// Kvalitetsmåling (Jacob 19/11-2026, punkt 3 fra overleveringen fra techfeedwatch). KUN LÆSNING: intet på sitet ændres.
// En uafhængig "redaktør" (Gemini, temperatur 0, JSON) bedømmer hver artikel som Googles kvalitetsbedømmere:
// indsats, originalitet, faglighed og nøjagtighed (0-100), fem ja/nej om hjælpsomhed og om artiklen har "noget eget"
// (test, udregning, sammenligning, klar dom, gennemregnet eksempel). Formålet: se hvor svagt indholdet er, og hvor en
// streng kontrol skulle sætte grænsen, før vi bygger den (punkt 9). Resultatet: loggen + robot/ud/kvalitet-maaling.json.
// Lære fra techfeedwatch: redaktøren SKAL have dagens dato (ellers kaldes alt nyt "opdigtet"), og kørslen bliver RØD,
// hvis over halvdelen af kaldene fejler (en grøn kørsel uden resultater skjuler fejlen).
// Nøjagtighed bedømmes UDEN Google-søgning (billigere) — tallet er et groft skøn.
//   node robot/kvalitet.mjs              alle artikler
//   node robot/kvalitet.mjs --kun robot  kun robottens artikler (eller: --kun gamle)
//   node robot/kvalitet.mjs --maks 5     højst 5 (prøve)
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { sti } from './lib/arkiv.mjs';
import { json, ARTIKELMODEL, gemPrisVedExit } from './lib/gemini.mjs';
// Model (19/11-2026): gemini-3.8-flash ($0,75/$3,75 pr. mio. tokens) — gemini-3.5-flash ($1,50/$9) ville koste ca. 25 kr for
// alle 208 artikler. Redaktøren er stadig uafhængig: den har ikke skrevet artiklen og får sin egen strenge opgave.
const MODEL = ARTIKELMODEL;
gemPrisVedExit('kvalitet');

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const KUN = arg('kun', null);
const MAKS = Number(arg('maks', 0)) || Infinity;
const SAMTIDIGE = 4;
const DATO = new Date().toISOString().slice(0, 10);

// Artikeltekst uden HTML (billeder, tabeller og skjulte felter fjernes; overskrifter beholdes som linjer)
const tekstAf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function artikler() {
  const ud = []; const rod = sti('src/content/posts');
  for (const aar of fs.readdirSync(rod)) for (const md of fs.readdirSync(path.join(rod, aar))) for (const f of fs.readdirSync(path.join(rod, aar, md)).filter((x) => x.endsWith('.md'))) {
    const raa = fs.readFileSync(path.join(rod, aar, md, f), 'utf8');
    const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) continue;
    const fm = parse(m[1]) || {};
    if (fm.draft) continue;
    ud.push({ sti: `/${aar}/${md}/${f.replace(/\.md$/, '')}`, titel: fm.title || '', spoergsmaal: fm.keyword || fm.title || '', robot: fm.robot === true, opskrift: fm.opskrift ?? null, tekst: tekstAf(m[2]) });
  }
  return ud.sort((a, b) => a.sti.localeCompare(b.sti));
}

const prompt = (a) => `You are an independent senior editor and a Google search quality rater. You did NOT write this article and you have no reason to be kind to it.
Judge the article below honestly, as Google's guidance on helpful, people-first content would.
TODAY IS ${DATO}. Your own knowledge stops earlier than today, so products, models, versions, reports and events from 2025 and 2026
may be real even if you have never heard of them. Do NOT treat a date, product or event as fabricated just because it is newer than
your knowledge. For accuracy, flag only what is internally contradictory, clearly impossible, or wrong about things you do know.
Unknown recent facts are "unverified", not wrong.

Score 0-100 (be strict; 50 = typical average web article, 80+ = clearly better than what already ranks):
- effort: how much real work went into it (depth, specifics, examples, structure) versus a quick rewrite
- originality: does it add something not found in the usual top results (own analysis, comparison, data, angle)
- skill: does it read as written by someone who knows the subject
- accuracy: are the facts, numbers, names and dates plausible and correct as far as you know

Answer true/false:
- q1_firsthand: does it show first-hand experience or original information, not only a summary of others?
- q2_complete: does it fully answer the target question, so the reader does not need to search again?
- q3_trust: would you trust it - is it clear who wrote it and why, with sources where it matters?
- q4_value: does it add real value compared with other pages on the same question?
- q5_people: is it written for people rather than to rank in search engines?
- own: does it contain at least one concrete thing of its own (a test, a calculation, a comparison, a clear verdict, a worked example)?

Also give:
- weakest: the single biggest weakness, max 25 words
- doubtful_facts: up to 3 short claims that look wrong for reasons OTHER than being newer than your knowledge (empty list if none)

Return ONLY JSON: {"effort":0,"originality":0,"skill":0,"accuracy":0,"q1_firsthand":true,"q2_complete":true,"q3_trust":true,"q4_value":true,"q5_people":true,"own":true,"weakest":"","doubtful_facts":[]}

Target question: ${a.spoergsmaal}
Title: ${a.titel}

ARTICLE:
${a.tekst.slice(0, 30000)}`;

