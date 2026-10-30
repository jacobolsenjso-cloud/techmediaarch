// TRIN 3 — robotten på fast tidsplan (Jacobs valg 26/9-2026):
//   højst 2 udgivelser pr. døgn, fri tirsdag, fredag og søndag (dansk tid; Jacob 29/10-2026 — før tir+fre fra 27/9,
//   og ons+søn før det). Tidsplanen på GitHub (cron) kører stadig søndag; den rettes ved go-live (trin 8) — indtil
//   da stopper maaUdgive() søndagens kørsler her, før der bruges penge.
// Kaldes af workflowet "Robot (tidsplan)". Tre opgaver:
//   node robot/plan.mjs --tjek     → må der udgives nu? (skriver koer=ja/nej til GitHub)
//   node robot/plan.mjs --koer     → skriv én artikel og markér søgeordet
//   node robot/plan.mjs --tomgang  → rød kørsel (= mail til Jacob), hvis robotten er gået i stå
//   node robot/plan.mjs --omskriv  → skriv næste ældre artikel i køen om (30/10-2026, samme kørsel som --koer)
// Loftet og fridagene tjekkes HER og ikke kun i tidsplanen, fordi GitHub kan
// være timer bagud med planlagte kørsler (målt på techfeedwatch 22-24/9), og
// fordi knappen kan trykkes i hånden.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { sti, BRUGTE, PROEVEDE } from './lib/arkiv.mjs';
import { KURS } from './lib/gemini.mjs';
const PRIS = 'robot/data/pris.json';   // pristælleren (trin 7): én række pr. kørsel

export const MAKS_PR_DAG = 2;
export const FRIDAGE = ['Tue', 'Fri', 'Sun']; // tirsdag, fredag og søndag (Jacob 29/10-2026: udgiver man, ons, tor, lør)
export const TOMGANG_TIMER = 60;            // længste normale pause: fx lørdag eftermiddag → mandag morgen (~40 t) + GitHubs forsinkelse
const SITE = 'https://www.techmediaarch.com';

const dkDato = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(d);            // 2026-09-26
const dkDag = (d) => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', weekday: 'short' }).format(d); // Sat
const laes = (f, tom) => { try { return JSON.parse(fs.readFileSync(sti(f), 'utf8')); } catch { return tom; } };
const skrivJson = (f, d) => fs.writeFileSync(sti(f), JSON.stringify(d, null, 1) + '\n');
const summary = (t) => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, t + '\n'); };

