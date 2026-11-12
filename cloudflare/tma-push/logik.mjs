// Ren logik for techmediaarchs push-beskeder (10/11-2026, appen trin 3). Ingen Cloudflare-afhængigheder,
// så den testes i Node (test.mjs). Bygget efter techfeedwatchs cloudflare/push/logik.mjs, holdt adskilt.
//
// Regel (som techfeedwatch, Jacobs valg 17/10 dér): højst ÉN besked om dagen pr. læser — den nyeste artikel
// fra det sidste døgn. Ingen ny artikel = ingen besked. techmediaarch har ingen "følg emne", så alle får samme.

// Kun rigtige push-tjenester må gemmes som modtager — ellers kunne nogen få Workeren til at sende
// forespørgsler til en vilkårlig adresse.
const TILLADTE_VAERTER = [
  /^fcm\.googleapis\.com$/,                  // Chrome, Edge, Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/,                 // Safari, iPhone, Mac
  /^[a-z0-9-]+\.notify\.windows\.com$/,      // Edge på Windows (WNS)
  /^[a-z0-9-]+\.push\.apple\.com$/,
];
export function gyldigtEndpoint(endpoint) {
  try {
    const u = new URL(String(endpoint));
    return u.protocol === 'https:' && String(endpoint).length <= 600 && TILLADTE_VAERTER.some((re) => re.test(u.hostname));
  } catch { return false; }
}

// SHA-256 af push-adressen som hex — samme id i Workeren og i sitets service worker (public/sw.js).
export async function endpointId(endpoint) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(endpoint)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// "Dagen" regnes i amerikansk østkysttid (Jacob 12/11-2026: beskeden skal ud om aftenen i USA). Udsendelsen kører
// 23:00-00:50 UTC; med UTC-datoen ville dagen skifte midt i udsendelsen, og nogle kunne få to beskeder samme aften.
// I New York er det 18:00-19:50 (vintertid) / 19:00-20:50 (sommertid) — samme dato hele vejen.
export const usDag = (nu, foer = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(nu.getTime() - foer * 864e5));

// Artikler fra i dag og i går (østkystdato) ud fra /app-data/nyeste.json ({ u, t, p, h }), nyeste først.
// allerede: adresser fra GÅRSDAGENS udsendelse — de sendes ikke igen (ellers samme artikel to dage i træk).
export function nyeArtikler(alle, nu = new Date(), allerede = []) {
  const idag = usDag(nu);
  const igaar = usDag(nu, 1);
  return (Array.isArray(alle) ? alle : [])
    .filter((a) => a && typeof a.u === 'string' && /^\/[^/]/.test(a.u) && a.t)
    .filter((a) => { const d = new Date(a.p); return !isNaN(d) && [idag, igaar].includes(usDag(d)); })
    .filter((a) => !allerede.includes(a.u))
    // Samme tidspunkt: sorter på adressen, så udsendelsen og /besked altid vælger den samme
    .sort((a, b) => new Date(b.p) - new Date(a.p) || a.u.localeCompare(b.u));
}

// KV-metadata må højst være 1024 bytes
export function metadataPasser(md) { return new TextEncoder().encode(JSON.stringify(md)).length <= 1000; }

// Beskedens tekst. Adressen får utm-mærker, så Analytics viser klik fra beskeder som kilde "push".
export function beskedFor(a) {
  return {
    title: String(a.t).slice(0, 120),
    body: a.h ? `New answer on ${a.h}` : 'A new answer on Tech Media Arch',
    url: `${a.u}?utm_source=push&utm_medium=notification&utm_campaign=daily`,
  };
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// VAPID-token (ES256). WebCrypto giver signaturen i r||s-form, som JWT kræver.
// sub: sitets kontaktmail er info@techmediaarch.com (eneste offentlige mail) — push-tjenesterne kan skrive dertil ved problemer.
export async function vapidToken(privatJwk, aud, sub = 'mailto:info@techmediaarch.com', nu = Date.now()) {
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const indhold = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp: Math.floor(nu / 1000) + 12 * 3600, sub })}`;
  const noegle = await crypto.subtle.importKey('jwk', privatJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, noegle, new TextEncoder().encode(indhold));
  return `${indhold}.${b64u(sig)}`;
}
