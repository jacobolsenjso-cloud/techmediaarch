// Talvagten (trin 4, Jacob 30/10-2026): hvert tal i en artikel skal kunne findes i artiklens egne kilder.
// Målt 30/10: i de 46 robotartikler fra før kildevagten (29/10) stod 278 af 469 tal (59 %) ikke i de kilder,
// artiklen selv nævner. Et tal godkendes, når det står i
//   1) teksten på en af kildesiderne (hentet her), eller
//   2) de kontrollerede fakta (kun fakta fra kilderne på listen, robot/lib/kildenavne.mjs) — nødvendigt, fordi nogle
//      sider bygger teksten med JavaScript, så et script ser en tom side (målt: digitalmarketinginstitute.com 905 tegn).
// Tal skrevet på forskellige måder sammenlignes som værdier: "$300,000" = "300000" = "$300K" = "0.3 million".
// Enkeltcifre (trin, "3 types") og årstal tælles ikke — samme regel som målingen (robot/ud/_maal-tal-kilder.mjs).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const GANGE = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, millions: 1e6, b: 1e9, bn: 1e9, billion: 1e9, billions: 1e9, t: 1e12, trillion: 1e12 };
const TAL = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s?(thousand|millions?|billions?|trillion|bn|mn|[kmbt])\b)?/gi;

export const synligTekst = (h) => String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#36;/g, '$').replace(/\s+/g, ' ');

// Alle tal i en tekst: [{ tekst, raa, vaerdi, gange, foer, efter }] (foer/efter = teksten lige omkring tallet)
export function talI(tekst) {
  const t = String(tekst);
  return [...t.matchAll(TAL)].map((m) => {
    const raa = Number(m[1].replace(/,/g, ''));
    const foer = t.slice(Math.max(0, m.index - 30), m.index);
    // Et enkelt bogstav ("K", "M", "B") er kun en multiplikator efter et valutategn ("$300K"); ellers er det et navn ("4K")
    const enkelt = m[2] && m[2].length === 1;
    const g = m[2] && (!enkelt || /[$€£]\s?$/.test(foer)) ? GANGE[m[2].toLowerCase()] || 1 : 1;
    const tekstDel = g === 1 && enkelt ? m[1] : m[0];
    return { tekst: tekstDel, raa, vaerdi: raa * g, gange: g, foer, efter: t.slice(m.index + tekstDel.length, m.index + tekstDel.length + 2) };
  }).filter((x) => Number.isFinite(x.raa));
}
// Tæller tallet med som en påstand? Ikke enkeltcifre, ikke årstal uden %, og ikke tal, der er en del af et navn:
// "GPT-4o", "COVID-19", "x86", "Web3" (bogstav eller bindestreg lige foran), "5G", "4K" (bogstav lige efter) og
// "Windows 11", "iPhone 15", "Python 3" (et ord med stort bogstav lige foran et lille heltal uden $ eller %).
export function taeller(x, saetning) {
  const heltal = x.gange === 1 && Number.isInteger(x.raa);
  if (heltal && x.raa < 10) return false;
  if (heltal && x.raa >= 1900 && x.raa <= 2099 && !/^\s?%/.test(x.efter)) return false;   // årstal (ikke "2000%")
  if (/[A-Za-z][-.]?$/.test(x.foer)) return false;
  if (x.gange === 1 && /^[A-Za-z]/.test(x.efter)) return false;
  const ordFoer = (x.foer.match(/([A-Za-z]+)\s$/) || [])[1] || '';
  if (heltal && x.raa < 1000 && !/^%/.test(x.efter) && !/[$€£]\s?$/.test(x.foer) && /^(?:[A-Z][A-Za-z]*|[a-z]+[A-Z][A-Za-z]*)$/.test(ordFoer) && !ALMINDELIGE.has(ordFoer.toLowerCase())) return false;
  return true;
}
// Ord, der står med stort bogstav i starten af en sætning — et tal efter dem er en påstand, ikke et navn ("Over 90 ...")
const ALMINDELIGE = new Set('in on at by of to from for with over under about around nearly almost only some just roughly approximately more less fewer than up after before within since until between among the a an and or but nearly overall each every all its their these those this that'.split(' '));

// Værdisæt for en tekst: både værdien med multiplikator og det rå tal (en kilde kan skrive "1.2 million" eller "1,200,000")
export function vaerdier(tekst) {
  const s = new Set();
  for (const x of talI(tekst)) { s.add(+x.vaerdi.toPrecision(12)); if (x.gange === 1) s.add(+x.raa.toPrecision(12)); }
  return s;
}
// Står tallet x i værdisættet? Med multiplikator: værdien skal findes. Uden: det rå tal skal findes.
export const fundet = (x, s) => s.has(+x.vaerdi.toPrecision(12));

