// tma-push (10/11-2026, appen trin 3): push-beskeder for techmediaarch.com. Bygget efter techfeedwatchs
// tfw-push, men egen Worker, eget lager og eget nøglepar (Jacob: "holde det adskilt").
// Højst ÉN besked om dagen pr. læser: den nyeste artikel fra det sidste døgn. Ingen ny artikel = ingen besked.
//
// Offentlige adresser (kun fra sitet — CORS, og højst 10 tilmeldinger i minuttet pr. afsender):
//   POST /subscribe    { subscription }  -> gemmer tilmeldingen (anonym: kun push-adressen)
//   POST /unsubscribe  { endpoint }      -> sletter den med det samme
//   GET  /besked?id=   -> dagens besked (titel, tekst, adresse) — telefonens service worker henter den
//   POST /proeve       { id }            -> én prøvebesked til netop den tilmelding (højst 1 i timen)
//
// Udsendelsen er IKKE en adresse: den kører på Workerens egen tidsplan (wrangler.toml), én portion pr. kørsel
// (gratis plan: højst 50 udgående forespørgsler pr. kørsel). Beskeden sendes UDEN indhold ("bank på"), så
// intet skal krypteres; teksten hentes fra /besked.
//
// Lager (KV "SUBS"):
//   s:<sha256 af push-adressen>  metadata { e: push-adresse }. Udløber efter 180 dage uden besøg (siden
//                                fornyer den), så glemte tilmeldinger ikke bliver liggende.
//   koersel:<dato>               dagens tilstand: færdig?, tællere, artiklerne der var med (til i morgen).
//   jwt:<push-tjeneste>          VAPID-token genbruges i op til 11 timer (Apple: højst ny hver time).
import { gyldigtEndpoint, endpointId, nyeArtikler, beskedFor, vapidToken, metadataPasser, usDag } from './logik.mjs';

const SITE = 'https://www.techmediaarch.com';
// localhost: kun til test med "npm run preview" (wrangler dev, port 8787) på Jacobs pc
const OPRINDELSER = [SITE, 'http://localhost:8787'];
const PORTION = 40;
const LEVETID = 180 * 86400;
const STANDARD = { title: 'Tech Media Arch', body: 'New answers are waiting for you.', url: '/latest?utm_source=push&utm_medium=notification&utm_campaign=daily' };

const cors = (req) => {
  const o = req.headers.get('origin');
  return { 'access-control-allow-origin': OPRINDELSER.includes(o) ? o : SITE, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
};
const svar = (data, status, req) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(req) } });
// Udsendelsens dag = østkystdato (12/11-2026), så den ikke skifter midt i aftenens udsendelse (se usDag i logik.mjs)
const dag = (nu, foer = 0) => usDag(nu, foer);

async function hentArtikler() {
  // user-agent: Cloudflare kan afvise forespørgsler uden navn (faldgrube fra techfeedwatch)
  const r = await fetch(`${SITE}/app-data/nyeste.json`, { headers: { 'user-agent': 'tma-push (techmediaarch.com)' }, cf: { cacheTtl: 300 } });
  if (!r.ok) throw new Error(`nyeste.json: ${r.status}`);
  return r.json();
}
async function gaarsdagens(env, nu) {
  const st = await env.SUBS.get('koersel:' + dag(nu, 1), 'json');
  return (st && st.artikler) || [];
}
async function dagensNye(env, nu) { return nyeArtikler(await hentArtikler(), nu, await gaarsdagens(env, nu)); }

async function laesKrop(req) {
  const t = await req.text();
  if (t.length > 4000) return null;
  try { return JSON.parse(t); } catch { return null; }
}

async function token(env, aud, cache) {
  if (cache[aud]) return cache[aud];
  const noegle = 'jwt:' + aud;
  let t = await env.SUBS.get(noegle);
  if (!t) {
    t = await vapidToken(JSON.parse(env.VAPID_PRIVATE_JWK), aud);
    await env.SUBS.put(noegle, t, { expirationTtl: 11 * 3600 });
  }
  return (cache[aud] = t);
}

// Ét "bank på": 'sendt', 'fjern' (404/410 = læseren har slået det fra) eller 'fejl <kode>'
async function sendTil(env, endpoint, cache) {
  const aud = new URL(endpoint).origin;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `vapid t=${await token(env, aud, cache)}, k=${env.VAPID_PUBLIC}`, ttl: '86400', urgency: 'normal' },
    body: new Uint8Array(0),
  });
  if (r.status === 404 || r.status === 410) return 'fjern';
  return r.ok ? 'sendt' : `fejl ${r.status} ${aud}`;
}

