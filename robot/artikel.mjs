// TRIN 2 — skriver ÉN prøveartikel ud fra en søgeordspakke (1 hoved + 5 beslægtede).
// Kører på GitHub (workflowet "Robot (manuel)", opgave "proeveartikel"), som
// gemmer resultatet på en egen gren (udkast-…) — ALDRIG på main. Intet udgives,
// før Jacob har godkendt artiklen.
// TRIN 3 (26/9): samme fil bruges af tidsplanen (robot/plan.mjs, workflowet
// "Robot (tidsplan)"), som udgiver direkte på main — højst 2 om dagen, fridage i robot/plan.mjs (FRIDAGE).
//
// Trin:
//  1. Søgeordslisten laves (robot/soegeord.mjs) og Gemini vælger en pakke, der
//     er et fornuftigt, varigt emne (ikke nyheder, priser, sludder).
//  2. Gemini skriver artiklen MED Google-søgning. Uden mindst 2 kontrollerede
//     kilder afvises artiklen (Gemini søger ellers ikke altid — målt 26/9).
//  3. Interne links: 3-5 til eksisterende artikler (kun adresser, der findes).
//  4. To billeder med Gemini (Cloudflare som reserve) — Jacobs valg 26/9. Ny billedopskrift 31/10 (robot/lib/billeder.mjs).
//  5. Trin 7 i svar-arkivet (Jacob 29/10-2026): ingen video (YouTube-delen og etiketten "Video" er fjernet;
//     sitet viser ikke videoer mere), titlen er spørgsmålet, og artiklen begynder med det korte svar.
//  6. Jacobs hjerne (30/10-2026): stilen fra jacob-hjerne er altid med i skriveprompten, og når emnet rammer
//     hans holdninger, flettes 1-2 korte afsnit i første person ind (robot/lib/hjerne.mjs). Uden hjerne: ingen artikel.
//  7. Omskrivning (30/10-2026): --omskriv <sti> skriver en ældre artikel om med samme opskrift. Adressen og den
//     oprindelige udgivelsesdato beholdes, "updated" sættes. --maade titel: kun ny titel og beskrivelse.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { somSporgsmaal } from '../src/lib/sporgsmaal.mjs';
import { EKSTRA_ETIKETTER } from '../src/lib/adresse.mjs';
import { skriv, json, gemPrisVedExit } from './lib/gemini.mjs';
gemPrisVedExit('artikel');   // pristælleren (trin 7): robot/ud/pris-artikel.json, også når artiklen afvises
import { lav, MOTIVREGLER } from './lib/billeder.mjs';
import { kontrollerKilder, kildeliste } from './lib/links.mjs';
import { kunKontrolleredeFakta, kildeNavneTekst, ukendteKilder, udenEgenKildeliste, KILDE_LOFT, KILDE_LOFT_MAKS } from './lib/kildenavne.mjs';
import { artikler, sti, emner } from './lib/arkiv.mjs';
import { lavIndeks, mestEns } from './lib/dubletter.mjs';
import { linkIndsaet, udenLinks } from './lib/linkfrase.mjs';
import { faqSchema } from '../src/lib/faqschema.mjs';
import { delAfsnit, fjernGentagelser, fyldKandidater, antalKropSaetninger, fjernSaetninger, samlEnkelte } from './lib/afsnit.mjs';
import { rensMarkdown, markdownRest, udenFedeSoegeord, foersteAfsnit, antalOrd, FOERSTE_MAKS, saetninger, uklarKilde, klistretSoegeord, storeBogstaver } from './lib/sprog.mjs';
import { laesHjerne, stemmeBlok, stemmePrompt, tjekStemme, fletInd, senesteStemmeAfsnit } from './lib/hjerne.mjs';
import { kildeHenvisninger } from './lib/kildenavne.mjs';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { hentKildeTekster, vaerdier, talUdenKilde, synligTekst } from './lib/talvagt.mjs';

