// Søgetal fra DataForSEO Labs (Jacob 9/11-2026). Måling #54: robottens hovedsøgeord havde typisk 10-20 søgninger
// om måneden, mens fx "how much does cybersecurity pay" (4.400/md, sværhed 10) lå i bunken uden at blive valgt.
//
// Hvad robotten får pr. spørgsmål: søgninger pr. måned (USA, engelsk), sværhedsgrad 0-100 (chancen for top 10),
// om kurven er jævn over 12 måneder ("tidløs") og udviklingen over et år.
// Pris: $0,012 pr. kald + $0,00012 pr. fundet søgeord; højst 700 søgeord pr. kald og 4 kald pr. kørsel → højst ca. $0,40.
// Ukendte søgeord (ikke i DataForSEO's database) koster intet.
// Hukommelse: robot/data/dataforseo.json gemmer svarene i 30 dage, så samme spørgsmål ikke betales igen.
// Fejler noget (ingen nøgle, dagsloft på $2 nået, tom saldo, nede), returneres null, og robotten kører videre uden tal.
// Nøglerne (DATAFORSEO_LOGIN/PASSWORD, GitHub-nøgler) skrives ALDRIG ud.
import fs from 'node:fs';
import path from 'node:path';
import { sti } from './arkiv.mjs';
import { normaliser } from './tekst.mjs';

export const MAKS_PR_KALD = 700;         // DataForSEO's grænse
export const MAKS_KALD = 4;              // pr. kørsel: 2.441 mulige hovedsøgeord målt 9/11 → 4 kald første gang (ca. $0,25),
                                         // derefter kun nye spørgsmål (hukommelsen), dvs. typisk ét lille kald
export const HUSK_DAGE = 30;             // søgetal er månedstal; ældre svar hentes igen
export const MIN_SOEGNINGER = 20;        // under dette tæller et søgeord som "for få søgninger"
export const SALDO_ADVARSEL = 10;        // $ — under dette giver tomgangsalarmen rødt (mail til Jacob)
const HUSK = process.env.DATAFORSEO_HUSK || 'robot/data/dataforseo.json';   // DATAFORSEO_HUSK kun til test
const fuld = (f) => (path.isAbsolute(f) ? f : sti(f));   // tests bruger en midlertidig fil

const skjul = (t) => String(t).replace(/[A-Za-z0-9+/=_-]{24,}/g, '***').slice(0, 160);
export const harNoegle = () => Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

