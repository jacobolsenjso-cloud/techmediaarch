// Tegner billedmærkerne som færdige PNG-filer (Jacob 31/10-2026: mærker UDEN baggrund).
// Køres på pc'en (Windows har skrifttypen Segoe UI): node scripts/lav-maerker.mjs
// Byggeriet (Cloudflare) og robotten (GitHub) har ikke samme skrifttyper, så de bruger de færdige filer i
// scripts/maerker/ i stedet for at tegne tekst selv — så ser mærket ens ud overalt.
//
// Fire filer, tegnet stort (mærkehøjde 120 px) og skaleret ned til hvert billede (scripts/maerker.mjs):
//   vm-hvid.png   logo + techmediaarch.com, hvid tekst med blød mørk skygge (mørke billeder)
//   vm-moerk.png  samme, mørk tekst med blød lys glorie (lyse billeder)
//   ai-hvid.png   ✦ AI-generated, hvid med skygge
//   ai-moerk.png  ✦ AI-generated, mørk med glorie
// Hver fil har luft (halvdelen af mærkehøjden) hele vejen rundt til skyggen; filens højde = 2 × mærkehøjden.
import fs from 'node:fs';
import sharp from 'sharp';

const H = 120;          // mærkehøjde i den færdige fil
const S = 4;            // tegnes 4x større og skaleres ned = skarpe kanter
const MAPPE = 'scripts/maerker';

function gnistSti(cx, cy, r, farve) {
  const k = r * 0.18;
  return `<path d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z" fill="${farve}"/>`;
}

// lys = mærket står på en lys baggrund: mørk tekst med lys glorie i stedet for hvid tekst med skygge
async function maerke({ tekst, logo = false, gnist = false, lys = false }) {
  const SKYG = lys ? '#fff' : '#000', TEKST = lys ? '#1b1f4a' : '#ffffff', GNIST = lys ? '#e8762f' : '#ffb07c';
  const HS = H * S, fs_ = Math.round(HS * 0.62), luft = Math.round(HS * 0.5);
  const ikon = logo || gnist ? HS : 0, mellem = ikon ? Math.round(HS * 0.3) : 0;
  const tekstB = Math.round(fs_ * tekst.length * 0.56);
  const W = luft * 2 + ikon + mellem + tekstB, HH = HS + luft * 2;
  const tx = luft + ikon + mellem;
  const tekstSvg = (farve) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HH}">
    <text x="${tx}" y="${luft + HS / 2}" dominant-baseline="central" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="${fs_}" fill="${farve}" textLength="${tekstB}" lengthAdjust="spacingAndGlyphs">${tekst}</text>
    ${gnist ? gnistSti(luft + HS / 2, luft + HS / 2, HS * 0.36, farve === SKYG ? SKYG : GNIST) : ''}
  </svg>`;
  // Skygge/glorie: teksten (og logoets form) i skyggefarven, sløret
  const skyggeLag = [];
  if (logo) skyggeLag.push({ input: await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${HS}" height="${HS}"><rect width="${HS}" height="${HS}" rx="${HS * 0.265}" fill="${SKYG}"/></svg>`)).png().toBuffer(), left: luft, top: luft });
  const skygge = await sharp(await sharp(Buffer.from(tekstSvg(SKYG))).composite(skyggeLag).png().toBuffer())
    .ensureAlpha(0).linear([1, 1, 1, lys ? 0.85 : 0.6], [0, 0, 0, 0]).blur(HS * 0.12).png().toBuffer();
  const lag = [{ input: skygge, left: 0, top: Math.round(HS * 0.04) }];
  if (logo) lag.push({ input: await sharp('public/logo.svg', { density: 72 * HS / 34 }).resize(HS, HS).png().toBuffer(), left: luft, top: luft });
  lag.push({ input: await sharp(Buffer.from(tekstSvg(TEKST))).png().toBuffer(), left: 0, top: 0 });
  const stor = await sharp({ create: { width: W, height: HH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(lag).png().toBuffer();
  return sharp(stor).resize({ width: Math.round(W / S), kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
}

fs.mkdirSync(MAPPE, { recursive: true });
for (const [fil, opt] of [
  ['vm-hvid', { tekst: 'techmediaarch.com', logo: true }],
  ['vm-moerk', { tekst: 'techmediaarch.com', logo: true, lys: true }],
  ['ai-hvid', { tekst: 'AI-generated', gnist: true }],
  ['ai-moerk', { tekst: 'AI-generated', gnist: true, lys: true }],
]) {
  const buf = await maerke(opt);
  fs.writeFileSync(`${MAPPE}/${fil}.png`, buf);
  const m = await sharp(buf).metadata();
  console.log(fil, m.width, 'x', m.height, Math.round(buf.length / 1024) + ' KB');
}
