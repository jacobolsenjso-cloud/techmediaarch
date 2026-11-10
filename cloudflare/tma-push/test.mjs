// Selvtest af tma-push (10/11-2026): logikken i logik.mjs og udsendelsen i worker.mjs med et falsk lager
// og falske push-tjenester. Kør: node test.mjs  — skal slutte med "alt OK".
import assert from 'node:assert/strict';
import { gyldigtEndpoint, endpointId, nyeArtikler, beskedFor, vapidToken, metadataPasser } from './logik.mjs';
import { sendPortion } from './worker.mjs';

let fejl = 0;
const t = async (navn, fn) => { try { await fn(); console.log('OK  ', navn); } catch (e) { fejl++; console.log('FEJL', navn, '-', e.message); } };
const nu = new Date('2026-11-10T17:00:00Z');
const artikler = [
  { u: '/2026/11/a', t: 'A', p: '2026-11-10T07:50:00Z', h: 'AI Tools & Agents' },
  { u: '/2026/11/b', t: 'B', p: '2026-11-09T15:50:00Z', h: 'Cybersecurity' },
  { u: '/2026/11/c', t: 'C', p: '2026-11-07T07:50:00Z', h: 'Everyday Tech' },
  { u: '//ondt.example/x', t: 'X', p: '2026-11-10T08:00:00Z', h: '' },
];

await t('kun rigtige push-tjenester', () => {
  assert.equal(gyldigtEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(gyldigtEndpoint('https://web.push.apple.com/QH'), true);
  assert.equal(gyldigtEndpoint('https://evil.example.com/x'), false);
  assert.equal(gyldigtEndpoint('http://fcm.googleapis.com/x'), false);
  assert.equal(gyldigtEndpoint('https://fcm.googleapis.com/' + 'x'.repeat(700)), false);
});
await t('id = sha256 hex', async () => assert.match(await endpointId('https://fcm.googleapis.com/x'), /^[0-9a-f]{64}$/));
await t('nye artikler: i dag + i går, nyeste først, fremmede adresser ude', () => {
  assert.deepEqual(nyeArtikler(artikler, nu).map((a) => a.u), ['/2026/11/a', '/2026/11/b']);
});
await t('gårsdagens artikler sendes ikke igen', () => {
  assert.deepEqual(nyeArtikler(artikler, nu, ['/2026/11/a']).map((a) => a.u), ['/2026/11/b']);
});
await t('besked har titel, hylde og utm-mærker', () => {
  const b = beskedFor(artikler[0]);
  assert.equal(b.title, 'A');
  assert.equal(b.body, 'New answer on AI Tools & Agents');
  assert.equal(b.url, '/2026/11/a?utm_source=push&utm_medium=notification&utm_campaign=daily');
});
await t('metadata-loft', () => { assert.equal(metadataPasser({ e: 'x'.repeat(500) }), true); assert.equal(metadataPasser({ e: 'x'.repeat(1200) }), false); });
await t('VAPID-token kan verificeres', async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const tok = await vapidToken(jwk, 'https://fcm.googleapis.com', undefined, nu.getTime());
  const [h, p, s] = tok.split('.');
  const fra = (x) => Uint8Array.from(Buffer.from(x, 'base64url'));
  assert.equal(JSON.parse(Buffer.from(p, 'base64url')).sub, 'mailto:info@techmediaarch.com');
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, par.publicKey, fra(s), new TextEncoder().encode(`${h}.${p}`)), true);
});

// Udsendelsen med falsk KV og falsk fetch
function falskKV(antal) {
  const data = new Map();
  for (let i = 0; i < antal; i++) data.set(`s:${String(i).padStart(64, '0')}`, { v: '1', metadata: { e: `https://fcm.googleapis.com/fcm/send/${i}` } });
  return {
    data,
    async get(k, type) { const x = data.get(k); return x ? (type === 'json' ? JSON.parse(x.v) : x.v) : null; },
    async put(k, v, o = {}) { data.set(k, { v, metadata: o.metadata }); },
    async delete(k) { data.delete(k); },
    async list({ prefix, limit, cursor }) {
      // Markøren er den sidste nøgle, der blev vist (som KV: sletninger undervejs flytter ikke resten)
      const alle = [...data.keys()].filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      const keys = alle.slice(0, limit).map((name) => ({ name, metadata: data.get(name).metadata }));
      const slut = alle.length <= limit;
      return { keys, list_complete: slut, cursor: slut ? undefined : keys[keys.length - 1].name };
    },
  };
}
await t('udsendelse: alle får én besked, 410 fjernes, intet to gange samme dag', async () => {
  const jwk = await crypto.subtle.exportKey('jwk', (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])).privateKey);
  const env = { SUBS: falskKV(90), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: JSON.stringify(jwk) };
  const modtaget = [];
  globalThis.fetch = async (url, o = {}) => {
    if (String(url).endsWith('/app-data/nyeste.json')) return new Response(JSON.stringify(artikler));
    modtaget.push(String(url));
    return new Response(null, { status: String(url).endsWith('/7') ? 410 : 201 });
  };
  let st;
  for (let i = 0; i < 5; i++) st = await sendPortion(env, nu);
  assert.equal(st.faerdig, true);
  assert.equal(st.allerede, true, 'kørsler efter færdig gør intet');
  assert.equal(modtaget.length, 90, 'hver tilmelding præcis én gang');
  assert.equal(new Set(modtaget).size, 90);
  assert.equal(env.SUBS.data.has(`s:${'7'.padStart(64, '0')}`), false, '410 er fjernet');
});
await t('ingen nye artikler = ingen beskeder', async () => {
  const env = { SUBS: falskKV(5), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: '{}' };
  let sendt = 0;
  globalThis.fetch = async (url) => { if (String(url).endsWith('/app-data/nyeste.json')) return new Response(JSON.stringify([artikler[2]])); sendt++; return new Response(null, { status: 201 }); };
  const st = await sendPortion(env, nu);
  assert.equal(st.ingenNye, true); assert.equal(sendt, 0);
});

console.log(fejl ? `${fejl} FEJL` : 'alt OK');
process.exit(fejl ? 1 : 0);
