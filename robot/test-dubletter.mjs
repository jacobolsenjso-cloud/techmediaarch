// Selvtest af dubletkontrollen med afsnitsoverskrifter (rettelse 1, 9/11-2026). Intet net, ingen Gemini.
// Kør: node robot/test-dubletter.mjs
import { lavIndeks, tjek, mestEns, delvistOverlap } from './lib/dubletter.mjs';
import { overskrifter } from './lib/arkiv.mjs';
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
// overskrifter() læser rigtige filer: FAQ og kilder tæller ikke
const tmp = path.join(os.tmpdir(), '_test-overskrifter.md');
fs.writeFileSync(tmp, '---\ntitle: x\n---\n<h2>Water Consumption in AI Cooling Systems</h2><p>a</p><h2>Conclusion</h2><h2>FAQ</h2><h3>Does AI use water?</h3><h2>Sources</h2>');
const o = overskrifter(tmp); fs.unlinkSync(tmp);
t(`overskrifter: kun indholdsafsnit (${JSON.stringify(o)})`, o.length === 1 && o[0] === 'Water Consumption in AI Cooling Systems');
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
