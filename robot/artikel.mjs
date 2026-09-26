// TRIN 2 — skriver ÉN prøveartikel ud fra en søgeordspakke (1 hoved + 5 beslægtede).
// Kører på GitHub (workflowet "Robot (manuel)", opgave "proeveartikel"), som
// gemmer resultatet på en egen gren (udkast-…) — ALDRIG på main. Intet udgives,
// før Jacob har godkendt artiklen.
//
// Trin:
//  1. Søgeordslisten laves (robot/soegeord.mjs) og Gemini vælger en pakke, der
//     er et fornuftigt, varigt emne (ikke nyheder, priser, sludder).
//  2. Gemini skriver artiklen MED Google-søgning. Uden mindst 2 kontrollerede
//     kilder afvises artiklen (Gemini søger ellers ikke altid — målt 26/9).
//  3. Interne links: 3-5 til eksisterende artikler (kun adresser, der findes).
//  4. To billeder, lavet med både Cloudflare og Gemini til sammenligning.
//  5. Video i ca. 60 % af artiklerne (fast ud fra adressen), kun hvis Gemini
//     finder en video relevant. Artikler med video får etiketten "Video" (Watch-siden).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { skriv, json } from './lib/gemini.mjs';
import { begge } from './lib/billeder.mjs';
import { kontrollerKilder, kildeliste } from './lib/links.mjs';
import { artikler, sti } from './lib/arkiv.mjs';
import { lavIndeks, mestEns } from './lib/dubletter.mjs';

const arg = (navn) => { const i = process.argv.indexOf(`--${navn}`); return i > 0 ? (process.argv[i + 1] || '') : ''; };
const EMNE = arg('emne');
const HOVED = arg('hoved').trim().toLowerCase();
const rapport = [];
const log = (t) => { rapport.push(t); console.log(t); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kodet = (s) => s.split('/').map(encodeURIComponent).join('/');

// --- 1. Vælg pakke -----------------------------------------------------------
// --brug-liste: genbrug robot/ud/soegeord-liste.json (kun til afprøvning uden net)
if (!process.argv.includes('--brug-liste')) execFileSync('node', ['robot/soegeord.mjs', '--pakker', '5', ...(EMNE ? ['--emne', EMNE] : [])], { cwd: sti(), stdio: ['ignore', 'ignore', 'inherit'] });
const liste = JSON.parse(fs.readFileSync(sti('robot/ud/soegeord-liste.json'), 'utf8'));
const alle = Object.entries(liste.resultat).flatMap(([emne, r]) => r.pakker.map((p) => ({ ...p, emne })));
let kandidater = HOVED ? alle.filter((p) => p.hoved === HOVED) : alle;
if (!kandidater.length) throw new Error(HOVED ? `Hovedsøgeordet "${HOVED}" findes ikke i dagens liste` : 'Ingen pakker i listen');
// Tyndeste emne først (listen er allerede sorteret sådan); Gemini vurderer de 8 første.
const vurdering = await json(`You pick topics for evergreen explainer articles on a tech blog (techmediaarch.com).
For each numbered keyword, answer whether it is a sensible, evergreen article topic in correct English: not news of the day, not prices/stock moves, not local/legal advice, not a product accessory, not nonsense.
Return JSON: {"ok":[numbers of acceptable keywords, best first]}
${kandidater.slice(0, 8).map((p, i) => `${i + 1}. ${p.hoved}`).join('\n')}`);
const valgt = kandidater[(vurdering.ok?.[0] || 0) - 1];
if (!valgt) throw new Error('Gemini godkendte ingen af pakkerne');
log(`# Prøveartikel\n\n**Emne:** ${valgt.emne}  \n**Hovedsøgeord:** ${valgt.hoved}  \n**Beslægtede:** ${valgt.beslaegtede.join(' · ')}`);

// --- 2. Interne link-kandidater ---------------------------------------------
const arkiv = artikler();
const indeks = lavIndeks(arkiv.filter((a) => a.sti.startsWith('/20')));
const linkKand = [];
for (const q of [valgt.hoved, ...valgt.beslaegtede]) for (const m of mestEns(q, indeks, 6)) if (!linkKand.some((k) => k.sti === m.sti)) linkKand.push(m);
const titelAf = (s) => arkiv.find((a) => a.sti === s)?.titel || s;
const interne = linkKand.slice(0, 8).map((m) => ({ href: kodet(m.sti), titel: titelAf(m.sti) }));

// --- 3. Skriv artiklen med Google-søgning -----------------------------------
const opgave = `Write an in-depth, genuinely helpful English article for techmediaarch.com.
Main keyword: "${valgt.hoved}"
Related keywords (cover each naturally, once or twice): ${valgt.beslaegtede.map((k) => `"${k}"`).join(', ')}

Use Google Search to check facts. Rules:
- 1400-1900 words. Plain, clear language for curious non-experts.
- Answer the main keyword directly in the first paragraph.
- Structure with <h2> and <h3>; include one short FAQ section (<h2>FAQ</h2> with <h3> questions) built from the related keywords.
- Never claim personal testing or experience ("I tested", "in my experience", "we tried"). No invented statistics, quotes or dates; only state numbers you verified.
- Link to 3-5 of these existing articles where relevant, using the exact href and a natural anchor text:
${interne.map((l) => `  ${l.href}  (${l.titel})`).join('\n') || '  (none)'}
- No other links. No images. No markdown.
Output ONLY the article body as HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>). No <html>, no title, no code fences.`;
let tekst, kilder;
for (let forsoeg = 1; forsoeg <= 2; forsoeg++) {
  ({ tekst, kilder } = await skriv(opgave, { soeg: true }));
  if (kilder.length >= 2) break;
  log(`- Forsøg ${forsoeg}: Gemini brugte ${kilder.length} kilder — prøver igen.`);
}
if (kilder.length < 2) throw new Error(`Gemini brugte kun ${kilder.length} kilder — artiklen afvist`);
let html = tekst.replace(/^```html?\s*|```\s*$/g, '').trim();

// Fjern alle links, der ikke er et af de tilladte interne (Gemini må ikke selv finde på links).
const tilladt = new Set(interne.map((l) => l.href));
html = html.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (hel, href, indre) => (tilladt.has(href) ? `<a href="${href}">${indre}</a>` : indre));
const brugteInterne = [...new Set([...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]))];
if (brugteInterne.length < 3) {
  const flere = interne.filter((l) => !brugteInterne.includes(l.href)).slice(0, 3 - brugteInterne.length);
  if (flere.length) html += `<h2>Related reading</h2><ul>${flere.map((l) => `<li><a href="${l.href}">${esc(l.titel)}</a></li>`).join('')}</ul>`;
}
const antalInterne = [...new Set([...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]))].length;

