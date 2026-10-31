// Kun kilder, der står under "Sources" (Jacob 29/10-2026).
// Målt 29/10 (prøve #31): teksten nævnte ca. 15 kilder (AWS, Forbes, Gartner …), men kun 4 stod på listen,
// fordi research brugte ~19 kilder, og kontrollen bagefter kun satte de første 4, der virkede, på listen.
// Her: (1) hvilke navne en kontrolleret kilde dækker, (2) fakta skæres ned til de kontrollerede kilder,
// (3) sætninger i teksten, der henviser til en kilde uden for listen, findes, så de kan rettes eller fjernes.

// Domænedele, der ikke siger noget om kilden
const TOM = new Set(['www', 'com', 'org', 'net', 'gov', 'edu', 'io', 'co', 'ai', 'uk', 'us', 'de', 'blog', 'news', 'docs', 'learn', 'en', 'support', 'help', 'info', 'app']);
const norm = (s) => String(s).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

// Navne en kilde ({ url, titel }) dækker: domænets dele ("aws", "amazon") + mærket sidst i titlen ("… | IBM").
export function kildeNoegler(k) {
  const host = new URL(k.url).hostname.toLowerCase();
  const dele = host.split('.').filter((d) => d.length >= 3 && !TOM.has(d));
  const maerke = String(k.titel || '').split(/\s[|–—-]\s|\s·\s/).slice(1).map(norm).filter((m) => m.length >= 3);
  return [...new Set([...dele.map(norm), ...maerke])];
}

// Dækker en af kilderne navnet? "Palo Alto Networks" ~ paloaltonetworks.com, "Microsoft Source" ~ news.microsoft.com
const daekker = (k, n) => kildeNoegler(k).some((s) => n === s || (s.length >= 3 && n.includes(s)) || (n.length >= 3 && s.includes(n)));
export function kendtNavn(navn, kilder) {
  const n = norm(navn);
  return n.length >= 2 && kilder.some((k) => daekker(k, n));
}

// Navneliste til Gemini: "IBM (ibm.com)" — mærket fra titlen ("… | IBM"), ellers domænet.
// Målt 29/10 (prøve #33): med kun domæner skrev Gemini "According to nhimg.org" og "securityScorecard notes".
const maerkeAf = (k) => { const d = String(k.titel || '').split(/\s[|–—-]\s|\s·\s/); const m = d.length > 1 ? d[d.length - 1].trim() : ''; return m.length >= 2 && m.length <= 40 ? m : ''; };
// Faste navne for kendte domæner (31/10-2026): sidetitlen "MIT News | Massachusetts Institute of Tech" er afkortet, og
// artiklen skrev "Massachusetts Institute of Tech" 4 gange. Gælder også underdomæner (news.mit.edu, csail.mit.edu).
const KENDTE_NAVNE = {
  'mit.edu': 'MIT', 'stanford.edu': 'Stanford University', 'harvard.edu': 'Harvard University', 'berkeley.edu': 'UC Berkeley',
  'nist.gov': 'NIST', 'cisa.gov': 'CISA', 'ftc.gov': 'FTC', 'weforum.org': 'World Economic Forum',
  'learn.microsoft.com': 'Microsoft Learn', 'support.apple.com': 'Apple Support', 'developer.apple.com': 'Apple Developer',
  'support.google.com': 'Google Help', 'developers.google.com': 'Google for Developers', 'research.ibm.com': 'IBM Research',
};
const kendtNavnFor = (host) => Object.entries(KENDTE_NAVNE).find(([d]) => host === d || host.endsWith(`.${d}`))?.[1] || '';
export const kildeNavneTekst = (kilder) => kilder.map((k) => { const host = new URL(k.url).hostname.replace(/^www\./, ''); const m = kendtNavnFor(host) || maerkeAf(k); return m ? `${m} (${host})` : host; }).join('; ');

