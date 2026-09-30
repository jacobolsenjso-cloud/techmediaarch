// Læser Search Console-tal for techmediaarch.com.
//
// Adgang: tjenestekontoen techmediaarch-robot@techmediaarch-tools.iam.gserviceaccount.com
// har "Begrænset" (kun læse) i Search Console. Nøglen ligger i GitHub som
// hemmeligheden GSC_SERVICE_ACCOUNT_JSON og kommer ind som miljøvariabel.
// Nøglen skrives ALDRIG ud — heller ikke i fejlbeskeder.
//
// Ingen ekstra pakker: login sker med Googles standard (en signeret JWT byttes
// til et adgangsbevis), og Node kan selv signere med nøglen.
import crypto from 'node:crypto';

export const EJENDOM = 'sc-domain:techmediaarch.com';
const OMFANG = 'https://www.googleapis.com/auth/webmasters.readonly';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function harAdgang() {
  return Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON);
}

// omfang: hvad beviset må (Search Console som standard; Analytics bruger samme konto med sit eget omfang, 30/9)
export async function hentAdgangsbevis(omfang = OMFANG) {
  let konto;
  try { konto = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('GSC_SERVICE_ACCOUNT_JSON kunne ikke læses som JSON'); }
  if (!konto.client_email || !konto.private_key) throw new Error('nøglen mangler client_email eller private_key');
  const nu = Math.floor(Date.now() / 1000);
  const hoved = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const krop = b64url(JSON.stringify({ iss: konto.client_email, scope: omfang, aud: 'https://oauth2.googleapis.com/token', iat: nu, exp: nu + 3600 }));
  const signatur = b64url(crypto.createSign('RSA-SHA256').update(`${hoved}.${krop}`).sign(konto.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${hoved}.${krop}.${signatur}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`login afvist (${r.status} ${j.error || ''})`);
  return j.access_token;
}

// Søgninger og sider de sidste `dage` dage (Search Console har ~2-3 dages forsinkelse).
// Returnerer [{ q, side, klik, visninger, placering }].
export async function hentSoegninger({ dage = 90, raekker = 5000 } = {}) {
  const bevis = await hentAdgangsbevis();
  const dato = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(EJENDOM)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bevis}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: dato(dage + 2), endDate: dato(2), dimensions: ['query', 'page'], rowLimit: raekker }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Search Console svarede ${r.status} ${j.error?.status || ''}`);
  return (j.rows || []).map((x) => ({
    q: x.keys[0], side: x.keys[1], klik: x.clicks, visninger: x.impressions, placering: Math.round(x.position * 10) / 10,
  }));
}

// Klik og visninger pr. side de sidste `dage` dage — til "Best of each topic" (30/9-2026).
// Samme periode som hentSoegninger (Search Console er ~2 dage bagud). Returnerer { fra, til, sider: [{ side, klik, visninger }] }.
export async function hentSider({ dage = 90, raekker = 25000 } = {}) {
  const bevis = await hentAdgangsbevis();
  const dato = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const fra = dato(dage + 2), til = dato(2);
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(EJENDOM)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bevis}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: fra, endDate: til, dimensions: ['page'], rowLimit: raekker }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Search Console svarede ${r.status} ${j.error?.status || ''}`);
  return { fra, til, sider: (j.rows || []).map((x) => ({ side: x.keys[0], klik: x.clicks, visninger: x.impressions })) };
}
