// Skærmbilleder til appen (10/11-2026): de tre billeder, installationsvinduet viser (public/screenshots/, nævnt i
// manifest.webmanifest), og eftersyns-billeder af de nye sider i mobil og desktop.
// Brug: node scripts/lav-app-billeder.mjs <mappe-til-eftersyn>   (kræver at sitet kører lokalt på 8787: npx wrangler dev --port 8787)
//
// Chrome uden vindue med --host-resolver-rules: alt andet end localhost peges væk — annonce- og YouTube-scripts får
// ellers Chrome uden vindue til at hænge (fundet på techfeedwatch 18/10). Derfor er der heller ingen annoncer på billederne.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8787';
const PORT = 9336; // ikke 9222 (Lenovo Vantage)
const eftersyn = process.argv[2] || 'app-billeder';
fs.mkdirSync(eftersyn, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('VAGTHUND: stoppet efter 4 min'); try { chrome.kill(); } catch {} process.exit(2); }, 240000).unref();

const svar = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!svar || svar.status !== 200) { console.error('STOP: ' + BASE + ' svarer ikke 200 — start den lokale server først.'); process.exit(1); }

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  // Profilen ligger i Windows' midlertidige mappe, ikke i repoet (så den aldrig kommer med i git)
  `--remote-debugging-port=${PORT}`, '--user-data-dir=' + path.join(os.tmpdir(), 'tma-app-billeder-chrome'), 'about:blank'], { stdio: 'ignore' });

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

// To gemte artikler, så "Read later" har indhold på billedet
const GEMTE = JSON.stringify([
  { href: '/2026/11/what-generative-ai-cannot-do', title: 'What Can Generative AI Tools Not Actually Do?', img: '', savedAt: Date.now() },
  { href: '/2026/11/generative-ai-water-consumption', title: 'Why Does Generative AI Consume So Much Water?', img: '', savedAt: Date.now() },
]);
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('tmaSaved', ${JSON.stringify(GEMTE)}); localStorage.setItem('theme', 'light'); } catch (e) {}` });

async function billede(sti, w, h, scale, mobile, fil) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await cdp.send('Page.navigate', { url: BASE + sti });
  await sleep(3500);
  await ev(`document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0); document.fonts.ready.then(() => true)`);
  await sleep(500);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(fil, Buffer.from(data, 'base64'));
  console.log('gemt', fil, `${w}x${h}@${scale}`);
}

// 1. Installationsvinduets billeder: præcis de mål, manifestet lover (skala 1)
await billede('/', 412, 915, 1, true, 'public/screenshots/mobile-home.png');
await billede('/2026/11/what-generative-ai-cannot-do', 412, 915, 1, true, 'public/screenshots/mobile-article.png');
await billede('/', 1280, 800, 1, false, 'public/screenshots/wide-home.png');
// 2. Eftersyn til Jacob: de nye/ændrede sider, mobil og desktop
for (const [sti, navn] of [['/app', 'app'], ['/read-later', 'read-later'], ['/offline', 'offline']]) {
  await billede(sti, 390, 844, 2, true, path.join(eftersyn, `${navn}-mobil.png`));
  await billede(sti, 1366, 900, 1, false, path.join(eftersyn, `${navn}-desktop.png`));
}
chrome.kill();
process.exit(0);
