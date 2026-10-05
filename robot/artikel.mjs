// TRIN 2 — skriver ÉN prøveartikel ud fra en søgeordspakke (1 hoved + 5 beslægtede).
// Kører på GitHub (workflowet "Robot (manuel)", opgave "proeveartikel"), som
// gemmer resultatet på en egen gren (udkast-…) — ALDRIG på main. Intet udgives,
// før Jacob har godkendt artiklen.
// TRIN 3 (26/9): samme fil bruges af tidsplanen (robot/plan.mjs, workflowet
// "Robot (tidsplan)"), som udgiver direkte på main — højst 2 om dagen, fri ons+søn.
//
// Trin:
//  1. Søgeordslisten laves (robot/soegeord.mjs) og Gemini vælger en pakke, der
//     er et fornuftigt, varigt emne (ikke nyheder, priser, sludder).
//  2. Gemini skriver artiklen MED Google-søgning. Uden mindst 2 kontrollerede
//     kilder afvises artiklen (Gemini søger ellers ikke altid — målt 26/9).
//  3. Interne links: 3-5 til eksisterende artikler (kun adresser, der findes).
//  4. To billeder med Gemini (Cloudflare som reserve) — Jacobs valg 26/9.
//  5. Video i ca. 60 % af artiklerne (fast ud fra adressen), kun hvis Gemini
//     finder en video relevant. Artikler med video får etiketten "Video" (Watch-siden).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { skriv, json } from './lib/gemini.mjs';
import { lav } from './lib/billeder.mjs';
import { kontrollerKilder, kildeliste } from './lib/links.mjs';
import { artikler, sti } from './lib/arkiv.mjs';
import { lavIndeks, mestEns } from './lib/dubletter.mjs';
import { linkIndsaet, udenLinks } from './lib/linkfrase.mjs';
import { faqSchema } from '../src/lib/faqschema.mjs';
import { rensMarkdown, markdownRest, udenFedeSoegeord, foersteAfsnit, antalOrd, FOERSTE_MAKS, saetninger, uklarKilde, klistretSoegeord } from './lib/sprog.mjs';

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
// Til tidsplanen (robot/plan.mjs): så et afvist søgeord kan hvile i 30 dage.
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/valgt.json'), JSON.stringify({ hoved: valgt.hoved, emne: valgt.emne }));
log(`# Prøveartikel\n\n**Emne:** ${valgt.emne}  \n**Hovedsøgeord:** ${valgt.hoved}  \n**Beslægtede:** ${valgt.beslaegtede.join(' · ')}`);

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
const kandListe = [...linkKand.slice(0, 12), ...iEmne].filter((m, i, arr) => arr.findIndex((x) => x.sti === m.sti) === i)
  .slice(0, 40).map((m) => ({ href: kodet(m.sti), sti: m.sti, titel: titelAf(m.sti) }));
// Kun artikler, der reelt handler om det samme. Prøveartikel 2 (26/9) fik tvunget
// 3 links ind via ordet "market" (bl.a. Trump/Stargate) — relevans vinder over antal.
let interne = [];
if (kandListe.length) {
  // Karakter 0-3 i stedet for ja/nej: målt 26/9 (kørsel #11-13) svarede den
  // billige model [] på et ja/nej-spørgsmål, selv med DeepSeek/ChatGPT-artikler
  // på listen til en artikel om sprogmodeller. 2-3 kommer med.
  const rel = await json(`New article topic: "${valgt.hoved}".
Rate each existing article for how useful it would be as a "further reading" link for readers of the new article:
3 = same subject, 2 = closely related subject a reader would likely want next, 1 = loosely related, 0 = unrelated (sharing a generic word like "AI" or "market" is not enough for 2).
Return JSON {"ratings":[{"n": number, "score": 0-3}]} covering every article.
${kandListe.map((k, i) => `${i + 1}. ${k.titel}`).join('\n')}`);
  const karakterer = (Array.isArray(rel.ratings) ? rel.ratings : []).map((r) => ({ k: kandListe[parseInt(r.n, 10) - 1], score: Number(r.score) || 0 }))
    .filter((r) => r.k && r.score >= 2).sort((x, y) => y.score - x.score);
  log(`- Karakterer ≥2: ${karakterer.map((r) => `${r.score}: ${r.k.titel.slice(0, 50)}`).join(' | ') || 'ingen'}`);
  interne = karakterer.map((r) => r.k).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 5);
}
log(`- Interne link-kandidater: ${kandListe.length}, relevante ifølge Gemini: ${interne.length}`);

