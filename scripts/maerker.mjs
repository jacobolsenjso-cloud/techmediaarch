// Lægger billedmærkerne på et billede (Jacob 31/10-2026): ingen baggrund bag mærkerne; hvid tekst med skygge
// på mørke billeder, mørk tekst med glorie på lyse. Mærkerne er tegnet på forhånd (scripts/lav-maerker.mjs).
// Bruges af byggeriet (vandmærket, scripts/vandmaerk-billeder.mjs) og robotten ("AI-generated", robot/lib/billeder.mjs).
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const fil = (navn) => fileURLToPath(new URL(`./maerker/${navn}.png`, import.meta.url));
export const MAERKE_HOEJDE = 0.032;  // vandmærkets højde: 3,2 % af billedets bredde (ca. 44 px på 1366 px)
export const AI_HOEJDE = 0.8;        // "AI-generated" er 80 % af vandmærkets højde
export const KANT = 0.02;            // afstand til billedets kant: 2 % af bredden
const LYS_GRAENSE = 0.6;             // gennemsnitlig lysstyrke over 0,6 i hjørnet = lyst hjørne → mørkt mærke

const cache = new Map();
async function skaleret(navn, maerkeHoejde) {
  const n = `${navn}:${maerkeHoejde}`;
  if (!cache.has(n)) {
    // Filen er 2 × mærkehøjden høj (luft til skyggen hele vejen rundt)
    const buf = await sharp(fil(navn)).resize({ height: maerkeHoejde * 2, kernel: 'lanczos3' }).png().toBuffer();
    const { width, height } = await sharp(buf).metadata();
    cache.set(n, { buf, width, height, luft: Math.round(maerkeHoejde / 2) });
  }
  return cache.get(n);
}

// Lysstyrke (0-1) i et område af billedet
async function lysstyrke(buf, o) {
  const { channels: [r, g, b] } = await sharp(buf, { failOn: 'none' }).extract(o).stats();
  return (0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean) / 255;
}

// Returnerer et lag til sharp().composite() — eller null, hvis billedet er for lille til mærket.
// hjoerne: 'nh' (nederst til højre, vandmærket) eller 'ov' (øverst til venstre, AI-mærket)
export async function maerkeLag(buf, { type, hjoerne }) {
  const { width: b, height: h } = await sharp(buf, { failOn: 'none' }).metadata();
  const kant = Math.round(b * KANT);
  const mh = Math.max(8, Math.round(b * MAERKE_HOEJDE * (type === 'ai' ? AI_HOEJDE : 1)));
  const proeve = await skaleret(`${type}-hvid`, mh);
  const bredde = proeve.width - proeve.luft * 2;
  if (bredde + kant * 2 > b || mh + kant * 2 > h) return null;
  const left = hjoerne === 'nh' ? b - kant - bredde : kant;
  const top = hjoerne === 'nh' ? h - kant - mh : kant;
  const lys = (await lysstyrke(buf, { left, top, width: bredde, height: mh })) > LYS_GRAENSE;
  const m = lys ? await skaleret(`${type}-moerk`, mh) : proeve;
  // Filen har luft rundt om mærket; læg den, så selve mærket står præcis kant fra hjørnet (kan ikke gå under 0)
  return { input: m.buf, left: Math.max(0, left - m.luft), top: Math.max(0, top - m.luft), lys };
}