// Én portion af dagens udsendelse. Tilstanden ligger i KV mellem kørslerne (tidsplanen kører hvert 10. minut
// i aftentimerne); når alle har fået beskeden, er dagen "færdig", og resten af kørslerne gør intet.
export async function sendPortion(env, nu = new Date()) {
  const noegle = 'koersel:' + dag(nu);
  let st = await env.SUBS.get(noegle, 'json');
  if (st && st.faerdig) return { ...st, allerede: true };
  const nye = await dagensNye(env, nu);
  if (!st) st = { cursor: null, sendt: 0, fjernet: 0, fejl: 0, portioner: 0, sendtIPortion: [], artikler: nye.map((a) => a.u) };
  const gem = () => env.SUBS.put(noegle, JSON.stringify(st), { expirationTtl: 3 * 86400 });
  if (!nye.length) { st.faerdig = true; st.ingenNye = true; await gem(); return st; }

  const liste = await env.SUBS.list({ prefix: 's:', limit: PORTION, ...(st.cursor ? { cursor: st.cursor } : {}) });
  const allerede = new Set(st.sendtIPortion || []);
  const sendtNu = [...allerede];
  const cache = {};
  for (const k of liste.keys) {
    if (allerede.has(k.name)) continue; // fik den i et afbrudt forsøg på samme portion
    const m = k.metadata || {};
    if (!m.e) continue;
    try {
      const res = await sendTil(env, m.e, cache);
      if (res === 'fjern') { await env.SUBS.delete(k.name); st.fjernet++; }
      else if (res === 'sendt') { st.sendt++; sendtNu.push(k.name); }
      else { st.fejl++; st.sidsteFejl = res; }
    } catch (e) {
      const tekst = String(e.message || e);
      // Loftet for udgående forespørgsler: stop UDEN at flytte markøren; næste kørsel tager resten
      if (/subrequest/i.test(tekst)) { st.sendtIPortion = sendtNu; st.afbrudt = true; await gem(); return st; }
      st.fejl++; st.sidsteFejl = tekst.slice(0, 120);
    }
  }
  st.portioner++;
  st.afbrudt = false;
  st.sendtIPortion = [];
  st.cursor = liste.list_complete ? null : liste.cursor;
  st.faerdig = liste.list_complete;
  await gem();
  return st;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

    if (req.method === 'POST' && (url.pathname === '/subscribe' || url.pathname === '/unsubscribe')) {
      if (!OPRINDELSER.includes(req.headers.get('origin'))) return svar({ fejl: 'oprindelse' }, 403, req);
      // Højst 10 pr. minut pr. afsender. IP-adressen bruges kun til tællingen og gemmes ikke.
      if (env.BEGRAENS) {
        const { success } = await env.BEGRAENS.limit({ key: req.headers.get('cf-connecting-ip') || 'ukendt' });
        if (!success) return svar({ fejl: 'for mange' }, 429, req);
      }
      const d = await laesKrop(req);
      const endpoint = url.pathname === '/subscribe' ? d?.subscription?.endpoint : d?.endpoint;
      if (!gyldigtEndpoint(endpoint)) return svar({ fejl: 'push-adresse' }, 400, req);
      const noegle = 's:' + await endpointId(endpoint);
      try {
        if (url.pathname === '/unsubscribe') { await env.SUBS.delete(noegle); return svar({ ok: true }, 200, req); }
        const metadata = { e: endpoint };
        if (!metadataPasser(metadata)) return svar({ fejl: 'for stor' }, 400, req);
        await env.SUBS.put(noegle, '1', { metadata, expirationTtl: LEVETID });
        return svar({ ok: true }, 200, req);
      } catch { return svar({ fejl: 'lager' }, 500, req); }
    }

    // Prøvebesked (10/11-2026, til test): sender én "bank på" til den tilmelding, der beder om den — og kun den.
    // id = sha256 af push-adressen, som kun læserens egen browser kender. Højst én prøve i timen pr. tilmelding.
    if (req.method === 'POST' && url.pathname === '/proeve') {
      if (!OPRINDELSER.includes(req.headers.get('origin'))) return svar({ fejl: 'oprindelse' }, 403, req);
      if (env.BEGRAENS) {
        const { success } = await env.BEGRAENS.limit({ key: req.headers.get('cf-connecting-ip') || 'ukendt' });
        if (!success) return svar({ fejl: 'for mange' }, 429, req);
      }
      const d = await laesKrop(req);
      const id = String(d?.id || '');
      if (!/^[0-9a-f]{64}$/.test(id)) return svar({ fejl: 'id' }, 400, req);
      const { metadata } = await env.SUBS.getWithMetadata('s:' + id);
      if (!metadata || !metadata.e) return svar({ fejl: 'ukendt' }, 404, req);
      if (await env.SUBS.get('p:' + id)) return svar({ fejl: 'vent en time' }, 429, req);
      await env.SUBS.put('p:' + id, '1', { expirationTtl: 3600 });
      try { return svar({ resultat: await sendTil(env, metadata.e, {}) }, 200, req); }
      catch (e) { return svar({ fejl: String(e.message || e).slice(0, 120) }, 500, req); }
    }

    if (req.method === 'GET' && url.pathname === '/besked') {
      const id = url.searchParams.get('id') || '';
      if (!/^[0-9a-f]{64}$/.test(id)) return svar(STANDARD, 200, req);
      try {
        const { metadata } = await env.SUBS.getWithMetadata('s:' + id);
        if (!metadata) return svar(STANDARD, 200, req);
        const a = (await dagensNye(env, new Date()))[0];
        return svar(a ? beskedFor(a) : STANDARD, 200, req);
      } catch { return svar(STANDARD, 200, req); }
    }
    return new Response('Not found', { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendPortion(env).then((st) => console.log('udsendelse', JSON.stringify({ sendt: st.sendt, fjernet: st.fjernet, fejl: st.fejl, faerdig: st.faerdig, ingenNye: !!st.ingenNye }))));
  },
};
