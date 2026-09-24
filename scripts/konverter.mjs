// Konverterer Blogger-eksporten (posts.json, pages.json, billed-kort.json) til
// indholdsfiler for det nye Astro-site.
//
// Hvorfor HTML og ikke markdown: indlæggene er skrevet som HTML i Blogger, med
// tabeller, billedtekster, indlejrede videoer og JSON-LD. En omsætning til
// markdown ville ændre indholdet; vi flytter det i stedet ordret og retter kun
// det, der SKAL rettes for at virke uden for Blogger (se RETTELSER nedenfor).
//
// Brug:  node scripts/konverter.mjs <eksportmappe> [--kun=3] [--billeder]
//   --kun=N      kun de N første indlæg (til prøvebyg)
//   --ekstra=a|b tag også indlæg hvis adresse indeholder a eller b
//   --billeder   kopierer de brugte billeder fra <eksportmappe>/billeder til public/images
//
// Filnavnene bevarer Bloggers adresse præcis (også mellemrum og store bogstaver),
// fordi adressen er det Google kender. /2024/10/news corp takes aim.html bliver
// til src/content/posts/2024/10/news corp takes aim.md.
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { fileURLToPath } from 'node:url';

const EKSPORT = process.argv[2];
if (!EKSPORT) { console.error('Angiv eksportmappen'); process.exit(1); }
const KUN = Number((process.argv.find((a) => a.startsWith('--kun=')) || '').split('=')[1]) || 0;
const MED_BILLEDER = process.argv.includes('--billeder');
const ROD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.techmediaarch.com';

const laes = (f) => JSON.parse(fs.readFileSync(path.join(EKSPORT, f), 'utf8'));
const posts = laes('posts.json');
const pages = laes('pages.json');
const kort = laes('billed-kort.json'); // gammel billedadresse -> billeder/<fil>
const alternate = (p) => p.link.find((l) => l.rel === 'alternate').href;

// Standardbeskrivelsen Blogger bruger, når et indlæg ikke har sin egen
const STANDARD_BESKRIVELSE = 'Tech and AI blog with news, trends, and easy guides';

const brugteBilleder = new Set();
const advarsler = [];

function billedSti(url) {
  const ren = url.replace(/&amp;/g, '&');
  const fil = kort[ren] || kort[ren.startsWith('//') ? 'https:' + ren : ren];
  if (!fil) return null;
  brugteBilleder.add(fil);
  return '/images/' + path.basename(fil);
}

