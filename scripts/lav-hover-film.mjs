// Små film (animerede GIF'er) af hover-bevægelserne på computer (10/11-2026, Hover 3.0) — så Jacob kan SE bevægelsen,
// ikke kun før/efter. Brug: node scripts/lav-hover-film.mjs <ud-mappe>   (kræver sitet lokalt på 8787)
// Sådan: browserens animationer sættes ned til 1/10 af farten (CDP Animation.setPlaybackRate), og der tages et billede
// ca. hver 30. ms "animationstid". Billederne samles til en GIF, der afspilles i den rigtige fart (40 ms pr. billede).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8787';
const PORT = 9338;
const ud = process.argv[2] || 'hover-film';
fs.mkdirSync(ud, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('VAGTHUND: stoppet efter 8 min'); try { chrome.kill(); } catch {} process.exit(2); }, 480000).unref();
const svar = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!svar || svar.status !== 200) { console.error('STOP: ' + BASE + ' svarer ikke 200 — start den lokale server først.'); process.exit(1); }

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(os.tmpdir(), 'tma-hover-film-chrome'), 'about:blank'], { stdio: 'ignore' });
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
await cdp.send('Animation.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'hover' }, { name: 'pointer', value: 'fine' }] });
const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;

// [side, vælger, navn, ekstra luft omkring elementet]
const SCENER = [
  ['/', '.lead-card', 'forside-hovedhistorie', 30],
  ['/', '.lead-mini', 'forside-lille-historie', 24],
  ['/', '.raekke.lille', 'forside-hylde-raekke', 24],
  ['/', '.hylde-afsnit-alle', 'forside-see-all-link', 30],
  ['/', '.vej', 'forside-vej', 24],
  ['/', '.top-links a[href="/p/start-here"]', 'topbjaelke-link', 24],
  ['/', '#searchBtn', 'ikonknap', 24],
  ['/', '.footer-link', 'sidefod-link', 24],
  ['/shelf/ai', '.hylde-raekke', 'hylde-raekke', 24],
  ['/shelf/ai', '.chip:not(.active)', 'hylde-knap', 24],
  ['/2026/11/what-generative-ai-cannot-do', '.side-item', 'artikel-sidekolonne', 24],
  ['/2026/11/what-generative-ai-cannot-do', '.las-naeste-link', 'artikel-read-next', 30],
  ['/2026/11/what-generative-ai-cannot-do', '.post-body p a:not(.paa-link)', 'artikel-tekstlink', 30],
  ['/2026/11/what-generative-ai-cannot-do', '.action-pill', 'artikel-knap', 24],
];

let side = null;
for (const [sti, sel, navn, pad] of SCENER) {
  if (side !== sti) { await cdp.send('Page.navigate', { url: BASE + sti }); await sleep(3500); side = sti; }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1360, y: 890 });
  const r = await ev(`(() => { document.documentElement.style.scrollBehavior='auto'; const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.offsetWidth > 0 && e.offsetHeight > 0); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, sy: window.scrollY }; })()`);
  if (!r) { console.log('springer over (findes ikke):', navn); continue; }
  await sleep(600);
  // clip måles i sidekoordinater (ikke vinduet), så rulleafstanden skal lægges til; musen bruger vinduets koordinater
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y + r.sy - pad), width: Math.min(1366, r.w + 2 * pad), height: r.h + 2 * pad, scale: 1 };
  const billede = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip })).data, 'base64');
  // Hvert billede får sit tidspunkt; bagefter vælges ét billede pr. 40 ms ANIMATIONSTID (= 400 ms rigtig tid ved 1/10 fart),
  // så filmen afspilles i præcis den fart, en læser ser det i. (Første version regnede et gennemsnit og blev 2-3 gange for langsom.)
  const TRIN = 40, FART = 0.1;
  const optag = async (msAnim) => {
    const ud = []; const t0 = Date.now();
    while ((Date.now() - t0) * FART < msAnim) { const t = (Date.now() - t0) * FART; ud.push({ t, b: await billede() }); }
    const valgt = [];
    for (let t = 0; t <= msAnim; t += TRIN) { let bedst = ud[0]; for (const f of ud) if (Math.abs(f.t - t) < Math.abs(bedst.t - t)) bedst = f; valgt.push(bedst.b); }
    return valgt;
  };
  await cdp.send('Animation.setPlaybackRate', { playbackRate: FART });
  const ro = await billede();
  const frames = [ro, ro, ro, ro, ro, ro, ro, ro, ro, ro]; // 0,4 s i ro
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + Math.min(r.w / 2, 120), y: r.y + Math.min(r.h / 2, 40) });
  frames.push(...await optag(800)); // musen ind: 0,8 s
  for (let i = 0; i < 15; i++) frames.push(frames[frames.length - 1]); // hold 0,6 s
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1360, y: 890 });
  frames.push(...await optag(700)); // musen ud: 0,7 s
  for (let i = 0; i < 8; i++) frames.push(frames[frames.length - 1]);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  const fil = path.join(ud, `${navn}.gif`);
  // Alle billeder i samme størrelse (et billede kan variere en pixel ved skalering)
  const meta = await sharp(frames[0]).metadata();
  const ens = await Promise.all(frames.map((f) => sharp(f).resize(meta.width, meta.height, { fit: 'fill' }).png().toBuffer()));
  await sharp(ens, { join: { animated: true } }).gif({ delay: ens.map(() => TRIN), loop: 0, effort: 7 }) /* delay SKAL være én værdi pr. billede; et enkelt tal gav 0 ms på alle andre end det første */.toFile(fil);
  console.log('gemt', fil, frames.length, 'billeder á', TRIN, 'ms');
}
chrome.kill();
process.exit(0);