// --- 3. Research: søg og saml fakta med kilder ------------------------------
// Målt 26/9: når Gemini både skal søge OG skrive, springer den ofte søgningen
// over (0 kilder i 2 af 2 forsøg i kørsel #7). En opgave, der KUN går ud på at
// søge, udløser søgningen langt mere sikkert. Søger den billige model stadig
// ikke, prøves en større som reserve.
const researchOpgave = `Use Google Search to research these questions for a factual explainer article:
- ${[valgt.hoved, ...valgt.beslaegtede].join('\n- ')}
Return 15-25 short bullet points of concrete, verified facts (definitions, how it works, examples, numbers with dates, best practices). Only include facts you found in search results.
Start every bullet with the name of the organization, agency, company or publication the fact comes from (e.g. "IBM: ...", "NIST: ...").`;
// ↑ Kildenavnet i hvert punkt (5/10-2026): uden det skrev Gemini "industry experts note" (18 sætninger i 8 af 15 artikler).
let fakta = ''; let kilder = [];
for (const model of [undefined, undefined, 'gemini-3.5-flash', 'gemini-2.5-flash']) {
  try {
    const r = await skriv(researchOpgave, { soeg: true, temperatur: 0.2, ...(model ? { model } : {}) });
    if (r.kilder.length >= 2) { fakta = r.tekst; kilder = r.kilder; log(`- Research: ${r.kilder.length} kilder (${model || 'standardmodel'}).`); break; }
    log(`- Research (${model || 'standardmodel'}): ${r.kilder.length} kilder — prøver igen.`);
  } catch (e) { log(`- Research (${model}): ${e.message.slice(0, 120)}`); }
}
if (kilder.length < 2) throw new Error(`Research gav kun ${kilder.length} kilder — artiklen afvist`);

