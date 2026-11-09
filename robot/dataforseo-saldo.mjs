// Saldo-vagt for DataForSEO (Jacob 9/11-2026): køres af Tomgangsalarm 3 gange i døgnet (gratis kald).
// RØD (exit 1 → mail fra GitHub), når saldoen er under SALDO_ADVARSEL ($10), når login afvises (401/403) eller nøglen
// mangler — så søgetallene aldrig stopper i stilhed. Er DataForSEO bare nede et øjeblik (net/5xx), kun en advarsel i
// loggen (ingen mail): robotten vælger så bare uden søgetal den dag. Nøglerne skrives aldrig ud.
import fs from 'node:fs';
import { saldo, SALDO_ADVARSEL } from './lib/dataforseo.mjs';

const r = await saldo();
let roed = false;
let tekst;
if (r.saldo !== undefined && r.saldo !== null) {
  roed = r.saldo < SALDO_ADVARSEL;
  tekst = roed
    ? `❌ DataForSEO-saldoen er $${r.saldo} — under $${SALDO_ADVARSEL}. Fyld op på app.dataforseo.com (Add Funds), ellers vælger robotten emner uden søgetal.`
    : `✅ DataForSEO-saldo: $${r.saldo}`;
} else if (r.fejl === 'nøglen mangler' || r.status === 401 || r.status === 403) {
  roed = true;
  tekst = `❌ DataForSEO-login virker ikke: ${r.fejl}. Tjek GitHub-nøglerne DATAFORSEO_LOGIN og DATAFORSEO_PASSWORD.`;
} else {
  tekst = `⚠ DataForSEO-saldoen kunne ikke læses lige nu (${r.fejl}) — prøves igen ved næste tjek.`;
  console.log(`::warning::${tekst}`);
}
console.log(tekst);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${tekst}\n`);
process.exit(roed ? 1 : 0);
