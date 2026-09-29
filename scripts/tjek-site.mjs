// Kontrol af det byggede site (dist/) mod Blogger-eksporten. Kun læsning.
//   node scripts/tjek-site.mjs <eksportmappe>
// Tjekker:
//  1. Alle Bloggers adresser (178 indlæg + 15 sider) findes som fil med præcis samme sti
//  2. Teksten i hver artikel er den samme som i Blogger-kilden (ord for ord)
//  3. Alle interne links peger på noget, der findes (fil eller en af workerens adresser)
//  4. Alle billeder, siderne bruger, findes
//  5. Hver side har præcis én <title> og (undtagen 404) én canonical
//  6. Ingen rå Blogger-genvejskoder ({getButton} o.l.) står synligt på siderne
//  7. Alle strukturerede data (JSON-LD) kan læses som gyldig JSON
//  8. Ingen side afhænger af Bloggers videoafspiller (blogger.com/video.g), og
//     videoernes forsidebilleder (poster) findes
// Afslutter med kode 1, hvis noget fejler.
import fs from 'node:fs';
import path from 'node:path';
import { temaKoder, vandmaerke, RAA_KODE } from '../src/lib/temakoder.mjs';
import { SLETTEDE } from '../worker/slettede.js';

const EKS = process.argv[2];
const DIST = path.resolve('dist');
const laes = (f) => JSON.parse(fs.readFileSync(path.join(EKS, f), 'utf8'));
const alt = (p) => p.link.find((l) => l.rel === 'alternate').href;
const fejl = [];

// Tekst uden tags, scripts og ekstra mellemrum
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…' };
const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, k) => k[0] === '#'
    ? String.fromCodePoint(k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)) : (ENT[k] ?? m))
  .replace(/\s+/g, ' ')
  // Mellemrum før tegnsætning tæller ikke: et fjernet link ("<a>ord</a>.") gav ellers "ord ." før og "ord." efter
  // — samme ord, kun et mellemrum, som tag→mellemrum selv skaber (målt 27/9, 31 døde links rettet).
  .replace(/ ([.,;:!?)—])/g, '$1').trim();

// Bevidste rettelser 28/9-2026 (robot/ud/_ret-gennemgang.mjs): synlige billed-/link-instrukser
// "[IMAGE PLACEHOLDER: …]", gentagne afsnit og én overskrift. Kilden ændres på samme måde, så
// resten af teksten stadig skal være ord for ord ens — og findes en rettelse ikke, er det en fejl.
const RETTELSER = JSON.parse(fs.readFileSync(path.resolve('scripts/bevidste-rettelser.json'), 'utf8'));
const PLADS = /\[(?:FEATURED IMAGE PLACEHOLDER|IMAGE PLACEHOLDER|EXTERNAL LINK):[^\]]*\]/g;
function rettet(sti, k) {
  k = k.replace(PLADS, ' ');
  // Sitets navn er kun "Tech Media Arch" (Jacob 28/9): "TechMediaArcive", "Tech Media Archive" m.fl. er rettet
  // i indholdet (ikke inde i adresser, som ikke er en del af teksten her)
  k = k.replace(/Tech[\s_-]*Media[\s_-]*Arc[h]?[i]?[v]?e\b/gi, (m, pos, hel) => ('=/.@-_'.includes(hel[pos - 1] || '') ? m : 'Tech Media Arch'));
  // 29/9: også "TechMediaArch" skrevet i ét ord som navn (ikke domænet TechMediaArch.com, ikke i adresser)
  k = k.replace(/\bTechMediaArch\b(?![.\w]*\.com|\w)/g, (m, pos, hel) => ('=/.@-_#'.includes(hel[pos - 1] || '') ? m : 'Tech Media Arch'));
  for (const r of RETTELSER.filter((x) => x.sti === sti)) {
    if (r.type === 'fjern') {
      const x = tekst(r.html); const i = k.lastIndexOf(x);
      if (i < 0) { fejl.push(`RETTELSE findes ikke i kilden: ${sti}: ${x.slice(0, 50)}`); continue; }
      k = k.slice(0, i) + ' ' + k.slice(i + x.length);
    } else if (r.type === 'omdoeb') {
      if (!k.includes(r.fra)) { fejl.push(`RETTELSE findes ikke i kilden: ${sti}: ${r.fra}`); continue; }
      k = k.replace(r.fra, r.til);
    }
  }
  return k.replace(/\s+/g, ' ').replace(/ ([.,;:!?)—])/g, '$1').trim();
}

// Alle filer i dist
const filer = new Set();
(function gaa(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? gaa(p) : filer.add('/' + path.relative(DIST, p).split(path.sep).join('/')); } })(DIST);
const html = [...filer].filter((f) => f.endsWith('.html'));

