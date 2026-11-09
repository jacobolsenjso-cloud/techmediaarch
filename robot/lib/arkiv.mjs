// Det, robotten skal kende til, før den foreslår et nyt søgeord:
// alle eksisterende artikler og sider, deres overskrifter, emner og gemte
// søgeord, samt listerne over brugte og prøvede søgeord.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { HYLDE_FOR_EMNE, EKSTRA_ETIKETTER } from '../../src/lib/adresse.mjs';
import { planHylde, erSvar } from '../../src/lib/hyldeplan.mjs';

const ROD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const sti = (...d) => path.join(ROD, ...d);

// Emnerne, læst direkte fra src/lib/emner.ts, så robotten og sitet aldrig er uenige om navnene.
// Trin 7 i svar-arkivet (Jacob 29/10-2026): robotten skriver KUN til de 5 hylder. Et emne er med i rotationen,
// når det hører til en hylde (HYLDE_FOR_EMNE i src/lib/adresse.mjs, samme tabel som sitet) — Fintech, Crypto,
// Web3, Vlog og Resources er derfor ude.
// "etiket" er navnet, der står i artiklernes labels (IT hedder "It" der); robotten bruger etiketten overalt,
// også som nøgle i robot/froe.json, så en ny artikel havner på den rigtige hylde.
export function emner() {
  const ts = fs.readFileSync(sti('src/lib/emner.ts'), 'utf8');
  const felt = (obj, navn) => (obj.match(new RegExp(`\\b${navn}:\\s*'([^']+)'`)) || [])[1];
  return [...ts.matchAll(/\{\s*navn:[^}]*\}/g)].map(([obj]) => ({ navn: felt(obj, 'navn'), slug: felt(obj, 'slug'), etiket: felt(obj, 'etiket') }))
    .map((e) => ({ ...e, etiket: e.etiket || e.navn, hylde: HYLDE_FOR_EMNE[e.slug] || null }))
    .filter((e) => e.navn && e.hylde);
}

// Antal SVAR pr. hylde — samme regel som sitet (src/lib/hylder.ts, svarIHylde). Skridt 3 (Jacob 29/10-2026): kun
// robotsvar og tidløse ældre artikler tæller (src/lib/hyldeplan.mjs); ellers ville ~90 gamle AI-nyheder få robotten
// til at tro, at AI-hylden er fuld. Ældre artikler: planens hylde. Robotartikler: emnets hylde + de ekstra etiketter
// ("Cyber Security"); en robotartikel med emner fra to hylder tæller på begge.
export function antalPrHylde(alle = artikler()) {
  const tilHylde = new Map(emner().map((e) => [e.etiket, e.hylde]));
  const ud = Object.fromEntries([...new Set(Object.values(HYLDE_FOR_EMNE))].map((h) => [h, 0]));
  for (const a of alle) {
    if (!erSvar(a.sti, a.robot)) continue;
    const plan = planHylde(a.sti);
    const hylder = plan !== undefined ? (plan ? [plan] : []) : new Set(a.labels.map((l) => tilHylde.get(l) || EKSTRA_ETIKETTER[l]).filter(Boolean));
    for (const h of hylder) ud[h]++;
  }
  return ud;
}

function frontmatter(fil) {
  const raa = fs.readFileSync(fil, 'utf8');
  const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? (parse(m[1]) || {}) : {};
}