// ---- RETTELSER af indholdet (det eneste der ændres) ----
function retHtml(html, kilde) {
  let h = html;

  // 1) Billeder peger på vores egne kopier. Originalerne ligger hos Blogger og hos
  //    en fremmed tjeneste (contenu.nyc3...), som kan forsvinde uden varsel.
  h = h.replace(/(\s(?:src|href|data-src)\s*=\s*)(["'])([^"']+)\2/gi, (m, attr, q, url) => {
    if (!/googleusercontent|bp\.blogspot|digitaloceanspaces|unsplash/i.test(url)) return m;
    const ny = billedSti(url);
    if (!ny) { advarsler.push(`${kilde}: billede uden lokal kopi: ${url.slice(0, 90)}`); return m; }
    return attr + q + ny + q;
  });
  h = h.replace(/\ssrcset\s*=\s*(["'])([^"']+)\1/gi, (m, q, liste) => {
    const nye = liste.split(',').map((d) => {
      const [url, ...rest] = d.trim().split(/\s+/);
      return [billedSti(url) || url, ...rest].join(' ');
    });
    return ` srcset=${q}${nye.join(', ')}${q}`;
  });

  // 2) Interne links bliver relative, så de virker på både testadressen og det rigtige domæne.
  h = h.replace(/(href\s*=\s*["'])https?:\/\/(?:www\.)?techmediaarch\.(?:com|blogspot\.com)(\/[^"']*)/gi, '$1$2');

  // 3) Bloggers indholdsfortegnelse (mbtTOC2) byggede sig selv med temaets script,
  //    som ikke findes på det nye site. Skabelonen laver i stedet en rigtig
  //    indholdsfortegnelse ud fra overskrifterne, så pladsholder og kald fjernes.
  //    Findes i to udgaver: tom pladsholder, og pladsholder med "Contents [hide]"-knap.
  h = h.replace(/<div class=["']mbtTOC2["']>[\s\S]*?<div id=["']mbtTOC2["']><\/div>\s*<\/div>/gi, '');
  h = h.replace(/<script>\s*mbtTOC2\(\);\s*<\/script>/gi, '');

  // 4) Bloggers feed-fodnote (affiliate-oplysningen) sættes af skabelonen på
  //    alle artikler i stedet for at stå i hver enkelt fil.
  h = h.replace(/<div class=["']blogger-post-footer["']>[\s\S]*?<\/div>\s*$/i, '');

  return h.trim();
}

// Første afsnit som beskrivelse, hvis Blogger ikke havde en egen søgebeskrivelse
function tekstUdsnit(html, max = 155) {
  const p = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || html;
  const tekst = p.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ').trim();
  if (tekst.length <= max) return tekst;
  return tekst.slice(0, max).replace(/\s+\S*$/, '').replace(/[.,;:!?—-]+$/, '') + '…';
}

// Bloggers egen metabeskrivelse, læst fra den gemte side (sider/…html), hvis den findes
function gemtBeskrivelse(url) {
  const fil = path.join(EKSPORT, 'sider', url.replace(SITE + '/', '').replace(/\//g, '__') + '.html');
  if (!fs.existsSync(fil)) return null;
  const m = fs.readFileSync(fil, 'utf8').match(/<meta\s+content=['"]([^'"]*)['"]\s+name=['"]description['"]|<meta\s+name=['"]description['"]\s+content=['"]([^'"]*)['"]/i);
  const d = m && (m[1] || m[2]);
  if (!d || d.startsWith(STANDARD_BESKRIVELSE)) return null;
  return d.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function foersteBillede(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function skrivFil(fil, data, body) {
  fs.mkdirSync(path.dirname(fil), { recursive: true });
  fs.writeFileSync(fil, '---\n' + stringify(data, { lineWidth: 0 }) + '---\n' + body + '\n', 'utf8');
}

// ---- Indlæg ----
// --ekstra=tekst1|tekst2 tager desuden de indlæg med, hvis adresse indeholder teksten
const EKSTRA = ((process.argv.find((a) => a.startsWith('--ekstra=')) || '').split('=')[1] || '').split('|').filter(Boolean);
const udvalgte = KUN
  ? posts.filter((p, i) => i < KUN || EKSTRA.some((e) => alternate(p).includes(e)))
  : posts;
let antal = 0;
for (const p of udvalgte) {
  const url = alternate(p);
  const m = url.match(/^https:\/\/www\.techmediaarch\.com\/(\d{4})\/(\d{2})\/(.+)\.html$/);
  if (!m) { advarsler.push('uventet adresse: ' + url); continue; }
  const [, aar, maaned, navn] = m;
  const kilde = `${aar}/${maaned}/${navn}`;
  const raa = p.content.$t;
  const body = retHtml(raa, kilde);
  const billede = foersteBillede(body);
  const data = {
    title: p.title.$t.trim(),
    description: gemtBeskrivelse(url) || tekstUdsnit(body),
    published: p.published.$t,
    updated: p.updated.$t,
    labels: (p.category || []).map((c) => c.term),
    image: billede && billede.startsWith('/images/') ? billede : null,
    bloggerId: p.id.$t.split('post-').pop(),
    hadToc: /mbtTOC2/.test(raa),
  };
  skrivFil(path.join(ROD, 'src/content/posts', aar, maaned, navn + '.md'), data, body);
  antal++;
}

// ---- Faste sider (/p/…html) ----
let antalSider = 0;
for (const p of pages) {
  const url = alternate(p);
  const m = url.match(/^https:\/\/www\.techmediaarch\.com\/p\/(.+)\.html$/);
  if (!m) { advarsler.push('uventet sideadresse: ' + url); continue; }
  const navn = m[1];
  const body = retHtml(p.content.$t, 'p/' + navn);
  const data = {
    title: p.title.$t.trim(),
    description: gemtBeskrivelse(url) || tekstUdsnit(body),
    published: p.published.$t,
    updated: p.updated.$t,
    bloggerId: p.id.$t.split('page-').pop(),
  };
  skrivFil(path.join(ROD, 'src/content/pages', navn + '.md'), data, body);
  antalSider++;
}

// ---- Billeder ----
if (MED_BILLEDER) {
  fs.mkdirSync(path.join(ROD, 'public/images'), { recursive: true });
  for (const fil of brugteBilleder) {
    fs.copyFileSync(path.join(EKSPORT, fil), path.join(ROD, 'public/images', path.basename(fil)));
  }
}

console.log(`indlæg skrevet: ${antal} af ${udvalgte.length}, sider: ${antalSider} af ${pages.length}, billeder brugt: ${brugteBilleder.size}${MED_BILLEDER ? ' (kopieret)' : ''}`);
fs.writeFileSync(path.join(ROD, 'scripts/billeder-brugt.json'), JSON.stringify([...brugteBilleder].sort(), null, 1));
if (advarsler.length) { console.log(`advarsler (${advarsler.length}):`); advarsler.slice(0, 40).forEach((a) => console.log('  ' + a)); }
