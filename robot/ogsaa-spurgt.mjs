// "People also ask" valgt af Gemini (29/9-2026, Jacobs valg: "du bygger det ind").
// For hver artikel: ~20 kandidatspørgsmål fra sitets egen ordsammenligning (src/lib/ogsaaspurgt.mjs) — spørgsmål,
// der er BESVARET i andre artikler. Gemini vælger op til 3, der passer bedst, eller færre/ingen. Gemini kan KUN
// vælge numre fra listen, så den kan ikke opfinde spørgsmål eller links.
// Resultatet gemmes i robot/data/ogsaa-spurgt.json: { "<sti>": { dato, valg: [{ q, sti }] } }. Sitet bruger valget,
// når det findes; ellers ordsammenligningen.
// Kører i "Robot (tidsplan)" efter artiklen (robot/plan.mjs --koer), så resultatet kommer med i robottens commit.
//   node robot/ogsaa-spurgt.mjs --antal 60          artikler uden valg først, derefter de ældste valg (> 30 dage)
//   node robot/ogsaa-spurgt.mjs --toer --antal 2    viser kandidaterne, kalder IKKE Gemini, gemmer intet
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { sti } from './lib/arkiv.mjs';
import { json } from './lib/gemini.mjs';
import { faqBoks } from '../src/lib/faqboks.mjs';
import { kandidater } from '../src/lib/ogsaaspurgt.mjs';

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const ANTAL = Number(arg('antal', '60'));
const TOER = process.argv.includes('--toer');
// --falsk: vælger de 3 første kandidater i stedet for at spørge Gemini — KUN til at prøve filformatet lokalt (med --fil)
const FALSK = process.argv.includes('--falsk');
const FIL = sti(arg('fil', 'robot/data/ogsaa-spurgt.json'));
if (FALSK && !process.argv.includes('--fil')) throw new Error('--falsk kræver --fil, så robottens rigtige fil aldrig får falske valg');
const FORNY_DAGE = 30;

// Alle artikler, som sitet ser dem (samme FAQ-boks som ved bygning, så spørgsmålene er de samme ord)
function alleArtikler() {
  const ud = [];
  const rod = sti('src/content/posts');
  for (const aar of fs.readdirSync(rod)) for (const md of fs.readdirSync(path.join(rod, aar))) for (const f of fs.readdirSync(path.join(rod, aar, md)).filter((x) => x.endsWith('.md'))) {
    const raa = fs.readFileSync(path.join(rod, aar, md, f), 'utf8');
    const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const d = m ? (parse(m[1]) || {}) : {};
    const krop = m ? m[2] : raa;
    const ekstra = Array.isArray(d.faq) ? d.faq.filter((x) => x && x.q && x.a) : [];
    const s = `/${aar}/${md}/${f.replace(/\.md$/, '')}`;
    ud.push({ sti: s, href: s, title: String(d.title || ''), description: String(d.description || ''), keyword: String(d.keyword || ''),
      robot: d.robot === true, published: String(d.published || ''), html: faqBoks(krop, ekstra).html,
      emner: (d.labels || []).slice(0, 1).map((l) => ({ slug: String(l).toLowerCase(), farve: '' })) });
  }
  return ud;
}

const alle = alleArtikler();
const gemt = (() => { try { return JSON.parse(fs.readFileSync(FIL, 'utf8')); } catch { return {}; } })();
// Hvilke artikler denne gang: uden valg først (nyeste først), derefter valg ældre end 30 dage (ældste først)
const nu = Date.now();
const uden = alle.filter((a) => !gemt[a.sti]).sort((x, y) => new Date(y.published) - new Date(x.published));
const gamle = alle.filter((a) => gemt[a.sti] && nu - new Date(gemt[a.sti].dato).getTime() > FORNY_DAGE * 864e5).sort((x, y) => new Date(gemt[x.sti].dato) - new Date(gemt[y.sti].dato));
const koe = [...uden, ...gamle].slice(0, ANTAL);

let ok = 0, ingen = 0, fejl = 0;
for (const a of koe) {
  const k = kandidater(a, alle, 20);
  if (TOER) { console.log(`\n${a.title}\n${k.map((x, i) => `  ${i + 1}. ${x.q}   [${x.titel}]`).join('\n')}`); continue; }
  if (!k.length) { gemt[a.sti] = { dato: new Date().toISOString(), valg: [] }; ingen++; continue; }
  const prompt = `You pick "People also ask" questions for an article on a tech news site.

Article title: ${a.title}
Article summary: ${a.description}

Below are questions that are answered in OTHER articles on the same site. Pick up to 3 that a reader who has just finished this article would most likely want to ask next. A good pick is clearly about the same subject (the same product, company, technology or problem) — not just sharing a word. Never pick a question that only makes sense inside its own article, or one about something else entirely. Picking fewer than 3, or none, is better than a weak pick. Order the picks from best to worst.

${k.map((x, i) => `${i + 1}. ${x.q}  (answered in: ${x.titel})`).join('\n')}

Answer with JSON only: {"valg": [numbers from the list]}`;
  try {
    const svar = FALSK ? { valg: [1, 2, 3] } : await json(prompt);
    const nr = [...new Set((Array.isArray(svar?.valg) ? svar.valg : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= k.length))].slice(0, 3);
    gemt[a.sti] = { dato: new Date().toISOString(), valg: nr.map((n) => ({ q: k[n - 1].q, sti: k[n - 1].href })) };
    if (nr.length) ok++; else ingen++;
  } catch (e) {
    fejl++; console.error(`Gemini fejlede for ${a.sti}: ${String(e.message || e).slice(0, 160)}`);
    if (fejl >= 5) { console.error('Stopper efter 5 fejl i træk.'); break; }
  }
}
if (!TOER) {
  // Artikler, der ikke findes mere (slettet), fjernes fra filen
  const findes = new Set(alle.map((a) => a.sti));
  for (const s of Object.keys(gemt)) if (!findes.has(s)) delete gemt[s];
  fs.writeFileSync(FIL, JSON.stringify(gemt, null, 1) + '\n');
}
console.log(`People also ask (Gemini): ${koe.length} artikler i kø · med valg: ${ok} · uden passende: ${ingen} · fejl: ${fejl} · i alt gemt: ${Object.keys(gemt).length} af ${alle.length}`);
