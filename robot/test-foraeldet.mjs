// Afprøvning af forældet-vagten (robot/lib/foraeldet.mjs) på kendte tilfælde — kører i "Robot (manuel)", opgave
// test-foraeldet (få øre). De tre første er udgået/ved at udgå, den sidste er aktuel.
import fs from 'node:fs';
import { tjekForaeldet } from './lib/foraeldet.mjs';
import { brugTekstmodel, ARTIKELMODEL, gemPrisVedExit } from './lib/gemini.mjs';
brugTekstmodel(ARTIKELMODEL);
gemPrisVedExit('test');
const tilfaelde = [
  ['Microsoft Publisher', 'Desktop installations include Word, Excel, PowerPoint, Outlook, OneNote, plus Access and Publisher on PC.', true],
  ['Windows 10 free security updates', 'Windows 10 users continue to receive free monthly security updates from Microsoft.', true],
  ['Microsoft Defender Application Guard', 'Windows 11 Pro includes Microsoft Defender Application Guard to isolate untrusted websites.', true],
  ['Microsoft Teams in Microsoft 365 Business Standard', 'Microsoft 365 Business Standard includes Microsoft Teams for chat and video calls.', false],
];
const linjer = [];
let rigtige = 0;
for (const [hvad, s, forventet] of tilfaelde) {
  const v = await tjekForaeldet(hvad, s);
  const ok = v.forældet === forventet && (!forventet || v.kilder > 0);
  if (ok) rigtige++;
  linjer.push(`- ${ok ? 'OK' : 'FEJL'} ${hvad}: forældet=${v.forældet} · ${v.kilder} søgekilder · ${v.status.slice(0, 120)}`);
}
linjer.push(`**${rigtige} af ${tilfaelde.length} rigtige**`);
console.log(linjer.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Forældet-vagt (test)\n\n${linjer.join('\n')}\n`);
