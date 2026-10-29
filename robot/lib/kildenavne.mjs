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

// Kort navneliste til Gemini: "ibm.com (What Are AI Agents? | IBM)"
export const kildeNavneTekst = (kilder) => kilder.map((k) => `${new URL(k.url).hostname.replace(/^www\./, '')} (${k.titel})`).join('; ');

// Kun punkter fra en kontrolleret kilde beholdes. To veje (29/10-2026):
//  1. Googles egen kobling (stoette fra robot/lib/gemini.mjs): et stykke af punktet bygger på søgekilde nr. i,
//     og i hører til en kontrolleret kilde (k.idx fra robot/lib/links.mjs).
//  2. Reserve: navnet først i punktet ("- IBM: …") passer på en kontrolleret kilde.
// Målt 29/10 (prøve #32): kun navnet gav 10 af 21 punkter med 9 kontrollerede kilder — fx "FBI" passer ikke på ic3.gov.
// brugte: de kilder, mindst ét beholdt punkt kommer fra — kun de skal stå under "Sources".
const krop = (l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').replace(/\*\*/g, '').trim();
const overlap = (l, seg) => { const a = krop(l); const b = krop(seg); return b.length >= 15 && (a.includes(b) || (a.length >= 15 && b.includes(a))); };
export function kunKontrolleredeFakta(fakta, kilder, stoette = []) {
  const punkter = String(fakta).split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+\.)\s+/.test(l));
  const brugte = new Set(); const behold = []; const smidt = []; let viaGoogle = 0; let viaNavn = 0;
  for (const l of punkter) {
    const nr = new Set(stoette.filter((s) => overlap(l, s.tekst)).flatMap((s) => s.kilder));
    let hvem = kilder.filter((k) => (k.idx || []).some((i) => nr.has(i)));
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(?:\*\*)?([^:*\n]{2,80}?)(?:\*\*)?\s*:/);
    if (hvem.length) {
      viaGoogle++;
      // Navnet i punktet er ikke selve kilden ("Gartner: …" fra en side på sparkout.com): skriv kilden på, så
      // teksten kan nævne den listede kilde ("…, according to Sparkout") i stedet for et navn uden for listen.
      if (m && !hvem.some((k) => daekker(k, norm(m[1])))) {
        const via = new URL(hvem[0].url).hostname.replace(/^www\./, '');
        brugte.add(hvem[0]); behold.push(l.replace(m[1], `${m[1].trim()} (via ${via})`)); continue;
      }
    } else {
      const n = m ? norm(m[1].replace(/\(.*?\)/g, '')) : '';
      hvem = n.length >= 2 ? kilder.filter((k) => daekker(k, n)) : [];
      if (hvem.length) viaNavn++;
    }
    if (hvem.length) { behold.push(l); hvem.forEach((k) => brugte.add(k)); } else smidt.push(m ? m[1].trim() : krop(l).slice(0, 30));
  }
  return { tekst: behold.join('\n'), alle: punkter.length, beholdt: behold.length, viaGoogle, viaNavn, smidt, brugte: kilder.filter((k) => brugte.has(k)) };
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
