// "Best of each topic" (30/9-2026, Jacobs valg A): klik fra Google Search de sidste 90 dage pr. artikel.
// Henter tallene fra Search Console (kun læseadgang) og gemmer dem i robot/data/bedste.json:
//   { hentet, fra, til, dage, sider: { "<sti>": { klik, visninger } } }
// Sitet læser filen ved bygning og viser de mest klikkede artikler pr. emne på /best-of-each-topic.
// Kører i "Robot (tidsplan)" efter artiklen (robot/plan.mjs --koer), så filen kommer med i robottens commit.
// Uden nøgle (fx lokalt) gør den ingenting og lader filen være.
//   node robot/bedste.mjs                      rigtige tal (kræver GSC_SERVICE_ACCOUNT_JSON)
//   node robot/bedste.mjs --falsk --fil X      opdigtede tal KUN til at prøve siden lokalt — aldrig i robottens fil
import fs from 'node:fs';
import { sti } from './lib/arkiv.mjs';
import { harAdgang, hentSider } from './lib/searchconsole.mjs';
import { alleStier, tilSti } from './lib/artikelstier.mjs';   // fælles med mest-laest.mjs (30/9)

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const DAGE = 90;
const FALSK = process.argv.includes('--falsk');
const FIL = sti(arg('fil', 'robot/data/bedste.json'));
if (FALSK && !process.argv.includes('--fil')) throw new Error('--falsk kræver --fil, så robottens rigtige fil aldrig får falske tal');

const stier = alleStier();
let data;
if (FALSK) {
  // Tilfældige, men faste tal (samme hver gang) til en tredjedel af artiklerne
  let n = 7; const tal = () => (n = (n * 48271) % 2147483647) / 2147483647;
  const sider = {};
  for (const s of stier) if (tal() < 0.33) { const v = Math.round(tal() * 3000); sider[s] = { klik: Math.round(v * tal() * 0.08), visninger: v }; }
  data = { hentet: new Date().toISOString(), fra: 'falsk', til: 'falsk', dage: DAGE, sider };
} else {
  if (!harAdgang()) { console.log('Best of each topic: ingen Search Console-nøgle her - intet ændret'); process.exit(0); }
  // Fejlen skrives som én linje på stdout, så den står læsbart i robottens resumé (ellers kun Nodes stakspor)
  const svar = await hentSider({ dage: DAGE }).catch((e) => { console.log(`Best of each topic: FEJL - ${String(e.message || e).slice(0, 200)}`); process.exit(1); });
  const { fra, til, sider: raekker } = svar;
  const sider = {}; let udenfor = 0;
  for (const r of raekker) {
    const s = tilSti(r.side);
    if (!s || !stier.has(s)) { udenfor++; continue; }   // forside, emnesider, sider — kun artikler tæller
    const x = (sider[s] ||= { klik: 0, visninger: 0 });
    x.klik += r.klik; x.visninger += r.visninger;
  }
  data = { hentet: new Date().toISOString(), fra, til, dage: DAGE, sider };
  console.error(`(${raekker.length} adresser fra Search Console, ${udenfor} er ikke artikler)`);
}
fs.writeFileSync(FIL, JSON.stringify(data, null, 1) + '\n');
const liste = Object.values(data.sider);
console.log(`Best of each topic: ${liste.length} artikler med visninger · ${liste.filter((x) => x.klik > 0).length} med klik · ${liste.reduce((a, x) => a + x.klik, 0)} klik i alt (${data.fra} til ${data.til})`);
