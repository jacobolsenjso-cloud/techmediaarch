// FAQ-EKSTRA (Jacob 29/9-2026: FAQ under artiklerne med MINDST 5 spørgsmål).
// For hver artikel med færre end 5 FAQ-spørgsmål skrives de manglende som frontmatter "faq:".
// Artiklens egen tekst røres ikke. FAQ-boksen (src/lib/faqboks.mjs) viser dem nederst i boksen,
// og FAQ-dataene til Google får dem med.
//
// Sådan findes spørgsmålene:
//  1. Gemini giver artiklens emne som et kort søgeord (1-3 ord).
//  2. Googles autoforslag for det søgeord = det, folk faktisk skriver ("google ask", Jacobs ord).
//  3. Gemini vælger blandt autoforslagene dem, som ARTIKLENS EGEN TEKST besvarer, og skriver et
//     kort svar i journalistisk tone — kun ud fra artiklen, med en ordret sætning som bevis.
//  4. Faste regler afviser (29/9, efter kørsel #15): søgeforslag, der ikke er skrevet om til rigtigt
//     engelsk ("what ai tool does google chrome use?"), navne der ikke står i artiklen ("bbc"),
//     og spørgsmål, der er det samme spørgsmål med andre ord ("What does X do?" / "What can X do?").
//  5. Gemini tjekker til sidst, at hvert svar kun siger det, artiklen siger, og besvarer spørgsmålet.
//  Op til 3 runder pr. artikel for at nå 5; de afviste sendes med tilbage, så de ikke gentages.
//
// Kører på GitHub (workflowet "Robot (manuel)", opgave "faq-ekstra") — resultatet lægges på en egen
// gren, aldrig på main. Kan køres igen: artikler, der allerede har 5, springes over.
// Brug: node robot/faq-ekstra.mjs [--antal N] [--minutter M] [--kun sti] [--toer]
import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { json } from './lib/gemini.mjs';
import { hentForslag } from './lib/autoforslag.mjs';
import { faqSchema } from '../src/lib/faqschema.mjs';

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const ANTAL = Number(arg('antal', 1000)), MINUTTER = Number(arg('minutter', 25)), KUN = arg('kun', '');
const MAAL = 5, RUNDER = 3;
const slut = Date.now() + MINUTTER * 60000;
const rod = 'src/content/posts';
const filer = [];
(function gaa(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? gaa(p) : p.endsWith('.md') && filer.push(p); } })(rod);
filer.sort();

