// Laver alle logo-filer til Tech Media Arch. Logoet er godkendt af Jacob 30/10-2026 efter flere runder
// på prøvesider: A'et som en lav spidsbue (navnet Arch) med en kort gylden pind (hylden) mellem benene.
// Dybden kommer fra en lilla kant i fast farve (en kopi af A'et lige bag forsiden, forskudt ned mod højre)
// og en skygge i fast farve. Ingen slør og ingen drejning, så det er lige skarpt i alle størrelser.
// Flisen er den låste fra lærredet "Tech Media Arch logo" (blå -> violet -> fersken; mørk = "Deep colour").
//
// Jacobs krav: ÉN tegning, der er ens alle steder (topbjælke, faneikon, app-ikoner, vandmærke,
// delingsbillede). Den bliver kun gjort større eller mindre. Kun Androids "én farve"-ikon og iPhones
// tonede ikon er i én farve, fordi telefonerne kræver det.
//
// Kør: node scripts/lav-logo.mjs  (kun på Windows-pc'en; Chrome tegner, sharp skalerer)
// Filerne lægges i git, så byggeriet ikke behøver Chrome.
//
// Laver:
//   public/logo.svg (topbjælken og kort uden billede) = public/favicon.svg, public/favicon.ico,
//   public/apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png, icon-monochrome-512.png,
//   public/og-default.png (1200x630), scripts/vandmaerke.png (brændes ind i billederne af byggeriet),
//   brand/*.png (app-ikoner i lys, mørk og én farve + afrundet logo, til en senere app)
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

// --- Formen (100×100-gitter) ----------------------------------------------------------------
const P0 = [23, 76], P1 = [30, 44], P2 = [50, 27], P3 = [70, 44], P4 = [77, 76];
const D = `M${P0.join(' ')} Q${P1.join(' ')} ${P2.join(' ')} Q${P3.join(' ')} ${P4.join(' ')}`; // M23 76 Q30 44 50 27 Q70 44 77 76
const SW = 16.5;          // stregbredde
const MAAL = 0.54;        // A'ets største mål (inkl. streg) i forhold til flisen
const OP = 0.03;          // A'et løftes 3 % over midten (optisk midte)
const HYLDE = 0.63;       // pinden sidder 63 % nede i A'et (Jacob 30/10: lidt lavere, så hullet i toppen er større)
const HH = 13;            // pindens højde
const KANT = [2.4, 2.8];  // den lilla kants forskydning (ned mod højre, samme vej som lyset falder)
const SKYG = [5, 6.5];    // skyggens forskydning
const kvad = (a, b, c, t) => (1 - t) ** 2 * a + 2 * t * (1 - t) * b + t * t * c;
const BX = [P0[0], P4[0]], BY = [P2[1], P0[1]];
const YH = BY[0] + (BY[1] - BY[0]) * HYLDE;
function benX(a, b, c) { let x = 0, f = 1e9; for (let i = 0; i <= 2000; i++) { const t = i / 2000, y = kvad(a[1], b[1], c[1], t); if (Math.abs(y - YH) < f) { f = Math.abs(y - YH); x = kvad(a[0], b[0], c[0], t); } } return x; }
const XV = benX(P0, P1, P2), XH = benX(P4, P3, P2);
const X1 = XV - SW * 0.05, X2 = XH + SW * 0.05, LP = X2 - X1;
const MID = (BX[0] + BX[1]) / 2, CY = (BY[0] + BY[1]) / 2;
const r2 = (v) => Math.round(v * 100) / 100;
const tr = (maal) => { const k = (180 * maal) / Math.max(BX[1] - BX[0] + SW, BY[1] - BY[0] + SW); return `translate(90 ${r2(90 - 180 * OP)}) scale(${r2(k * 1000) / 1000}) translate(${-MID} ${-CY})`; };
const sti = (attr) => `<path d="${D}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${attr}/>`;
const pind = (attr) => `<rect x="${r2(X1)}" y="${r2(YH - HH / 2)}" width="${r2(LP)}" height="${HH}" rx="${HH / 2}" ${attr}/>`;

