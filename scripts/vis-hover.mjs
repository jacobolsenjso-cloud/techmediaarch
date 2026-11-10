// Før/efter-billeder af hover (computer) og tryk-løft (telefon) på alle slags artikelkort (10/11-2026, Hover 2.0).
// For hvert kort: billede i hvile og billede med musen over (computer) eller fingeren på (telefon), sat side om side.
// Brug: node scripts/vis-hover.mjs <ud-mappe>   (kræver sitet lokalt på 8787: npx --yes wrangler@4.160.0 dev --port 8787)
// Telefon-trykket afbrydes (touchCancel), så siden ikke skifter, mens billedet tages.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// Andet argument = andet site, fx https://www.techmediaarch.com til test på det levende site (annoncer blokeres stadig)
const BASE = process.argv[3] || 'http://localhost:8787';
const VAERT = new URL(BASE).hostname;
const PORT = 9337;
const ud = process.argv[2] || 'hover-billeder';
fs.mkdirSync(ud, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('VAGTHUND: stoppet efter 5 min'); try { chrome.kill(); } catch {} process.exit(2); }, 300000).unref();

const svar = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!svar || svar.status !== 200) { console.error('STOP: ' + BASE + ' svarer ikke 200 — start den lokale server først.'); process.exit(1); }

// Alt andet end localhost peges væk (annonce-/YouTube-scripts får ellers Chrome uden vindue til at hænge)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE ${VAERT}`,
  `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(os.tmpdir(), 'tma-hover-chrome'), 'about:blank'], { stdio: 'ignore' });

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); const pending = new Map(); let id = 0;
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); } };
    ws.onerror = reject;
    ws.onopen = () => resolve({ send: (method, params = {}) => Promise.race([
      new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('CDP svarede ikke: ' + method)), 30000)),
    ]) });
  });
}
let target = null;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find((t) => t.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); throw new Error('Chrome svarede ikke'); }
const cdp = await connect(target.webSocketDebuggerUrl);
await cdp.send('Page.enable');
const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;

const KORT = [
  ['/', '.lead-card', 'forside-hovedhistorie'],
  ['/', '.lead-mini', 'forside-lille-historie'],
  ['/', '.hylde-stor', 'forside-hylde-stor'],
  ['/', '.raekke', 'forside-hylde-raekke'],
  ['/', '.vej', 'forside-veje'],
  ['/shelf/ai', '.hylde-raekke', 'hylde-raekke'],
  ['/page/2', '.raekke', 'all-articles-raekke'],
  ['/2026/11/what-generative-ai-cannot-do', '.side-item', 'artikel-sidekolonne'],
  ['/2026/11/what-generative-ai-cannot-do', '.las-naeste-link', 'artikel-read-next'],
  ['/2026/11/what-generative-ai-cannot-do', '.article-card', 'artikel-relaterede-kort'],
];

async function tag(navn, rect) {
  const pad = 28;
  const clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + 2 * pad, height: rect.h + 2 * pad, scale: 1 };
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  return Buffer.from(data, 'base64');
}
async function sammen(foer, efter, fil) {
  const a = await sharp(foer).metadata(), b = await sharp(efter).metadata();
  const h = Math.max(a.height, b.height), gap = 24;
  await sharp({ create: { width: a.width + b.width + gap, height: h, channels: 4, background: '#9aa0a6' } })
    .composite([{ input: foer, left: 0, top: 0 }, { input: efter, left: a.width + gap, top: 0 }]).png().toFile(fil);
}

for (const enhed of [
  { navn: 'computer', w: 1366, h: 900, scale: 1, mobile: false },
  { navn: 'telefon', w: 390, h: 844, scale: 2, mobile: true },
]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: enhed.w, height: enhed.h, deviceScaleFactor: enhed.scale, mobile: enhed.mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: enhed.mobile, maxTouchPoints: enhed.mobile ? 5 : 0 });
  // Telefon: siden skal mene, at der IKKE er mus (hover: none), ligesom en rigtig telefon
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: enhed.mobile ? 'none' : 'hover' }, { name: 'pointer', value: enhed.mobile ? 'coarse' : 'fine' }] });
  let side = null;
  for (const [sti, sel, navn] of KORT) {
    if (side !== sti) { await cdp.send('Page.navigate', { url: BASE + sti }); await sleep(3500); side = sti; }
    const r = await ev(`(() => { document.documentElement.style.scrollBehavior='auto'; const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.offsetWidth > 0 && e.offsetHeight > 0); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + Math.min(b.height / 2, 60) }; })()`);
    if (!r) { console.log('springer over (findes ikke her):', enhed.navn, navn); continue; }
    await sleep(700);
    const foer = await tag(navn, r);
    if (enhed.mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.cx, y: r.cy }] });
    else await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.cx, y: r.cy });
    await sleep(900);
    const efter = await tag(navn, r);
    if (enhed.mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    const fil = path.join(ud, `${enhed.navn}-${navn}.png`);
    await sammen(foer, efter, fil);
    console.log('gemt', fil);
    await sleep(500);
  }
}
chrome.kill();
process.exit(0);