// Gemini må ikke selv skrive en kildeliste — den lægges på bagefter (robot/lib/links.mjs kildeliste).
// Målt 29/10 (prøve #33): et afsnit med kun domæner ("nhimg.org, cloudmask.com, …") lige før "Sources".
// Fjerner (1) afsnit, der kun er domæner/kildenavne fra listen, og (2) egne "Sources"/"References"-afsnit.
export function udenEgenKildeliste(html) {
  let ud = String(html); let fjernet = 0;
  ud = ud.replace(/<h[23]\b[^>]*>\s*(?:Sources|References|Source list|Further sources)\s*:?\s*<\/h[23]>\s*(?:<(ul|ol)\b[\s\S]*?<\/\1>|<p\b[^>]*>[\s\S]*?<\/p>)?/gi, () => { fjernet++; return ''; });
  ud = ud.replace(/<p\b[^>]*>\s*((?:Sources?\s*:\s*)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\s*[,;]\s*(?:and\s+)?(?:[a-z0-9-]+\.)+[a-z]{2,})+\.?)\s*<\/p>/gi, () => { fjernet++; return ''; });
  return { html: ud, fjernet };
}

// Kun punkter fra en kontrolleret kilde beholdes. To veje (29/10-2026):
//  1. Googles egen kobling (stoette fra robot/lib/gemini.mjs): et stykke af punktet bygger på søgekilde nr. i,
//     og i hører til en kontrolleret kilde (k.idx fra robot/lib/links.mjs).
//  2. Reserve: navnet først i punktet ("- IBM: …") passer på en kontrolleret kilde.
// Målt 29/10 (prøve #32): kun navnet gav 10 af 21 punkter med 9 kontrollerede kilder — fx "FBI" passer ikke på ic3.gov.
// brugte: de kilder, mindst ét beholdt punkt kommer fra — kun de skal stå under "Sources".
// Loft (Jacob 29/10-2026): højst `loft` kilder (8) — dem med flest punkter. Giver de under `minFakta` punkter,
// tages én kilde mere ad gangen, dog højst `maksLoft` (12). Målt 29/10: prøve #33 og #34 fik 16 og 19 kilder.
const krop = (l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').replace(/\*\*/g, '').trim();
const overlap = (l, seg) => { const a = krop(l); const b = krop(seg); return b.length >= 15 && (a.includes(b) || (a.length >= 15 && b.includes(a))); };
export const KILDE_LOFT = 8;
export const KILDE_LOFT_MAKS = 12;
export function kunKontrolleredeFakta(fakta, kilder, stoette = [], { loft = Infinity, minFakta = 0, maksLoft = loft } = {}) {
  const punkter = String(fakta).split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+\.)\s+/.test(l));
  // 1. Hvilke kontrollerede kilder står bag hvert punkt — Googles kobling først, ellers navnet
  const vurderet = punkter.map((l) => {
    const nr = new Set(stoette.filter((s) => overlap(l, s.tekst)).flatMap((s) => s.kilder));
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(?:\*\*)?([^:*\n]{2,80}?)(?:\*\*)?\s*:/);
    let hvem = kilder.filter((k) => (k.idx || []).some((i) => nr.has(i))); let via = hvem.length ? 'google' : '';
    if (!hvem.length) { const n = m ? norm(m[1].replace(/\(.*?\)/g, '')) : ''; hvem = n.length >= 2 ? kilder.filter((k) => daekker(k, n)) : []; via = hvem.length ? 'navn' : ''; }
    return { l, m, hvem, via };
  });
  // 2. Loftet: kilderne med flest punkter først (ved lighed: søgningens rækkefølge)
  const antal = new Map(); for (const v of vurderet) for (const k of v.hvem) antal.set(k, (antal.get(k) || 0) + 1);
  const raekke = kilder.filter((k) => antal.get(k)).sort((a, b) => antal.get(b) - antal.get(a) || kilder.indexOf(a) - kilder.indexOf(b));
  const daekket = (n) => { const s = new Set(raekke.slice(0, n)); return vurderet.filter((v) => v.hvem.some((k) => s.has(k))).length; };
  let n = Math.min(loft, raekke.length);
  while (n < Math.min(maksLoft, raekke.length) && daekket(n) < minFakta) n++;
  const valgte = new Set(raekke.slice(0, n));
  // 3. Behold punkter fra de valgte kilder
  const brugte = new Set(); const behold = []; const smidt = []; let viaGoogle = 0; let viaNavn = 0; let overLoft = 0;
  for (const v of vurderet) {
    const hvem = v.hvem.filter((k) => valgte.has(k));
    if (!hvem.length) { if (v.hvem.length) overLoft++; else smidt.push(v.m ? v.m[1].trim() : krop(v.l).slice(0, 30)); continue; }
    if (v.via === 'google') viaGoogle++; else viaNavn++;
    hvem.forEach((k) => brugte.add(k));
    // Navnet i punktet er ikke selve kilden ("Gartner: …" fra en side på sparkout.com): skriv kilden på, så
    // teksten kan nævne den listede kilde ("…, according to Sparkout") i stedet for et navn uden for listen.
    if (v.m && !hvem.some((k) => daekker(k, norm(v.m[1])))) behold.push(v.l.replace(v.m[1], `${v.m[1].trim()} (via ${new URL(hvem[0].url).hostname.replace(/^www\./, '')})`));
    else behold.push(v.l);
  }
  return { tekst: behold.join('\n'), alle: punkter.length, beholdt: behold.length, viaGoogle, viaNavn, smidt, overLoft, kilderFoerLoft: raekke.length, brugte: kilder.filter((k) => brugte.has(k)) };
}

