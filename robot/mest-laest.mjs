// Trending = de mest læste artikler (30/9-2026, Jacobs valg: Google Analytics).
// Henter sidevisninger pr. side de sidste 7 dage fra Google Analytics (kun læseadgang) og gemmer dem i
// robot/data/mest-laest.json: { hentet, fra, til, dage, sider: { "<sti>": { visninger, brugere } } }
// Sitet læser filen ved bygning og sorterer /trending efter visninger.
// Kører i "Robot (tidsplan)" efter artiklen (robot/plan.mjs --koer), så filen kommer med i robottens commit.
// Uden nøgle (fx lokalt) gør den ingenting og lader filen være.
//   node robot/mest-laest.mjs                      rigtige tal (kræver GSC_SERVICE_ACCOUNT_JSON)
//   node robot/mest-laest.mjs --falsk --fil X      opdigtede tal KUN til at prøve siden lokalt — aldrig i robottens fil
import fs from 'node:fs';
import { sti } from './lib/arkiv.mjs';
import { harAdgang } from './lib/searchconsole.mjs';
import { hentSidevisninger } from './lib/analytics.mjs';
import { alleStier, tilSti } from './lib/artikelstier.mjs';

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const DAGE = 7;
const FALSK = process.argv.includes('--falsk');
const FIL = sti(arg('fil', 'robot/data/mest-laest.json'));
if (FALSK && !process.argv.includes('--fil')) throw new Error('--falsk kræver --fil, så robottens rigtige fil aldrig får falske tal');

const stier = alleStier();
let data;
if (FALSK) {
  // Tilfældige, men faste tal (samme hver gang) til en femtedel af artiklerne
  let n = 11; const tal = () => (n = (n * 48271) % 2147483647) / 2147483647;
  const sider = {};
  for (const s of stier) if (tal() < 0.2) { const v = 1 + Math.round(tal() * 200); sider[s] = { visninger: v, brugere: Math.max(1, Math.round(v * 0.8)) }; }
  data = { hentet: new Date().toISOString(), fra: 'falsk', til: 'falsk', dage: DAGE, sider };
} else {
  if (!harAdgang()) { console.log('Mest læste: ingen nøgle her - intet ændret'); process.exit(0); }
  // Fejlen skrives som én linje på stdout, så den står læsbart i robottens resumé (ellers kun Nodes stakspor)
  const svar = await hentSidevisninger({ dage: DAGE }).catch((e) => { console.log(`Mest læste: FEJL - ${String(e.message || e).slice(0, 200)}`); process.exit(1); });
  const { fra, til, sider: raekker } = svar;
  const sider = {}; let udenfor = 0;
  for (const r of raekker) {
    const s = tilSti(r.side);
    if (!s || !stier.has(s)) { udenfor++; continue; }   // forside, emnesider, sider — kun artikler tæller
    const x = (sider[s] ||= { visninger: 0, brugere: 0 });
    // Brugere lægges sammen på tværs af adresseformer (.html/uden); en person kan derfor tælle to gange — kun visninger bruges til rækkefølgen
    x.visninger += r.visninger; x.brugere += r.brugere;
  }
  data = { hentet: new Date().toISOString(), fra, til, dage: DAGE, sider };
  console.error(`(${raekker.length} sider fra Analytics, ${udenfor} er ikke artikler)`);
}
fs.writeFileSync(FIL, JSON.stringify(data, null, 1) + '\n');
const liste = Object.values(data.sider);
console.log(`Mest læste: ${liste.length} artikler læst · ${liste.reduce((a, x) => a + x.visninger, 0)} visninger i alt (${data.fra} til ${data.til})`);