// Første-persons-påstande er forbudt — stop hellere end at udgive dem.
const forbudt = html.match(/\b(I tested|I tried|in my experience|we tested|we tried|I've used|I have used)\b/i);
if (forbudt) throw new Error(`Artiklen indeholder en førstepersons-påstand: "${forbudt[0]}"`);

// Kilder: følg Googles omdirigering, kontrollér live, højst 4, ét pr. domæne.
const { sat: kildeLinks, afvist: kildeAfvist } = await kontrollerKilder(kilder, 4);
if (kildeLinks.length < 2) throw new Error(`Kun ${kildeLinks.length} kilder bestod kontrollen — artiklen afvist`);

// --- 4. Titel, beskrivelse, billedtekster -----------------------------------
const meta = await json(`Article about "${valgt.hoved}". First 1500 characters:
${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)}

Return JSON with:
"title": 50-65 characters, contains the main keyword or a close natural variant, no clickbait, no year,
"description": 140-160 characters, plain and specific,
"slug": 3-6 lowercase words joined by hyphens,
"image1": a prompt for a clean, modern editorial illustration for the top of the article (no text, no logos, no real people),
"image2": a different prompt for an illustration further down (no text, no logos, no real people),
"alt1": short alt text for image 1, "alt2": short alt text for image 2`);
const titel = String(meta.title).trim();
const slug = String(meta.slug || titel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// --- 5. Billeder (begge motorer) --------------------------------------------
const b1 = await begge(meta.image1);
const b2 = await begge(meta.image2);
const valgBillede = (b) => (b.cf?.fil ? b.cf : b.gm);
const hero = valgBillede(b1); const mid = valgBillede(b2);
if (!hero?.fil || !mid?.fil) throw new Error('Mindst ét af billederne kunne ikke laves');
const figur = (b, alt) => `<table align="center" cellpadding="0" cellspacing="0" class="tr-caption-container" style="margin-left: auto; margin-right: auto;"><tbody><tr><td style="text-align: center;"><img alt="${esc(alt)}" height="768" src="${b.fil}" width="1366" loading="lazy" /></td></tr><tr><td class="tr-caption" style="text-align: center;">${esc(alt)}</td></tr></tbody></table>`;

// Billede 1 efter første afsnit, billede 2 før overskriften nærmest 60 % inde.
html = html.replace(/<\/p>/i, `</p>${figur(hero, meta.alt1)}`);
const h2er = [...html.matchAll(/<h2\b/gi)].map((m) => m.index);
const midt = h2er.filter((i) => i > html.length * 0.45)[0];
if (midt) html = html.slice(0, midt) + figur(mid, meta.alt2) + html.slice(midt);

// --- 6. Video (ca. 60 %, fast ud fra adressen) ------------------------------
const hash = parseInt(crypto.createHash('sha256').update(slug).digest('hex').slice(0, 8), 16);
let video = null;
if (hash % 10 < 6) {
  const y = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=en&videoDuration=medium&maxResults=8&q=${encodeURIComponent(valgt.hoved)}&key=${process.env.YOUTUBE_API_KEY}`).then((r) => r.json()).catch(() => ({}));
  const vid = (y.items || []).map((v) => ({ id: v.id.videoId, titel: v.snippet.title, kanal: v.snippet.channelTitle, beskrivelse: v.snippet.description }));
  if (vid.length) {
    const d = await json(`Article topic: "${valgt.hoved}". Which video (if any) genuinely explains this topic well for a reader of the article? Reject ads, music, reactions, unrelated or clickbait videos.
Return JSON {"choice": number or 0 for none}
${vid.map((v, i) => `${i + 1}. ${v.titel} — ${v.kanal} — ${v.beskrivelse.slice(0, 120)}`).join('\n')}`);
    video = vid[(d.choice || 0) - 1] || null;
  }
  log(video ? `- Video: "${video.titel}" (${video.kanal})` : '- Video: skulle have video (60 %), men Gemini fandt ingen relevant');
} else log('- Video: denne artikel er blandt de ca. 40 % uden video');
if (video) {
  const iframe = `<div style="text-align:center;"><iframe allowfullscreen="true" height="360" src="https://www.youtube.com/embed/${video.id}?rel=0" width="640"></iframe></div>`;
  const efter = [...html.matchAll(/<h2\b/gi)].map((m) => m.index).filter((i) => i > html.length * 0.3)[0];
  html = efter ? html.slice(0, efter) + iframe + html.slice(efter) : html + iframe;
}

html += kildeliste(kildeLinks);

const ord = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
if (ord < 1000) throw new Error(`Artiklen er kun ${ord} ord — afvist (mindst 1000)`);

// --- 7. Gem artiklen --------------------------------------------------------
const nu = new Date();
const aar = String(nu.getUTCFullYear()); const md = String(nu.getUTCMonth() + 1).padStart(2, '0');
let navn = slug; let n = 2;
while (fs.existsSync(sti(`src/content/posts/${aar}/${md}/${navn}.md`))) navn = `${slug}-${n++}`;
fs.mkdirSync(sti(`src/content/posts/${aar}/${md}`), { recursive: true });
const labels = [valgt.emne, ...(video ? ['Video'] : [])];
const yamlStr = (s) => JSON.stringify(String(s));
const fm = ['---', `title: ${yamlStr(titel)}`, `description: ${yamlStr(meta.description)}`, `published: ${nu.toISOString()}`, `updated: ${nu.toISOString()}`,
  'labels:', ...labels.map((l) => `  - ${l}`), `image: ${hero.fil}`, `keyword: ${yamlStr(valgt.hoved)}`, 'relatedKeywords:', ...valgt.beslaegtede.map((k) => `  - ${yamlStr(k)}`), 'robot: true', '---'].join('\n');
fs.writeFileSync(sti(`src/content/posts/${aar}/${md}/${navn}.md`), `${fm}\n${html}\n`);

log(`\n**Titel:** ${titel}  \n**Adresse:** /${aar}/${md}/${navn}.html  \n**Ord:** ${ord} · **Interne links:** ${antalInterne} · **Kilder:** ${kildeLinks.length} (afvist ${kildeAfvist.length}) · **Video:** ${video ? 'ja' : 'nej'}`);
log(`\n**Billeder:** 1: Cloudflare ${b1.cf?.fil || 'FEJL ' + b1.cf?.fejl} · Gemini ${b1.gm?.fil || 'FEJL ' + b1.gm?.fejl}  \n2: Cloudflare ${b2.cf?.fil || 'FEJL ' + b2.cf?.fejl} · Gemini ${b2.gm?.fil || 'FEJL ' + b2.gm?.fejl}`);
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/proeveartikel.json'), JSON.stringify({ valgt, titel, sti: `/${aar}/${md}/${navn}.html`, ord, antalInterne, kildeLinks, kildeAfvist, video, billeder: { b1, b2 } }, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.join('\n') + '\n');
