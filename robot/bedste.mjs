// "Best of each topic" (30/9-2026, Jacobs valg A): klik fra Google Search de sidste 90 dage pr. artikel.
// Henter tallene fra Search Console (kun læseadgang) og gemmer dem i robot/data/bedste.json:
//   { hentet, fra, til, dage, sider: { "<sti>": { klik, visninger } } }
// Sitet læser filen ved bygning og viser de mest klikkede artikler pr. emne på /best-of-each-topic.
// Kører i "Robot (tidsplan)" efter artiklen (robot/plan.mjs --koer), så filen kommer med i robottens commit.
// Uden nøgle (fx lokalt) gør den ingenting og lader filen være.
//   node robot/bedste.mjs                      rigtige tal (kræver GSC_SERVICE_ACCOUNT_JSON)
//   node robot/bedste.mjs --falsk --fil X      opdigtede tal KUN til at prøve siden lokalt — aldrig i robottens fil
import fs from 'node:fs';
import path from 'node:path';
import { sti } from './lib/arkiv.mjs';
import { harAdgang, hentSider } from './lib/searchconsole.mjs';

const arg = (n, std) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : std; };
const DAGE = 90;
const FALSK = process.argv.includes('--falsk');
const FIL = sti(arg('fil', 'robot/data/bedste.json'));
if (FALSK && !process.argv.includes('--fil')) throw new Error('--falsk kræver --fil, så robottens rigtige fil aldrig får falske tal');

// Alle artiklers stier (/2024/10/navn), som sitet kender dem
function alleStier() {
  const ud = new Set();
  const rod = sti('src/content/posts');
  for (const aar of fs.readdirSync(rod)) for (const md of fs.readdirSync(path.join(rod, aar)))
    for (const f of fs.readdirSync(path.join(rod, aar, md)).filter((x) => x.endsWith('.md'))) ud.add(`/${aar}/${md}/${f.replace(/\.md$/, '')}`);
  return ud;
}

// Search Console-adresse -> artiklens sti. Samme artikel kan stå som både .html (Blogger) og uden (nu), med og uden www,
// og med kodede tegn — alt lægges sammen på én sti.
function tilSti(url) {
  let s;
  try { s = new URL(url).pathname; } catch { return null; }
  try { s = decodeURIComponent(s); } catch { /* ukodet i forvejen */ }
  return s.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
}

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
  const { fra, til, sider: raekker } = await hentSider({ dage: DAGE });
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
