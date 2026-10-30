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

// Sætninger (med HTML) i artiklen, der har tal, som ikke findes i kilderne/fakta. saetninger = robot/lib/sprog.mjs saetninger
export function talUdenKilde(saetningerMedHtml, kendte) {
  const ud = [];
  for (const s of saetningerMedHtml) {
    const synlig = synligTekst(s);
    const mangler = talI(synlig).filter((x) => taeller(x, synlig) && !fundet(x, kendte)).map((x) => x.tekst.trim());
    if (mangler.length) ud.push({ s, mangler: [...new Set(mangler)] });
  }
  return ud;
}
