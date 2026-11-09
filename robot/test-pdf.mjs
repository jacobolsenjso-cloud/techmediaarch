// Prøve af PDF-kilder (rettelse 4, 9/11-2026) MED net: henter rigtige PDF'er fra de steder, der blev afvist 7/11.
// Kør: node robot/test-pdf.mjs
import { kontrollerKilder } from './lib/links.mjs';
import { hentKildeTekster } from './lib/talvagt.mjs';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
const kilder = [
  { uri: 'https://arxiv.org/pdf/2304.03271', titel: 'arxiv.org', i: 0 },
  { uri: 'https://www.gao.gov/assets/gao-25-107172.pdf', titel: 'gao.gov', i: 1 },
  { uri: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', titel: 'nist.gov', i: 2 },
  { uri: 'https://www.techmediaarch.com/', titel: 'html-side (skal stadig virke)', i: 3 },
];
const r = await kontrollerKilder(kilder, 8);
for (const s of r.sat) console.log('  godkendt:', s.url.slice(0, 70), '·', s.titel);
for (const a of r.afvist) console.log('  afvist:', a.kilde, '·', a.grund);
t('mindst 2 af 3 PDF-kilder godkendt med titel', r.sat.filter((s) => /\.pdf|arxiv\.org\/pdf/i.test(s.url)).length >= 2);
const tekster = await hentKildeTekster(['https://arxiv.org/pdf/2304.03271']);
t(`talvagten kan læse PDF-tekst (${tekster[0].length} tegn)`, tekster[0].length > 5000 && /water/i.test(tekster[0]));
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
