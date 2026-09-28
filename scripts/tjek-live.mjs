// Kontrol af et udlagt site (test-adressen eller det rigtige domæne). Kun læsning.
//   node scripts/tjek-live.mjs <adresse> <eksportmappe>
//   fx node scripts/tjek-live.mjs https://techmediaarch.jacobolsenjso.workers.dev C:\Users\jacob\techmediaarch-eksport
// Tjekker:
//  1. Alle Bloggers adresser (178 indlæg + 15 sider) svarer 200 med HTML
//  2. Test-adressen er lukket for Google: robots.txt = "Disallow: /" og
//     X-Robots-Tag: noindex på både sider, billeder og workerens egne svar.
//     (På www.techmediaarch.com er det omvendt: åben robots.txt og ingen noindex.)
//  3. Bloggers gamle adresser omdirigeres (etiket, søgning, feed, arkiv), ukendt = 404
//  4. Bloggers JSON-feeds (Watch- og Sitemap-siden bruger dem) svarer med data
//  5. Videoen kan hentes i stykker (206 — Safari kræver det)
//  6. (kun rigtigt domæne) techmediaarch.com uden www sendes til www med sti og søgedel
// Afslutter med kode 1, hvis noget fejler.
import fs from 'node:fs';
import path from 'node:path';
import { SLETTEDE } from '../worker/slettede.js';

const BASE = (process.argv[2] || '').replace(/\/$/, '');
const EKS = process.argv[3];
if (!BASE || !EKS) { console.error('Brug: node scripts/tjek-live.mjs <adresse> <eksportmappe>'); process.exit(2); }
const PROD = new URL(BASE).host === 'www.techmediaarch.com';
const fejl = [];
const hent = (sti, opt = {}) => fetch(BASE + sti, { redirect: 'manual', ...opt });

// Bloggers adresser, kodet som browseren sender dem
const laes = (f) => JSON.parse(fs.readFileSync(path.join(EKS, f), 'utf8'));
const alt = (p) => p.link.find((l) => l.rel === 'alternate').href;
const stier = [...laes('posts.json'), ...laes('pages.json')].map((p) => new URL(alt(p)).pathname)
  // Slettede artikler svarer 301 (tjekkes under 3), ikke 200
  .filter((s) => !SLETTEDE[decodeURI(s)]);

// 1: alle adresser, 8 ad gangen
let ok = 0, noindex = 0;
for (let i = 0; i < stier.length; i += 8) {
  await Promise.all(stier.slice(i, i + 8).map(async (s) => {
    try {
      const r = await hent(s);
      const type = r.headers.get('content-type') || '';
      if (r.status === 200 && type.includes('text/html')) ok++;
      else fejl.push(`${r.status} ${type}: ${s}`);
      if ((r.headers.get('x-robots-tag') || '').includes('noindex')) noindex++;
      await r.arrayBuffer();
    } catch (e) { fejl.push(`FEJL ${s}: ${e.message}`); }
  }));
}
console.log(`Blogger-adresser: ${ok} af ${stier.length} svarer 200 · med noindex: ${noindex}`);
if (!PROD && noindex !== stier.length) fejl.push(`noindex mangler på ${stier.length - noindex} sider`);
if (PROD && noindex) fejl.push(`noindex på ${noindex} sider på det RIGTIGE domæne`);

// 2: robots.txt, forside, billede, workerens svar
const robots = await (await hent('/robots.txt')).text();
const lukket = /Disallow:\s*\/\s*$/m.test(robots) && !/Allow:\s*\//.test(robots);
console.log(`robots.txt: ${lukket ? 'lukket (Disallow: /)' : 'åben'}`);
if (PROD === lukket) fejl.push(`robots.txt er ${lukket ? 'lukket' : 'åben'} — forkert for ${PROD ? 'det rigtige domæne' : 'test-adressen'}`);
for (const s of ['/', '/images/15d326138cfb576f.png', '/rss.xml', '/findes-ikke-123.html']) {
  const r = await hent(s); await r.arrayBuffer();
  const ni = (r.headers.get('x-robots-tag') || '').includes('noindex');
  console.log(`${s}: ${r.status}${ni ? ' · noindex' : ''}`);
  if (!PROD && !ni) fejl.push(`noindex mangler: ${s}`);
}

// 3: omdirigeringer og 404
const forventet = [
  ['/search/label/AI', 301, '/topic/ai.html'],
  ['/search?q=claude', 301, '/search.html?q=claude'],
  ['/search', 301, '/trending.html'],
  ['/search/label/Resources', 301, '/topic/resources.html'],
  ['/feeds/posts/default', 301, '/rss.xml'],
  ['/2024/10/', 301, '/'],
  ['/findes-ikke-123.html', 404, null],
  // Slettede artikler (worker/slettede.js) -> 301 til nærmeste levende artikel
  ...Object.entries(SLETTEDE).map(([s, til]) => [s, 301, til]),
];
for (const [s, status, til] of forventet) {
  const r = await hent(s); await r.arrayBuffer();
  const loc = r.headers.get('location') ? new URL(r.headers.get('location'), BASE).pathname + new URL(r.headers.get('location'), BASE).search : null;
  const godt = r.status === status && (til === null || loc === til);
  console.log(`${s} -> ${r.status}${loc ? ' ' + loc : ''}${godt ? '' : '  <-- FORKERT'}`);
  if (!godt) fejl.push(`${s}: ventede ${status} ${til || ''}, fik ${r.status} ${loc || ''}`);
}

// 4: Bloggers JSON-feeds
for (const s of ['/feeds/posts/default/-/Video?alt=json&max-results=5', '/feeds/posts/summary?alt=json&max-results=5', '/feeds/pages/default?alt=json']) {
  const r = await hent(s);
  let n = -1; try { n = ((await r.json()).feed.entry || []).length; } catch {}
  console.log(`${s}: ${r.status} · ${n} poster`);
  if (r.status !== 200 || n < 1) fejl.push(`feed svarer ikke med data: ${s}`);
}

// 5: video i stykker
{
  const r = await hent('/video/tubemagic.mp4', { headers: { Range: 'bytes=0-1' } });
  const n = (await r.arrayBuffer()).byteLength;
  const cr = r.headers.get('content-range') || '';
  console.log(`/video/tubemagic.mp4 Range 0-1: ${r.status} · ${n} bytes · ${cr}`);
  if (r.status !== 206 || n !== 2 || !/^bytes 0-1\/\d+$/.test(cr)) fejl.push('video sendes ikke i stykker (206) — Safari kan ikke afspille den');
}

// 6: domænet uden www (Cloudflare Redirect Rule)
if (PROD) {
  const r = await fetch('https://techmediaarch.com/2024/09/faq.html?x=1', { redirect: 'manual' }); await r.arrayBuffer();
  const loc = r.headers.get('location');
  console.log(`techmediaarch.com/2024/09/faq.html?x=1 -> ${r.status} ${loc}`);
  if (r.status !== 301 || loc !== 'https://www.techmediaarch.com/2024/09/faq.html?x=1') fejl.push(`uden www: ventede 301 til www, fik ${r.status} ${loc}`);
}

console.log(`fejl: ${fejl.length}`);
fejl.slice(0, 40).forEach((f) => console.log('  ' + f));
process.exitCode = fejl.length ? 1 : 0;
