// Selvtest af dubletkontrollen med afsnitsoverskrifter (rettelse 1, 9/11-2026). Intet net, ingen Gemini.
// Kør: node robot/test-dubletter.mjs
import { lavIndeks, tjek, mestEns, delvistOverlap } from './lib/dubletter.mjs';
import { overskrifter, renTekst } from './lib/arkiv.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
const miljo = { titel: 'How Does Generative AI Affect the Environment?', sti: '/2026/11/generative-ai-environmental-impact', soegeord: ['how does generative ai affect the environment'],
  overskrifter: ['How Generative AI Draws Power from Electrical Grids', 'Water Consumption in AI Cooling Systems', 'Embodied Carbon and Hardware Manufacturing'] };
const kun = lavIndeks([miljo]), med = lavIndeks([miljo], [], { afsnit: true });
const q = 'how does generative ai use water';
t('uden afsnit ser kontrollen IKKE vand-afsnittet (fejlen 9/11)', !String(mestEns(q, kun, 1)[0]?.tekst || '').includes('Water'));
t('med afsnit peger kontrollen på vand-afsnittet', String(mestEns(q, med, 1)[0]?.tekst || '').includes('Water Consumption'));
t('med afsnit sendes vand-søgeordet til Gemini (tvivl eller delvist overlap)', tjek(q, med).dom === 'tvivl' || delvistOverlap(q, med));
t('et afsnit afviser aldrig alene (højst tvivl)', !tjek('water consumption generative ai cooling systems', med).alle?.some((h) => h.dom === 'afvist' && h.tekst.includes('section')));
t('fremmed emne er stadig frit', tjek('difference between kubernetes and docker', med).dom === 'fri');
// Kørsel #52: mange "AI Tools"-artikler med samme andel skubbede vand-artiklen ud af Geminis top 10.
// Det sjældne ord ("water") skal vægte mest.
const vand = { titel: 'Why Does Generative AI Consume So Much Water?', sti: '/2026/11/generative-ai-water-consumption', soegeord: ['how does generative ai use water'] };
const vaerktoej = Array.from({ length: 15 }, (_, i) => ({ titel: `Best AI Tools for Task ${i}`, sti: `/2024/0${(i % 9) + 1}/ai-tools-${i}`, soegeord: [] }));
const stor = lavIndeks([...vaerktoej, vand]);
const top = mestEns('how does ai tools use water', stor, 10);
t(`vand-artiklen er med blandt Geminis 10 (nr. ${top.findIndex((a) => a.sti === vand.sti) + 1})`, top.some((a) => a.sti === vand.sti));
t('vand-artiklen er nr. 1', top[0]?.sti === vand.sti);
t('delvist overlap ser stadig højeste andel', delvistOverlap('how does ai tools use water', stor));
// overskrifter() læser rigtige filer: FAQ og kilder tæller ikke
const tmp = path.join(os.tmpdir(), '_test-overskrifter.md');
fs.writeFileSync(tmp, '---\ntitle: x\n---\n<h2>Water Consumption in AI Cooling Systems</h2><p>a</p><h2>Conclusion</h2><h2>FAQ</h2><h3>Does AI use water?</h3><h2>Sources</h2>');
const o = overskrifter(tmp); fs.unlinkSync(tmp);
t(`overskrifter: kun indholdsafsnit (${JSON.stringify(o)})`, o.length === 1 && o[0] === 'Water Consumption in AI Cooling Systems');
// renTekst (CodeQL #29/#30, 9/11-2026): mærker væk til der ikke er flere, entiteter afkodet i én omgang
for (const [ind, ud] of [['<b>Water</b> &amp; AI', 'Water & AI'], ['It&#39;s <em>here</em>', "It's here"], ['&amp;#39;', '&#39;'], ['<scr<b>ipt>x', 'x'], ['a &lt;b&gt;', 'a <b>']]) {
  t(`renTekst ${JSON.stringify(ind)} → ${JSON.stringify(ud)}`, renTekst(ind) === ud);
}
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
