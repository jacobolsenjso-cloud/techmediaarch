// FAQ-EKSTRA (Jacob 29/9-2026: FAQ under artiklerne med MINDST 5 spørgsmål).
// For hver artikel med færre end 5 FAQ-spørgsmål skrives de manglende som frontmatter "faq:".
// Artiklens egen tekst røres ikke. FAQ-boksen (src/lib/faqboks.mjs) viser dem nederst i boksen,
// og FAQ-dataene til Google får dem med.
//
// Sådan findes spørgsmålene:
//  1. Gemini giver artiklens emne som et kort søgeord (1-3 ord).
//  2. Googles autoforslag for det søgeord = det, folk faktisk skriver ("google ask", Jacobs ord).
//  3. Gemini vælger blandt autoforslagene dem, som ARTIKLENS EGEN TEKST besvarer, og skriver et
//     kort svar i journalistisk tone — kun ud fra artiklen. Som bevis skal den citere den sætning
//     i artiklen, svaret bygger på; findes citatet ikke ordret i artiklen, kasseres spørgsmålet.
//
// Kører på GitHub (workflowet "Robot (manuel)", opgave "faq-ekstra") — resultatet lægges på en egen
// gren, aldrig på main. Kan køres igen: artikler, der allerede har 5, springes over.
// Brug: node robot/faq-ekstra.mjs [--antal N] [--minutter M] [--kun sti]
import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { json } from './lib/gemini.mjs';
import { hentForslag } from './lib/autoforslag.mjs';
import { faqSchema } from '../src/lib/faqschema.mjs';

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const ANTAL = Number(arg('antal', 1000)), MINUTTER = Number(arg('minutter', 25)), KUN = arg('kun', '');
const MAAL = 5;
const slut = Date.now() + MINUTTER * 60000;
const rod = 'src/content/posts';
const filer = [];
(function gaa(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? gaa(p) : p.endsWith('.md') && filer.push(p); } })(rod);
filer.sort();

