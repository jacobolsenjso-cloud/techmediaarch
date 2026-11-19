// Skærmbilleder af forfatterfotoet (19/11-2026): forfatterlinjen øverst i en artikel, forfatterboksen nederst og
// kortet på About-siden - på computer (1366 px) og telefon (412 px). Kun læsning.
// Brug: node scripts/vis-foto.mjs <ud-mappe> [site]   (standard: lokal server på 8787)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[3] || 'http://localhost:8787';
const VAERT = new URL(BASE).hostname;
const PORT = 9338;
const ud = process.argv[2] || 'foto-billeder';
fs.mkdirSync(ud, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('VAGTHUND: stoppet efter 4 min'); try { chrome.kill(); } catch {} process.exit(2); }, 240000).unref();

const svar = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!svar || svar.status !== 200) { console.error('STOP: ' + BASE + ' svarer ikke 200 - start den lokale server først.'); process.exit(1); }

// Alt andet end sitet peges væk (annonce-scripts får ellers Chrome uden vindue til at hænge)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE ${VAERT}`,
  `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(os.tmpdir(), 'tma-foto-chrome'), 'about:blank'], { stdio: 'ignore' });
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
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find((t) => t.type === 'page'); } catch {} }
if (!target) { chrome.kill(); throw new Error('Chrome svarede ikke'); }
const cdp = await connect(target.webSocketDebuggerUrl);
await cdp.send('Page.enable');
const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;

const STEDER = [
  ['/2026/11/how-data-engineering-works', '.byline-foto', 'artikel-forfatterlinje', 1.6],
  ['/2026/11/how-data-engineering-works', '.author-box', 'artikel-forfatterboks', 0.15],
  ['/p/about-us', '.about-kort-foto', 'about-kort', 1.2],
];
for (const [bredde, hoejde, mobil, navn] of [[1366, 900, false, 'computer'], [412, 915, true, 'telefon']]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: bredde, height: hoejde, deviceScaleFactor: 2, mobile: mobil });
  for (const [sti, sel, stedNavn, ekstra] of STEDER) {
    await cdp.send('Page.navigate', { url: BASE + sti }); await sleep(3500);
    const r = await ev(`(() => { document.documentElement.style.scrollBehavior='auto'; const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
      const boks = el.closest('.author-box, .about-kort, .byline, header, section') || el; boks.scrollIntoView({ block: 'center' });
      const b = boks.getBoundingClientRect(); const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      return { x: b.left, y: b.top + window.scrollY, w: b.width, h: b.height, src: img ? img.currentSrc : null, loaded: img ? img.complete && img.naturalWidth > 0 : null }; })()`);
    if (!r) { console.log('findes ikke:', navn, stedNavn, sel); continue; }
    await sleep(800);
    const luft = Math.round(r.h * ekstra) + 16;
    const clip = { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - luft), width: Math.min(bredde, r.w + 32), height: r.h + 2 * luft, scale: 1 };
    const b = Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })).data, 'base64');
    const fil = path.join(ud, `${navn}-${stedNavn}.png`);
    fs.writeFileSync(fil, b);
    console.log('gemt', fil, '· billede:', r.src ? r.src.replace(BASE, '') : '(ingen)', r.loaded ? 'indlæst' : 'IKKE indlæst');
  }
}
chrome.kill();
process.exit(0);