// 1 + 2: Bloggers adresser og teksten
const posts = laes('posts.json').filter((p) => !SLETTEDE[decodeURI(alt(p).replace('https://www.techmediaarch.com', ''))]), pages = laes('pages.json');
// Slettede artikler (worker/slettede.js) må IKKE længere ligge som fil — ellers svarer de 200, ikke 301
for (const s of Object.keys(SLETTEDE)) if (filer.has(s)) fejl.push(`SLETTET artikel findes stadig: ${s}`);
for (const [s, til] of Object.entries(SLETTEDE)) if (!filer.has(til + '.html')) fejl.push(`SLETTET artikels mål findes ikke: ${s} -> ${til}`);
let tekstOk = 0;
for (const p of [...posts, ...pages]) {
  const sti = decodeURI(alt(p).replace('https://www.techmediaarch.com', ''));
  if (!filer.has(sti)) { fejl.push(`MANGLER adresse: ${sti}`); continue; }
  if (!posts.includes(p)) continue;
  const side = fs.readFileSync(path.join(DIST, sti), 'utf8');
  const m = side.match(/<article class="post-body"[^>]*>([\s\S]*?)<\/article>/);
  if (!m) { fejl.push(`INGEN brødtekst: ${sti}`); continue; }
  // Kilden minus det, konverteren bevidst fjerner (TOC-knap og feed-fodnote), og med
  // temaets genvejskoder og vandmærker vist som på Blogger ({getButton} blev til en knap)
  // Rå markdown-rester "[ord](adresse)" fra Blogger er bevidst rettet til almindelig tekst/link (28/9, 7 artikler)
  const kilde = rettet(sti, tekst(vandmaerke(temaKoder(p.content.$t.replace(/<div class=["']mbtTOC2["']>[\s\S]*?<div id=["']mbtTOC2["']><\/div>\s*<\/div>/gi, '')
    .replace(/<div class=["']blogger-post-footer["']>[\s\S]*?<\/div>\s*$/i, '')
    .replace(/\[((?:[^\[\]\n<]|<[^>]+>){2,300}?)\]\((https?:\/\/[^)\s"<>]+)\)/g, '$1')
    // og søgeords-rester med understregning i Fintech-artiklen ("fintech_banks" -> "fintech banks", 28/9)
    .replace(/\b([Ff]intech)_(companies|Companies|meaning|banks)\b/g, '$1 $2')))));
  const ny = tekst(m[1]
    // FAQ-boksens EKSTRA spørgsmål (frontmatter "faq:", lib/faqboks.mjs) findes ikke på Blogger og tælles ikke med;
    // artiklens egne FAQ-spørgsmål står i boksen med de samme ord og SKAL stadig være ens
    .replace(/<section class="faq-box" data-ekstra="1">[\s\S]*?<\/section>/g, ' ')
    .replace(/<details class="faq-item" data-ekstra="1">[\s\S]*?<\/details>/g, ' '));
  if (kilde === ny) tekstOk++;
  else {
    let i = 0; while (i < kilde.length && kilde[i] === ny[i]) i++;
    fejl.push(`TEKST afviger: ${sti} ved tegn ${i}: kilde «${kilde.slice(i, i + 50)}» / ny «${ny.slice(i, i + 50)}»`);
  }
}

// 3 + 4 + 5: links, billeder, title/canonical på alle sider
// Adresser workeren eller Cloudflare svarer på (security.txt serveres af Cloudflares egen funktion på zonen)
const WORKER = [/^\/$/, /^\/search\/label\//, /^\/search(\?|$)/, /^\/feeds\//, /^\/robots\.txt$/, /^\/\.well-known\/security\.txt$/];
// Links der allerede var døde på Blogger (scripts/kendte-doede-links.txt)
const KENDTE = new Set(fs.readFileSync(path.resolve('scripts/kendte-doede-links.txt'), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')));
const kendteFundet = new Set();
let links = 0, billeder = 0, ldJson = 0;
const faqSider = new Set();
const findes = (url) => {
  const ren = url.split('#')[0].split('?')[0];
  if (!ren) return true;
  let d; try { d = decodeURI(ren); } catch { d = ren; }
  // Adresser uden .html (29/9-2026): /2026/05/navn serveres fra navn.html
  return filer.has(d) || filer.has(d + '.html') || WORKER.some((r) => r.test(url)) || filer.has(d.replace(/\/$/, '') + '/index.html');
};
for (const f of html) {
  const s = fs.readFileSync(path.join(DIST, f), 'utf8');
  const titler = (s.match(/<title>/g) || []).length;
  const kanon = (s.match(/rel="canonical"/g) || []).length;
  if (titler !== 1) fejl.push(`${titler} <title>: ${f}`);
  if (kanon !== (f === '/404.html' ? 0 : 1)) fejl.push(`${kanon} canonical: ${f}`);
  // Adresser uden .html (Jacob 29/9-2026): ingen canonical, og-adresse, JSON-LD-adresse eller internt
  // link må pege på en .html-adresse på sitet (de ville give en 301-omvej)
  for (const [u] of s.matchAll(/(?:href|content)="(?:https:\/\/www\.techmediaarch\.com)?\/[^"]*?\.html(?:[?#][^"]*)?"/g)) fejl.push(`.HTML-adresse i ${f}: ${u}`);
  for (const [u] of s.matchAll(/href="(?:https:\/\/www\.techmediaarch\.com)?\/(?:\d{4}\/\d{2}|p|topic|page)\/[^"]+\/"/g)) fejl.push(`adresse med "/" til sidst i ${f}: ${u}`);
  for (const [u] of s.matchAll(/https:\/\/(?:www\.)?techmediaarch\.com\/[^"\s<>]*?\.html\b/g)) if (!/\/p\/contact\.html$/.test(u)) fejl.push(`.HTML-adresse (fuld) i ${f}: ${u}`);
  // Kun det læseren ser: <body> uden scripts (feed-data og JSON-LD er ikke synlige)
  const krop = tekst((s.match(/<body[\s\S]*<\/body>/) || [''])[0]);
  const raa = krop.match(RAA_KODE);
  if (raa) fejl.push(`RÅ genvejskode ${raa[0]} synlig på ${f}`);
  for (const [, j] of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldJson++; if (j.includes('"FAQPage"')) faqSider.add(f);
    try { JSON.parse(j); } catch { fejl.push(`UGYLDIG JSON-LD på ${f}`); }
  }
  for (const [, u] of s.matchAll(/\shref="(\/[^"]*)"/g)) {
    links++;
    if (findes(u.replace(/&amp;/g, '&'))) continue;
    const kort = u.startsWith('/share-widget') ? '/share-widget?w=poi' : u;
    if (KENDTE.has(kort)) { kendteFundet.add(kort); continue; }
    fejl.push(`DØDT link i ${f}: ${u}`);
  }
  if (/blogger\.com\/video\.g/.test(s)) fejl.push(`BLOGGER-video (virker kun, så længe Blogger findes) på ${f}`);
  for (const [, u] of s.matchAll(/\sposter="(\/[^"]*)"/g)) { billeder++; if (!findes(u)) fejl.push(`MANGLER videobillede i ${f}: ${u}`); }
  for (const [, u] of s.matchAll(/\ssrc="(\/[^"]*)"/g)) {
    billeder++;
    if (findes(u)) continue;
    if (u.startsWith('/share-widget') && KENDTE.has('/share-widget?w=poi')) { kendteFundet.add('/share-widget?w=poi'); continue; }
    fejl.push(`MANGLER fil i ${f}: ${u}`);
  }
}
// Adresser uden .html (29/9-2026) også i sitemap, RSS, llms.txt, søgeindeks og feed-data
for (const f of [...filer].filter((x) => /\.(xml|txt|json)$/.test(x))) {
  const s = fs.readFileSync(path.join(DIST, f), 'utf8');
  // Undtagelse: security.txt-sidens synlige tekst "Contact: …/p/contact.html" (Blogger-tekst, ikke et link)
  const n = (s.replace(/\/p\/contact\.html/g, '').match(/(?:techmediaarch\.com|["'(>\s])\/(?:\d{4}\/\d{2}|p|topic|page)\/[^"'<>)\s]*?\.html\b|\/(?:search|trending|index)\.html\b/g) || []).length;
  if (n) fejl.push(`.HTML-adresser i ${f}: ${n}`);
  // … og ingen sideadresse med "/" til sidst (Cloudflare ville sende den videre med 307)
  const skraa = (s.match(/techmediaarch\.com\/(?:\d{4}\/\d{2}|p|topic|page)\/[^"'<>)\s]+\/(?=["'<)\s])/g) || []).length;
  if (skraa) fejl.push(`adresser med "/" til sidst i ${f}: ${skraa}`);
}
const unik = [...new Set(fejl)];
console.log(`sider: ${html.length} · Blogger-adresser: ${posts.length + pages.length} · tekst ens: ${tekstOk} af ${posts.length}`);
console.log(`strukturerede data: ${ldJson} blokke · sider med FAQ-data: ${faqSider.size}`);
console.log(`interne links: ${links} · interne src: ${billeder} · kendte døde links fra Blogger: ${kendteFundet.size} af ${KENDTE.size} · fejl: ${unik.length}`);
const VIS = Number(process.env.VIS || 60);
unik.slice(0, VIS).forEach((f) => console.log('  ' + f));
if (unik.length > VIS) console.log(`  … og ${unik.length - VIS} til`);
process.exitCode = unik.length ? 1 : 0;
