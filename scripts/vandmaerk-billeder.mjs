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
// Udseendet er lærredets "Watermark on an article image" (logoet låst 30/10): mørkeblå pille med det
// lille A og techmediaarch.com nederst til højre. Pillen tegnes af scripts/lav-logo.mjs (vandmaerke.png).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PILLE = fileURLToPath(new URL('./vandmaerke.png', import.meta.url));
export const MAPPE = 'm';        // dist/images/m/
export const MIN_BREDDE = 150;   // smallere billeder (ikoner, pixels) får intet mærke — samme regel som på Blogger

// Pillen fylder 22 % af billedets bredde: på en artikel (ca. 720 px bred) bliver teksten ca. 14 px,
// samme størrelse som det gamle vandmærke. Afstand til kanten: 2 % af bredden.
const ANDEL = 0.22;
const pilleCache = new Map();
async function pille(bredde) {
  if (!pilleCache.has(bredde)) pilleCache.set(bredde, await sharp(PILLE).resize({ width: bredde, kernel: 'lanczos3' }).png().toBuffer());
  return pilleCache.get(bredde);
}

export async function braendInd(buf) {
  const billede = sharp(buf, { failOn: 'none' });
  const { width: b, height: h, format } = await billede.metadata();
  if (!b || b < MIN_BREDDE) return null;
  if (!['jpeg', 'png', 'webp'].includes(format)) return buf; // fx en GIF med .jpg-navn: kopien er originalen
  const pb = Math.round(b * ANDEL), p = await pille(pb);
  const { height: ph } = await sharp(p).metadata();
  const kant = Math.round(b * 0.02);
  if (ph + kant * 2 > h) return buf; // ekstremt lavt banner: ingen plads — kopien er originalen
  const ud = billede.composite([{ input: p, left: b - pb - kant, top: h - ph - kant }]);
  if (format === 'png') return ud.png({ compressionLevel: 9 }).toBuffer();
  if (format === 'webp') return ud.webp({ quality: 82 }).toBuffer();
  return ud.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// Laver alle kopierne. fra = public/images, til = dist/images/m
export async function vandmaerkAlle(fra, til) {
  fs.mkdirSync(til, { recursive: true });
  const filer = fs.readdirSync(fra).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  let lavet = 0, sprunget = 0; const fejl = [];
  const koe = [...filer];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f; (f = koe.shift());) {
      const org = fs.readFileSync(path.join(fra, f));
      const res = await braendInd(org).catch(() => undefined);
      if (res) { fs.writeFileSync(path.join(til, f), res); lavet++; }
      else if (res === undefined) {
        // Fejl i billedfilen: siden peger alligevel på kopien (src/lib/temakoder.mjs), så originalen lægges der
        fs.writeFileSync(path.join(til, f), org); fejl.push(f);
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