const PUNKTER = ['effort', 'originality', 'skill', 'accuracy'];
const SPM = ['q1_firsthand', 'q2_complete', 'q3_trust', 'q4_value', 'q5_people'];
async function bedoem(a) {
  try {
    const j = await json(prompt(a), { model: MODEL, temperatur: 0 });
    if (PUNKTER.some((p) => typeof j[p] !== 'number')) throw new Error('mangler point');
    return { sti: a.sti, robot: a.robot, opskrift: a.opskrift, ord: a.tekst.split(/\s+/).length, ...j, laveste: Math.min(...PUNKTER.map((p) => j[p])), nej: SPM.filter((q) => j[q] === false).length };
  } catch (e) { return { sti: a.sti, robot: a.robot, fejl: String(e.message || e).slice(0, 400) }; }
}

let liste = artikler();
if (KUN === 'robot') liste = liste.filter((a) => a.robot);
if (KUN === 'gamle') liste = liste.filter((a) => !a.robot);
liste = liste.slice(0, MAKS);
console.log(`Kvalitetsmåling ${DATO}: ${liste.length} artikler (${liste.filter((a) => a.robot).length} fra robotten, ${liste.filter((a) => !a.robot).length} gamle), model ${MODEL}`);
if (!process.env.GEMINI_API_KEY) { console.log('GEMINI_API_KEY mangler — stopper.'); process.exit(1); }

const res = [];
for (let i = 0; i < liste.length; i += SAMTIDIGE) {
  res.push(...(await Promise.all(liste.slice(i, i + SAMTIDIGE).map(bedoem))));
  if (res.length % 20 < SAMTIDIGE || res.length === liste.length) console.log(`   bedømt ${res.length}/${liste.length}`);
}
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/kvalitet-maaling.json'), JSON.stringify({ dato: DATO, model: MODEL, resultater: res }, null, 1));

const ok = res.filter((r) => !r.fejl); const fejl = res.filter((r) => r.fejl);
if (fejl.length) console.log(`\nFØRSTE FEJL: ${fejl[0].sti}: ${fejl[0].fejl}`);
function rapport(navn, xs) {
  if (!xs.length) return;
  const snit = (p) => Math.round(xs.reduce((s, r) => s + r[p], 0) / xs.length);
  const med = (p) => { const v = xs.map((r) => r[p]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(`\n== ${navn}: ${xs.length} artikler`);
  console.log('   snit / median / laveste / højeste');
  for (const p of PUNKTER) console.log(`   ${p.padEnd(12)} ${snit(p)} / ${med(p)} / ${Math.min(...xs.map((r) => r[p]))} / ${Math.max(...xs.map((r) => r[p]))}`);
  console.log(`   antal "nej": ${[...SPM, 'own'].map((q) => `${q} ${xs.filter((r) => r[q] === false).length}`).join(' · ')}`);
  console.log(`   ville falde igennem (laveste point under X ELLER intet eget): ${[50, 55, 60, 65, 70].map((x) => `<${x}: ${xs.filter((r) => r.laveste < x || r.own === false).length}`).join(' · ')}`);
  console.log(`   med tvivlsomme fakta: ${xs.filter((r) => (r.doubtful_facts || []).length).length}`);
}
console.log(`\nRESULTAT: ${ok.length} bedømt, ${fejl.length} fejlede`);
rapport('ALLE', ok);
rapport('ROBOTTENS (fra sep. 2026)', ok.filter((r) => r.robot));
rapport('GAMLE (før robotten)', ok.filter((r) => !r.robot));
console.log('\nDe 12 svageste:');
for (const r of [...ok].sort((a, b) => a.laveste - b.laveste).slice(0, 12)) console.log(`   ${r.laveste} ${r.robot ? 'robot' : 'gammel'} ${r.sti} [${PUNKTER.map((p) => r[p]).join('/')}, eget: ${r.own ? 'ja' : 'nej'}] — ${r.weakest}`);
console.log('\nDe 5 stærkeste:');
for (const r of [...ok].sort((a, b) => b.laveste - a.laveste).slice(0, 5)) console.log(`   ${r.laveste} ${r.robot ? 'robot' : 'gammel'} ${r.sti} [${PUNKTER.map((p) => r[p]).join('/')}]`);
// Rød kørsel, hvis over halvdelen fejlede (Lære fra techfeedwatch 13/11)
if (fejl.length > res.length / 2) { console.log(`\nFEJL: ${fejl.length} af ${res.length} kald fejlede — kørslen markeres rød.`); process.exit(1); }
