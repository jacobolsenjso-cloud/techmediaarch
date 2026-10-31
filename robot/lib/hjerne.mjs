// Jacobs hjerne på techmediaarch (Jacob 30/10-2026: "bygge hjernen ind sammen med omskrivningsfunktionen").
// Samme opskrift som techfeedwatch (src/lib/hjerne.mjs der, i brug siden 21-27/10), tilpasset HTML:
// - Workflowet henter det PRIVATE repo jacob-hjerne med læsenøglen HJERNE_NOEGLE til mappen _hjerne.
// - Stilen (core.md + voice.md) er altid med i skriveprompten. Brødteksten skrives aldrig i første person.
// - BREMSEN: hans holdninger kommer kun med, når emnet rammer et afsnit i emner.md. Så skrives 1-2 korte
//   afsnit i første person (2-3 sætninger hver), flettet ind sidst i den sektion, hvor de passer — ingen
//   boks, ingen overskrift (25/10 på techfeedwatch: "My take"-boksen "ser latterligt ud").
// - Mangler hjernen, skrives INGEN artikel (25/10, Jacob: hjernen skal altid bruges).
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.HJERNE_DIR || '_hjerne';

// Læser hjernefilerne. null = ingen hjerne.
export function laesHjerne() {
  const l = (f) => { try { return fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n').trim(); } catch { return ''; } };
  const hjerne = { core: l('core.md'), voice: l('voice.md'), beliefs: l('beliefs.md'), emner: l('emner.md'), erfaringer: l('erfaringer.md') };
  return (hjerne.voice || hjerne.emner || hjerne.core) ? hjerne : null;
}

// De afsnit i emner.md, hvis emneord står i artiklens emne. Hvert afsnit: "- **<Emne> (nøgleord, …):** ...",
// med underpunkter ("  - ..."). Samme regler som techfeedwatch: ord på 4+ tegn matches som del af ord, korte
// forkortelser (ai, seo, vr) kun som hele ord og kun fra den engelske nøgleordsliste i parentesen.
export function emneAfsnit(hjerne, tekst) {
  if (!hjerne?.emner) return [];
  const t = String(tekst || '').toLowerCase();
  const FOR_GENERELLE = new Set(['tech', 'computing', 'money', 'building']);
  const ud = [];
  const linjer = hjerne.emner.split('\n');
  for (let li = 0; li < linjer.length; li++) {
    const m = linjer[li].match(/^- \*\*(.+?):?\*\*/);
    if (!m) continue;
    const under = [];
    for (let j = li + 1; j < linjer.length && /^\s+- /.test(linjer[j]); j++) under.push(linjer[j].trimEnd());
    const navn = m[1].toLowerCase();
    const alle = navn.split(/[\s/&,()-]+/).filter((o) => o && !FOR_GENERELLE.has(o));
    const lange = alle.filter((o) => o.length >= 4);
    const noegle = (navn.match(/\(([^)]*)\)/)?.[1] || '').split(/[\s,]+/);
    const korte = noegle.filter((o) => o.length >= 2 && o.length <= 3 && /^[a-z]+$/.test(o));
    if (t.includes(navn) || lange.some((o) => t.includes(o)) || korte.some((o) => new RegExp(`\\b${o}\\b`).test(t))) ud.push([linjer[li].trim(), ...under].join('\n'));
  }
  // Det brede "AI & Tech" sidst, så et mere præcist emne får pladsen først
  ud.sort((a, b) => Number(/^- \*\*AI & Tech/.test(a)) - Number(/^- \*\*AI & Tech/.test(b)));
  return ud.slice(0, 2);
}

// Blokken til skriveprompten: kun stil og vinkel. Brødteksten forbliver neutral og i tredje person —
// hans egne afsnit lægges ind bagefter (stemmePrompt nedenfor), så kildereglerne gælder fuldt for brødteksten.
export function stemmeBlok(hjerne) {
  if (!hjerne) return '';
  const dele = [`SITE OWNER'S NOTES (written in Danish - the article stays in English). They shape tone and angle only:`];
  if (hjerne.core) dele.push(`Who the owner is and why the site exists:\n${hjerne.core.slice(0, 6000)}`);
  if (hjerne.voice) dele.push(`Style ideals - follow the spirit, not the wording; never copy idioms from them:\n${hjerne.voice.slice(0, 6000)}`);
  dele.push(`Write the article body in neutral third person, as the rules below say. Never mention AdSense or the owner's private life.`);
  return dele.join('\n');
}

const tekstAf = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Sektionerne, hans afsnit må stå i: alle <h2> undtagen FAQ, kilder og "Related reading"
const IKKE_SEKTION = /^(FAQ|Frequently Asked Questions|Sources|References|Related reading)\b/i;
export const sektioner = (html) => [...String(html).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => tekstAf(m[1])).filter((h) => h && !IKKE_SEKTION.test(h));

// Prompten til hans egne afsnit. null = ingen holdning rammer emnet (så skrives ingen).
export function stemmePrompt(hjerne, emneTekst, html, spoergsmaal, seneste = []) {
  const holdninger = emneAfsnit(hjerne, emneTekst);
  if (!hjerne || !holdninger.length) return null;
  const ob = overbrugte(seneste); const slidte = slidteVendinger(seneste);
  return `You add the site owner's own voice to an article on Tech Media Arch that answers "${spoergsmaal}". Below are his own notes in Danish (who he is, his style, his positions, his experience) and the finished article. Write in English.

TASK
Write his view in the FIRST PERSON as 1 or 2 SHORT paragraphs (2-3 sentences each). For each, choose the article section where it fits most naturally (different sections). Each is inserted as an ordinary paragraph at the end of its section - no heading, no box - so it must read as a natural part of the article.

RULES
- Each paragraph 2-3 short sentences. Plain words, calm and conversational. Never aggressive, never preachy, never selling anything.
- Each paragraph connects to what its section just said, then adds what HE thinks and why - and, only where it truly fits, a lesson from his own experience. Never boast.
- His notes are a COMPASS for how he thinks - not lines to insert. Express his view in NEW words that fit this article. At most ONE concrete example or story from his notes in the whole piece. Idioms in his notes are only examples of his tone - never copy them.
- Use ONLY what his notes state. Never invent experiences, tests, details, numbers, dates or names. Never claim he tested or reviewed a product unless his notes say so. Do not mention employers, places, his age, family, partner or private life. Never mention AdSense.
- Do not repeat facts the article already gives. A number may only appear if the article already states it. Name no organisation, company or publication as a source.${seneste.length ? `
- His voice already appears in other recent articles (below). Do NOT reuse their stories, examples or phrasing.${ob.length ? ` Used up for now - do not use at all: ${ob.join('; ')}.` : ''}${slidte.length ? ` Worn phrases - do not use them or close variants: ${slidte.map((v) => `"${v}"`).join(', ')}.` : ''}` : ''}
- Write only where his notes give him a real view or real experience. Never claim experience he does not have, and never write that he lacks experience ("I do not have personal experience with ...") - choose another section, or write fewer paragraphs.
- No headings, no lists, no HTML, no quotation marks around the text, no sign-off.
- If nothing in his notes genuinely bears on this question, output exactly NONE.

Output ONLY a JSON array: [{"section": "<one heading copied exactly from the list>", "text": "<the paragraph>"}] with 1-2 items - or NONE.

SECTION HEADINGS
${sektioner(html).map((h) => `- ${h}`).join('\n')}

HIS NOTES
Who he is:
${(hjerne.core || '').slice(0, 6000)}

His style:
${(hjerne.voice || '').slice(0, 6000)}

His positions on this topic:
${holdninger.join('\n')}

His general positions:
${(hjerne.beliefs || '').slice(0, 4000)}

His experience:
${(hjerne.erfaringer || '').slice(0, 8000)}

${seneste.length ? `HIS RECENT PARAGRAPHS IN OTHER ARTICLES (do not repeat)
${seneste.slice(0, 20).map((x) => `- ${x}`).join('\n')}

` : ''}THE ARTICLE
${tekstAf(html).slice(0, 14000)}`;
}

// Historier, der ikke må gå igen for tit (techfeedwatch 26/10: samme få historier i 3 af 4 artikler)
const ANEKDOTER = {
  'Boeing/Volkswagen': /Boeing|Volkswagen/i,
  'being hacked (Facebook/Gmail)': /been hacked|hacked (myself|several|more than)|my Facebook|my Gmail/i,
  'his crypto wallets / crypto card': /my (own )?(crypto )?wallets?|wallets? (with|holding)|crypto card/i,
  '"worth its weight in gold"': /weight in gold|worth gold/i,
  '"better safe than sorry"': /safe than sorry/i,
  'crane operator / offshore work': /crane|oil platform|offshore|helicopter deck/i,
  '"push-button" tools': /push-button/i,
  '"over a cup of coffee"': /cup of coffee/i,
};
const FOERSTE_PERSON = /\b(I|I'm|I've|my|me)\b/;

// Hans seneste afsnit i andre artikler (frontmatter "stemme: true"), nyeste først — så de ikke gentages.
export function senesteStemmeAfsnit(rod = 'src/content/posts', udenFil = '', antal = 20) {
  const artikler = [];
  for (const aar of fs.readdirSync(rod)) for (const md of fs.readdirSync(path.join(rod, aar))) {
    for (const f of fs.readdirSync(path.join(rod, aar, md)).filter((x) => x.endsWith('.md'))) {
      const fil = path.join(rod, aar, md, f);
      if (udenFil && path.resolve(fil) === path.resolve(udenFil)) continue;
      const t = fs.readFileSync(fil, 'utf8').replace(/\r/g, '');
      const fm = t.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
      if (!/^stemme:\s*true\b/m.test(fm)) continue;
      const dato = fm.match(/^updated:\s*"?([^"\n]+)/m)?.[1] || '';
      const afsnit = [...t.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => tekstAf(m[1])).filter((x) => FOERSTE_PERSON.test(x.replace(/"[^"]*"|“[^”]*”/g, '')));
      if (afsnit.length) artikler.push({ dato, afsnit });
    }
  }
  return artikler.sort((x, y) => y.dato.localeCompare(x.dato)).flatMap((x) => x.afsnit).slice(0, antal);
}
// Historier brugt i mindst 2 af de 10 seneste afsnit er "brugt op" for nu
export function overbrugte(seneste) {
  const s10 = seneste.slice(0, 10);
  return Object.entries(ANEKDOTER).filter(([, re]) => s10.filter((x) => re.test(x)).length >= 2).map(([navn]) => navn);
}
// Vendinger på 2-4 ord, der står i mindst 2 af hans seneste afsnit
const FYLDORD = new Set(('a an the and or but of to in on at for with by from as is are was were be been it its this that these those ' +
  'i me my i\'m i\'ve we you your he his they them their not no so if than then just very can will would should could do does have has had ' +
  'what when where which who how why there here about into over more most also only even really').split(' '));
const MENING = new Set(['i', 'my', 'me', "i'm", "i've", 'think', 'believe', 'view', 'in', 'opinion', 'feel']);
const ordAf = (x) => x.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
export function slidteVendinger(seneste = [], max = 12) {
  const taelling = new Map();
  for (const afsnit of seneste) {
    const w = ordAf(afsnit); const her = new Set();
    for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= w.length; i++) her.add(w.slice(i, i + n).join(' '));
    for (const g of her) taelling.set(g, (taelling.get(g) || 0) + 1);
  }
  const kand = [...taelling].filter(([g, n]) => {
    if (n < 2) return false;
    const w = g.split(' '); const indhold = w.filter((x) => !FYLDORD.has(x));
    if (w.every((x) => MENING.has(x) || FYLDORD.has(x)) && !indhold.some((x) => !MENING.has(x))) return false;
    return indhold.length >= (w.length === 2 ? 2 : 1);
  }).sort((a, b) => b[1] - a[1] || b[0].split(' ').length - a[0].split(' ').length);
  const valgt = [];
  for (const [g] of kand) { if (valgt.some((v) => v.includes(g) || g.includes(v))) continue; valgt.push(g); if (valgt.length >= max) break; }
  return valgt;
}
// Fem ord i træk fra et af de seneste afsnit = genbrugt formulering
function genbrugtFrase(tekst, seneste) {
  const gamle = new Set(seneste.flatMap((x) => { const w = ordAf(x); return w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(' ')); }));
  const w = ordAf(tekst);
  for (let i = 0; i + 5 <= w.length; i++) { const g = w.slice(i, i + 5).join(' '); if (gamle.has(g)) return g; }
  return '';
}

