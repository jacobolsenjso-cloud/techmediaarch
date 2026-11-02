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
// 1/11-2026 (PageSpeed: "Optimer billedlevering", 335 KB): to størrelser mere. Mobilens store kort (ca. 400 px gange
// skærmens tæthed 1,75 = 700 px) fik før originalen på 1.366 px (131 KB), og de små rækker (133 px ≈ 233 px) fik
// 480 px-kopien. Nu: 240 px (xs), 480 px (s) og 800 px (md). Navnene skal matche miniSrcset i src/lib/temakoder.mjs.
export const KOPIER = [{ mappe: 'xs', bredde: 240 }, { mappe: 's', bredde: 480 }, { mappe: 'md', bredde: 800 }];
async function lilleKopi(buf, ud, bredde) {
  try {
    const b = sharp(buf, { failOn: 'none' });
    const { width, format } = await b.metadata();
    if (!width || width <= bredde || !['jpeg', 'png', 'webp'].includes(format)) { fs.writeFileSync(ud, buf); return; }
    const r = b.resize({ width: bredde });
    const res = format === 'png' ? await r.png({ compressionLevel: 9 }).toBuffer()
      : format === 'webp' ? await r.webp({ quality: 78 }).toBuffer()
      : await r.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    fs.writeFileSync(ud, res);
  } catch { fs.writeFileSync(ud, buf); }
}
const alleKopier = async (buf, rod, f) => { for (const k of KOPIER) await lilleKopi(buf, path.join(rod, k.mappe, f), k.bredde); };

// WebP (2/11-2026, Jacobs valg): hver kopi (m, xs, s, md) får en WebP-udgave ved siden af: <fil>.webp
// (fx 9c7c…-gm.jpg.webp). Målt på forsidens billeder: 35 % mindre end JPEG. (AVIF var prøvet først:
// 54 % mindre, men byggeriet tog 3,5 min længere hos Cloudflare, og Jacob valgte WebP som det sikreste.)
// Siderne tilbyder filen via <picture> (src/lib/temakoder.mjs webpSrcset), og scripts/tjek-site.mjs
// fejler, hvis en af dem mangler.
// Nødudgang: kan en fil ikke laves om (fx en GIF med .jpg-navn, der skal blive ved med at bevæge sig),
// lægges de originale bytes under .webp-navnet. Browseren ser selv efter, hvad filen indeholder, så
// billedet vises stadig — en henvisning til en manglende fil ville derimod give et tomt billede.
export const WEBP = { quality: 75 };
async function webpAf(fil) {
  if (!fs.existsSync(fil)) return true;
  const ud = `${fil}.webp`;
  try {
    const b = sharp(fil, { failOn: 'none' });
    const { format } = await b.metadata();
    if (!['jpeg', 'png', 'webp'].includes(format)) { fs.copyFileSync(fil, ud); return false; }
    fs.writeFileSync(ud, await b.webp(WEBP).toBuffer());
    return true;
  } catch { fs.copyFileSync(fil, ud); return false; }
}
const alleWebp = async (rod, f) => {
  let ok = true;
  for (const mappe of [MAPPE, ...KOPIER.map((k) => k.mappe)]) ok = (await webpAf(path.join(rod, mappe, f))) && ok;
  return ok;
};

// Laver alle kopierne. fra = public/images, til = dist/images/m
export async function vandmaerkAlle(fra, til) {
  fs.mkdirSync(til, { recursive: true });
  const rod = path.dirname(til);
  for (const k of KOPIER) fs.mkdirSync(path.join(rod, k.mappe), { recursive: true });
  const filer = fs.readdirSync(fra).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  let lavet = 0, sprunget = 0; const fejl = [], webpNoed = [];
  const koe = [...filer];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let f; (f = koe.shift());) {
      const org = fs.readFileSync(path.join(fra, f));
      const res = await braendInd(org).catch(() => undefined);
      if (res) { fs.writeFileSync(path.join(til, f), res); lavet++; await alleKopier(res, rod, f); }
      else if (res === undefined) {
        // Fejl i billedfilen: siden peger alligevel på kopien (src/lib/temakoder.mjs), så originalen lægges der
        fs.writeFileSync(path.join(til, f), org); fejl.push(f); await alleKopier(org, rod, f);
      } else { sprunget++; continue; }
      if (!(await alleWebp(rod, f))) webpNoed.push(f);
    }
  }));
  return { lavet, sprunget, fejl, webpNoed };
}

// Astro-integration: kører efter byggeriet og lægger kopierne i dist/images/m/
export function vandmaerkeIntegration() {
  return {
    name: 'tma-vandmaerke',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const start = Date.now();
        const rod = fileURLToPath(dir);
        const { lavet, sprunget, fejl, webpNoed } = await vandmaerkAlle(path.join(rod, 'images'), path.join(rod, 'images', MAPPE));
        logger.info(`vandmærke: ${lavet} billeder lavet, ${sprunget} sprunget over (under ${MIN_BREDDE} px), ${fejl.length} kunne ikke læses, WebP med nødudgang: ${webpNoed.length} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
        if (fejl.length) logger.warn(`vandmærke: uden mærke: ${fejl.join(', ')}`);
        if (webpNoed.length) logger.warn(`webp: originalen lagt under .webp-navnet for: ${webpNoed.join(', ')}`);
      },
    },
  };
}