// Alle robotartikler: [{ sti, udgivet: Date }]
export function robotArtikler() {
  const ud = []; const posts = sti('src/content/posts');
  for (const aar of fs.readdirSync(posts)) for (const md of fs.readdirSync(path.join(posts, aar))) {
    for (const f of fs.readdirSync(path.join(posts, aar, md)).filter((x) => x.endsWith('.md'))) {
      const m = fs.readFileSync(path.join(posts, aar, md, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const d = m ? (parse(m[1]) || {}) : {};
      // Uden .html (29/9-2026): tomgangstjekket henter adressen uden at følge omdirigeringer,
      // så den gamle .html-adresse (301) ville give falsk alarm
      if (d.robot === true && d.published) ud.push({ sti: `/${aar}/${md}/${f.replace(/\.md$/, '')}`, udgivet: new Date(String(d.published)) });
    }
  }
  return ud.sort((a, b) => b.udgivet - a.udgivet);
}

// Må der udgives nu? Returnerer { ok, grund }.
export function maaUdgive(nu = new Date(), liste = robotArtikler()) {
  if (FRIDAGE.includes(dkDag(nu))) return { ok: false, grund: `fridag (${dkDag(nu)}, dansk tid)` };
  const iDag = liste.filter((a) => dkDato(a.udgivet) === dkDato(nu)).length;
  if (iDag >= MAKS_PR_DAG) return { ok: false, grund: `loftet er nået: ${iDag} af ${MAKS_PR_DAG} i dag` };
  return { ok: true, grund: `${iDag} af ${MAKS_PR_DAG} i dag` };
}

const OMSKRIV_KOE = 'robot/data/omskriv-koe.json';         // [{ sti, maade: 'fuld' | 'titel' }] i Jacobs rækkefølge
const OMSKRIV_PROEVET = 'robot/data/omskriv-proevet.json'; // [{ sti, dato, grund }] — afvist; hviler 30 dage
export const OMSKRIV_LOFT_KR = 150;                        // omskrivning stopper ved 150 kr i måneden (Googles loft er 200, Jacob 30/10-2026)
// Tempo (Jacob 30/10-2026): 3 om dagen, 6 dage om ugen (fri søndag), højst 1 af de 3 med Google-visninger
// ("visninger: true" i køen) — så et eventuelt fald i Google kan ses og bremses, før det rammer dem alle.
export const OMSKRIV_PR_DAG = 3;
export const OMSKRIV_VISNINGER_PR_DAG = 1;
export const OMSKRIV_FRIDAGE = ['Sun'];
const OMSKRIV_FORSOEG_PR_KOERSEL = 5;                      // også afviste tæller, så en kørsel aldrig løber løbsk

// Pristæller (trin 7, Jacob 29/10-2026): hver del (søgeord, artikel, "People also ask") skriver sin opgørelse
// til robot/ud/pris-<del>.json ud fra Googles egne tal (robot/lib/gemini.mjs). Her lægges de sammen og gemmes
// i robot/data/pris.json (kommer med i robottens commit), så prisen pr. artikel og pr. måned kan ses.
// 30/10: en omskrivning gemmes med "omskrevet: true", så nye artikler og omskrivninger kan tælles hver for sig.
function gemPris(lykkedes) {
  try {
    const dele = {};
    if (fs.existsSync(sti('robot/ud'))) for (const f of fs.readdirSync(sti('robot/ud')).filter((x) => /^pris-.+\.json$/.test(x))) dele[f.slice(5, -5)] = laes(`robot/ud/${f}`, null);
    const usd = Object.values(dele).reduce((s, d) => s + (d?.usd || 0), 0);
    const a = lykkedes ? laes('robot/ud/proeveartikel.json', null) : null;
    const priser = laes(PRIS, []);
    priser.push({ dato: new Date().toISOString(), artikel: a?.sti || null, ...(arg === '--omskriv' ? { omskrevet: true } : {}), usd: Math.round(usd * 10000) / 10000, kr: Math.round(usd * KURS * 100) / 100,
      dele: Object.fromEntries(Object.entries(dele).map(([k, d]) => [k, { kr: d?.kr ?? null, billeder: d?.billeder ?? 0, soegninger: d?.soegninger ?? 0, ukendtPris: d?.ukendtPris ?? [] }])) });
    skrivJson(PRIS, priser);
    const md = dkDato(new Date()).slice(0, 7);
    const iMd = priser.filter((p) => dkDato(new Date(p.dato)).slice(0, 7) === md);
    const krMd = iMd.reduce((s, p) => s + (p.kr || 0), 0);
    const ukendt = [...new Set(Object.values(dele).flatMap((d) => d?.ukendtPris || []))];
    summary(`**Pris denne kørsel:** ${(Math.round(usd * KURS * 100) / 100).toFixed(2)} kr (${Object.entries(dele).map(([k, d]) => `${k} ${(d?.kr ?? 0).toFixed(2)}`).join(' · ')})${ukendt.length ? ` — UKENDT pris for ${ukendt.join(', ')}` : ''} · **${md} indtil nu:** ${krMd.toFixed(2)} kr for ${iMd.filter((p) => p.artikel && !p.omskrevet).length} nye artikler og ${iMd.filter((p) => p.artikel && p.omskrevet).length} omskrivninger (målt fra 29/10-2026)`);
  } catch (e) { summary(`**Pris:** kunne ikke opgøres (${String(e.message).slice(0, 120)})`); }
}

// Afvisninger, der er robottens egen kvalitetskontrol (ikke en fejl i maskineriet).
// Kun artiklens egne afvisninger — IKKE fx "login afvist" fra Search Console (målt 26/9: det er en nøglefejl).
const AFVIST = /artiklen afvist|— afvist \(mindst|førstepersons-påstand|godkendte ingen af pakkerne|Ingen pakker i listen/i;

const arg = process.argv[2];
if (arg === '--tjek') {
  const { ok, grund } = maaUdgive();
  // Omskrivning kører 6 dage om ugen (Jacob 30/10-2026) — også tirsdag og fredag, hvor der ikke kommer nye artikler
  const omskriv = !OMSKRIV_FRIDAGE.includes(dkDag(new Date()));
  summary(`**Tidsplan:** ny artikel ${ok ? 'kører' : 'springer over'} — ${grund} · omskrivning ${omskriv ? 'kører' : `springer over (fridag ${dkDag(new Date())})`}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `koer=${ok ? 'ja' : 'nej'}\nomskriv=${omskriv ? 'ja' : 'nej'}\n`);
} else if (arg === '--koer') {
  fs.rmSync(sti('robot/ud/valgt.json'), { force: true });   // aldrig et gammelt valg fra en tidligere kørsel
  // Aldrig en gammel prisopgørelse fra en tidligere kørsel (pristælleren, se nederst)
  if (fs.existsSync(sti('robot/ud'))) for (const f of fs.readdirSync(sti('robot/ud')).filter((x) => /^pris-.+\.json$/.test(x))) fs.rmSync(sti('robot/ud', f));
  const r = spawnSync('node', ['robot/artikel.mjs'], { cwd: sti(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  const valgt = laes('robot/ud/valgt.json', null);
  if (r.status === 0) {
    const a = laes('robot/ud/proeveartikel.json', null);
    const b = laes(BRUGTE, []);   // læses og flettes — overskrives aldrig
    b.push({ q: a.valgt.hoved, emne: a.valgt.emne, dato: dkDato(new Date()), artikel: a.sti });
    skrivJson(BRUGTE, b);
    summary(`**Udgivet:** ${a.titel} — ${SITE}${a.sti}`);
  } else {
    const fejl = ((r.stderr || '').match(/Error: (.+)/) || [])[1] || `artikel.mjs sluttede med kode ${r.status}`;
    // Ryd halve filer (billeder, tilbage-links) væk, så intet halvt når main.
    if (process.env.CI) { execFileSync('git', ['checkout', '--', 'src', 'public'], { cwd: sti() }); execFileSync('git', ['clean', '-fdq', '--', 'src/content', 'public/images'], { cwd: sti() }); }
    if (valgt) {   // søgeordet hviler 30 dage, så robotten ikke prøver det samme igen og igen
      const p = laes(PROEVEDE, []); p.push({ q: valgt.hoved, emne: valgt.emne, dato: new Date().toISOString(), grund: fejl.slice(0, 160) }); skrivJson(PROEVEDE, p);
    }
    if (AFVIST.test(fejl)) summary(`**Ingen artikel denne gang** (kvalitetskontrollen sagde nej): ${fejl}${valgt ? ` — "${valgt.hoved}" hviler i 30 dage` : ''}`);
    else { summary(`**FEJL:** ${fejl}`); process.exitCode = 1; }
  }
  // "People also ask" valgt af Gemini (29/9, Jacobs valg): 60 artikler pr. kørsel — den nye artikel og dem uden valg først.
  // Gemmes i robot/data/ogsaa-spurgt.json og kommer med i robottens commit. Fejl her stopper aldrig artiklen.
  const o = spawnSync('node', ['robot/ogsaa-spurgt.mjs', '--antal', '60'], { cwd: sti(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10 * 60 * 1000 });
  process.stderr.write(o.stderr || '');
  summary(`**People also ask:** ${((o.stdout || '').trim().split('\n').pop() || `sluttede med kode ${o.status}`).slice(0, 300)}`);
  // "Best of each topic" (30/9, Jacobs valg A): klik fra Google de sidste 90 dage -> robot/data/bedste.json. Fejl stopper aldrig artiklen.
  const b = spawnSync('node', ['robot/bedste.mjs'], { cwd: sti(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3 * 60 * 1000 });
  process.stderr.write(b.stderr || '');
  summary(`**Best of each topic:** ${((b.stdout || '').trim().split('\n').pop() || `sluttede med kode ${b.status}`).slice(0, 300)}`);
  // Trending = mest læste (30/9, Jacobs valg: Google Analytics, 7 dage) -> robot/data/mest-laest.json. Fejl stopper aldrig artiklen.
  const m = spawnSync('node', ['robot/mest-laest.mjs'], { cwd: sti(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3 * 60 * 1000 });
  process.stderr.write(m.stderr || '');
  summary(`**Trending (mest læste):** ${((m.stdout || '').trim().split('\n').pop() || `sluttede med kode ${m.status}`).slice(0, 300)}`);
  gemPris(r.status === 0);
} else if (arg === '--omskriv') {
  // Omskrivning af ældre artikler (Jacob 29-30/10-2026): OMSKRIV_PR_DAG om dagen (højst OMSKRIV_VISNINGER_PR_DAG af dem
  // med Google-visninger), aldrig over OMSKRIV_LOFT_KR i måneden (så der altid er plads til nye artikler under Googles
  // beløbsloft på 200 kr). Køen: robot/data/omskriv-koe.json (Jacobs rækkefølge: først artiklerne med Google-visninger,
  // så videoopsummeringerne, så resten af T/V). En afvist artikel hviler 30 dage (robot/data/omskriv-proevet.json).
  // Hele dagens kvote tages i dagens første kørsel; den anden kørsel samler op, hvis noget blev afvist.
  const koe = laes(OMSKRIV_KOE, []);
  const proevet = laes(OMSKRIV_PROEVET, []);
  const fm = (s) => { try { return parse(fs.readFileSync(sti(`src/content/posts${s}.md`), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]) || {}; } catch { return {}; } };
  const iDagDato = new Date().toISOString().slice(0, 10);
  const md = dkDato(new Date()).slice(0, 7);
  // Hvad der allerede er ændret FØR en omskrivning (dagens nye artikel og tidligere omskrivninger i samme kørsel).
  // Fejler en omskrivning, ryddes KUN det, den selv har lavet (30/10: én robot, én kørsel).
  const aendret = () => new Set(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src', 'public'], { cwd: sti(), encoding: 'utf8' }).split('\n').filter(Boolean));
  for (let forsoeg = 0; forsoeg < OMSKRIV_FORSOEG_PR_KOERSEL; forsoeg++) {
    const hviler = new Set(proevet.filter((p) => Date.now() - new Date(p.dato) < 30 * 864e5).map((p) => p.sti));
    const iDag = koe.filter((k) => fm(k.sti).omskrevet === iDagDato);
    const visIDag = iDag.filter((k) => k.visninger).length;
    const krMd = laes(PRIS, []).filter((p) => dkDato(new Date(p.dato)).slice(0, 7) === md).reduce((s, p) => s + (p.kr || 0), 0);
    const tilbage = koe.filter((k) => !fm(k.sti).omskrevet).length;
    // Næste i køen; er dagens kvote for artikler med visninger brugt, springes de over til i morgen
    const naeste = koe.find((k) => !fm(k.sti).omskrevet && !hviler.has(k.sti) && !(k.visninger && visIDag >= OMSKRIV_VISNINGER_PR_DAG));
    if (iDag.length >= OMSKRIV_PR_DAG) { summary(`**Omskrivning:** færdig for i dag — ${iDag.length} af ${OMSKRIV_PR_DAG} (heraf ${visIDag} med visninger) · ${tilbage} tilbage i køen`); break; }
    if (!naeste) { summary(`**Omskrivning:** intet at gøre lige nu (${tilbage} tilbage i køen, ${hviler.size} hviler, ${visIDag} med visninger i dag)`); break; }
    if (krMd >= OMSKRIV_LOFT_KR) { summary(`**Omskrivning:** springer over — ${krMd.toFixed(2)} kr brugt i ${md} (loft for omskrivning ${OMSKRIV_LOFT_KR} kr)`); break; }
    summary(`**Omskrivning ${iDag.length + 1} af ${OMSKRIV_PR_DAG} i dag:** ${naeste.sti} (${naeste.maade}${naeste.visninger ? ', har visninger' : ''}) · ${tilbage} tilbage i køen · ${krMd.toFixed(2)} kr brugt i ${md}`);
    if (fs.existsSync(sti('robot/ud'))) for (const f of fs.readdirSync(sti('robot/ud')).filter((x) => /^pris-.+\.json$|^proeveartikel\.json$/.test(x))) fs.rmSync(sti('robot/ud', f));
    const foer = aendret();
    const r = spawnSync('node', ['robot/artikel.mjs', '--omskriv', naeste.sti, '--maade', naeste.maade], { cwd: sti(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
    let stop = false;
    if (r.status === 0) summary(`**Skrevet om:** ${laes('robot/ud/proeveartikel.json', {}).titel} — ${SITE}${naeste.sti}`);
    else {
      const fejl = ((r.stderr || '').match(/Error: (.+)/) || [])[1] || `artikel.mjs sluttede med kode ${r.status}`;
      for (const linje of [...aendret()].filter((l) => !foer.has(l))) {
        const fil = linje.slice(3).replace(/^"|"$/g, '');
        if (linje.startsWith('??')) fs.rmSync(sti(fil), { force: true });
        else execFileSync('git', ['checkout', '--', fil], { cwd: sti() });
      }
      if (AFVIST.test(fejl)) {
        proevet.push({ sti: naeste.sti, dato: new Date().toISOString(), grund: fejl.slice(0, 160) }); skrivJson(OMSKRIV_PROEVET, proevet);
        summary(`**Ingen omskrivning af ${naeste.sti}** (kvalitetskontrollen sagde nej): ${fejl} — hviler i 30 dage`);
      } else { summary(`**FEJL:** ${fejl}`); process.exitCode = 1; stop = true; }   // en maskinfejl (fx nøgle) gentages ikke
    }
    gemPris(r.status === 0);
    if (stop) break;
  }
} else if (arg === '--tomgang') {
  const [nyeste] = robotArtikler();
  if (!nyeste) { summary('Ingen robotartikler endnu.'); process.exit(0); }
  const timer = (Date.now() - nyeste.udgivet) / 36e5;
  // Navngiven anmodning + op til 3 forsøg med 5 sekunders pause: Cloudflare svarer
  // 403 til en ukendt maskine første gang og lukker op bagefter. Samme opskrift som
  // techfeedwatch (tjek-tomgang.mjs / indexnow.mjs). Målt 26/9: kun navnet → 403.
  let live = 0;
  for (let forsoeg = 0; forsoeg < 3; forsoeg++) {
    if (forsoeg) await new Promise((r) => setTimeout(r, 5000));
    try { live = (await fetch(`${SITE}${nyeste.sti}?t=${Date.now()}`, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'techmediaarch-tomgang/1.0 (+https://www.techmediaarch.com)' } })).status; } catch { live = 0; }
    if (![0, 403, 429, 503].includes(live)) break;   // 200 eller en ægte fejl som 404: stop
  }
  summary(`**Nyeste robotartikel:** ${nyeste.sti} — for ${timer.toFixed(1)} timer siden, svarer ${live} live (grænse ${TOMGANG_TIMER} timer)`);
  if (timer > TOMGANG_TIMER) { summary(`**ALARM:** ingen ny artikel i ${timer.toFixed(0)} timer.`); process.exitCode = 1; }
  if (live !== 200) { summary(`**ALARM:** den nyeste artikel svarer ${live}, ikke 200 — Cloudflare har måske ikke bygget.`); process.exitCode = 1; }
} else if (arg) {
  console.error('Brug: --tjek | --koer | --tomgang'); process.exitCode = 2;
}
