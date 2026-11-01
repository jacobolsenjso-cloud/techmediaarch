// Vandmærket brændes ind i billedfilerne, når sitet bygges (Jacob 29-30/10-2026), så det følger med,
// når et billede gemmes, deles (Pinterest, Facebook) eller vises i Google Billeder. Før lå det kun
// som tekst ovenpå billedet på siden.
//
// Sådan virker det:
//  - Originalerne i public/images forbliver rene (robotten gemmer dem som før). Byggeriet laver en kopi
//    med vandmærke af hvert billede i dist/images/m/ (samme filnavn).
//  - Billeder i artiklernes brødtekst og delingsbilledet (og:image) peger på /images/m/<fil>
//    (src/lib/temakoder.mjs). Kortene på forsiden og hylderne bruger de rene originaler.
//  - Ny adresse betyder også, at ingen browser viser en gammel cachet udgave (/images/* caches i et år).
// Udseendet (Jacob 31/10-2026): logoet og techmediaarch.com nederst til højre UDEN baggrund — hvid tekst med
// blød skygge på mørke billeder, mørk tekst med lys glorie på lyse. Mærket er tegnet på forhånd
// (scripts/lav-maerker.mjs) og lægges på af scripts/maerker.mjs. Før 31/10: en mørkeblå pille (vandmaerke.png).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { maerkeLag } from './maerker.mjs';

export const MAPPE = 'm';        // dist/images/m/
export const MIN_BREDDE = 150;   // smallere billeder (ikoner, pixels) får intet mærke — samme regel som på Blogger

export async function braendInd(buf) {
  const billede = sharp(buf, { failOn: 'none' });
  const { width: b, format } = await billede.metadata();
  if (!b || b < MIN_BREDDE) return null;
  if (!['jpeg', 'png', 'webp'].includes(format)) return buf; // fx en GIF med .jpg-navn: kopien er originalen
  const lag = await maerkeLag(buf, { type: 'vm', hjoerne: 'nh' });
  if (!lag) return buf; // ekstremt lavt banner: ingen plads — kopien er originalen
  const ud = billede.composite([{ input: lag.input, left: lag.left, top: lag.top }]);
  if (format === 'png') return ud.png({ compressionLevel: 9 }).toBuffer();
  if (format === 'webp') return ud.webp({ quality: 82 }).toBuffer();
  return ud.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// Små kopier til miniaturer (1/11-2026, Jacobs ja): kortene viste billeder på op til 2560 px i felter på 112–235 px,
// så en artikelside hentede 21 billeder = 2.041 KB. Den lille kopi laves af kopien MED mærker (dist/images/s/),
// og siderne tilbyder den via srcset (src/lib/temakoder.mjs miniSrcset) — browseren vælger selv efter plads og skærm.
export const LILLE_MAPPE = 's';
export const LILLE_BREDDE = 480;
async function lilleKopi(buf, ud) {
  try {
    const b = sharp(buf, { failOn: 'none' });
    const { width, format } = await b.metadata();
    if (!width || width <= LILLE_BREDDE || !['jpeg', 'png', 'webp'].includes(format)) { fs.writeFileSync(ud, buf); return; }
    const r = b.resize({ width: LILLE_BREDDE });
    const res = format === 'png' ? await r.png({ compressionLevel: 9 }).toBuffer()
      : format === 'webp' ? await r.webp({ quality: 78 }).toBuffer()
      : await r.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    fs.writeFileSync(ud, res);
  } catch { fs.writeFileSync(ud, buf); }
}

// Laver alle kopierne. fra = public/images, til = dist/images/m
export async function vandmaerkAlle(fra, til, lille = path.join(path.dirname(til), LILLE_MAPPE)) {
  fs.mkdirSync(til, { recursive: true });
  fs.mkdirSync(lille, { recursive: true });
  const filer = fs.readdirSync(fra).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  let lavet = 0, sprunget = 0; const fejl = [];
  const koe = [...filer];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f; (f = koe.shift());) {
      const org = fs.readFileSync(path.join(fra, f));
      const res = await braendInd(org).catch(() => undefined);
      if (res) { fs.writeFileSync(path.join(til, f), res); lavet++; await lilleKopi(res, path.join(lille, f)); }
      else if (res === undefined) {
        // Fejl i billedfilen: siden peger alligevel på kopien (src/lib/temakoder.mjs), så originalen lægges der
        fs.writeFileSync(path.join(til, f), org); fejl.push(f); await lilleKopi(org, path.join(lille, f));
      } else sprunget++;
    }
  }));
  return { lavet, sprunget, fejl };
}

// Astro-integration: kører efter byggeriet og lægger kopierne i dist/images/m/
export function vandmaerkeIntegration() {
  return {
    name: 'tma-vandmaerke',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const start = Date.now();
        const rod = fileURLToPath(dir);
        const { lavet, sprunget, fejl } = await vandmaerkAlle(path.join(rod, 'images'), path.join(rod, 'images', MAPPE));
        logger.info(`vandmærke: ${lavet} billeder lavet, ${sprunget} sprunget over (under ${MIN_BREDDE} px), ${fejl.length} kunne ikke læses (${((Date.now() - start) / 1000).toFixed(1)} s)`);
        if (fejl.length) logger.warn(`vandmærke: uden mærke: ${fejl.join(', ')}`);
      },
    },
  };
}