// Navne, teksten henviser til som kilde: "according to X", "as noted by X", "X reports/notes/explains …".
const NAVN = "([A-Z][A-Za-z0-9&.'’-]*(?:\\s+(?:of|for|and|&|[A-Z][A-Za-z0-9&.'’-]*)){0,4})";
const VERBER = '(?:reports?|reported|notes?|noted|explains?|explained|observes?|observed|adds?|added|predicts?|predicted|estimates?|estimated|found|finds|warns?|warned|says|said|states?|stated|describes?|described|recommends?|recommended|defines?|defined|projects?|projected|highlights?|emphasizes?|cautions?|advises?|suggests?)';
const MOENSTRE = [
  new RegExp(`\\baccording to (?:the\\s+)?${NAVN}`, 'g'),
  new RegExp(`\\bas (?:noted|reported|described|explained|highlighted|defined|observed|stated) by (?:the\\s+)?${NAVN}`, 'g'),
  new RegExp(`(?:^|[.;:]\\s+|,\\s+|\\b(?:while|and|but|whereas)\\s+)(?:the\\s+)?${NAVN}\\s+${VERBER}\\b`, 'g'),
];
// Ord, der kan stå med stort uden at være en kilde. Målt 29/10 på 46 robotartikler: 278 navne, heraf ca. 12
// falske (Security, Compliance, Insights, Managing, Anything, Fintech, CO …) — de står her.
const IKKE_KILDE = /^(This|That|These|Those|It|They|He|She|We|You|The|A|An|Each|Every|Most|Many|Some|Furthermore|Additionally|However|Moreover|Meanwhile|In|For|When|While|If|Both|Research|Data|Studies|Experts?|Analysts?|Researchers?|Developers?|Users?|Companies|Organizations|Businesses|Teams|Security|Compliance|Insights|Managing|Anything|Fintech|CO-?)$/;
const synlig = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function kildeHenvisninger(saetning) {
  const t = synlig(saetning); const ud = new Set();
  for (const re of MOENSTRE) for (const m of t.matchAll(re)) {
    const navn = m[1].replace(/\s+(?:of|for|and|&)$/, '').replace(/[.'’]+$/, '').trim();
    if (navn && !IKKE_KILDE.test(navn.split(/\s+/)[0])) ud.add(navn);
  }
  return [...ud];
}

// Navne i sætningen, som ingen kontrolleret kilde dækker. En sætning, der også nævner en kendt kilde
// ("Gartner predicted …, as noted by Sparkout"), er i orden: den kendte kilde står for oplysningen.
export function ukendteKilder(saetning, kilder) {
  const navne = kildeHenvisninger(saetning);
  if (!navne.length || navne.some((n) => kendtNavn(n, kilder))) return [];
  return navne;
}
