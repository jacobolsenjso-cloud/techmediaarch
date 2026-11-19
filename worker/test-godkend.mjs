// Selvtest af godkend-sidens bagdel (worker/godkend.js, 19/11-2026). Intet net: Access' nøgler og KV er falske,
// og billetterne underskrives her med en nøgle lavet til testen. Kør: node worker/test-godkend.mjs
import { godkend, tjekBillet, nulstilNoegler, gyldigSti } from './godkend.js';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };

const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const offentlig = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid: 'k1', alg: 'RS256' };
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function billet(krop, kid = 'k1', alg = 'RS256') {
  const h = b64({ alg, kid, typ: 'JWT' }), p = b64(krop);
  const s = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
  return `${h}.${p}.${s}`;
}
let certKald = 0;
const hent = async (url) => { certKald++; if (!url.startsWith('https://jacob-sites.cloudflareaccess.com/cdn-cgi/access/certs')) throw new Error('forkert adresse: ' + url); return { json: async () => ({ keys: [offentlig] }) }; };
const kv = () => { const d = new Map(); return { d, async get(k, typ) { const v = d.get(k); return v && typ === 'json' ? JSON.parse(v) : v ?? null; }, async put(k, v) { d.set(k, v); }, async list({ prefix }) { return { keys: [...d.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } }; };
const env = { GODKEND: kv(), ACCESS_TEAM: 'jacob-sites', ACCESS_AUD: 'aud-tma', GODKEND_EMAIL: 'jacob@example.com' };
const om = Math.floor(Date.now() / 1000) + 3600;
const god = { iss: 'https://jacob-sites.cloudflareaccess.com', aud: ['aud-tma'], email: 'Jacob@Example.com', exp: om };
const kald = (jwt, metode = 'GET', krop) => new Request('https://www.techmediaarch.com/api/godkend', { method: metode, headers: { ...(jwt ? { 'cf-access-jwt-assertion': jwt } : {}), 'content-type': 'application/json' }, body: krop ? JSON.stringify(krop) : undefined });

t('uden billet: 403', (await godkend(kald(null), env, hent)).status === 403);
t('gyldig billet (e-mail uanset store/små bogstaver)', await tjekBillet(kald(await billet(god)), env, hent));
t('forkert målgruppe (fx techfeedwatchs app): afvist', !(await tjekBillet(kald(await billet({ ...god, aud: ['aud-tfw'] })), env, hent)));
t('forkert e-mail: afvist', !(await tjekBillet(kald(await billet({ ...god, email: 'anden@example.com' })), env, hent)));
t('udløbet billet: afvist', !(await tjekBillet(kald(await billet({ ...god, exp: Math.floor(Date.now() / 1000) - 10 })), env, hent)));
t('forkert udsteder: afvist', !(await tjekBillet(kald(await billet({ ...god, iss: 'https://ondt.cloudflareaccess.com' })), env, hent)));
t('ikke RS256: afvist', !(await tjekBillet(kald(await billet(god, 'k1', 'HS256')), env, hent)));
const s = (await billet(god)).split('.'); s[1] = b64({ ...god, email: 'jacob@example.com', aud: ['aud-tma', 'x'] });
t('ændret indhold med gammel underskrift: afvist', !(await tjekBillet(kald(s.join('.')), env, hent)));
t('ukendt nøgle-id: afvist (nøglerne hentes igen én gang)', (certKald = 0, nulstilNoegler(), !(await tjekBillet(kald(await billet(god, 'k9')), env, hent))) && certKald === 2);
t('mangler indstillinger: afvist', !(await tjekBillet(kald(await billet(god)), { ...env, ACCESS_AUD: '' }, hent)));
t('mangler KV-binding: 500', (await godkend(kald(await billet(god)), { ...env, GODKEND: undefined }, hent)).status === 500);

const jwt = await billet(god);
let r = await godkend(kald(jwt, 'POST', { sti: '2026/11/how-data-engineering-works', status: 'ok' }), env, hent);
t('POST ok gemmes', r.status === 200 && JSON.parse(env.GODKEND.d.get('a:2026/11/how-data-engineering-works')).status === 'ok');
r = await godkend(kald(jwt, 'POST', { sti: '2026/11/phishing-vs-spam-differences', status: 'fejl', grund: 'forkert tal i afsnit 2' }), env, hent);
t('POST fejl med grund gemmes', r.status === 200 && (await r.json()).grund === 'forkert tal i afsnit 2');
t('POST fejl uden grund: 400', (await godkend(kald(jwt, 'POST', { sti: '2026/11/x', status: 'fejl', grund: '  ' }), env, hent)).status === 400);
t('POST ugyldig adresse: 400', (await godkend(kald(jwt, 'POST', { sti: '../../etc', status: 'ok' }), env, hent)).status === 400);
t('POST ugyldig status: 400', (await godkend(kald(jwt, 'POST', { sti: '2026/11/x', status: 'slet' }), env, hent)).status === 400);
r = await godkend(kald(jwt), env, hent);
const alle = await r.json();
t('GET giver alle svar', r.status === 200 && Object.keys(alle).length === 2 && alle['2026/11/phishing-vs-spam-differences'].status === 'fejl');
t('svar har noindex og no-store', r.headers.get('x-robots-tag').includes('noindex') && r.headers.get('cache-control') === 'no-store');
t('andre metoder: 405', (await godkend(kald(jwt, 'DELETE'), env, hent)).status === 405);
t('gyldigSti', gyldigSti('2026/11/how-data-engineering-works') && !gyldigSti('/2026/11/x') && !gyldigSti('2026/11/Ugyldig Navn'));
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