const PRIVAT = /\b(54|fifty-four|girlfriend|partner|wife|children|kids|Scotland|Zealand|Sj[æa]lland|Brabrand)\b/i;
const FIRMAER = /M[æa]e?rsk|Musikhus|Concert Hall of Aarhus|AarBus|Bang\s*&\s*Olufsen|DS Dental|Beumer|Terma|Semco|Keolis|Region Midtjylland/i;
const INGEN_ERFARING = /\bI (?:do not|don't|did not|didn't|never|have never|haven't|have not)\b[^.]{0,30}\b(?:experience|expertise|an expert)\b|\bI'?m not (?:an? )?(?:expert|gamer|developer|programmer|specialist)\b|\b(?:no|little|limited) (?:personal |hands-on |real )?experience\b/i;
const TESTET = /\bI (have )?(tested|reviewed|benchmarked|compared)\b|\bin my tests?\b/i;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Kontrollerer svaret. ekstraTjek(tekst) kan returnere en grund til afslag (fx en kilde uden for listen).
// Returnerer { ok, dele:[{sektion, tekst}] } eller { ok:false, grund }.
export function tjekStemme(svar, html, seneste = [], ekstraTjek = () => '') {
  const raa = String(svar || '').trim();
  if (!raa || /^NONE\b/i.test(raa)) return { ok: false, grund: 'ingen holdning passer til emnet' };
  let j = null; try { j = JSON.parse((raa.match(/\[[\s\S]*\]/) || ['null'])[0]); } catch { /* nedenfor */ }
  if (!Array.isArray(j) || !j.length) return { ok: false, grund: 'svaret var ikke en JSON-liste med section/text' };
  const tilladte = sektioner(html);
  const brod = tekstAf(html);
  const dele = [];
  for (const x of j.slice(0, 2)) {
    const t = String(x?.text || '').trim().replace(/^["“]|["”]$/g, '').replace(/<[^>]+>/g, '').replace(/\s*\n+\s*/g, ' ').trim();
    const sektion = String(x?.section || '').trim();
    if (!t) continue;
    // "Jeg har ingen erfaring med …" lyder svagt midt i en artikel (Jacob 31/10-2026, prøve #37): afsnittet springes over
    if (INGEN_ERFARING.test(t)) continue;
    if (!tilladte.includes(sektion)) return { ok: false, grund: `sektionen "${sektion.slice(0, 50)}" findes ikke` };
    const ss = t.split(/(?<=[.!?])\s+/).filter((y) => y.split(/\s+/).length >= 3);
    if (ss.length < 2 || ss.length > 3) return { ok: false, grund: `et afsnit har ${ss.length} sætninger (skal være 2-3)` };
    if (PRIVAT.test(t)) return { ok: false, grund: 'privat oplysning' };
    if (FIRMAER.test(t)) return { ok: false, grund: 'firmanavn' };
    if (TESTET.test(t)) return { ok: false, grund: 'påstår at have testet' };
    if (/AdSense|rejected my (site|blog|application)/i.test(t)) return { ok: false, grund: 'AdSense-historien må ikke stå i artikler' };
    const frase = genbrugtFrase(t, seneste);
    if (frase) return { ok: false, grund: `genbrugt formulering: "${frase}"` };
    const opbrugt = overbrugte(seneste).find((navn) => ANEKDOTER[navn].test(t));
    if (opbrugt) return { ok: false, grund: `historien er brugt op for nu: ${opbrugt}` };
    const nyeTal = [...t.matchAll(/\d[\d,.]*/g)].map((m) => m[0].replace(/[.,]$/, '')).filter((n) => !brod.includes(n));
    if (nyeTal.length) return { ok: false, grund: `tal, artiklen ikke har: ${nyeTal.join(', ')}` };
    const ekstra = ekstraTjek(t);
    if (ekstra) return { ok: false, grund: ekstra };
    if (dele.some((d) => d.sektion === sektion)) continue;
    dele.push({ sektion, tekst: t });
  }
  if (!dele.length) return { ok: false, grund: 'ingen brugbare afsnit' };
  const historier = Object.entries(ANEKDOTER).filter(([, re]) => dele.some((d) => re.test(d.tekst))).map(([navn]) => navn);
  if (historier.length > 1) return { ok: false, grund: `${historier.length} af hans historier i samme artikel (højst 1)` };
  if (!dele.some((d) => FOERSTE_PERSON.test(d.tekst))) return { ok: false, grund: 'ikke i første person' };
  return { ok: true, dele };
}

// Sætter afsnittet ind som <p> sidst i den valgte sektion (lige før næste <h2>, eller sidst i teksten).
export function fletInd(html, sektion, tekst) {
  const h2 = [...String(html).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const i = h2.findIndex((m) => tekstAf(m[1]) === sektion);
  if (i < 0) return html;
  const slut = h2[i + 1] ? h2[i + 1].index : html.length;
  return html.slice(0, slut) + `<p>${esc(tekst)}</p>` + html.slice(slut);
}