// Afsnitsoverskrifter (h2/h3) i brødteksten — det, artiklen faktisk dækker (Jacob 9/11-2026, rettelse 1).
// Målt 9/11: "How Does Generative AI Affect the Environment?" havde et helt afsnit "Water Consumption in AI
// Cooling Systems" (26 gange "water"), men dubletkontrollen kendte kun titel og søgeord, så robotten skrev to dage
// efter "Why Does Generative AI Consume So Much Water?" — næsten samme artikel. FAQ og kildelisten tæller ikke
// (korte svar), og heller ikke generiske overskrifter som "Conclusion".
const GENERISK = /^(faq|frequently asked questions|sources|references|key takeaways|conclusion|introduction|summary|final thoughts|the bottom line|bottom line|overview|what('| i)s next|wrapping up)\b/i;
// Ren tekst af en overskrift (kun til sammenligning — vises aldrig som HTML). Rettet 9/11-2026 efter CodeQL #29/#30:
// mærker fjernes, til der ikke er flere (så "<scr<b>ipt>" ikke efterlader "<script>"), og entiteter afkodes i ÉN omgang
// (ellers blev "&amp;#39;" først til "&#39;" og så til "'").
const ENTITETER = { '&amp;': '&', '&#39;': "'", '&rsquo;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export function renTekst(s) {
  let t = String(s), foer;
  do { foer = t; t = t.replace(/<[^<>]*>/g, ''); } while (t !== foer);
  return t.replace(/[<>]/g, '').replace(/&(?:amp|#39|rsquo|quot|lt|gt|nbsp);/g, (e) => ENTITETER[e]).replace(/\s+/g, ' ').trim();
}
export function overskrifter(fil) {
  let krop = '';
  try { krop = fs.readFileSync(fil, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---/, ''); } catch { return []; }
  const stop = krop.search(/<h2[^>]*>\s*(FAQ|Frequently Asked Questions|Sources)\s*<\/h2>|\n##\s+(FAQ|Frequently Asked Questions|Sources)\b/i);
  if (stop > 0) krop = krop.slice(0, stop);
  const ud = [];
  for (const m of krop.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>|^#{2,3}\s+(.+)$/gim)) {
    const t = renTekst(String(m[1] ?? m[2] ?? ''));
    if (t && t.length >= 8 && !GENERISK.test(t)) ud.push(t);
  }
  return [...new Set(ud)];
}

// Alle artikler (og sider) som [{ titel, sti, labels, soegeord: [..], overskrifter: [..], dato }].
// "soegeord" er hovedsøgeordet + de 5 beslægtede for artikler, robotten har
// skrevet; de gamle Blogger-artikler har kun overskriften.
export function artikler() {
  const ud = [];
  const posts = sti('src/content/posts');
  for (const aar of fs.readdirSync(posts)) for (const md of fs.readdirSync(path.join(posts, aar))) {
    const mappe = path.join(posts, aar, md);
    for (const f of fs.readdirSync(mappe).filter((x) => x.endsWith('.md'))) {
      const d = frontmatter(path.join(mappe, f));
      ud.push({
        // Adresser uden .html (Jacob 29/9-2026) — samme som sitet (src/lib/adresse.mjs)
        titel: String(d.title || ''), sti: `/${aar}/${md}/${f.replace(/\.md$/, '')}`, labels: d.labels || [], robot: d.robot === true,
        soegeord: [d.keyword, ...(d.relatedKeywords || [])].filter(Boolean).map(String),
        overskrifter: overskrifter(path.join(mappe, f)),
        dato: String(d.published || ''),
      });
    }
  }
  const sider = sti('src/content/pages');
  for (const f of fs.readdirSync(sider).filter((x) => x.endsWith('.md'))) {
    const d = frontmatter(path.join(sider, f));
    ud.push({ titel: String(d.title || ''), sti: `/p/${f.replace(/\.md$/, '')}`, labels: [], soegeord: [] });
  }
  return ud;
}

// Antal artikler pr. emne (et emne = en label med emnets etiket).
export function antalPrEmne(alle = artikler()) {
  return Object.fromEntries(emner().map((e) => [e.etiket, alle.filter((a) => a.labels.includes(e.etiket)).length]));
}

const laesJson = (f, tom) => { try { return JSON.parse(fs.readFileSync(sti(f), 'utf8')); } catch { return tom; } };
// Opskriftens version (31/10-2026): skrives i frontmatter som "opskrift: N" på nye og omskrevne artikler. Et punkt i
// omskriv-køen med "igen": true skrives om igen, hvis artiklen er lavet med en ældre opskrift. Hæv tallet, når
// opskriften bliver markant bedre, og ældre robotartikler skal kunne laves om.
// 2 = naturligt sprog, Key takeaways, 3 billeder, forældet-vagt, ingen løst beslægtede links.
export const OPSKRIFT = 2;
export const BRUGTE = 'robot/data/brugte-soegeord.json';   // [{ q, emne, dato, artikel }] — skrevet ind, når en artikel er udgivet
export const PROEVEDE = 'robot/data/proevede-soegeord.json'; // [{ q, emne, dato, grund }] — prøvet uden held; hviler 30 dage
export const brugte = () => laesJson(BRUGTE, []);
export function proevedeForNylig(dage = 30) {
  const graense = Date.now() - dage * 864e5;
  return laesJson(PROEVEDE, []).filter((x) => new Date(x.dato).getTime() > graense);
}
