// Kildernes rækkefølge (Jacob 2/11-2026, E-E-A-T punkt 1): officielle kilder først.
// Målt 2/11: i "What Is Included in Microsoft 365?" stod HP, Wikipedia og Coursera øverst og Microsofts egen
// dokumentation (learn.microsoft.com) længere nede — verifikationsboksen viser de 3 første, så læseren (og Google)
// så de svageste først. Bruges af robotten (robot/lib/links.mjs, robot/lib/kildenavne.mjs) og af artikelsiden,
// så nye OG eksisterende artikler følger samme regel.
//   0 = officiel: myndigheder, standardorganer, producenternes egen dokumentation og hjælpesider
//   1 = almindelig kilde (medier, fagsider, firmaer)
//   2 = opslagsværk/kursus/aggregator (Wikipedia, Coursera …) — fint som supplement, men aldrig først
const MYNDIGHED = /(^|\.)(gov|mil)$|\.gov\.[a-z]{2}$|(^|\.)(europa\.eu|gc\.ca|govt\.nz)$/i;
const STANDARD = /(^|\.)(iso\.org|w3\.org|ietf\.org|rfc-editor\.org|owasp\.org|mitre\.org|first\.org|unicode\.org|whatwg\.org|ecma-international\.org|nist\.gov|cisa\.gov)$/i;
// Producentens egne dokumentations- og hjælpesider (docs.github.com, learn.microsoft.com, support.apple.com …)
const DOK_UNDERDOMAENE = /^(docs|learn|support|help|developer|developers|dev|cloud|aws|kb)\./i;
// Platformenes egne domæner (kun de store, hvis produkter artiklerne handler om)
const PRODUCENT = /(^|\.)(microsoft\.com|apple\.com|google\.com|android\.com|mozilla\.org|python\.org|nodejs\.org|php\.net|kernel\.org|openai\.com|anthropic\.com|cloudflare\.com)$/i;
const OPSLAG = /(^|\.)(wikipedia\.org|wikimedia\.org|britannica\.com|coursera\.org|udemy\.com|investopedia\.com|geeksforgeeks\.org|w3schools\.com|tutorialspoint\.com|javatpoint\.com|simplilearn\.com)$/i;

export function kildeRang(url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 1; }
  if (OPSLAG.test(host)) return 2;
  if (MYNDIGHED.test(host) || STANDARD.test(host) || DOK_UNDERDOMAENE.test(host) || PRODUCENT.test(host)) return 0;
  return 1;
}

// Stabil sortering: samme lag beholder deres indbyrdes rækkefølge. adresse(x) giver elementets URL.
export const efterRang = (liste, adresse = (x) => x) =>
  liste.map((x, i) => ({ x, i, r: kildeRang(adresse(x)) })).sort((a, b) => a.r - b.r || a.i - b.i).map((o) => o.x);