// --- 4. Skriv artiklen ud fra de fakta ---------------------------------------
const opgave = `Write an in-depth, genuinely helpful English article for techmediaarch.com.
Main keyword: "${valgt.hoved}"
Related keywords (cover each naturally, once or twice): ${valgt.beslaegtede.map((k) => `"${k}"`).join(', ')}

Base all factual claims on these researched facts (do not add other numbers, dates or quotes):
${fakta}

Rules:
- At least 1600 words, 8-10 sections with <h2> (and <h3> where useful), each section 150-250 words.
- Write like a technology journalist at a news publication, not like an analyst or a marketer (Jacob 28/9-2026):
  lead with the most important facts, attribute facts to their source in the sentence ("according to IBM", "NIST defines ..."),
  short paragraphs, concrete examples, neutral tone, no hype words, no "our analysis", "the verdict" or "key takeaways" framing.
- The first paragraph is a short, direct answer to the main keyword: 2 sentences, at most 50 words, plain language. Context and numbers come after it.
- Search phrases are often ungrammatical ("what is phishing attack", "how does seo work"). Never paste a keyword verbatim into a sentence where it reads wrongly; write correct English ("how phishing attacks work"). Never put keywords in bold, quotes or <strong>.
- Every factual claim names its source from the facts (an organization, agency, company or publication). Never use vague attributions such as "experts say", "industry experts note", "researchers confirm", "analysts point out", "studies show" or "according to market research".
- Include one FAQ section (<h2>FAQ</h2>) with AT LEAST 5 questions as <h3>, each followed by a 2-4 sentence answer in <p>.
  Phrase the questions the way people type them into Google, built from the related keywords; every question must be different.
- Never claim personal testing or experience ("I tested", "in my experience", "we tried").
- Link to 3-5 of these existing articles where relevant, using the exact href and a natural anchor text:
${interne.map((l) => `  ${l.href}  (${l.titel})`).join('\n') || '  (none)'}
- No other links. No images. No markdown.
Output ONLY the article body as HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>). No <html>, no title, no code fences.`;
const { tekst } = await skriv(opgave);
let html = rensMarkdown(tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
// Gemini skriver kortere end bedt om (målt 26/9: 857 ord mod 1400-1900 bedt om).
// Er udkastet under 1500 ord, får den det tilbage og skal uddybe — kun med de researchede fakta.
const ordI = (h) => h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
if (ordI(html) < 1500) {
  log(`- Udkast 1: ${ordI(html)} ord — beder Gemini uddybe til mindst 1500.`);
  const udv = await skriv(`Here is a draft article (HTML) about "${valgt.hoved}". Expand it to at least 1600 words by deepening the existing sections with concrete explanations, examples and practical guidance. Use only these researched facts for any numbers, dates or claims:\n${fakta}\nKeep all existing links exactly as they are, keep the FAQ, add no new links, never claim personal testing.
Keep the first paragraph exactly as it is (it is a short direct answer). Name the source of every fact; no vague attributions ("experts say", "studies show"). Never paste ungrammatical search phrases into sentences, never bold keywords, no markdown.
Output ONLY the full expanded article body as HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>).

${html}`);
  const ny = rensMarkdown(udv.tekst.replace(/^```html?\s*|```\s*$/g, '').trim());
  if (ordI(ny) > ordI(html)) html = ny;
  log(`- Efter uddybning: ${ordI(html)} ord.`);
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
const daarlige = () => saetninger(html).map((s) => ({ s, uklar: uklarKilde(s), klistret: klistretSoegeord(s, soegeord) })).filter((x) => x.uklar || x.klistret);
const foerRet = daarlige();
if (foerRet.length) {
  try {
    const r = await json(`Fix each numbered sentence from an article about "${valgt.hoved}".
- If it uses a vague attribution (marked VAGUE), name the specific source from the facts below, or drop the attribution and keep the plain fact if no source fits.
- If it contains a search phrase pasted in ungrammatically (marked PHRASE), rephrase it into correct, natural English.
Keep every HTML tag (especially <a ...>...</a>) exactly as it is. Change nothing else.
Facts with sources:\n${fakta}
Return JSON {"fixes":[{"n": number, "new": "the corrected sentence with its HTML"}]}
${foerRet.map((x, i) => `${i + 1}. [${[x.uklar && 'VAGUE', x.klistret && 'PHRASE'].filter(Boolean).join('+')}] ${x.s}`).join('\n')}`);
    let rettet = 0;
    for (const f of Array.isArray(r.fixes) ? r.fixes : []) {
      const x = foerRet[parseInt(f.n, 10) - 1]; const ny = rensMarkdown(String(f.new || '').trim());
      if (!x || !ny || hrefs(ny) !== hrefs(x.s) || uklarKilde(ny) || klistretSoegeord(ny, soegeord) || !html.includes(x.s)) continue;
      html = html.replace(x.s, () => ny); rettet++;
    }
    log(`- Sætninger med uklare kilder/klistrede søgeord: ${foerRet.length} fundet, ${rettet} rettet, ${daarlige().length} tilbage`);
  } catch (e) { log(`- Sætningsretning fejlede (${e.message.slice(0, 80)}) — ${foerRet.length} sætninger uændret`); }
} else log('- Sætninger med uklare kilder/klistrede søgeord: 0');

// Kilder: følg Googles omdirigering, kontrollér live, højst 4, ét pr. domæne.
const { sat: kildeLinks, afvist: kildeAfvist } = await kontrollerKilder(kilder, 4);
if (kildeLinks.length < 2) throw new Error(`Kun ${kildeLinks.length} kilder bestod kontrollen — artiklen afvist`);

// --- 5. Titel, beskrivelse, billedtekster -----------------------------------
const meta = await json(`Article about "${valgt.hoved}". First 1500 characters:
${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)}

Return JSON with:
"title": 50-65 characters, contains the main keyword or a close natural variant, no clickbait, no year,
"description": 140-160 characters, plain and specific,
"slug": 3-6 lowercase words joined by hyphens,
"image1": a prompt for a clean, modern editorial illustration for the top of the article,
"image2": a different prompt for an illustration further down,
"alt1": short alt text for image 1, "alt2": short alt text for image 2`);
const titel = String(meta.title).trim();
const slug = String(meta.slug || titel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// --- 6. Billeder (Gemini, Cloudflare som reserve) ---------------------------
// Fast tilføjelse til begge billed-prompts. Prøveartikel 1-2 (26/9) fik tekst i
// billederne, et falsk diagram med tal, og et motiv beskåret i toppen.
const BILLEDREGLER = ' Wide 16:9 landscape composition, main subject centered with generous empty margins on all sides. Absolutely no text, no letters, no words, no numbers, no labels, no charts or graphs, no logos, no brand or product symbols (e.g. no programming-language logos), no real people.';
const hero = await lav(meta.image1 + BILLEDREGLER);
const mid = await lav(meta.image2 + BILLEDREGLER);
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

// Sidste vagt (5/10-2026): ingen synlige markdown-rester må udgives. Rensningen ovenfor
// fanger det normale; står der stadig noget, er det hellere en afvist artikel end en synlig fejl.
const mdRest = markdownRest(html);
if (mdRest) throw new Error(`Markdown-rest "${mdRest}" i artiklen — afvist`);

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

// --- 8. Links FRA ældre artikler til den nye (Jacobs ønske 26/9) --------------
// Kun de artikler, Gemini vurderede relevante (trin 2), højst 3. I hver foreslår
// Gemini en frase, der står ordret i den gamle tekst; linket sættes kun, hvis
// frasen findes, og den gamle tekst er ord for ord uændret bagefter. Ingen
// updated-dato, fordi ingen ord er ændret (samme regel som techfeedwatch 23/9).
const nyHref = kodet(`/${aar}/${md}/${navn}`);   // uden .html (29/9-2026)
const tilbage = [];
for (const g of interne.slice(0, 3)) {
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

log(`\n**Titel:** ${titel}  \n**Adresse:** /${aar}/${md}/${navn}  \n**Ord:** ${ord} · **Interne links:** ${antalInterne} · **Kilder:** ${kildeLinks.length} (afvist ${kildeAfvist.length}) · **Video:** ${video ? 'ja' : 'nej'}`);
log(`\n**Billeder:** 1: ${hero.fil} (${hero.motor})  \n2: ${mid.fil} (${mid.motor})`);
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/proeveartikel.json'), JSON.stringify({ valgt, titel, sti: `/${aar}/${md}/${navn}`, ord, antalInterne, kildeLinks, kildeAfvist, video, billeder: { hero, mid } }, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport.join('\n') + '\n');