const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, "'").replace(/&quot;|&ldquo;|&rdquo;|“|”/g, '"').replace(/\s+/g, ' ').trim();
const norm = (s) => tekst(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ord = (s) => s.split(/\s+/).filter(Boolean).length;

const rapport = ['# FAQ-ekstra', '', `Kørt ${new Date().toISOString()}`, ''];
let behandlet = 0, skrevet = 0, sprunget = 0;
for (const fil of filer) {
  if (Date.now() > slut || behandlet >= ANTAL) { rapport.push(`\nStoppet efter ${behandlet} artikler (tid/antal) — kør igen for resten.`); break; }
  const sti = '/' + path.relative(rod, fil).replace(/\\/g, '/').replace(/\.md$/, '.html');
  if (KUN && sti !== KUN) continue;
  const raa = fs.readFileSync(fil, 'utf8');
  const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) continue;
  const data = parse(m[1]) || {};
  const body = raa.slice(m[0].length);
  if (/"@type"\s*:\s*"FAQPage"/.test(body)) continue; // siden har sine egne FAQ-data (fx /2024/09/faq.html)
  const egne = (faqSchema(body)?.mainEntity || []).map((q) => q.name);
  const har = [...egne, ...(Array.isArray(data.faq) ? data.faq.map((x) => x.q) : [])];
  if (har.length >= MAAL) continue;
  behandlet++;
  const mangler = MAAL - har.length;
  if (process.argv.includes('--toer')) { console.log(`${String(har.length).padStart(2)} har · mangler ${mangler} · ${sti}`); continue; }
  const artikel = tekst(body);
  try {
    // 1. emnet som kort søgeord
    const e = await json(`Article title: "${data.title}". Start of the article: ${artikel.slice(0, 700)}
Return JSON {"emne": the 1-3 word search topic people would type into Google for this article, lowercase, no brand-new jargon}`);
    const emne = String(e.emne || '').toLowerCase().trim();
    // 2. Googles autoforslag for emnet
    const { forslag } = emne ? await hentForslag(emne, { pauseMs: 150 }) : { forslag: [] };
    const kandidater = forslag.map((f) => f.q).filter((q) => !har.some((h) => norm(h) === norm(q))).slice(0, 60);
    // 3. vælg og besvar — kun ud fra artiklen, med citat som bevis
    const svar = await json(`You write the FAQ for a news article on techmediaarch.com. The article already has these FAQ questions: ${JSON.stringify(har)}.
Add EXACTLY ${mangler} new, different questions. Prefer questions from this list of real Google searches (rephrase into a proper English question ending with "?"):
${JSON.stringify(kandidater)}
If fewer than ${mangler} of them are answered by the article, write other questions a reader would type into Google that THIS ARTICLE answers.
Rules: every answer 2-4 sentences, 25-90 words, journalistic and neutral, based ONLY on the article text below — no outside facts, no numbers that are not in the article, no first person, no links.
For each item include "citat": one sentence copied EXACTLY, word for word, from the article that the answer is based on.
Return JSON {"faq":[{"q":"...","a":"...","citat":"..."}]}

ARTICLE:
${artikel.slice(0, 14000)}`);
    const godkendt = [], afvist = [];
    for (const x of svar.faq || []) {
      const q = String(x.q || '').trim(), a = String(x.a || '').trim(), c = String(x.citat || '').trim();
      const grund = !q.endsWith('?') ? 'ikke et spørgsmål'
        : q.length < 15 || q.length > 130 ? 'spørgsmålets længde'
        : ord(a) < 20 || ord(a) > 100 ? `svarets længde (${ord(a)} ord)`
        : /<|https?:\/\/|\bwe (tested|tried)\b|\bI (tested|tried)\b|\bour (tests|testing|analysis)\b/i.test(a) ? 'link/førsteperson'
        : [...har, ...godkendt.map((g) => g.q)].some((h) => norm(h) === norm(q)) ? 'dublet'
        : c.length < 30 || !norm(artikel).includes(norm(c)) ? 'citatet står ikke i artiklen'
        : null;
      grund ? afvist.push(`${q} — ${grund}`) : godkendt.push({ q, a });
    }
    const nye = godkendt.slice(0, mangler);
    if (!nye.length) { sprunget++; rapport.push(`## ${sti}\nIngen godkendte (emne "${emne}", ${kandidater.length} autoforslag). Afvist: ${afvist.join(' · ')}\n`); continue; }
    // Skriv frontmatter: "faq:" lægges til sidst i frontmatter; resten af filen røres ikke
    const blok = stringify({ faq: [...(Array.isArray(data.faq) ? data.faq : []), ...nye] }, { lineWidth: 0 });
    const nyFront = m[1].replace(/\nfaq:[\s\S]*$/, '') + '\n' + blok.trimEnd();
    fs.writeFileSync(fil, raa.replace(m[0], () => `---\n${nyFront}\n---\n`));
    skrevet++;
    rapport.push(`## ${sti}\nEmne "${emne}" · ${kandidater.length} autoforslag · havde ${har.length}, nu ${har.length + nye.length}${nye.length < mangler ? ' (STADIG UNDER 5)' : ''}`);
    nye.forEach((x) => rapport.push(`- **${x.q}** ${x.a}`));
    if (afvist.length) rapport.push(`- _Afvist:_ ${afvist.join(' · ')}`);
    rapport.push('');
    console.log(`${sti}: +${nye.length}`);
  } catch (e) { sprunget++; rapport.push(`## ${sti}\nFEJL: ${String(e.message).slice(0, 200)}\n`); console.log(`${sti}: FEJL ${String(e.message).slice(0, 120)}`); }
}
rapport.splice(3, 0, `Artikler behandlet: ${behandlet} · skrevet: ${skrevet} · uden resultat: ${sprunget}`, '');
fs.mkdirSync('robot/ud', { recursive: true });
fs.writeFileSync('robot/ud/faq-ekstra.md', rapport.join('\n'));
console.log(`behandlet ${behandlet} · skrevet ${skrevet} · uden resultat ${sprunget}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.slice(0, 6).join('\n') + '\n\nHele listen: artefakten robot-ud → faq-ekstra.md\n');