const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, "'").replace(/&quot;|&ldquo;|&rdquo;|“|”/g, '"').replace(/\s+/g, ' ').trim();
const norm = (s) => tekst(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ord = (s) => s.split(/\s+/).filter(Boolean).length;

// --- Faste regler (29/9, rettet efter test på kørsel #15) --------------------------
// Et rigtigt spørgsmål starter med et spørgeord og stort bogstav.
const START = /^(What|How|Why|Is|Are|Can|Could|Does|Do|Did|Who|Whose|When|Where|Which|Should|Will|Would|Has|Have|In what)\b/;
const STOP = new Set(('a an the is are was were be been do does did can could will would should shall to of in on for with and or vs versus '
  + 'what how why who whose when where which it its this that these those your you i my me we our there their they as at by from into about '
  + 'use using used than have has had any some get way ways no not').split(' '));
// Synonymer, så "How to make/create/generate X" og "best/top X" ses som samme spørgsmål
const SYN = { create: 'make', generate: 'make', produce: 'make', build: 'make', creating: 'make', making: 'make', generating: 'make',
  videos: 'video', tools: 'tool', works: 'work', working: 'work', better: 'best', top: 'best' };
const kerne = (s) => new Set(norm(s.replace(/['’]s\b/g, '')).split(' ').filter((w) => w.length > 1 && !STOP.has(w))
  .map((w) => SYN[w] || w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1')));
// Samme spørgsmål med andre ord. Artiklens emneord (fra titel + søgeord) tæller IKKE, ellers ligner alle
// spørgsmål om "Taco Bell AI drive thru" hinanden. Tilbage er det, spørgsmålet egentlig spørger om:
// "What does X do?" / "What can X do?" -> intet tilbage på begge = samme; "benefits of X" -> {benefit} = forskelligt.
function ligner(a, b, emneOrd = new Set()) {
  const f = (s) => new Set([...kerne(s)].filter((w) => !emneOrd.has(w)));
  const A = f(a), B = f(b);
  if (!A.size && !B.size) return true;
  if (!A.size || !B.size) return false;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / new Set([...A, ...B]).size >= 0.66;
}
// Stavning: et ord, som artiklen skriver som navn/forkortelse (AI, SEO, Google, ChatGPT) midt i en sætning og
// ALDRIG med småt, må ikke stå med småt i spørgsmålet. Overskrifter tæller ikke (de har stort på hvert ord),
// og ord i starten af en sætning heller ikke.
function stavefejl(q, brod) {
  for (const w of new Set(q.match(/\b[a-z][a-z0-9]+\b/g) || [])) {
    if (STOP.has(w)) continue;
    if (new RegExp(`(^|[^A-Za-z0-9])${w}($|[^A-Za-z0-9])`).test(brod)) continue; // står med småt et sted
    const re = new RegExp(`(^|[^A-Za-z0-9])(${w})(?=$|[^A-Za-z0-9])`, 'gi');
    for (const m of brod.matchAll(re)) {
      const ordet = m[2];
      // Forkortelse med store bogstaver (AI, SEO, JITRO) er altid et navn
      if (ordet.length >= 2 && ordet === ordet.toUpperCase()) return w;
      // Ellers kun et navn, hvis ordet lige før står med småt ("... by Google.") — ikke i en titel med stort
      // på hvert ord (link-tekster til andre artikler, målt på kørsel #15: "Hire", "Features", "Beginners")
      const foer = brod.slice(Math.max(0, m.index - 40), m.index + m[1].length);
      const forrige = (foer.match(/([A-Za-z][A-Za-z'’-]*)[^A-Za-z]*$/) || [])[1] || '';
      if (/^[a-z]/.test(forrige) && !/[.!?:"“]\s*$/.test(foer)) return w;
    }
  }
  return null;
}
// Navne i spørgsmålet (ord med stort, ikke første ord) skal stå i artiklen. Ejefald ("Meta's") fjernes først.
function fremmedNavn(q, art) {
  const lav = art.toLowerCase();
  for (const w of q.replace(/['’]s\b/g, '').split(/\s+/).slice(1).map((x) => x.replace(/[^A-Za-z0-9-]/g, '')).filter((x) => /^[A-Z]/.test(x))) {
    if (!lav.includes(w.toLowerCase())) return w;
  }
  return null;
}
// Tilføjet efter kørsel #16 (29/9):
// En FAQ taler ikke om "the text"/"the article" ("What is the viral video mentioned in the text used for?")
// (ikke "the text-to-speech tool" eller "the text file" — de er ikke henvisninger til artiklen)
const META = /according to the (text|article|video|guide|post|story)|(mentioned|described|discussed|referenced|highlighted|noted|considered|shown) (in|by) the (text|article|video)\b(?![-\w]| file)|\b(in|from) the (text|article|video)(?=[?.,]|$)/i;
// Efter kørsel #17: et svar, der ikke svarer ("The article lacks any financial details …"), duer ikke
// (ikke "the video game", "the video editor", "the text prompt" — kun når svaret henviser til sin kilde)
// ("running the text through Rephrasy" og "does not include a friendly installer" er almindelige sætninger)
const IKKESVAR = /\b(the|this) (article|text|video|source) (explains|outlines|lacks|states|says|notes|mentions|describes|does|provides|highlights|suggests|covers|shows)\b|\b(in|from|according to) the (article|text|video|source)\b|\bdoes not (mention|specify|disclose|say|state)\b|\bnot (mentioned|specified|disclosed|stated)\b|\black(s|ing)? (any )?(details|information|specifics)\b|\bomitted\b/i;
// Spørger spørgsmålet om et navn ("Who …?", "What is the name of …?"), skal svaret nævne et navn, der ikke står i spørgsmålet
// ("What is the name of NVIDIA's latest chip?" -> svar uden "Blackwell" duer ikke)
const NAVNSPM = /^(Who\b|What is the name|What are the names|Which (company|companies|brand|brands|tool|tools|app|apps|model|models|chip|platform|service|institutions?|organi[sz]ations?|person|people|firm|firms|startup|startups)\b)/i;
// Almindelige ord, der står med stort i starten af en sætning, er ikke navne
const IKKENAVN = new Set(('The This That These Those It Its They Their There In On At By For With While Although However Both Each Many Most Some '
  + 'Users Specifically Additionally Furthermore Moreover A An As After Before When If Because Such According Unlike Through Following '
  + 'Despite Instead Rather Currently Today Yes No Its Once Over Under Among Several Various Other Another Every All Key One Two').split(' '));
// Er ordet et navn i artiklen? = står med stort midt i en sætning (ordet før står med småt)
function navnIArtikel(w, brod) {
  for (const m of brod.matchAll(new RegExp(`(^|[^A-Za-z0-9])(${w})(?=$|[^A-Za-z0-9])`, 'g'))) {
    const foer = brod.slice(Math.max(0, m.index - 40), m.index + m[1].length);
    if (/[a-z][a-z'’-]*[,;]?\s+$/.test(foer)) return true;
  }
  return false;
}
// Et ord med stort midt i svaret er et navn; står det først i en sætning ("Oppo is …", "Industry experts …"),
// tæller det kun, hvis artiklen også skriver det som navn (efter kørsel #17: "Industry" blev taget for et navn)
function navnISvar(q, a, brod = '') {
  const iq = q.toLowerCase();
  for (const m of a.matchAll(/\b([A-Z][A-Za-z0-9-]*[A-Za-z0-9])/g)) {
    const w = m[1];
    if (w.length < 2 || IKKENAVN.has(w) || iq.includes(w.toLowerCase())) continue;
    const start = m.index === 0 || /[.!?]\s+$/.test(a.slice(0, m.index));
    if (!start || /[A-Z].*[A-Z]|[a-z][A-Z]|\d/.test(w.slice(1)) || navnIArtikel(w, brod)) return true;
  }
  return false;
}
// Søgestøj fra autoforslag ("What is artificial intelligence bbc news?") — kun tilladt, hvis ordet står i artiklen
const STOEJ = /\b(bbc|cnn|reddit|quora|wikipedia|pdf|ppt|near me|news)\b/i;
// Spørger spørgsmålet om et tal eller en dato, skal svaret give det ("What percentage …?" -> "only a minority" duer ikke)
// ("When is/was/will …" spørger om en dato; "When does Google recommend …" om en situation)
const TALSPM = /^(What (percentage|proportion|share|date|year|month|price)|How (much|many|long|often|old)|When (is|was|will|did)\b)/i;
const HARTAL = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|thousand|million|billion|trillion|percent|half|third|quarter|dozen|daily|weekly|monthly|yearly|annually|free|seconds?|minutes?|hours?|days?|weeks?|months?|years?|january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|fall|autumn|winter)\b/i;
// Spørger spørgsmålet om en pris, skal svaret give et beløb. "free" alene tæller ikke: efter kørsel #18 svarede
// "How much does Windows 10 extended support cost?" med "completely free", men artiklen nævner ingen pris
const PRISSPM = /^(How much (does|do|will|would|is|are)\b.*\b(cost|charge|pay)\b|What (is|are) the (price|pricing|cost)|How much is\b)/i;
// Samme svar som et andet spørgsmål: 8 ord i træk ens (efter kørsel #18: to forskellige spørgsmål fik begge
// svaret "Microsoft hired Inflection AI's CEO Mustafa Suleyman … part of a broader industry trend …")
function sammeSvar(a, b) {
  const A = norm(a).split(' '), B = ` ${norm(b)} `;
  for (let i = 0; i + 8 <= A.length; i++) if (B.includes(` ${A.slice(i, i + 8).join(' ')} `)) return true;
  return false;
}
// ctx = { art: hele teksten, brod: teksten uden overskrifter, emneOrd }; svarHar = svarene, der allerede står i FAQ'en
function afvisGrund(x, ctx, allerede, svarHar = []) {
  const q = String(x.q || '').trim(), a = String(x.a || '').trim(), c = String(x.citat || '').trim();
  if (!q.endsWith('?')) return 'ikke et spørgsmål';
  if (!START.test(q)) return 'starter ikke som et rigtigt spørgsmål';
  if (META.test(q)) return 'henviser til "teksten"/"artiklen"';
  const st = q.match(STOEJ); if (st && !new RegExp(`\\b${st[0]}\\b`, 'i').test(ctx.art)) return `søgestøj ("${st[0]}")`;
  if (TALSPM.test(q) && !HARTAL.test(a)) return 'spørger om et tal/en dato, men svaret giver ingen';
  // (tal fra spørgsmålet tæller ikke: "Windows 10" er ikke en pris; "twenty dollars" tæller)
  if (PRISSPM.test(q) && !/[$€£]|\b(dollars?|euros?|cents?|pounds?|kroner|usd|eur)\b/i.test(a) && !(a.match(/\d[\d.,]*/g) || []).some((t) => !(q.match(/\d[\d.,]*/g) || []).includes(t))) return 'spørger om en pris, men svaret giver intet beløb';
  if (IKKESVAR.test(a)) return 'svaret svarer ikke (henviser til kilden eller siger, at oplysningen mangler)';
  if (NAVNSPM.test(q) && !navnISvar(q, a, ctx.brod)) return 'spørger om et navn, men svaret giver intet';
  if (q.length < 15 || q.length > 130) return 'spørgsmålets længde';
  const s = stavefejl(q, ctx.brod); if (s) return `stavning ("${s}" skrives med stort i artiklen)`;
  const n = fremmedNavn(q, ctx.art); if (n) return `navnet "${n}" står ikke i artiklen`;
  if (ord(a) < 20 || ord(a) > 100) return `svarets længde (${ord(a)} ord)`;
  if (/<|https?:\/\/|\bwe (tested|tried)\b|\bI (tested|tried)\b|\bour (tests|testing|analysis)\b/i.test(a)) return 'link/førsteperson';
  const d = allerede.find((h) => ligner(h, q, ctx.emneOrd)); if (d) return `samme spørgsmål som «${d}»`;
  if (svarHar.some((h) => sammeSvar(a, h))) return 'samme svar som et spørgsmål, der allerede står i FAQ\'en';
  if (c.length < 30 || !norm(ctx.art).includes(norm(c))) return 'citatet står ikke i artiklen';
  return null;
}
const lavCtx = (body, titel, emne) => ({
  art: tekst(body),
  // Overskrifter fjernes, og hvert HTML-mærke tæller som sætningsstart: fed tekst, punkter og tabelceller
  // ("<li><strong>Features</strong>") har stort begyndelsesbogstav uden at være et navn (målt på kørsel #15).
  brod: tekst(body.replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, ' . ').replace(/<[^>]+>/g, ' . ')),
  emneOrd: kerne(`${titel} ${emne}`),
});

const rapport = ['# FAQ-ekstra', '', `Kørt ${new Date().toISOString()}`, ''];
let behandlet = 0, skrevet = 0, sprunget = 0, under5 = 0;
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
  const egneFaq = faqSchema(body)?.mainEntity || [];
  const egne = egneFaq.map((q) => q.name);
  const har = [...egne, ...(Array.isArray(data.faq) ? data.faq.map((x) => x.q) : [])];
  const harSvar = [...egneFaq.map((q) => String(q.acceptedAnswer?.text || '')), ...(Array.isArray(data.faq) ? data.faq.map((x) => x.a) : [])];
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
    const ctx = lavCtx(body, data.title, emne);
    // 2. Googles autoforslag for emnet
    const { forslag } = emne ? await hentForslag(emne, { pauseMs: 150 }) : { forslag: [] };
    const kandidater = forslag.map((f) => f.q).filter((q) => !har.some((h) => ligner(h, q, ctx.emneOrd))).slice(0, 60);
    const godkendt = [], afvist = [];
    for (let runde = 1; runde <= RUNDER && godkendt.length < mangler; runde++) {
      const brug = mangler - godkendt.length;
      // 3. vælg og besvar — kun ud fra artiklen, med citat som bevis
      const svar = await json(`You write the FAQ for a news article on techmediaarch.com.
Questions already in the FAQ (do NOT repeat them or ask the same thing in other words): ${JSON.stringify([...har, ...godkendt.map((g) => g.q)])}
${afvist.length ? `Rejected earlier, do not reuse: ${JSON.stringify(afvist.slice(-12))}\n` : ''}Write ${brug + 2} new questions, each asking about something DIFFERENT. Base them on these real Google searches:
${JSON.stringify(kandidater)}
Rewrite each search into a correct, natural English question: start with What/How/Why/Is/Are/Can/Does/Do/Who/When/Which/Should/Will,
capital first letter, correct capitalisation of names and acronyms exactly as the article writes them (AI, SEO, Google, ChatGPT), end with "?".
Only use names that appear in the article. Never refer to "the text", "the article" or "the video" — not in questions and not in answers.
If a question asks for a number, percentage, price, date or a name, the answer MUST state it exactly as the article does; if the article
does not give it, do not ask that question. Never write an answer saying that something is not mentioned. If fewer searches are answered by the article, write other questions a reader would type into Google that THIS ARTICLE answers.
Answers: 2-4 sentences, 25-90 words, journalistic and neutral, based ONLY on the article text below — no outside facts, no numbers that are not in the article, no first person, no links.
For each item include "citat": one sentence copied EXACTLY, word for word, from the article that the answer is based on.
Return JSON {"faq":[{"q":"...","a":"...","citat":"..."}]}

ARTICLE:
${artikel.slice(0, 14000)}`);
      const nyeRunde = [];
      for (const x of svar.faq || []) {
        const grund = afvisGrund(x, ctx, [...har, ...godkendt.map((g) => g.q), ...nyeRunde.map((g) => g.q)],
          [...harSvar, ...godkendt.map((g) => g.a), ...nyeRunde.map((g) => g.a)]);
        grund ? afvist.push(`${String(x.q || '').trim()} — ${grund}`) : nyeRunde.push({ q: String(x.q).trim(), a: String(x.a).trim() });
      }
      // 4. Gemini tjekker, at svaret kun siger det, artiklen siger, og besvarer spørgsmålet
      if (nyeRunde.length) {
        const t = await json(`For each numbered question and answer, check against the article below:
"daekket": is EVERY factual claim in the answer stated in the article? "besvarer": does the answer actually answer the question?
Return JSON {"svar":[{"n":1,"daekket":true,"besvarer":true}]}
${nyeRunde.map((x, i) => `${i + 1}. Q: ${x.q}\n   A: ${x.a}`).join('\n')}

ARTICLE:
${artikel.slice(0, 14000)}`);
        nyeRunde.forEach((x, i) => {
          const d = (t.svar || []).find((s) => Number(s.n) === i + 1);
          if (d && d.daekket === true && d.besvarer === true) { if (godkendt.length < mangler) godkendt.push(x); }
          else afvist.push(`${x.q} — ${!d ? 'ikke kontrolleret' : d.daekket !== true ? 'svaret siger mere end artiklen' : 'svarer ikke på spørgsmålet'}`);
        });
      }
    }
    const nye = godkendt;
    if (har.length + nye.length < MAAL) under5++;
    if (!nye.length) { sprunget++; rapport.push(`## ${sti}\nIngen godkendte (emne "${emne}", ${kandidater.length} autoforslag). Afvist: ${afvist.join(' · ')}\n`); continue; }
    // Skriv frontmatter: "faq:" lægges til sidst i frontmatter; resten af filen røres ikke
    const blok = stringify({ faq: [...(Array.isArray(data.faq) ? data.faq : []), ...nye] }, { lineWidth: 0 });
    const nyFront = m[1].replace(/\nfaq:[\s\S]*$/, '') + '\n' + blok.trimEnd();
    fs.writeFileSync(fil, raa.replace(m[0], () => `---\n${nyFront}\n---\n`));
    skrevet++;
    rapport.push(`## ${sti}\nEmne "${emne}" · ${kandidater.length} autoforslag · havde ${har.length}, nu ${har.length + nye.length}${har.length + nye.length < MAAL ? ' (STADIG UNDER 5)' : ''}`);
    nye.forEach((x) => rapport.push(`- **${x.q}** ${x.a}`));
    if (afvist.length) rapport.push(`- _Afvist:_ ${afvist.join(' · ')}`);
    rapport.push('');
    console.log(`${sti}: +${nye.length}`);
  } catch (e) { sprunget++; rapport.push(`## ${sti}\nFEJL: ${String(e.message).slice(0, 200)}\n`); console.log(`${sti}: FEJL ${String(e.message).slice(0, 120)}`); }
}
rapport.splice(3, 0, `Artikler behandlet: ${behandlet} · skrevet: ${skrevet} · uden resultat: ${sprunget} · stadig under 5: ${under5}`, '');
fs.mkdirSync('robot/ud', { recursive: true });
fs.writeFileSync('robot/ud/faq-ekstra.md', rapport.join('\n'));
console.log(`behandlet ${behandlet} · skrevet ${skrevet} · uden resultat ${sprunget} · stadig under 5 ${under5}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.slice(0, 6).join('\n') + '\n\nHele listen: artefakten robot-ud → faq-ekstra.md\n');
