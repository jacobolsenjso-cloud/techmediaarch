// Selvtest af tma-starters tidsplan (kør: node cloudflare/tma-starter/test.mjs). Intet net.
// Tjekker også, at tiderne er de samme som i robottens GitHub-tidsplan og i wrangler.toml.
import fs from 'node:fs';
import { skalStarte } from './worker.mjs';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
// En uge: mandag 2/11-2026 til søndag 8/11-2026, hvert minut
let starter = 0; const tider = [];
for (let d = 2; d <= 8; d++) for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) {
  const tid = new Date(Date.UTC(2026, 10, d, h, m));
  if (skalStarte(tid)) { starter++; tider.push(tid.toISOString().slice(5, 16)); }
}
t(`12 starter om ugen (2 om dagen, mandag-lørdag): ${starter}`, starter === 12);
t('ingen start om søndagen', !tider.some((x) => x.startsWith('11-08')));
t('kl. 07:43 og 15:43 UTC', skalStarte(new Date(Date.UTC(2026, 10, 2, 7, 43))) && skalStarte(new Date(Date.UTC(2026, 10, 2, 15, 43))) && !skalStarte(new Date(Date.UTC(2026, 10, 2, 7, 17))));
t('aldrig samtidig med tfw-starter (minut 17 og 37)', !tider.some((x) => /:(17|37)$/.test(x)));
// Workerens tider og wrangler.toml skal være ens
const cron = '43 7,15 * * 1-6';
const toml = fs.readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
const yml = fs.readFileSync(new URL('../../.github/workflows/robot-tidsplan.yml', import.meta.url), 'utf8');
t('wrangler.toml har samme tid som workeren', toml.includes(`crons = ["${cron}"]`));
// GitHubs egen tidsplan (reserve): schedule og jobbets "if" SKAL være ens, ellers kører jobbet aldrig
const ghCron = (yml.match(/- cron: '([^']+)'/) || [])[1];
t(`robot-tidsplan.yml: schedule og "if" er ens (${ghCron})`, !!ghCron && yml.includes(`github.event.schedule == '${ghCron}'`));
t('robot-tidsplan.yml kan startes udefra (workflow_dispatch)', /workflow_dispatch:/.test(yml) && /options: \[artikel, omskriv\]/.test(yml));
t('workflowet kører aldrig to gange samtidig (concurrency)', /concurrency:\s*\n\s*group: robot-tidsplan/.test(yml));
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