const arg = (navn) => { const i = process.argv.indexOf(`--${navn}`); return i > 0 ? (process.argv[i + 1] || '') : ''; };
const EMNE = arg('emne');
const HOVED = arg('hoved').trim().toLowerCase();
const OMSKRIV = arg('omskriv').trim().replace(/\.html$/, '');   // fx /2026/05/the-best-ai-detector-free-tools-to-spot
const MAADE = arg('maade') || 'fuld';                           // 'fuld' eller 'titel'
const rapport = [];
const log = (t) => { rapport.push(t); console.log(t); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kodet = (s) => s.split('/').map(encodeURIComponent).join('/');

// Jacobs hjerne (30/10-2026): uden hjernen skrives intet (samme regel som techfeedwatch 25/10). Tjekkes FØR noget
// koster penge, og før et søgeord vælges (så et søgeord ikke hviler 30 dage pga. en manglende nøgle).
const hjerne = laesHjerne();
if (!hjerne) throw new Error('Hjernen mangler (_hjerne / HJERNE_DIR) — intet skrives uden Jacobs stemme. Tjek læsenøglen HJERNE_NOEGLE.');
log(`- Hjernen er med (${['core', 'voice', 'beliefs', 'emner', 'erfaringer'].filter((k) => hjerne[k]).join(', ')})`);
// robot/ud oprettes her, før vejene deler sig (30/10: omskrivningen fejlede, fordi mappen kun blev lavet i "ny artikel"-vejen)
fs.mkdirSync(sti('robot/ud'), { recursive: true });

// Omskrivning: den gamle artikel læses (frontmatter + tekst)
const gammelFil = OMSKRIV ? sti(`src/content/posts${OMSKRIV}.md`) : '';
let gammel = null;
if (OMSKRIV) {
  if (!fs.existsSync(gammelFil)) throw new Error(`Omskrivning: ${OMSKRIV} findes ikke`);
  const raa = fs.readFileSync(gammelFil, 'utf8');
  const d = raa.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  gammel = { fm: yamlParse(d[1]) || {}, krop: d[2] };
  if (gammel.fm.omskrevet) throw new Error(`Omskrivning: ${OMSKRIV} er allerede skrevet om (${gammel.fm.omskrevet})`);
}
const gemFrontmatter = (fm, krop) => fs.writeFileSync(gammelFil, `---\n${yamlStringify(fm, { lineWidth: 0 }).trimEnd()}\n---\n${krop}`);
const iDag = new Date().toISOString().slice(0, 10);

// --- 0. Kun ny titel og beskrivelse (Jacob 29/10: OpenFutureAI ligger på plads 6,8 — teksten røres ikke) ----
if (OMSKRIV && MAADE === 'titel') {
  const t = gammel.krop.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
  const m = await json(`An older article on techmediaarch.com is titled "${gammel.fm.title}". Its text starts:
${t}

Write a better title and meta description for the SAME text (the text itself will not change, so promise nothing it does not cover).
Return JSON {"title": "the question a reader would type into Google that this text answers, Title Case, ending with ?, at most 70 characters, no year", "description": "140-160 characters, plain and specific"}`);
  const titel = String(m.title || '').trim(); const besk = String(m.description || '').trim();
  if (!/\?$/.test(titel) || titel.length > 90 || besk.length < 100 || besk.length > 170) throw new Error(`Ny titel/beskrivelse bestod ikke kontrollen: "${titel}" / ${besk.length} tegn — artiklen afvist`);
  // seoTitle fjernes: det er den, Google viser i <title> (30/10, testkørsel 3: den gamle blev stående og skyggede for den nye)
  const { seoTitle, ...behold } = gammel.fm;
  gemFrontmatter({ ...behold, title: titel, description: besk, omskrevet: iDag, omskrivning: 'titel' }, gammel.krop);
  log(`- Kun titel: "${gammel.fm.title}" → "${titel}"\n- Beskrivelse: ${besk}`);
  fs.mkdirSync(sti('robot/ud'), { recursive: true });
  fs.writeFileSync(sti('robot/ud/proeveartikel.json'), JSON.stringify({ omskrevet: true, maade: 'titel', titel, sti: OMSKRIV }, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.join('\n') + '\n');
  process.exit(0);
}

// --- 1. Vælg pakke -----------------------------------------------------------
let valgt;
if (OMSKRIV) {
  // Omskrivning: søgeordene udledes af den gamle artikel (titel, overskrifter, begyndelse), så den nye
  // tekst svarer på det samme, som læserne fandt den gamle på.
  const overskr = [...gammel.krop.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  // En robotartikel fra før kildevagten (30/10) har allerede sine søgeord — de genbruges, så den svarer på det samme
  const egne = gammel.fm.keyword && Array.isArray(gammel.fm.relatedKeywords) && gammel.fm.relatedKeywords.length >= 3;
  const s = egne ? { hoved: gammel.fm.keyword, beslaegtede: gammel.fm.relatedKeywords } : await json(`An older article on techmediaarch.com will be rewritten as an evergreen explainer on the same subject.
Title: "${gammel.fm.title}"
Headings: ${overskr.slice(0, 20).join(' | ')}
Start of text: ${gammel.krop.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)}

Return JSON {"hoved": "the main search phrase people type into Google for this subject, lowercase, 2-7 words", "beslaegtede": ["5 different related search phrases, lowercase"]}`);
  valgt = { hoved: String(s.hoved || '').trim().toLowerCase(), beslaegtede: (Array.isArray(s.beslaegtede) ? s.beslaegtede : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 5), emne: (gammel.fm.labels || [])[0] || '' };
  if (!valgt.hoved || valgt.beslaegtede.length < 3) throw new Error('Omskrivning: Gemini gav ingen brugbare søgeord — artiklen afvist');
  log(`# Omskrivning\n\n**Adresse:** ${OMSKRIV}  \n**Gammel titel:** ${gammel.fm.title}  \n**Hovedsøgeord:** ${valgt.hoved}  \n**Beslægtede:** ${valgt.beslaegtede.join(' · ')}`);
} else {
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
valgt = kandidater[(vurdering.ok?.[0] || 0) - 1];
if (!valgt) throw new Error('Gemini godkendte ingen af pakkerne');
// Til tidsplanen (robot/plan.mjs): så et afvist søgeord kan hvile i 30 dage.
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/valgt.json'), JSON.stringify({ hoved: valgt.hoved, emne: valgt.emne }));
log(`# Prøveartikel\n\n**Emne:** ${valgt.emne}  \n**Hovedsøgeord:** ${valgt.hoved}  \n**Beslægtede:** ${valgt.beslaegtede.join(' · ')}`);
}

// --- 1b. Kun beslægtede søgeord om selve emnet (Jacob 31/10-2026) ----------------
// Målt 31/10: "How does generative AI create images" fik "should i learn generative ai" og "how long does it take to
// learn generative ai" med, og halvdelen af artiklen kom til at handle om jobs og læring. Nu vurderer Gemini, hvilke
// beslægtede søgeord artiklen naturligt svarer på; resten droppes (også fra research, FAQ og frontmatter).
{
  try {
    const r = await json(`Main topic of an explainer article: "${valgt.hoved}".
For each related search phrase, answer whether it asks about the SAME subject, so an article on the main topic would naturally answer it.
Say no to side topics: careers, whether/how long to learn it, salaries, prices of unrelated products, other products or brands, news.
Return JSON {"samme": [numbers of the phrases on the same subject]}
${valgt.beslaegtede.map((k, i) => `${i + 1}. ${k}`).join('\n')}`);
    const ok = new Set((Array.isArray(r.samme) ? r.samme : []).map((n) => parseInt(n, 10)));
    const beholdt = valgt.beslaegtede.filter((_, i) => ok.has(i + 1));
    const droppet = valgt.beslaegtede.filter((_, i) => !ok.has(i + 1));
    if (beholdt.length) valgt.beslaegtede = beholdt;
    log(`- Beslægtede søgeord om selve emnet: ${beholdt.length} af ${beholdt.length + droppet.length}${droppet.length && beholdt.length ? ` · droppet: ${droppet.join(' · ')}` : ''}${beholdt.length ? '' : ' (ingen vurderet relevante — alle beholdt)'}`);
  } catch (e) { log(`- Beslægtede søgeord: vurdering fejlede (${e.message.slice(0, 80)}) — alle beholdt`); }
}

// --- 2. Interne link-kandidater ---------------------------------------------
const arkiv = artikler();
const indeks = lavIndeks(arkiv.filter((a) => a.sti.startsWith('/20')));
const linkKand = [];
for (const q of [valgt.hoved, ...valgt.beslaegtede]) for (const m of mestEns(q, indeks, 6)) if (!linkKand.some((k) => k.sti === m.sti)) linkKand.push(m);
const titelAf = (s) => arkiv.find((a) => a.sti === s)?.titel || s;
// Kandidater: de 12 med flest fælles ord + alle artikler i samme emne. Målt 26/9
// (kørsel #11): ordlisten alene fandt ingen LLM-artikler til en LLM-artikel,
// fordi titlerne siger "DeepSeek", "ChatGPT", "Claude" — ikke "language model".
const iEmne = arkiv.filter((a) => a.sti.startsWith('/20') && a.labels.includes(valgt.emne)).map((a) => ({ sti: a.sti }));
// Ved omskrivning aldrig et link til artiklen selv
const kandListe = [...linkKand.filter((m) => m.sti !== OMSKRIV).slice(0, 12), ...iEmne.filter((m) => m.sti !== OMSKRIV)].filter((m, i, arr) => arr.findIndex((x) => x.sti === m.sti) === i)
  .slice(0, 40).map((m) => ({ href: kodet(m.sti), sti: m.sti, titel: titelAf(m.sti) }));
// Kun artikler, der reelt handler om det samme. Prøveartikel 2 (26/9) fik tvunget
// 3 links ind via ordet "market" (bl.a. Trump/Stargate) — relevans vinder over antal.
let interne = [];
let relevante = []; // karakter 2-3: kun dem får et link TIL den nye artikel (trin 8)
if (kandListe.length) {
  // Karakter 0-3 i stedet for ja/nej: målt 26/9 (kørsel #11-13) svarede den
  // billige model [] på et ja/nej-spørgsmål, selv med DeepSeek/ChatGPT-artikler
  // på listen til en artikel om sprogmodeller. 2-3 kommer med.
  const rel = await json(`New article topic: "${valgt.hoved}".
Rate each existing article for how useful it would be as a "further reading" link for readers of the new article:
3 = same subject, 2 = closely related subject a reader would likely want next, 1 = loosely related, 0 = unrelated (sharing a generic word like "AI" or "market" is not enough for 2).
Return JSON {"ratings":[{"n": number, "score": 0-3}]} covering every article.
${kandListe.map((k, i) => `${i + 1}. ${k.titel}`).join('\n')}`);
  const alleKar = (Array.isArray(rel.ratings) ? rel.ratings : []).map((r) => ({ k: kandListe[parseInt(r.n, 10) - 1], score: Number(r.score) || 0 })).filter((r) => r.k);
  const karakterer = alleKar.filter((r) => r.score >= 2).sort((x, y) => y.score - x.score);
  log(`- Karakterer ≥2: ${karakterer.map((r) => `${r.score}: ${r.k.titel.slice(0, 50)}`).join(' | ') || 'ingen'}`);
  interne = karakterer.map((r) => r.k).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 5);
  relevante = [...interne];
  // Mindst 2 interne links (Jacob 5/10-2026): prøve #23 og #24 fik 0, fordi ingen af 13 kandidater fik 2+.
  // Fyldes op med karakter 1 ("løst beslægtet") fra SAMME emne, mest lignende først. Karakter 0 kommer
  // aldrig med (26/9-reglen: hellere færre end forkerte). Links fra ældre artikler bruger kun de relevante.
  if (interne.length < 2) {
    const iEmneSti = new Set(iEmne.map((m) => m.sti));
    const ekstra = alleKar.filter((r) => r.score === 1 && iEmneSti.has(r.k.sti) && !interne.includes(r.k))
      .sort((x, y) => kandListe.indexOf(x.k) - kandListe.indexOf(y.k)).map((r) => r.k)
      .filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 2 - interne.length);
    interne = [...interne, ...ekstra];
    log(`- Løst beslægtede (karakter 1, samme emne) lagt til: ${ekstra.length}${ekstra.length ? ` (${ekstra.map((k) => k.titel.slice(0, 40)).join(' | ')})` : ''}`);
  }
}
log(`- Interne link-kandidater: ${kandListe.length}, relevante ifølge Gemini: ${relevante.length}, til artiklen i alt: ${interne.length}`);

// --- 3. Research: søg og saml fakta med kilder ------------------------------
// Målt 26/9: når Gemini både skal søge OG skrive, springer den ofte søgningen
// over (0 kilder i 2 af 2 forsøg i kørsel #7). En opgave, der KUN går ud på at
// søge, udløser søgningen langt mere sikkert. Søger den billige model stadig
// ikke, prøves en større som reserve.
const researchOpgave = `Use Google Search to research these questions for a factual explainer article:
- ${[valgt.hoved, ...valgt.beslaegtede].join('\n- ')}
Return 25-40 short bullet points of concrete, verified facts (definitions, how it works, examples, numbers with dates, steps, comparisons, best practices). Cover every question above with at least 3 different facts, and never repeat the same fact in other words. Only include facts you found in search results.
Start every bullet with the name of the organization, agency, company or publication the fact comes from (e.g. "IBM: ...", "NIST: ...").
Prefer primary, authoritative sources: the official documentation and help pages of the product's maker (e.g. Apple, Microsoft, Google), standards bodies and government agencies (e.g. NIST, CISA), universities and research labs, and established publications. Use a company's marketing blog only for facts about that company's own product, and only when no better source has the fact.`;
// ↑ Kildeorden (Jacob 31/10-2026): målt 31/10 var de fleste kilder sælgernes egne blogs (DomoAI, Animaker, CityMac, Iru).
// ↑ Kildenavnet i hvert punkt (5/10-2026): uden det skrev Gemini "industry experts note" (18 sætninger i 8 af 15 artikler).
let fakta = ''; let kilder = []; let stoette = [];
for (const model of [undefined, undefined, 'gemini-3.5-flash', 'gemini-2.5-flash']) {
  try {
    const r = await skriv(researchOpgave, { soeg: true, temperatur: 0.2, ...(model ? { model } : {}) });
    if (r.kilder.length >= 2) { fakta = r.tekst; kilder = r.kilder; stoette = r.stoette || []; log(`- Research: ${r.kilder.length} kilder, ${(r.tekst.match(/^\s*(?:[-*•]|\d+\.)\s+/gm) || []).length} faktapunkter (${model || 'standardmodel'}).`); break; }
    log(`- Research (${model || 'standardmodel'}): ${r.kilder.length} kilder — prøver igen.`);
  } catch (e) { log(`- Research (${model}): ${e.message.slice(0, 120)}`); }
}
if (kilder.length < 2) throw new Error(`Research gav kun ${kilder.length} kilder — artiklen afvist`);

// Kun kilder, der står under "Sources" (Jacob 29/10-2026). Før blev kilderne kontrolleret EFTER skrivningen, og kun
// de første 4 kom på listen — prøve #31 nævnte ca. 15 kilder i teksten med 4 på listen. Nu: kontrollér op til 20,
// skriv kun ud fra fakta fra de kontrollerede (Googles kobling, ellers navnet), og vis præcis de kilder, fakta
// kommer fra. Se robot/lib/kildenavne.mjs. Prøve #32 blev afvist med 10 fakta via navnet alene — derfor koblingen.
const MIN_FAKTA = 12;
const { sat: kontrollerede, afvist: kildeAfvist } = await kontrollerKilder(kilder, 20);
const kf = kunKontrolleredeFakta(fakta, kontrollerede, stoette, { loft: KILDE_LOFT, minFakta: MIN_FAKTA, maksLoft: KILDE_LOFT_MAKS });
const kildeLinks = kf.brugte;
log(`- Kilder kontrolleret før skrivning: ${kontrollerede.length} bestod (${kildeAfvist.length} afvist: ${kildeAfvist.map((a) => `${a.kilde} – ${a.grund}`).join('; ') || 'ingen'})`);
log(`- Fakta fra kontrollerede kilder: ${kf.beholdt} af ${kf.alle} (${kf.viaGoogle} via Googles kobling, ${kf.viaNavn} via navnet; ${stoette.length} koblinger fra Google)${kf.smidt.length ? ` · uden kontrolleret kilde: ${kf.smidt.join(', ')}` : ''}`);
log(`- Kildeloft (${KILDE_LOFT}, højst ${KILDE_LOFT_MAKS}): ${kildeLinks.length} af ${kf.kilderFoerLoft} kilder med fakta bruges · fakta væk pga. loftet: ${kf.overLoft}`);
// Research-data til måling bagefter (kommer med i kørslens zip, robot-ud): fakta, Googles koblinger og kilderne.
fs.writeFileSync(sti('robot/ud/research.json'), JSON.stringify({ fakta, stoette, kontrollerede, kildeAfvist }, null, 1));
if (kildeLinks.length < 2) throw new Error(`Kun ${kildeLinks.length} kontrollerede kilder har fakta — artiklen afvist`);
if (kf.beholdt < MIN_FAKTA) throw new Error(`Kun ${kf.beholdt} fakta fra kontrollerede kilder (mindst ${MIN_FAKTA}) — artiklen afvist`);
fakta = kf.tekst;
const kildeNavn = kildeNavneTekst(kildeLinks);

// --- 4. Skriv artiklen ud fra de fakta ---------------------------------------
// Omskrivning: emnerne fra den gamle version (kun overskrifterne — dens tekst og tal er ikke kontrolleret)
const gamleEmner = gammel ? [...gammel.krop.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter((h) => h && !/^(FAQ|Frequently Asked|Key Takeaways|Conclusion|Wrapping Up)/i.test(h)).slice(0, 15) : [];
const opgave = `Write an in-depth, genuinely helpful English article for techmediaarch.com.
Main keyword: "${valgt.hoved}"
Related questions readers ask (answer each where it fits — they are topics, not phrases to copy): ${valgt.beslaegtede.map((k) => `"${k}"`).join(', ')}
${gamleEmner.length ? `This article replaces an older one on the same page titled "${gammel.fm.title}". Readers came for these subjects, so cover them where the researched facts allow (never take facts from the old article): ${gamleEmner.join(' | ')}\n` : ''}
${stemmeBlok(hjerne)}

Base all factual claims on these researched facts (do not add other numbers, dates or quotes):
${fakta}

Rules:
- At least 1200 words, 7-10 sections with <h2> (and <h3> where useful), each section 120-250 words. Write longer only when the researched facts give enough material; never pad to reach a length (Jacob 6/10-2026).
- Write like a technology journalist at a news publication, not like an analyst or a marketer (Jacob 28/9-2026):
  lead with the most important facts, attribute facts to their source in the sentence ("according to IBM", "NIST defines ..."),
  short paragraphs, concrete examples, neutral tone, no hype words, no "our analysis", "the verdict" or "key takeaways" framing.
- Paragraphs like a news site (Jacob 5/10-2026, rule C 6/10): most paragraphs are 2 connected sentences of at most 55 words together, or 3 short sentences of at most 40 words. Use a one-sentence paragraph only now and then for emphasis, never several in a row.
- Attribute a fact once, where it first appears. Vary how sources are named and where ("CompTIA defines ...", "..., according to Coursera"); sentences that explain, compare or give context need no source. Never start most sentences with "X notes/reports/states that".
- Never repeat a fact, number or sentence that already appears in another section (the FAQ may summarise).
- Every sentence must tell the reader something concrete: a fact, a definition, an example, a step or a clear comparison. No generic filler that could sit in any article on the topic ("Both roles are critical for modern organizations.", "Companies must invest in skilled personnel.").
- Include at least 2 lists (<ul> or <ol>, 3-6 items each) where they genuinely help the reader: steps, options, key differences, benefits or risks. Introduce each list with one sentence.
- The first paragraph is a short, direct answer to the main keyword: 2 sentences, at most 50 words, plain language. Context and numbers come after it.
- Start the article with that short answer as a <p>. The very first element must be the answer paragraph, never a heading (no "Introduction" or "Understanding ..." heading before it).
- Search phrases are often ungrammatical ("what is phishing attack", "how does seo work"). Never paste a keyword verbatim into a sentence where it reads wrongly; write correct English ("how phishing attacks work"). Never put keywords in bold, quotes or <strong>.
- Search phrases are written in lowercase; your text never is. Write every name and abbreviation with correct capitals (Apple, MDM, AI, YouTube, macOS, SEO). Never copy a search phrase word for word into a sentence ("An apple mdm enrollment guide explains ..."); describe the subject the way an expert would ("Enrolling Macs in Apple's device management ...").
- Explain the subject in depth: how it works, why, and what the reader should do. Stay on the main topic; do not drift into careers, learning paths or general market trends unless the main keyword asks about them.
- Every number, statistic and quoted definition names its source from the facts (an organization, agency, company or publication). Never use vague attributions such as "experts say", "industry experts note", "researchers confirm", "analysts point out", "studies show" or "according to market research".
- Name ONLY these sources: ${kildeNavn}. Use the name before the brackets ("according to IBM"), never a bare web address. Never name any other organization, company, publication or website as a source, even if a fact mentions one; then name the listed source the fact comes from.
- Do not write a list of sources, a "Sources" or "References" section, or a line of web addresses: the source list is added automatically.
- Include one FAQ section (<h2>FAQ</h2>) with AT LEAST 5 questions as <h3>, each followed by a 2-4 sentence answer in <p>.
  Phrase the questions the way people ask them, built from the related questions and the main topic, in correct English with capitals ("How do I enroll a Mac in Apple MDM?"); every question must be different.
- Never claim personal testing or experience ("I tested", "in my experience", "we tried").
- Link to 3-5 of these existing articles where relevant, using the exact href and a natural anchor text:
${interne.map((l) => `  ${l.href}  (${l.titel})`).join('\n') || '  (none)'}
- No other links. No images. No markdown.
Output ONLY the article body as HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>). No <html>, no title, no code fences.`;
const { tekst } = await skriv(opgave);
let html = rensMarkdown(tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
// Gemini skriver kortere end bedt om (målt 26/9: 857 ord mod 1400-1900 bedt om).
// Er udkastet under 1200 ord, får den det tilbage og skal uddybe — kun med de researchede fakta.
// Kravet var 1600/1500 ord til 6/10: prøve #29 nåede det kun med fyld (Gemini udpegede selv 37
// fyldsætninger). Jacob 6/10: mindst 1200 ord, længere kun når fakta rækker, og mere research.
const ordI = (h) => h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
if (ordI(html) < 1200) {
  log(`- Udkast 1: ${ordI(html)} ord — beder Gemini uddybe til mindst 1200.`);
  const udv = await skriv(`Here is a draft article (HTML) about "${valgt.hoved}". Expand it to at least 1300 words by deepening the existing sections with concrete explanations, examples and practical guidance taken from the facts below. If the facts do not support more text, add less: never pad with generic sentences. Use only these researched facts for any numbers, dates or claims:\n${fakta}\nName only these sources, never any other: ${kildeNavn}.\nKeep all existing links exactly as they are, keep the FAQ, add no new links, never claim personal testing.
Keep the first paragraph exactly as it is (it is a short direct answer). Most paragraphs 2 connected sentences (at most 55 words together) or 3 short ones (at most 40 words), never several one-sentence paragraphs in a row; keep the existing lists. Name the source of numbers and statistics once, varying how; no vague attributions ("experts say", "studies show"). Never repeat a fact or sentence that is already in the article. Every new sentence must add something concrete (a fact, definition, example, step or comparison); no generic filler. Never paste ungrammatical search phrases into sentences, never bold keywords, no markdown.
Output ONLY the full expanded article body as HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>).

${html}`);
  const ny = rensMarkdown(udv.tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
  if (ordI(ny) > ordI(html)) html = ny;
  log(`- Efter uddybning: ${ordI(html)} ord.`);
} else log(`- Udkast 1: ${ordI(html)} ord — ingen uddybning nødvendig.`);

// Svaret først (trin 7, Jacob 29/10-2026). Målt 28/10: 33 af 45 robotartikler begyndte med en indledende <h2>
// ("Introduction to …", "Understanding …") og havde svaret i afsnittet under. Står der stadig en overskrift først,
// flyttes det første afsnit op foran den — ingen ord ændres. Sitet viser det første afsnit som forspalte.
{
  const ind = html.match(/^\s*(<h[23]\b[^>]*>[\s\S]*?<\/h[23]>)\s*(<p\b[^>]*>[\s\S]*?<\/p>)/i);
  if (ind) { html = ind[2] + ind[1] + html.slice(ind[0].length); log(`- Svaret først: afsnittet er flyttet op foran "${ind[1].replace(/<[^>]+>/g, '').slice(0, 60)}"`); }
  else log('- Svaret først: artiklen begyndte allerede med svaret');
}

// Fjern alle links, der ikke er et af de tilladte interne (Gemini må ikke selv finde på links).
const tilladt = new Set(interne.map((l) => l.href));
html = html.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (hel, href, indre) => (tilladt.has(href) ? `<a href="${href}">${indre}</a>` : indre));
const brugteInterne = [...new Set([...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]))];
if (brugteInterne.length < 3) { // kun fra de RELEVANTE kandidater — hellere færre end forkerte
  const flere = interne.filter((l) => !brugteInterne.includes(l.href)).slice(0, 3 - brugteInterne.length);
  if (flere.length) html += `<h2>Related reading</h2><ul>${flere.map((l) => `<li><a href="${l.href}">${esc(l.titel)}</a></li>`).join('')}</ul>`;
}
const antalInterne = [...new Set([...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]))].length;

// Første-persons-påstande er forbudt — stop hellere end at udgive dem.
const forbudt = html.match(/\b(I tested|I tried|in my experience|we tested|we tried|I've used|I have used)\b/i);
if (forbudt) throw new Error(`Artiklen indeholder en førstepersons-påstand: "${forbudt[0]}"`);

// FAQ: mindst 5 spørgsmål (Jacob 29/9). Tælles med sitets egen regel (src/lib/faqschema.mjs), så robot og
// site er enige. Er der færre, skrives KUN FAQ-afsnittet om én gang; lykkes det ikke, afvises artiklen.
const antalFaq = (h) => (faqSchema(h)?.mainEntity || []).length;
if (antalFaq(html) < 5) {
  log(`- FAQ: ${antalFaq(html)} spørgsmål - beder Gemini om mindst 5.`);
  const m = html.match(/<h2[^>]*>\s*(?:FAQ|Frequently Asked Questions)\s*<\/h2>[\s\S]*?(?=<h2\b|$)/i);
  const ny = await skriv(`Rewrite this FAQ section of an article about "${valgt.hoved}" so it has AT LEAST 5 different questions as <h3>, each followed by a 2-4 sentence answer in <p>.
Keep the existing questions and answers; add new ones built from these search phrases: ${valgt.beslaegtede.map((k) => `"${k}"`).join(', ')}.
Base answers only on these researched facts (no other numbers, dates or quotes):\n${fakta}
Journalistic, neutral tone. No links. Start with <h2>FAQ</h2>. Output ONLY the HTML of the FAQ section.

${m ? m[0] : '<h2>FAQ</h2>'}`);
  const faqNy = rensMarkdown(ny.tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
  if (antalFaq(faqNy) >= 5) html = m ? html.replace(m[0], () => faqNy) : html + faqNy;
}
if (antalFaq(html) < 5) throw new Error(`FAQ har kun ${antalFaq(html)} spørgsmål (mindst 5) - artiklen afvist`);
log(`- FAQ: ${antalFaq(html)} spørgsmål.`);

// --- 4b. Sproglig efterkontrol (Jacob 5/10-2026, forslag 3) -------------------
// Reglerne står i opgaven, men Gemini følger dem ikke altid. Målt 5/10 på de 15
// første robotartikler: første afsnit 70-170 ord (median 108), 24 sætninger med
// klistrede søgeord, 18 med uklare kilder, 21 søgeord med fed skrift. Her
// kontrolleres det, og KUN det, der fejler, sendes tilbage til Gemini.
const soegeord = [valgt.hoved, ...valgt.beslaegtede];
const fedFoer = (html.match(/<(strong|b)>/gi) || []).length;
html = udenFedeSoegeord(html, soegeord);
log(`- Fede søgeord pakket ud: ${fedFoer - (html.match(/<(strong|b)>/gi) || []).length}`);
const hrefs = (h) => [...h.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0]).sort().join('|');
// Første afsnit: for langt → deles i et kort svar + et afsnit med resten (ingen fakta forsvinder).
const foerste = foersteAfsnit(html);
if (foerste && antalOrd(foerste) > FOERSTE_MAKS) {
  try {
    const d = await skriv(`Split this opening paragraph of an article about "${valgt.hoved}" into two paragraphs.
The first paragraph is a direct answer to the topic: 2 sentences, at most 50 words, plain language, correct English (do not paste the search phrase if it is ungrammatical).
The second paragraph keeps all remaining information from the original, with the wording as close to the original as possible.
Keep every <a> tag exactly as it is. No markdown. Output ONLY the two <p> elements.

${foerste}`);
    const nyF = rensMarkdown(d.tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
    const ok = /^<p\b/i.test(nyF) && antalOrd(foersteAfsnit(nyF)) <= FOERSTE_MAKS && hrefs(nyF) === hrefs(foerste);
    if (ok) html = html.replace(foerste, () => nyF);
    log(`- Første afsnit: ${antalOrd(foerste)} ord → ${ok ? `${antalOrd(foersteAfsnit(nyF))} ord (delt i to)` : 'uændret (Geminis forslag bestod ikke kontrollen)'}`);
  } catch (e) { log(`- Første afsnit: ${antalOrd(foerste)} ord, deling fejlede (${e.message.slice(0, 80)})`); }
} else log(`- Første afsnit: ${antalOrd(foerste)} ord`);
// Sætninger med uklare kilder eller klistrede søgeord → Gemini retter netop dem.
const daarlige = () => saetninger(html).map((s) => ({ s, uklar: uklarKilde(s), klistret: klistretSoegeord(s, soegeord), ukendt: ukendteKilder(s, kildeLinks).length > 0 })).filter((x) => x.uklar || x.klistret || x.ukendt);
const foerRet = daarlige();
if (foerRet.length) {
  try {
    const r = await json(`Fix each numbered sentence from an article about "${valgt.hoved}".
- If it uses a vague attribution (marked VAGUE), name the specific source from the facts below, or drop the attribution and keep the plain fact if no source fits.
- If it contains a search phrase pasted in ungrammatically (marked PHRASE), rephrase it into correct, natural English.
- If it names a source that is not on the source list below (marked UNLISTED), name the listed source the fact comes from (see the facts), or drop the attribution and keep the plain fact.
Keep every HTML tag (especially <a ...>...</a>) exactly as it is. Change nothing else.
Source list (the only sources the article may name): ${kildeNavn}
Facts with sources:\n${fakta}
Return JSON {"fixes":[{"n": number, "new": "the corrected sentence with its HTML"}]}
${foerRet.map((x, i) => `${i + 1}. [${[x.uklar && 'VAGUE', x.klistret && 'PHRASE', x.ukendt && 'UNLISTED'].filter(Boolean).join('+')}] ${x.s}`).join('\n')}`);
    let rettet = 0;
    for (const f of Array.isArray(r.fixes) ? r.fixes : []) {
      const x = foerRet[parseInt(f.n, 10) - 1]; const ny = rensMarkdown(String(f.new || '').trim());
      if (!x || !ny || hrefs(ny) !== hrefs(x.s) || uklarKilde(ny) || klistretSoegeord(ny, soegeord) || ukendteKilder(ny, kildeLinks).length || !html.includes(x.s)) continue;
      html = html.replace(x.s, () => ny); rettet++;
    }
    log(`- Sætninger med uklare kilder/klistrede søgeord/kilder uden for listen: ${foerRet.length} fundet (heraf ${foerRet.filter((x) => x.ukendt).length} uden for listen), ${rettet} rettet, ${daarlige().length} tilbage`);
  } catch (e) { log(`- Sætningsretning fejlede (${e.message.slice(0, 80)}) — ${foerRet.length} sætninger uændret`); }
} else log('- Sætninger med uklare kilder/klistrede søgeord/kilder uden for listen: 0');

// Kilder uden for listen, der stadig står der efter rettelsen, fjernes (Jacob 29/10-2026: robotten må kun nævne
// kilder fra "Sources"). Står en i det korte svar, eller er der over 6, afvises artiklen hellere.
const udenForListen = () => saetninger(html).map((s) => ({ s, navne: ukendteKilder(s, kildeLinks) })).filter((x) => x.navne.length);
const tomt = (h) => h.replace(/<(p|li)\b[^>]*>\s*<\/\1>/gi, '').replace(/<(ul|ol)\b[^>]*>\s*<\/\1>/gi, '');
{
  const rest = udenForListen();
  if (rest.some((x) => foersteAfsnit(html).includes(x.s))) throw new Error(`Det korte svar nævner en kilde, der ikke står under Sources (${rest[0].navne.join('+')}) — artiklen afvist`);
  if (rest.length > 6) throw new Error(`${rest.length} sætninger nævner kilder, der ikke står under Sources — artiklen afvist`);
  for (const x of rest) html = html.replace(x.s, '');
  html = tomt(html);
  log(`- Kilder uden for listen: ${rest.length} sætninger fjernet${rest.length ? ` (${rest.map((x) => x.navne.join('+')).join(', ')})` : ''}`);
}

// Lister (Jacob 5/10-2026): mindst 2. Mangler de, omskriver Gemini 1-2 afsnit, hvor en liste hjælper læseren.
// Kun hvis afsnittet findes ordret, alle links bevares, og næsten alle ord er med (ingen fakta forsvinder).
const antalLister = () => (html.match(/<(ul|ol)\b/gi) || []).length;
if (antalLister() < 2) {
  // Ikke FAQ-svarene (FAQ-boksen og FAQ-dataene bygger på dem) og ikke første afsnit (det korte svar)
  const faqPos = html.search(/<h2[^>]*>\s*(?:FAQ|Frequently Asked Questions)/i);
  const kandAfsnit = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].filter((m) => faqPos < 0 || m.index < faqPos).map((m) => m[0])
    .filter((p) => antalOrd(p) >= 35 && antalOrd(p) <= 140 && p !== foersteAfsnit(html));
  try {
    const r = await json(`From an article about "${valgt.hoved}", choose ${2 - antalLister()} of the numbered paragraphs where a bulleted or numbered list would genuinely help the reader (steps, options, differences, benefits or risks), and rewrite each as one short intro sentence in <p> followed by a <ul> or <ol> with 3-6 <li> items.
Keep every fact, number and name; add nothing. Keep every <a ...>...</a> tag exactly. No markdown, no bold keywords.
Return JSON {"lists":[{"n": number, "html": "<p>...</p><ul><li>...</li></ul>"}]}
${kandAfsnit.slice(0, 30).map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    let lavet = 0;
    for (const x of (Array.isArray(r.lists) ? r.lists : []).slice(0, 2)) {
      const fra = kandAfsnit[parseInt(x.n, 10) - 1]; const til = rensMarkdown(String(x.html || '').trim());
      if (!fra || !html.includes(fra) || !/<(ul|ol)\b/i.test(til) || hrefs(til) !== hrefs(fra) || antalOrd(til) < antalOrd(fra) * 0.8 || uklarKilde(til)) continue;
      html = html.replace(fra, () => til); lavet++;
    }
    log(`- Lister: ${antalLister() - lavet} skrevet af Gemini, ${lavet} lavet bagefter → ${antalLister()} i alt`);
  } catch (e) { log(`- Lister: ${antalLister()} (omskrivning fejlede: ${e.message.slice(0, 80)})`); }
} else log(`- Lister: ${antalLister()}`);

// Korte afsnit (Jacob 5/10-2026): for lange afsnit deles mellem sætningerne (ingen ord ændres), robot/lib/afsnit.mjs
{ const d = delAfsnit(html); html = d.html; log(`- Afsnit delt: ${d.delt}`); }
{ const g = fjernGentagelser(html); html = g.html; log(`- Gentagne afsnit fjernet: ${g.fjernet} · afsnit med kun én sætning: ${g.enSaetning} af ${g.afsnit}`); }
// Fyldsætninger (Jacob 5/10-2026): Gemini udpeger sætninger, læseren intet lærer af; de fjernes uden omskrivning.
// Højst hver 5. sætning i brødteksten, så en for ivrig vurdering ikke kan tømme artiklen. Se robot/lib/afsnit.mjs.
{
  const kand = fyldKandidater(html);
  if (kand.length) {
    try {
      const r = await json(`Below are numbered sentences from an article about "${valgt.hoved}".
Mark only the FILLER sentences: generic statements a reader learns nothing from, which could sit in any article on the topic, with no concrete fact, definition, example, step or comparison.
Also mark a sentence that repeats a fact already given in an EARLIER numbered sentence (mark the later one, even if it explains something; 31/10-2026: an article said twice that tokens expire after a year).
Examples of filler: "Both roles are critical for modern organizations." "Companies must invest in skilled personnel." "Malicious actors constantly evolve their tactics."
Do NOT mark sentences that explain how something works, define a term, compare two things, give an example or tell the reader what to do. When unsure, do not mark.
Return JSON {"filler": [numbers]}.
${kand.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
      const valgte = [...new Set((Array.isArray(r.filler) ? r.filler : []).map((n) => parseInt(n, 10)))].filter((n) => n >= 1 && n <= kand.length).map((n) => kand[n - 1]);
      const maks = Math.floor(antalKropSaetninger(html) / 5);
      const f = fjernSaetninger(html, valgte, maks); html = f.html;
      log(`- Fyldsætninger: ${valgte.length} udpeget, ${f.fjernet} fjernet (loft ${maks})${f.fjernet ? ` — fx "${valgte[0].slice(0, 90)}"` : ''}`);
    } catch (e) { log(`- Fyldsætninger: tjek fejlede (${e.message.slice(0, 80)}) — intet fjernet`); }
  } else log('- Fyldsætninger: ingen kandidater');
}
// Saml enkeltsætninger, der står lige efter hinanden (Jacob 6/10-2026), robot/lib/afsnit.mjs. Ingen ord ændres.
{ const s = samlEnkelte(html); html = s.html; const g = fjernGentagelser(html); html = g.html; log(`- Enkeltsætninger samlet: ${s.samlet} · afsnit med kun én sætning nu: ${g.enSaetning} af ${g.afsnit}`); }

// Kilderne er kontrolleret før skrivningen (se "Kun kilder, der står under Sources" ovenfor).
// Geminis egen kildeliste/domæne-linje fjernes — den rigtige lægges på til sidst (prøve #33, 29/10).
{ const u = udenEgenKildeliste(html); html = u.html; log(`- Geminis egen kildeliste fjernet: ${u.fjernet}`); }
// Sidste vagt: ingen sætning må nævne en kilde uden for listen (fx genindført af liste-omskrivningen).
{
  const rest = udenForListen();
  if (rest.length) throw new Error(`${rest.length} sætninger nævner stadig kilder uden for Sources (${rest.map((x) => x.navne.join('+')).join(', ')}) — artiklen afvist`);
  if (antalFaq(html) < 5) throw new Error(`FAQ har kun ${antalFaq(html)} spørgsmål efter kildevagten — artiklen afvist`);
}

// --- 4c. Talvagten (trin 4, Jacob 30/10-2026, robot/lib/talvagt.mjs) — FØR Jacobs stemme, så den kun kan bruge godkendte tal
// Hvert tal skal stå i en af artiklens egne kilder (siden selv eller de kontrollerede fakta fra den). Målt 30/10: 59 % af
// tallene i robotartiklerne fra før kildevagten stod ikke i kilderne. Sætninger med et ukendt tal sendes til Gemini, der
// skal fjerne eller omskrive tallet; lykkes det ikke, fjernes sætningen. Står det i det korte svar, eller er der for
// mange, afvises artiklen hellere.
const TALVAGT_MAKS = 8;
let kendteTal = new Set();
{
  const tekster = await hentKildeTekster(kildeLinks.map((k) => k.url));
  kendteTal = vaerdier([fakta, ...tekster].join(' '));
  const foerTal = talUdenKilde(saetninger(html), kendteTal);
  if (foerTal.length) {
    try {
      const r = await json(`Each numbered sentence from an article about "${valgt.hoved}" contains a number that is NOT in the article's sources (the numbers are listed after the sentence).
Rewrite each sentence so it no longer states those numbers: keep the point in words without the number, or use a number from the facts below if one says the same. Never invent a number.
Keep every HTML tag (especially <a ...>...</a>) exactly as it is. Change nothing else. If the sentence means nothing without the number, return "".
Facts with sources (the only numbers allowed):\n${fakta}
Return JSON {"fixes":[{"n": number, "new": "the corrected sentence with its HTML, or empty"}]}
${foerTal.map((x, i) => `${i + 1}. ${x.s}  [numbers: ${x.mangler.join(', ')}]`).join('\n')}`);
      let rettet = 0;
      for (const f of Array.isArray(r.fixes) ? r.fixes : []) {
        const x = foerTal[parseInt(f.n, 10) - 1]; const ny = rensMarkdown(String(f.new || '').trim());
        if (!x || !ny || !html.includes(x.s) || hrefs(ny) !== hrefs(x.s) || talUdenKilde([ny], kendteTal).length || uklarKilde(ny) || ukendteKilder(ny, kildeLinks).length) continue;
        html = html.replace(x.s, () => ny); rettet++;
      }
      log(`- Talvagt: ${foerTal.length} sætninger med tal uden kilde (${foerTal.flatMap((x) => x.mangler).slice(0, 12).join(', ')}), ${rettet} rettet af Gemini`);
    } catch (e) { log(`- Talvagt: retning fejlede (${e.message.slice(0, 80)})`); }
    const rest = talUdenKilde(saetninger(html), kendteTal);
    if (rest.some((x) => foersteAfsnit(html).includes(x.s))) throw new Error(`Det korte svar har et tal, der ikke står i kilderne (${rest[0].mangler.join(', ')}) — artiklen afvist`);
    if (rest.length > TALVAGT_MAKS) throw new Error(`${rest.length} sætninger har tal, der ikke står i kilderne — artiklen afvist`);
    for (const x of rest) html = html.replace(x.s, '');
    html = tomt(html);
    if (rest.length) log(`- Talvagt: ${rest.length} sætninger fjernet (${rest.flatMap((x) => x.mangler).join(', ')})`);
    if (antalFaq(html) < 5) throw new Error(`FAQ har kun ${antalFaq(html)} spørgsmål efter talvagten — artiklen afvist`);
  }
  log(`- Talvagt: ${tekster.filter(Boolean).length} af ${kildeLinks.length} kildesider læst · ${foerTal.length ? 'se ovenfor' : 'alle tal står i kilderne'} · tilbage uden kilde: ${talUdenKilde(saetninger(html), kendteTal).length}`);
}

// --- 4d. Jacobs stemme (30/10-2026, robot/lib/hjerne.mjs) ----------------------
// Kun når emnet rammer en af hans holdninger i emner.md: 1-2 korte afsnit i første person, sat ind sidst i den
// sektion, hvor de passer. Efter sprog- og kildekontrollen, så de ikke bliver "rettet" eller fjernet som fyld.
// Et kasseret forsøg sendes tilbage med grunden (højst 3 forsøg). Lykkes det ikke, udgives artiklen uden stemmen.
let stemme = false;
{
  const emneTekst = `${valgt.emne} ${valgt.hoved} ${valgt.beslaegtede.join(' ')}`;
  const seneste = senesteStemmeAfsnit(sti('src/content/posts'), gammelFil);
  const p = stemmePrompt(hjerne, emneTekst, html, valgt.hoved, seneste);
  if (!p) log('- Stemme: ingen af Jacobs holdninger rammer emnet (kun stilen er brugt)');
  else {
    const ekstra = (t) => (kildeHenvisninger(t).length ? `nævner en kilde (${kildeHenvisninger(t).join(', ')})`
      : talUdenKilde([t], kendteTal).length ? `tal, der ikke står i kilderne (${talUdenKilde([t], kendteTal)[0].mangler.join(', ')})` : '');
    let mt = { ok: false, grund: '' };
    for (let forsoeg = 0; forsoeg < 3 && !mt.ok; forsoeg++) {
      try {
        const pp = forsoeg && mt.grund ? `${p}\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${mt.grund}. Write it again and avoid exactly that.` : p;
        const r = await skriv(pp, { temperatur: 0.5 });
        mt = tjekStemme(r.tekst, html, seneste, ekstra);
      } catch (e) { mt = { ok: false, grund: e.message.slice(0, 100) }; }
      if (!mt.ok) log(`- Stemme forsøg ${forsoeg + 1} kasseret: ${mt.grund}`);
      // NONE = modellen finder ingen holdning, der passer. At spørge igen giver samme svar (testkørsel 4: 3 x NONE)
      if (/ingen holdning passer/.test(mt.grund)) break;
    }
    if (mt.ok) { for (const d of mt.dele) html = fletInd(html, d.sektion, d.tekst); stemme = true; }
    log(`- Stemme: ${mt.ok ? `${mt.dele.length} afsnit (${mt.dele.map((d) => d.sektion.slice(0, 40)).join(' | ')})` : `ikke med (${mt.grund})`}`);
  }
}

// --- 5. Titel, beskrivelse, billedtekster -----------------------------------
const meta = await json(`Article about "${valgt.hoved}". First 1500 characters:
${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)}

Return JSON with:
"title": the question a person searching the main keyword actually wants answered, in correct natural English and Title Case, ending with "?" (e.g. keyword "phishing resistant mfa" → "How Does Phishing-Resistant MFA Work?"; keyword "apple mdm enrollment guide" → "How Do You Enroll Macs in Apple MDM?"). Never a title that only restates the search phrase ("What Is An Apple MDM Enrollment Guide?"). At most 70 characters, no year,
"description": 140-160 characters, plain and specific,
"slug": 3-6 lowercase words joined by hyphens,
"image1": the cover image for the article's main idea: ${MOTIVREGLER},
"image2": a different image idea for another key point of the article, following the same rules,
"image3": a third, different image idea for a later point of the article, following the same rules,
"alt3": short alt text for image 3,
"alt1": short alt text for image 1, "alt2": short alt text for image 2`);
// Talvagten gælder også beskrivelsen, som Google viser: har den et tal uden kilde, bruges det korte svar i stedet.
if (talUdenKilde([String(meta.description || '')], kendteTal).length) {
  const svar = synligTekst(foersteAfsnit(html)).trim();
  const kort = svar.length <= 160 ? svar : `${svar.slice(0, 157).replace(/\s+\S*$/, '')}…`;
  log(`- Talvagt: beskrivelsen havde et tal uden kilde — bruger det korte svar i stedet`);
  meta.description = kort;
}
// Titlen er spørgsmålet (trin 7, Jacob 29/10-2026). Er Geminis titel ikke et spørgsmål, bruges søgeordet som
// spørgsmål (samme regel som forsidens "Questions people are asking", src/lib/sporgsmaal.mjs).
const geminiTitel = String(meta.title || '').trim();
const titel = /\?$/.test(geminiTitel) && geminiTitel.length <= 90 ? geminiTitel : somSporgsmaal(valgt.hoved);
if (titel !== geminiTitel) log(`- Titel: Geminis "${geminiTitel}" var ikke et spørgsmål — bruger "${titel}"`);
const slug = String(meta.slug || titel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// --- 6. Billeder (Gemini, Cloudflare som reserve) ---------------------------
// Ny opskrift 31/10-2026 (robot/lib/billeder.mjs): motiverne ovenfor (image1/image2), techfeedwatchs billedmodel,
// billedkontrol, dæmpede lyspletter, hyldens accentfarve, "AI-generated" og IPTC-mærket.
// Hylden giver accentfarven. Omskrivninger har Bloggers etiket som emne ("Cyber Security" o.l.); ukendt → AI-farven.
const hylde = emner().find((e) => e.etiket === valgt.emne)?.hylde || EKSTRA_ETIKETTER[valgt.emne];
const hero = await lav({ motiv: meta.image1, titel, besk: meta.description, hylde });
const mid = await lav({ motiv: meta.image2, titel, besk: meta.description, hylde });
if (!hero?.fil || !mid?.fil) throw new Error('Mindst ét af billederne kunne ikke laves');
for (const [n, b] of [[1, hero], [2, mid]]) log(`- Billede ${n}: ${b.motor}${b.forsoeg > 1 ? ` · ${b.forsoeg} forsøg` : ''}${b.noter.length ? ` · ${b.noter.join(' · ')}` : ''}`);
const figur = (b, alt) => `<table align="center" cellpadding="0" cellspacing="0" class="tr-caption-container" style="margin-left: auto; margin-right: auto;"><tbody><tr><td style="text-align: center;"><img alt="${esc(alt)}" height="768" src="${b.fil}" width="1366" loading="lazy" /></td></tr><tr><td class="tr-caption" style="text-align: center;">${esc(alt)}</td></tr></tbody></table>`;

// Billede 1 efter første afsnit, billede 2 før overskriften nærmest 60 % inde.
const heroFigur = figur(hero, meta.alt1);
html = html.replace(/<\/p>/i, `</p>${heroFigur}`);
const h2er = [...html.matchAll(/<h2\b/gi)].map((m) => m.index);
const midt = h2er.filter((i) => i > html.length * 0.45)[0];
const midFigur = figur(mid, meta.alt2);
if (midt) html = html.slice(0, midt) + midFigur + html.slice(midt);
// Billede 3 (Jacob 31/10-2026): i artikler over 1.200 ord, før en overskrift mellem billede 2 og FAQ — så der ikke
// er lange stræk uden billede. Er der ingen overskrift dér, eller fejler billedet, udgives artiklen med 2.
if (antalOrd(html) > 1200) {
  const efterMid = html.indexOf(midFigur) + midFigur.length;
  const faqPos = html.search(/<h2[^>]*>\s*(?:FAQ|Frequently Asked Questions)/i);
  const steder = [...html.matchAll(/<h2\b/gi)].map((m) => m.index).filter((i) => i > efterMid && (faqPos < 0 || i < faqPos));
  if (midt && steder.length) {
    try {
      const tredje = await lav({ motiv: meta.image3, titel, besk: meta.description, hylde });
      const sted = steder[Math.floor((steder.length - 1) / 2)];
      html = html.slice(0, sted) + figur(tredje, meta.alt3 || meta.alt2) + html.slice(sted);
      log(`- Billede 3: ${tredje.motor}${tredje.forsoeg > 1 ? ` · ${tredje.forsoeg} forsøg` : ''}${tredje.noter.length ? ` · ${tredje.noter.join(' · ')}` : ''}`);
    } catch (e) { log(`- Billede 3: kunne ikke laves (${String(e.message).slice(0, 80)}) — artiklen har 2 billeder`); }
  } else log('- Billede 3: ingen plads mellem billede 2 og FAQ — artiklen har 2 billeder');
}

// (Video-delen er fjernet i trin 7, 29/10-2026: sitet viser ikke videoer mere — se src/lib/temakoder.mjs udenYoutube.)

// Eksterne links INDE i teksten (Jacobs ønske 26/9): Gemini foreslår for hver
// kontrolleret kilde en frase, der står ordret i teksten; linket sættes kun, hvis
// frasen findes, og teksten er ord for ord uændret bagefter. Kildelisten bliver.
let eksterneITekst = 0;
const brugteFraser = new Set();
try {
  const fr = await json(`For each numbered source, give up to 3 alternative SHORT phrases (2-4 words each) copied exactly, character for character, from the article text below, that the source is specifically about. Skip a source if nothing fits.
Return JSON {"links":[{"n": number, "phrases": ["...", "..."]}]}
Sources:
${kildeLinks.map((k, i) => `${i + 1}. ${k.titel} (${k.url})`).join('\n')}
Article text:
${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 14000)}`);
  log(`- Geminis svar (eksterne): ${JSON.stringify(fr).slice(0, 300)}`);
  for (const l of (fr.links || []).slice(0, 3)) {
    const k = kildeLinks[l.n - 1]; if (!k) continue;
    for (const frase of [].concat(l.phrases || l.phrase || []).slice(0, 3)) {
      // Hver frase kun én gang (kørsel #14: to kilder fik begge "large language models").
      if (brugteFraser.has(String(frase).toLowerCase().trim())) continue;
      const ny = linkIndsaet(html, frase, k.url.replace(/"/g, '%22'), { ekstern: true });
      if (ny) brugteFraser.add(String(frase).toLowerCase().trim());
      if (ny && udenLinks(ny) === udenLinks(html)) { html = ny; eksterneITekst++; break; }
    }
  }
} catch (e) { log(`- Eksterne links i teksten: sprunget over (${e.message.slice(0, 80)})`); }
log(`- Eksterne links inde i teksten: ${eksterneITekst}`);

html += kildeliste(kildeLinks);

// FAQ-spørgsmålene med rigtige store bogstaver (31/10-2026: "Should i learn generative ai?"), robot/lib/sprog.mjs
{
  let rettet = 0;
  html = html.replace(/(<h2[^>]*>\s*(?:FAQ|Frequently Asked Questions)\s*<\/h2>)([\s\S]*?)(?=<h2\b|$)/i, (m, h, krop) => h + krop.replace(/(<h3\b[^>]*>)([\s\S]*?)(<\/h3>)/gi, (x, a, t, b) => {
    const ny = storeBogstaver(t); if (ny !== t) rettet++; return a + ny + b;
  }));
  log(`- FAQ-spørgsmål med rettede store bogstaver: ${rettet}`);
}

// Key takeaways (Jacob 31/10-2026): 3-4 korte punkter lige under det første billede til læsere, der skimmer.
// Kun ud fra artiklens egen tekst: et punkt med et tal, der ikke står i artiklen, droppes (talvagten gælder også her).
// Udseendet står i src/pages/[year]/[month]/[slug].astro (.tma-overblik) i hyldens farve.
{
  try {
    const tekstNu = synligTekst(html).replace(/\s+/g, ' ');
    const r = await json(`Below is an article titled "${titel}". Write 3-4 key takeaways for a reader who only skims: each one short sentence (at most 22 words), concrete and specific, in correct natural English with proper capitals.
Use ONLY information stated in the article; never add numbers, names or claims that are not in it. No source names, no links, no markdown, no bold.
Return JSON {"punkter": ["...", "..."]}

${tekstNu.slice(0, 9000)}`);
    const punkter = (Array.isArray(r.punkter) ? r.punkter : [])
      .map((p) => storeBogstaver(String(p).replace(/<[^>]+>/g, '').replace(/\*+/g, '').trim()))
      .filter((p) => p && p.split(/\s+/).length <= 30 && (p.match(/\d[\d.,]*\d|\d/g) || []).every((tal) => tekstNu.includes(tal)))
      .slice(0, 4);
    if (punkter.length >= 3 && html.includes(heroFigur)) {
      const boks = `<div class="tma-overblik"><p class="tma-overblik-titel">Key takeaways</p><ul>${punkter.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
      html = html.replace(heroFigur, () => heroFigur + boks);
      log(`- Key takeaways: ${punkter.length} punkter`);
    } else log(`- Key takeaways: kun ${punkter.length} punkter bestod kontrollen — ingen boks`);
  } catch (e) { log(`- Key takeaways: fejlede (${String(e.message).slice(0, 80)}) — ingen boks`); }
}

// Sidste vagt (5/10-2026): ingen synlige markdown-rester må udgives. Rensningen ovenfor
// fanger det normale; står der stadig noget, er det hellere en afvist artikel end en synlig fejl.
const mdRest = markdownRest(html);
if (mdRest) throw new Error(`Markdown-rest "${mdRest}" i artiklen — afvist`);

const ord = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
if (ord < 1000) throw new Error(`Artiklen er kun ${ord} ord — afvist (mindst 1000)`);

// --- 7. Gem artiklen --------------------------------------------------------
const nu = new Date();
let aar; let md; let navn;
if (OMSKRIV) {
  // Omskrivning: samme fil og adresse. Udgivelsesdato, etiketter (= hylden via hyldeplanen) og bloggerId beholdes;
  // gamle frontmatter-felter, der hørte til den gamle tekst (seoTitle, ekstra FAQ, hadToc), fjernes.
  [, aar, md, navn] = OMSKRIV.match(/^\/(\d{4})\/(\d{2})\/(.+)$/);
  const { seoTitle, faq, hadToc, ...behold } = gammel.fm;
  gemFrontmatter({ ...behold, title: titel, description: String(meta.description || ''), updated: nu.toISOString(), image: hero.fil,
    keyword: valgt.hoved, relatedKeywords: valgt.beslaegtede, robot: true, ...(stemme ? { stemme: true } : {}), omskrevet: iDag, omskrivning: 'fuld',
    gammelTitel: String(gammel.fm.title || '') }, `${html}\n`);
} else {
aar = String(nu.getUTCFullYear()); md = String(nu.getUTCMonth() + 1).padStart(2, '0');
navn = slug; let n = 2;
while (fs.existsSync(sti(`src/content/posts/${aar}/${md}/${navn}.md`))) navn = `${slug}-${n++}`;
fs.mkdirSync(sti(`src/content/posts/${aar}/${md}`), { recursive: true });
const labels = [valgt.emne];   // emnets etiket = artiklens hylde (src/lib/hylder.ts)
const yamlStr = (s) => JSON.stringify(String(s));
const fm = ['---', `title: ${yamlStr(titel)}`, `description: ${yamlStr(meta.description)}`, `published: ${nu.toISOString()}`, `updated: ${nu.toISOString()}`,
  'labels:', ...labels.map((l) => `  - ${l}`), `image: ${hero.fil}`, `keyword: ${yamlStr(valgt.hoved)}`, 'relatedKeywords:', ...valgt.beslaegtede.map((k) => `  - ${yamlStr(k)}`), 'robot: true', ...(stemme ? ['stemme: true'] : []), '---'].join('\n');
fs.writeFileSync(sti(`src/content/posts/${aar}/${md}/${navn}.md`), `${fm}\n${html}\n`);
}

// --- 8. Links FRA ældre artikler til den nye (Jacobs ønske 26/9) --------------
// Kun de artikler, Gemini vurderede relevante (trin 2), højst 3. I hver foreslår
// Gemini en frase, der står ordret i den gamle tekst; linket sættes kun, hvis
// frasen findes, og den gamle tekst er ord for ord uændret bagefter. Ingen
// updated-dato, fordi ingen ord er ændret (samme regel som techfeedwatch 23/9).
const nyHref = kodet(`/${aar}/${md}/${navn}`);   // uden .html (29/9-2026)
const tilbage = [];
for (const g of relevante.slice(0, 3)) {
  try {
    const [, ga, gm, gn] = g.sti.match(/^\/(\d{4})\/(\d{2})\/(.+?)(?:\.html)?$/) || [];
    if (!ga) continue;
    const fil = sti(`src/content/posts/${ga}/${gm}/${gn}.md`);
    const raa = fs.readFileSync(fil, 'utf8');
    const del = raa.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
    if (!del || del[2].includes(nyHref)) continue;
    const f = await json(`A new article titled "${titel}" (topic: "${valgt.hoved}") was published. In the older article text below, find up to 3 alternative SHORT phrases (2-4 words each), copied exactly character for character, that would be a natural anchor for a link to the new article. Return JSON {"phrases": ["...", "..."]} or {"phrases": []} if nothing fits naturally.
Text:
${del[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 14000)}`);
    for (const frase of [].concat(f.phrases || f.phrase || []).slice(0, 3)) {
      const ny = linkIndsaet(del[2], frase, nyHref);
      if (ny && udenLinks(ny) === udenLinks(del[2])) { fs.writeFileSync(fil, del[1] + ny); tilbage.push(`${g.titel} ("${frase}")`); break; }
    }
  } catch (e) { log(`- Tilbagelink fra "${g.titel}": sprunget over (${e.message.slice(0, 60)})`); }
}
log(`- Links fra ældre artikler til den nye: ${tilbage.length}${tilbage.length ? ' — ' + tilbage.join(' · ') : ''}`);

log(`\n**Titel:** ${titel}  \n**Adresse:** /${aar}/${md}/${navn}  \n**Ord:** ${ord} · **Interne links:** ${antalInterne} · **Kilder:** ${kildeLinks.length} (afvist ${kildeAfvist.length})`);
log(`\n**Billeder:** 1: ${hero.fil} (${hero.motor})  \n2: ${mid.fil} (${mid.motor})`);
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/proeveartikel.json'), JSON.stringify({ valgt, titel, sti: `/${aar}/${md}/${navn}`, ord, antalInterne, kildeLinks, kildeAfvist, billeder: { hero, mid }, stemme, ...(OMSKRIV ? { omskrevet: true, maade: 'fuld', gammelTitel: gammel.fm.title } : {}) }, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.join('\n') + '\n');