export async function hentKildeTekster(urls, timeoutMs = 15000) {
  return Promise.all(urls.map(async (u) => {
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
      return r.ok ? synligTekst((await r.text()).slice(0, 1500000)) : '';
    } catch { return ''; }
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Talvagt 2 (4/11-2026, Jacob: "det skal vi så rette til … på den bedst mulige måde"). Målt på "How Does Generative AI
// Learn?": "IBM reports … 30 to 60 hours over 1 to 2 months" blev godkendt, fordi "30" stod i en HELT anden kilde
// ("30-minute course" hos TechTarget, en kode "30AS5" hos IBM) og "60" i "60 minutes" hos Google — ingen kilde siger
// "30 to 60 hours", og IBM-siden nævner slet ingen timer. Derfor nu:
//   1) ENHED: et tal tæller kun som fundet, hvis kilden har samme tal med samme enhed (timer, minutter, %, $, GB …).
//   2) TILSKRIVNING: nævner sætningen en kilde ("IBM reports", "according to Coursera", et link), skal tallet stå i
//      netop DEN kildes tekst — ikke i en vilkårlig anden.
//   3) FAKTA-noterne fra søgningen (Googles AI-opsummering) godkender kun tal, når den nævnte kilde ikke kunne læses
//      (siden bygges med JavaScript); før godkendte de alle tal — derfra kom "100 to 150 hours", som ingen side har.
const ENHEDER = new Map(Object.entries({
  second: 'second', seconds: 'second', sec: 'second', secs: 'second', minute: 'minute', minutes: 'minute', min: 'minute', mins: 'minute',
  hour: 'hour', hours: 'hour', hr: 'hour', hrs: 'hour', day: 'day', days: 'day', week: 'week', weeks: 'week', month: 'month', months: 'month',
  year: 'year', years: 'year', yr: 'year', yrs: 'year', percent: 'pct', percentage: 'pct', pct: 'pct',
  kb: 'kb', mb: 'mb', gb: 'gb', tb: 'tb', pb: 'pb', kbps: 'kbps', mbps: 'mbps', gbps: 'gbps', ghz: 'ghz', mhz: 'mhz', mp: 'mp', megapixels: 'mp',
  user: 'user', users: 'user', device: 'device', devices: 'device', people: 'person', persons: 'person', employees: 'employee', employee: 'employee',
  customers: 'customer', customer: 'customer', languages: 'language', countries: 'country', words: 'word', tokens: 'token', token: 'token',
  parameters: 'parameter', pages: 'page', videos: 'video', apps: 'app', courses: 'course', modules: 'module', lessons: 'lesson', steps: 'step',
  times: 'times', x: 'times', dollars: 'usd', usd: 'usd', euros: 'eur', eur: 'eur', pounds: 'gbp', kr: 'dkk', dkk: 'dkk',
}));
const MAALEENHEDER = new Set(['second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'pct', 'kb', 'mb', 'gb', 'tb', 'pb', 'kbps', 'mbps', 'gbps', 'ghz', 'mhz', 'mp', 'usd', 'eur', 'gbp', 'dkk', 'times']);
const FYLD = new Set(['to', 'and', 'or', 'of', 'the', 'a', 'an', 'total', 'study', 'per', 'additional', 'more', 'extra', 'full', 'free', 'monthly', 'daily', 'weekly', 'active', 'dedicated', 'about', 'roughly', 'approximately', 'nearly', 'over', 'up']);
// Enheden for tallet på plads i i teksten t (længde len): valuta foran; "%" lige efter; ellers første kendte enhed inden
// for 4 ord — et interval ("30 to 60 hours", "1-2 months", "10–20 hours") springes over, så begge tal får enheden.
export function enhedFor(t, i, len) {
  const foer = t.slice(Math.max(0, i - 3), i);
  if (/\$\s?$/.test(foer)) return 'usd'; if (/€\s?$/.test(foer)) return 'eur'; if (/£\s?$/.test(foer)) return 'gbp';
  let efter = t.slice(i + len, i + len + 60);
  if (/^\s?(%|percent\b|per cent\b)/i.test(efter)) return 'pct';
  efter = efter.replace(/^\s?(?:to|-|–|—|and)\s?\$?\d[\d.,]*/i, ''); // spring intervallets andet tal over
  if (/^\s?(%|percent\b)/i.test(efter)) return 'pct';
  const ord = (efter.match(/^[\s-]*([A-Za-z]+)(?:[\s-]+([A-Za-z]+))?(?:[\s-]+([A-Za-z]+))?(?:[\s-]+([A-Za-z]+))?/) || []).slice(1).filter(Boolean).map((o) => o.toLowerCase());
  for (const o of ord) { if (ENHEDER.has(o)) return ENHEDER.get(o); if (!FYLD.has(o)) break; }
  return '';
}
const noegle = (v, e) => `${+Number(v).toPrecision(12)}|${e}`;
// Tal skrevet med bogstaver (4/11-2026): "two to four weeks" og "six to twelve months" gik uden om talvagten, som
// kun så cifre. Nu laves de om til cifre (i artiklen OG i kilderne), før reglerne ovenfor bruges — så "two weeks" i
// artiklen også godkendes af "2 weeks" i kilden. Enkeltcifre tæller stadig kun med en måleenhed ("one of the" tæller ikke).
const ORDTAL = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const TIERE = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const ORDTAL_RE = new RegExp(`\\b(?:(${TIERE})[-\\s](one|two|three|four|five|six|seven|eight|nine)|(${Object.keys(ORDTAL).join('|')}))\\b`, 'gi');
export const ordTilTal = (tekst) => String(tekst).replace(ORDTAL_RE, (m, tier, en, enkelt) => String(tier ? ORDTAL[tier.toLowerCase()] + ORDTAL[en.toLowerCase()] : ORDTAL[enkelt.toLowerCase()]));
// Nøglesæt for en tekst: "værdi|enhed" og "værdi|*" (hvert tal i teksten, også det rå tal ved "1.2 million")
export function talNoegler(tekst) {
  const t = ordTilTal(tekst); const s = new Set();
  for (const m of t.matchAll(TAL)) {
    const x = talI(m[0])[0]; if (!x) continue;
    const e = enhedFor(t, m.index, m[0].length);
    for (const v of x.gange === 1 ? [x.raa] : [x.vaerdi, x.raa]) { s.add(noegle(v, '*')); if (e) s.add(noegle(v, e)); }
  }
  return s;
}
export const LAESBAR = 1000; // tegn synlig tekst; derunder kunne siden ikke læses (blokeret, tom, kun JavaScript)
// Indeks over kilderne: [{ url, host, laesbar, noegler }] — bygges én gang pr. artikel
export const kildeIndeks = (kilder, tekster) => kilder.map((k, i) => ({ url: k.url, k, host: new URL(k.url).hostname.replace(/^www\./, ''), laesbar: (tekster[i] || '').length >= LAESBAR, noegler: talNoegler(tekster[i] || '') }));
// Hvilke kilder står sætningen på? Links til en kilde + navne, der dækker en kilde (navne = kildeHenvisninger(s)).
export function tilskrevne(saetningHtml, indeks, navne = [], kendtNavn = () => false) {
  const hosts = [...String(saetningHtml).matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => { try { return new URL(m[1]).hostname.replace(/^www\./, ''); } catch { return ''; } });
  return indeks.filter((c) => hosts.includes(c.host) || navne.some((n) => kendtNavn(n, [c.k])));
}
// Sætninger, hvis tal ikke er dækket. faktaNoegler = talNoegler(fakta). navneFor(s) = kildenavne i sætningen.
export function talUdenKildeV2(saetningerMedHtml, indeks, faktaNoegler, navneFor = () => [], kendtNavn = () => false) {
  const ud = [];
  for (const s of saetningerMedHtml) {
    const synlig = ordTilTal(synligTekst(s));
    const egne = tilskrevne(s, indeks, navneFor(s), kendtNavn);
    const kandidater = egne.length ? egne : indeks;
    const mangler = [];
    for (const m of synlig.matchAll(TAL)) {
      const foer = synlig.slice(Math.max(0, m.index - 30), m.index); const efter = synlig.slice(m.index + m[0].length, m.index + m[0].length + 2);
      // Forhold og klokkeslæt ("9:16", "16:9", "10:30") er formater, ikke påstande (målt 4/11: "9:16 vertical video")
      if (/\d:$/.test(foer) || /^:\d/.test(efter)) continue;
      const x = talI(m[0])[0]; if (!x) continue;
      const e = enhedFor(synlig, m.index, m[0].length);
      // Enkeltcifre: før talte de aldrig ("3 types", "step 2"); men "6 hours", "1 to 2 months", "5 GB" er påstande
      // (4/11-2026) — de tjekkes nu, når de har en MÅLEENHED (tid, %, datastørrelse, valuta, "x gange").
      const enkelt = x.gange === 1 && Number.isInteger(x.raa) && x.raa < 10;
      if (enkelt ? !(MAALEENHEDER.has(e) && !/[A-Za-z][-.]?$/.test(foer)) : !taeller({ ...x, foer, efter }, synlig)) continue;
      const k = noegle(x.vaerdi, e || '*');
      const ok = kandidater.some((c) => c.noegler.has(k)) || (kandidater.some((c) => !c.laesbar) && faktaNoegler.has(k));
      if (!ok) mangler.push(x.tekst.trim());
    }
    if (mangler.length) ud.push({ s, mangler: [...new Set(mangler)], tilskrevet: egne.map((c) => c.host) });
  }
  return ud;
}

// Sætninger (med HTML) i artiklen, der har tal, som ikke findes i kilderne/fakta. saetninger = robot/lib/sprog.mjs saetninger
// (Talvagt 1 — bruges ikke længere af robotten fra 4/11-2026; se talUdenKildeV2 ovenfor)
export function talUdenKilde(saetningerMedHtml, kendte) {
  const ud = [];
  for (const s of saetningerMedHtml) {
    const synlig = synligTekst(s);
    const mangler = talI(synlig).filter((x) => taeller(x, synlig) && !fundet(x, kendte)).map((x) => x.tekst.trim());
    if (mangler.length) ud.push({ s, mangler: [...new Set(mangler)] });
  }
  return ud;
}
