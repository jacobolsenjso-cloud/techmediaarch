// Selvtest af emnespredningen (rettelse 3, 9/11-2026). Intet net. Kør: node robot/test-spredning.mjs
import { spred, hvilerMod, nyeArtikler } from './lib/spredning.mjs';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
const nu = Date.parse('2026-11-09T12:00:00Z');
const arkiv = [
  { robot: true, dato: '2026-11-07T13:10:15Z', soegeord: ['how does generative ai affect the environment'], labels: ['AI'], sti: '/a' },
  { robot: true, dato: '2026-11-05T15:52:18Z', soegeord: ['microsoft 365 vs office'], labels: ['It'], sti: '/b' },
  { robot: true, dato: '2026-10-20T10:00:00Z', soegeord: ['what is ransomware'], labels: ['Infosec'], sti: '/c' },   // ældre end 7 dage
  { robot: false, dato: '2026-11-08T10:00:00Z', soegeord: ['how does chatgpt work'], labels: ['AI'], sti: '/d' },     // ikke robot
];
const hylde = { AI: 'ai', It: 'everyday-tech', Infosec: 'cybersecurity', DevOps: 'software', Marketing: 'marketing' };
const nye = nyeArtikler(arkiv, (a) => hylde[a.labels[0]], { nu });
t(`kun robotartikler fra de sidste 7 dage (${nye.length})`, nye.length === 2);
t('vand-emnet hviler (generative)', !!hvilerMod('how does generative ai use water', nye));
t('"what are ai coding assistants" hviler IKKE (kun det brede "ai" er fælles)', !hvilerMod('what are the best ai coding assistants', nye));
t('ransomware hviler ikke (artiklen er 20 dage gammel)', !hvilerMod('why ransomware attacks are on the rise', nye));
const k = [
  { hoved: 'how does generative ai use water', emne: 'AI', klynge: 35 },
  { hoved: 'what are the best ai coding assistants', emne: 'AI', klynge: 20 },
  { hoved: 'why ransomware attacks are on the rise', emne: 'Infosec', klynge: 3 },
  { hoved: 'difference between kubernetes and docker', emne: 'DevOps', klynge: 0 },
  { hoved: 'what are content marketing tools', emne: 'Marketing', klynge: 25 },
];
const r = spred(k, nye, (e) => hylde[e]);
t(`vand-emnet sidst (${r.sorteret.map((p) => p.hoved.split(' ').slice(-2).join(' ')).join(' | ')})`, r.sorteret.at(-1).hoved.includes('water'));
t('en hylde uden nye artikler før AI-hylden (som fik én i ugen)', r.sorteret.findIndex((p) => p.emne === 'AI') > r.sorteret.findIndex((p) => p.emne === 'Infosec'));
t('klynge før ikke-klynge på hylder med lige mange nye', r.sorteret.findIndex((p) => p.emne === 'Infosec') < r.sorteret.findIndex((p) => p.emne === 'DevOps'));
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
