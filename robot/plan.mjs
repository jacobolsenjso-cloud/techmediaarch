// TRIN 3 — robotten på fast tidsplan (Jacobs valg 26/9-2026):
//   højst 2 udgivelser pr. døgn, fri tirsdag og fredag (dansk tid; ændret fra ons+søn af Jacob 27/9).
// Kaldes af workflowet "Robot (tidsplan)". Tre opgaver:
//   node robot/plan.mjs --tjek     → må der udgives nu? (skriver koer=ja/nej til GitHub)
//   node robot/plan.mjs --koer     → skriv én artikel og markér søgeordet
//   node robot/plan.mjs --tomgang  → rød kørsel (= mail til Jacob), hvis robotten er gået i stå
// Loftet og fridagene tjekkes HER og ikke kun i tidsplanen, fordi GitHub kan
// være timer bagud med planlagte kørsler (målt på techfeedwatch 22-24/9), og
// fordi knappen kan trykkes i hånden.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { sti, BRUGTE, PROEVEDE } from './lib/arkiv.mjs';

export const MAKS_PR_DAG = 2;
export const FRIDAGE = ['Tue', 'Fri'];      // tirsdag og fredag
export const TOMGANG_TIMER = 60;            // længste normale pause: mandag eftermiddag → onsdag morgen (~40 t) + GitHubs forsinkelse
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

// Afvisninger, der er robottens egen kvalitetskontrol (ikke en fejl i maskineriet).
// Kun artiklens egne afvisninger — IKKE fx "login afvist" fra Search Console (målt 26/9: det er en nøglefejl).
const AFVIST = /artiklen afvist|— afvist \(mindst|førstepersons-påstand|godkendte ingen af pakkerne|Ingen pakker i listen/i;

const arg = process.argv[2];
if (arg === '--tjek') {
  const { ok, grund } = maaUdgive();
  summary(`**Tidsplan:** ${ok ? 'kører' : 'springer over'} — ${grund}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `koer=${ok ? 'ja' : 'nej'}\n`);
} else if (arg === '--koer') {
  fs.rmSync(sti('robot/ud/valgt.json'), { force: true });   // aldrig et gammelt valg fra en tidligere kørsel
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
