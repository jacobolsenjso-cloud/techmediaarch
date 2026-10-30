// Laver alle logo-filer til Tech Media Arch ud fra det låste logo (Jacob 30/10-2026):
// lærredet "Tech Media Arch logo" i Claude, tavlen "Final" (normal) og "Dark" nr. 2 "Deep colour" (mørk).
// Et blødt A formet som en spidsbue (Arch) med en gul pille som tværstreg (hylden),
// på en flise fra blå over violet til fersken.
//
// Kør: node scripts/lav-logo.mjs  (kun på Windows-pc'en; bruger Chrome til at tegne, sharp til at skalere)
// Hvorfor Chrome: logoet er tegnet i en browser (skygger, farveovergange, skriften Archivo),
// og Chrome giver præcis samme resultat. Filerne lægges i git, så byggeriet ikke behøver Chrome.
//
// Laver:
//   public/favicon.svg, public/favicon.ico (16+32+48), public/apple-touch-icon.png (180),
//   public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png, public/icon-monochrome-512.png,
//   public/og-default.png (1200x630), scripts/vandmaerke.png (vandmærket, som byggeriet brænder ind i
//   billederne — se scripts/vandmaerk-billeder.mjs),
//   brand/*.png (app-ikonerne i lys, mørk og én farve til en senere app)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROD = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tma-logo-'));
const SKRIFT = pathToFileURL(path.join(ROD, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')).href;

// --- A'et (100×100-koordinater, som på lærredet) ---------------------------------
const BUE = 'M27 79 Q33 40 50 19 Q67 40 73 79';
const DEFS = `
  <linearGradient id="tone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fdf3f4"/><stop offset="1" stop-color="#ffe4d6"/></linearGradient>
  <linearGradient id="gul" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd877"/><stop offset="1" stop-color="#f0a531"/></linearGradient>
  <!-- Skyggens område er hele flisen (userSpaceOnUse). Med lærredets procent-område blev skyggen under
       hylden klippet af i en lige kant — usynligt i 160 px, men tydeligt i 1024 px (set 30/10). -->
  <filter id="violet" filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#3a1d7a" flood-opacity="0.5"/></filter>
  <filter id="sort" filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.6"/></filter>
  <!-- CSS linear-gradient(150deg …) omregnet til SVG-koordinater for en kvadratisk flise -->
  <linearGradient id="flise" x1="0.1585" y1="0.0085" x2="0.8415" y2="0.9915"><stop offset="0" stop-color="#5b7cfa"/><stop offset="0.55" stop-color="#6a3fd6"/><stop offset="1" stop-color="#b0508f"/></linearGradient>
  <linearGradient id="fliseMoerk" x1="0.1585" y1="0.0085" x2="0.8415" y2="0.9915"><stop offset="0" stop-color="#2c3c8f"/><stop offset="0.55" stop-color="#2f1a6b"/><stop offset="1" stop-color="#4f1f45"/></linearGradient>
  <linearGradient id="fliseEn" x1="0.329" y1="0.03" x2="0.671" y2="0.97"><stop offset="0" stop-color="#26262b"/><stop offset="1" stop-color="#141416"/></linearGradient>
  <radialGradient id="fersken" cx="1" cy="1.08" r="0.5"><stop offset="0" stop-color="#ffb07c"/><stop offset="0.7" stop-color="#ffb07c" stop-opacity="0"/></radialGradient>
  <radialGradient id="ferskenMoerk" cx="1" cy="1.08" r="0.5"><stop offset="0" stop-color="#ff966e" stop-opacity="0.55"/><stop offset="0.7" stop-color="#ff966e" stop-opacity="0"/></radialGradient>
  <radialGradient id="lys" cx="0.3" cy="0.15" r="0.7" gradientTransform="translate(0.3 0.15) scale(1 0.7857) translate(-0.3 -0.15)"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <radialGradient id="lysMoerk" cx="0.3" cy="0.15" r="0.7" gradientTransform="translate(0.3 0.15) scale(1 0.7857) translate(-0.3 -0.15)"><stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <linearGradient id="bund" x1="0" y1="0" x2="0" y2="1"><stop offset="0.86" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient>
  <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="0.02" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`;

// A'et i farver (normal/mørk) og i én farve (iPhone tonet, Android-tema, kort uden billede)
const aFarve = (skygge) => `<path d="${BUE}" fill="none" stroke="url(#tone)" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" filter="url(#${skygge})"/>`
  + `<rect x="35.5" y="54" width="29" height="12.5" rx="6.25" fill="url(#gul)" filter="url(#${skygge})"/>`
  + `<rect x="40" y="56.2" width="16" height="2.6" rx="1.3" fill="#ffffff" fill-opacity="0.6"/>`;
const aEn = (farve) => `<path d="${BUE}" fill="none" stroke="${farve}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>`
  + `<rect x="35.5" y="54" width="29" height="12.5" rx="6.25" fill="${farve}" fill-opacity="0.55"/>`;

// Flisen: 180×180 som på lærredet; A'et fylder 160 af 180 i midten.
// rx = hjørnernes runding (0 = fuldt kvadrat, som telefonerne selv runder af).
// skala < 1 gør A'et mindre (Androids "maskable" ikon klipper kanten af).
function flise(variant, { rx = 0, skala = 1 } = {}) {
  const a = `translate(90 90) scale(${skala}) translate(-90 -90) translate(10 10) scale(1.6)`;
  const r = (fyld) => `<rect width="180" height="180" rx="${rx}" fill="${fyld}"/>`;
  let bag = '', aet = '';
  // Den tynde lyse kant øverst hører kun til en afrundet flise; på et fuldt kvadrat ligner den en streg
  const top = rx > 0 ? r('url(#top)') : '';
  if (variant === 'normal') { bag = r('url(#flise)') + r('url(#fersken)') + r('url(#lys)') + r('url(#bund)') + top; aet = aFarve('violet'); }
  else if (variant === 'moerk') { bag = r('url(#fliseMoerk)') + r('url(#lysMoerk)') + r('url(#ferskenMoerk)') + top; aet = aFarve('sort'); }
  else if (variant === 'en') { bag = r('url(#fliseEn)'); aet = aEn('#ffffff'); }
  else if (variant === 'mono') { aet = aEn('#ffffff'); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="100%" height="100%"><defs>${DEFS}</defs>${bag}<g transform="${a}">${aet}</g></svg>`;
}

// Faneikonet (lærredets "Browser tab"): forenklet, så det kan ses i 32 og 16 px
const FAV32 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="f" x1="0.1585" y1="0.0085" x2="0.8415" y2="0.9915"><stop offset="0" stop-color="#5b7cfa"/><stop offset="0.55" stop-color="#6a3fd6"/><stop offset="1" stop-color="#b0508f"/></linearGradient></defs>`
  + `<rect width="32" height="32" rx="8" fill="url(#f)"/><g transform="translate(1 1) scale(0.3)"><path d="${BUE}" fill="none" stroke="#ffffff" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><rect x="34.5" y="53" width="31" height="14.5" rx="7.25" fill="#f2b33d"/></g></svg>`;
const FAV16 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#6a3fd6"/>`
  + `<g transform="translate(0.5 0.5) scale(0.15)"><path d="${BUE}" fill="none" stroke="#ffffff" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/><rect x="33" y="52" width="34" height="16" rx="8" fill="#f2b33d"/></g></svg>`;

// --- Tegning med Chrome ------------------------------------------------------------
const side = (krop, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo"; src: url("${SKRIFT}") format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
html, body { margin: 0; background: transparent; } svg { display: block; } ${css}</style></head><body>${krop}</body></html>`;

let nr = 0;
async function tegn(html, b, h) {
  const fil = path.join(TMP, `s${++nr}.html`), ud = path.join(TMP, `s${nr}.png`);
  fs.writeFileSync(fil, html, 'utf8');
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--allow-file-access-from-files', '--virtual-time-budget=4000',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    `--user-data-dir=${path.join(TMP, 'profil')}`, `--window-size=${b},${h}`, `--screenshot=${ud}`, pathToFileURL(fil).href],
    { stdio: 'ignore', timeout: 60000 });
  const m = await sharp(ud).metadata();
  if (m.width !== b || m.height !== h) throw new Error(`Chrome gav ${m.width}x${m.height}, ventede ${b}x${h} (${fil})`);
  return fs.readFileSync(ud);
}
const tegnSvg = (svg, s) => tegn(side(`<div style="width:${s}px;height:${s}px">${svg}</div>`), s, s);

// Delingsbilledet, når en side ikke har sit eget billede (Facebook, LinkedIn, Pinterest, X)
const OG = side(`<div class="og"><div class="ikon">${flise('normal', { rx: 42 })}</div>
  <div class="navn">Tech Media Arch</div><div class="under">Clear answers to the tech questions people actually ask</div></div>`,
`.og { width: 1200px; height: 630px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: radial-gradient(60% 70% at 100% 100%, #fde7da 0%, transparent 70%), linear-gradient(150deg, #eef1ff 0%, #f7f8fc 55%, #fbf3f6 100%); font-family: "Archivo", Arial, sans-serif; }
 .ikon { width: 190px; height: 190px; border-radius: 44px; box-shadow: 0 26px 50px -22px rgba(106, 63, 214, 0.65); margin-bottom: 8px; }
 .navn { font-size: 92px; font-weight: 750; font-stretch: 88%; letter-spacing: -0.02em; color: #1f2328; line-height: 1; }
 .under { font-size: 31px; font-weight: 450; color: #4b5160; }`);

// Vandmærket (lærredets "Watermark on an article image"), tegnet 4 gange større end på lærredet,
// så det kan skaleres ned til hvert billede uden at blive grumset
const VM = side(`<div class="vm"><svg viewBox="0 0 100 100" width="72" height="72"><path d="${BUE}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><rect x="34" y="52.5" width="32" height="15" rx="7.5" fill="#f2b33d"/></svg><span>techmediaarch.com</span></div>`,
`body { padding: 20px; } .vm { display: inline-flex; align-items: center; gap: 24px; padding: 20px 40px; border-radius: 32px; background: rgba(15, 31, 85, 0.55); font-family: "Archivo", Arial, sans-serif; }
 .vm span { font-size: 56px; font-weight: 650; color: #ffffff; line-height: 1; }`);

// --- Favicon.ico: PNG-billeder pakket i en .ico-fil --------------------------------
function ico(pngs) {
  const hoved = Buffer.alloc(6 + 16 * pngs.length);
  hoved.writeUInt16LE(0, 0); hoved.writeUInt16LE(1, 2); hoved.writeUInt16LE(pngs.length, 4);
  let pos = hoved.length;
  pngs.forEach(({ s, buf }, i) => {
    const o = 6 + 16 * i;
    hoved.writeUInt8(s >= 256 ? 0 : s, o); hoved.writeUInt8(s >= 256 ? 0 : s, o + 1);
    hoved.writeUInt16LE(1, o + 4); hoved.writeUInt16LE(32, o + 6);
    hoved.writeUInt32LE(buf.length, o + 8); hoved.writeUInt32LE(pos, o + 12);
    pos += buf.length;
  });
  return Buffer.concat([hoved, ...pngs.map((p) => p.buf)]);
}

// --- Kør ---------------------------------------------------------------------------
const skriv = (rel, buf) => { const p = path.join(ROD, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); console.log(rel.padEnd(32), buf.length, 'bytes'); };
// Ikoner på sitet gemmes med en farvepalet (256 farver + dithering): ca. 4 gange mindre filer,
// og forskellen kan ikke ses i de størrelser, de vises i. App-ikonerne i brand/ gemmes fuldt.
const PALET = { compressionLevel: 9, palette: true, quality: 100, effort: 10, dither: 1 };
const png = (buf, s, fuld = false) => sharp(buf).resize(s, s, { kernel: 'lanczos3' })
  .png(fuld ? { compressionLevel: 9 } : PALET).toBuffer();

const normal = await tegnSvg(flise('normal'), 1024);
skriv('public/icon-512.png', await png(normal, 512));
skriv('public/icon-192.png', await png(normal, 192));
skriv('public/apple-touch-icon.png', await sharp(normal).resize(180, 180, { kernel: 'lanczos3' }).flatten({ background: '#6a3fd6' }).png(PALET).toBuffer());
skriv('public/icon-maskable-512.png', await png(await tegnSvg(flise('normal', { skala: 0.84 }), 1024), 512));
skriv('public/icon-monochrome-512.png', await png(await tegnSvg(flise('mono', { skala: 0.84 }), 1024), 512));
skriv('brand/app-ikon-lys-1024.png', await png(normal, 1024, true));
skriv('brand/app-ikon-moerk-1024.png', await png(await tegnSvg(flise('moerk'), 1024), 1024, true));
skriv('brand/app-ikon-en-farve-1024.png', await png(await tegnSvg(flise('en'), 1024), 1024, true));
skriv('brand/logo-afrundet-1024.png', await png(await tegnSvg(flise('normal', { rx: 42 }), 1024), 1024, true));

skriv('public/favicon.svg', Buffer.from(FAV32 + '\n'));
const f32 = await tegnSvg(FAV32, 256), f16 = await tegnSvg(FAV16, 256);
skriv('public/favicon.ico', ico([{ s: 16, buf: await png(f16, 16) }, { s: 32, buf: await png(f32, 32) }, { s: 48, buf: await png(f32, 48) }]));

skriv('public/og-default.png', await sharp(await tegn(OG, 1200, 630)).png(PALET).toBuffer());
skriv('scripts/vandmaerke.png', await sharp(await tegn(VM, 1400, 240)).trim({ threshold: 0 }).png({ compressionLevel: 9 }).toBuffer());

fs.rmSync(TMP, { recursive: true, force: true });
console.log('Færdig.');