// --- Logoet (én tegning) --------------------------------------------------------------------
// rx = hjørnernes runding i flisens 180-enheder (0 = fuldt kvadrat, som telefonerne selv runder)
// maal = A'ets størrelse (kun mindre på Androids "maskable" ikon, hvor kanten klippes af)
function logo({ moerk = false, rx = 0, maal = MAAL, id = 't' } = {}) {
  const fl = moerk ? ['#2c3c8f', '#2f1a6b', '#4f1f45'] : ['#5b7cfa', '#6a3fd6', '#b0508f'];
  const glod = moerk ? 'stop-color="#ff966e" stop-opacity="0.55"' : 'stop-color="#ffb07c"';
  const r = (f) => `<rect width="180" height="180" rx="${r2(rx)}" fill="${f}"/>`;
  const sk = moerk ? '#000000' : '#2a1260';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><defs>`
    + `<linearGradient id="${id}f" x1="0.1585" y1="0.0085" x2="0.8415" y2="0.9915"><stop offset="0" stop-color="${fl[0]}"/><stop offset="0.55" stop-color="${fl[1]}"/><stop offset="1" stop-color="${fl[2]}"/></linearGradient>`
    + `<radialGradient id="${id}p" cx="1" cy="1.08" r="0.5"><stop offset="0" ${glod}/><stop offset="0.7" stop-color="#ffb07c" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="${id}l" cx="0.3" cy="0.15" r="0.7" gradientTransform="translate(0.3 0.15) scale(1 0.7857) translate(-0.3 -0.15)"><stop offset="0" stop-color="#fff" stop-opacity="${moerk ? 0.12 : 0.28}"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fff6f6"/><stop offset="1" stop-color="#ffdccd"/></linearGradient>`
    + `<linearGradient id="${id}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9b6f6"/><stop offset="1" stop-color="#a68ce4"/></linearGradient>`
    + `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdf8a"/><stop offset="0.5" stop-color="#ffc04f"/><stop offset="1" stop-color="#f39a3c"/></linearGradient>`
    + `<linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${r2(X1)}" y1="${r2(YH - HH)}" x2="${r2(X2)}" y2="${r2(YH + HH)}"><stop offset="0" stop-color="#e8dcff"/><stop offset="0.5" stop-color="#fff1ea"/><stop offset="1" stop-color="#ffc9ae"/></linearGradient>`
    + `</defs>${r(`url(#${id}f)`)}${r(`url(#${id}p)`)}${r(`url(#${id}l)`)}`
    + `<g transform="${tr(maal)}">`
    + `<g transform="translate(${SKYG[0]} ${SKYG[1]})" opacity="${moerk ? 0.4 : 0.24}">${sti(`stroke="${sk}" stroke-width="${SW}"`)}${pind(`fill="${sk}"`)}</g>`
    + `<g transform="translate(${KANT[0]} ${KANT[1]})">${sti(`stroke="url(#${id}k)" stroke-width="${SW}"`)}</g>`
    + sti(`stroke="url(#${id}a)" stroke-width="${SW}"`)
    + `<g transform="translate(${r2(KANT[0] * 0.8)} ${r2(KANT[1] * 0.8)})">${pind('fill="#d27a1c"')}</g>`
    + pind(`fill="url(#${id}g)" stroke="url(#${id}r)" stroke-width="2.3"`)
    + `<rect x="${r2(X1 + HH * 0.45)}" y="${r2(YH - HH / 2 + 2.3)}" width="${r2(LP * 0.46)}" height="2.8" rx="1.4" fill="#fff" fill-opacity="0.85"/>`
    + `</g></svg>`;
}
// Én farve (Android-tema og iPhone tonet): telefonen farver selv; formen er den samme
const enFarve = (maal = MAAL, bag = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">${bag}<g transform="${tr(maal)}">${sti(`stroke="#ffffff" stroke-width="${SW}"`)}${pind('fill="#ffffff" fill-opacity="0.55"')}</g></svg>`;
const AFRUNDET = (9 / 34) * 180; // hjørnerne som på lærredets topbjælke (9 af 34 px)

// --- Tegning med Chrome ------------------------------------------------------------------------
let nr = 0;
const side = (krop, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo"; src: url("${SKRIFT}") format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
html, body { margin: 0; background: transparent; } svg { display: block; width: 100%; height: 100%; } ${css}</style></head><body>${krop}</body></html>`;
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

// Delingsbilledet (Facebook, LinkedIn, Pinterest, X), når en side ikke har sit eget billede
const OG = side(`<div class="og"><div class="ik">${logo({ rx: AFRUNDET, id: 'og' })}</div>
  <div class="navn">Tech Media Arch</div><div class="under">Clear answers to the tech questions people actually ask</div></div>`,
`.og { width: 1200px; height: 630px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: radial-gradient(60% 70% at 100% 100%, #fde7da 0%, transparent 70%), linear-gradient(150deg, #eef1ff 0%, #f7f8fc 55%, #fbf3f6 100%); font-family: "Archivo", Arial, sans-serif; }
 .ik { width: 196px; height: 196px; border-radius: 52px; box-shadow: 0 26px 50px -22px rgba(106, 63, 214, 0.65); margin-bottom: 8px; }
 .navn { font-size: 92px; font-weight: 750; font-stretch: 88%; letter-spacing: -0.02em; color: #1f2328; line-height: 1; }
 .under { font-size: 31px; font-weight: 450; color: #4b5160; }`);

// Vandmærket: logoet (samme tegning) + techmediaarch.com i en mørkeblå pille, tegnet 4 gange større
// end det vises, så det kan skaleres ned til hvert billede uden at blive grumset
const VM = side(`<div class="vm"><div class="ik">${logo({ rx: AFRUNDET, id: 'vm' })}</div><span>techmediaarch.com</span></div>`,
`body { padding: 20px; } .vm { display: inline-flex; align-items: center; gap: 28px; padding: 20px 44px 20px 24px; border-radius: 36px; background: rgba(15, 31, 85, 0.55); font-family: "Archivo", Arial, sans-serif; }
 .vm .ik { width: 80px; height: 80px; } .vm span { font-size: 56px; font-weight: 650; color: #ffffff; line-height: 1; }`);

// --- Favicon.ico: PNG-billeder pakket i en .ico-fil -------------------------------------------
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

// --- Kør ----------------------------------------------------------------------------------------
const skriv = (rel, buf) => { const p = path.join(ROD, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); console.log(rel.padEnd(34), buf.length, 'bytes'); };
// Ikoner på sitet gemmes med farvepalet (256 farver + dithering): ca. 4 gange mindre, og forskellen
// kan ikke ses i de størrelser, de vises i. App-ikonerne i brand/ gemmes fuldt.
const PALET = { compressionLevel: 9, palette: true, quality: 100, effort: 10, dither: 1 };
const png = (buf, s, fuld = false) => sharp(buf).resize(s, s, { kernel: 'lanczos3' }).png(fuld ? { compressionLevel: 9 } : PALET).toBuffer();

// Logoet som vektor: topbjælken og faneikonet bruger samme fil (afrundede hjørner)
const LOGO_SVG = logo({ rx: AFRUNDET }) + '\n';
skriv('public/logo.svg', Buffer.from(LOGO_SVG));
skriv('public/favicon.svg', Buffer.from(LOGO_SVG));
const afrundet = await tegnSvg(LOGO_SVG, 1024);
skriv('brand/logo-afrundet-1024.png', await png(afrundet, 1024, true));
skriv('public/favicon.ico', ico(await Promise.all([16, 32, 48].map(async (s) => ({ s, buf: await png(afrundet, s) })))));

// App-ikoner: fuldt kvadrat (telefonerne runder selv hjørnerne)
const normal = await tegnSvg(logo(), 1024);
skriv('public/icon-512.png', await png(normal, 512));
skriv('public/icon-192.png', await png(normal, 192));
skriv('public/apple-touch-icon.png', await sharp(normal).resize(180, 180, { kernel: 'lanczos3' }).flatten({ background: '#6a3fd6' }).png(PALET).toBuffer());
skriv('public/icon-maskable-512.png', await png(await tegnSvg(logo({ maal: MAAL * 0.84 }), 1024), 512));
skriv('brand/app-ikon-lys-1024.png', await png(normal, 1024, true));
skriv('brand/app-ikon-moerk-1024.png', await png(await tegnSvg(logo({ moerk: true }), 1024), 1024, true));
const morkBag = '<defs><linearGradient id="e" x1="0.329" y1="0.03" x2="0.671" y2="0.97"><stop offset="0" stop-color="#26262b"/><stop offset="1" stop-color="#141416"/></linearGradient></defs><rect width="180" height="180" fill="url(#e)"/>';
skriv('brand/app-ikon-en-farve-1024.png', await png(await tegnSvg(enFarve(MAAL, morkBag), 1024), 1024, true));
skriv('public/icon-monochrome-512.png', await png(await tegnSvg(enFarve(MAAL * 0.84), 1024), 512));

// Delingsbillede og vandmærke
skriv('public/og-default.png', await sharp(await tegn(OG, 1200, 630)).png(PALET).toBuffer());
skriv('scripts/vandmaerke.png', await sharp(await tegn(VM, 1400, 240)).trim({ threshold: 0 }).png({ compressionLevel: 9 }).toBuffer());

fs.rmSync(TMP, { recursive: true, force: true });
console.log('Færdig.');