async function kald(vej, body) {
  const auth = 'Basic ' + Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
  const r = await fetch(`https://api.dataforseo.com/v3/${vej}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, j };
}

// Saldo i $ (gratis kald) eller { fejl }
export async function saldo() {
  if (!harNoegle()) return { fejl: 'nøglen mangler' };
  try {
    const r = await kald('appendix/user_data');
    if (!r.ok || r.j?.status_code !== 20000) return { fejl: `HTTP ${r.status} ${skjul(r.j?.status_message || '')}`, status: r.status };
    return { saldo: r.j.tasks?.[0]?.result?.[0]?.money?.balance ?? null };
  } catch (e) { return { fejl: skjul(e.message) }; }
}

// Ét svar fra DataForSEO → robottens korte form. j = jævn kurve ("tidløs"): månederne svinger mindre end 35 % omkring
// snittet, og der er mindst 10 søgninger i snit.
export function oversaet(it) {
  const mdr = (it?.keyword_info?.monthly_searches || []).slice(0, 12).map((m) => m.search_volume || 0);
  const snit = mdr.length ? mdr.reduce((a, b) => a + b, 0) / mdr.length : 0;
  const spredning = snit ? Math.sqrt(mdr.reduce((a, b) => a + (b - snit) ** 2, 0) / mdr.length) / snit : null;
  return {
    v: it?.keyword_info?.search_volume ?? 0,                       // søgninger pr. måned
    kd: it?.keyword_properties?.keyword_difficulty ?? null,         // sværhed 0-100 (null = ukendt)
    j: spredning !== null && spredning < 0.35 && snit >= 10,        // tidløs
    a: it?.keyword_info?.search_volume_trend?.yearly ?? null,       // udvikling over et år, %
  };
}

// Værdi = søgninger × lethed. Ukendt sværhed regnes som 50. Tidløs ×1,5 (Jacob vil have tidløse artikler);
// faldet med mindst halvdelen på et år ×0,7 (ofte en nyhed, der er ved at dø ud).
// Under MIN_SOEGNINGER → 0 (for få søgninger til at være en artikel værd i sig selv).
export function vaerdi(t) {
  if (!t || (t.v || 0) < MIN_SOEGNINGER) return 0;
  const lethed = 1 - (t.kd ?? 50) / 100;
  return Math.round(t.v * Math.max(lethed, 0.05) * (t.j ? 1.5 : 1) * (t.a !== null && t.a <= -50 ? 0.7 : 1));
}

// Gruppe: 0 = kendt med søgninger · 1 = ukendt (ikke i DataForSEO, eller ikke spurgt) · 2 = kendt, men for få søgninger
export const gruppe = (t) => (t === undefined ? 1 : t === null ? 1 : (t.v || 0) >= MIN_SOEGNINGER ? 0 : 2);
// NB: t === null betyder "spurgt, men DataForSEO kendte det ikke" — det er IKKE det samme som 0 søgninger.

const gyldig = (q) => q.length <= 80 && q.split(' ').length <= 10;

export function laesHusk(nu = Date.now(), fil = HUSK) {
  try {
    const alle = JSON.parse(fs.readFileSync(fuld(fil), 'utf8'));
    const graense = nu - HUSK_DAGE * 864e5;
    return Object.fromEntries(Object.entries(alle).filter(([, x]) => Date.parse(x.d) >= graense));
  } catch { return {}; }
}
function gemHusk(husk, fil = HUSK) {
  fs.mkdirSync(path.dirname(fuld(fil)), { recursive: true });
  // Sorteret, så git-ændringer er til at læse
  fs.writeFileSync(fuld(fil), JSON.stringify(Object.fromEntries(Object.entries(husk).sort(([a], [b]) => a.localeCompare(b))), null, 0).replace(/},"/g, '},\n"') + '\n');
}

// Søgetal for en liste spørgsmål i PRIORITERET rækkefølge (de mest sandsynlige hovedsøgeord først).
// Returnerer { tal: Map(normaliseret → {v,kd,j,a} | null), log }. null = DataForSEO kender ikke spørgsmålet.
// Spørgsmål, der hverken er i hukommelsen eller blev sendt (over loftet på 700), står ikke i tal.
export async function hentTal(qs, { nu = Date.now(), maks = MAKS_PR_KALD, kald_ = MAKS_KALD, fil = HUSK } = {}) {
  const husk = laesHusk(nu, fil);
  const tal = new Map();
  const nye = [];
  const nyeSet = new Set();
  for (const q0 of qs) {
    const q = normaliser(q0);
    if (tal.has(q) || nyeSet.has(q)) continue;
    if (husk[q]) tal.set(q, husk[q].t);
    else if (gyldig(q) && nye.length < maks * kald_) { nye.push(q); nyeSet.add(q); }
  }
  const log = { fraHusk: tal.size, sendt: 0, fundet: 0, kald: 0, pris: 0, fejl: null };
  if (!nye.length) return { tal, log };
  if (!harNoegle()) { log.fejl = 'nøglen mangler (DATAFORSEO_LOGIN/PASSWORD)'; return { tal, log }; }
  const d = new Date(nu).toISOString().slice(0, 10);
  // Op til kald_ kald à maks søgeord. Fejler et kald, stoppes der; svarene fra de kald, der lykkedes, gemmes alligevel.
  for (let i = 0; i < nye.length; i += maks) {
    const del = nye.slice(i, i + maks);
    try {
      const r = await kald('dataforseo_labs/google/keyword_overview/live', [{ keywords: del, location_code: 2840, language_code: 'en' }]);
      const opg = r.j?.tasks?.[0];
      if (!r.ok || opg?.status_code !== 20000) {
        // Fx 40203 = dagsloftet ($2) er nået, 40200 = saldoen er tom
        log.fejl = `HTTP ${r.status} ${opg?.status_code || r.j?.status_code || ''} ${skjul(opg?.status_message || r.j?.status_message || '')}`.trim();
        break;
      }
      const fundet = new Map((opg.result?.[0]?.items || []).map((it) => [normaliser(it.keyword), oversaet(it)]));
      for (const q of del) { const t = fundet.get(q) ?? null; tal.set(q, t); husk[q] = { d, t }; }
      log.sendt += del.length; log.fundet += fundet.size; log.kald++; log.pris = Math.round((log.pris + (opg.cost || 0)) * 1e6) / 1e6;
    } catch (e) { log.fejl = skjul(e.message); break; }
  }
  if (log.kald) gemHusk(husk, fil);
  return { tal, log };
}

// Kort tekst til lister og logge: "4400 søgn./md · sværhed 10 · tidløs"
export function talTekst(t) {
  if (t === undefined) return 'søgetal: ikke spurgt';
  if (t === null) return 'søgetal: ukendt hos DataForSEO';
  return [`${t.v} søgn./md`, t.kd !== null ? `sværhed ${t.kd}` : null, t.j ? 'tidløs' : null, t.a !== null && t.a <= -50 ? `faldende (${t.a} %)` : null].filter(Boolean).join(' · ');
}
