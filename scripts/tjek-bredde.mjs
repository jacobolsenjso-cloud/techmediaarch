// Breddetjek (Jacob 1/11-2026: "ja det må du godt lave"): åbner det færdige byg (dist/) i en usynlig Chrome
// og stopper med fejl, hvis noget i en artikels tekst går ud over spalten, eller hvis en side kan rulles
// sidelæns — på computer (1366 px) og mobil (390 px). Baggrund: 1/11 stak billederne 579 px ud til højre i
// 139 af 197 artikler på computer, uden at noget tjek opdagede det. Nu kan sådan en side ikke udgives:
//   - Windows: køres efter "npm run build" (npm run tjek:bredde)
//   - robotten (.github/workflows/robot-tidsplan.yml): mellem "Byg sitet" og "Udgiv på main"
// Bruger den Chrome, der allerede er installeret (playwright-core henter ingen browser). CHROME_PATH kan pege
// på en anden. Alt fra nettet (annoncer, YouTube, Google) blokeres — kun sitets egne filer indlæses.
// Brug: node scripts/tjek-bredde.mjs [dist-mappe]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const START = Date.now();
const DIST = path.resolve(process.argv[2] || 'dist');
const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.ico': 'image/x-icon' };

// Samme adresseregel som Cloudflare (html_handling "drop-trailing-slash"): /a/b -> a/b.html, / -> index.html
function fil(url) {
  let p = decodeURIComponent(new URL(url, 'http://x').pathname);
  const kandidater = p.endsWith('/') ? [p + 'index.html'] : [p, p + '.html', p + '/index.html'];
  for (const k of kandidater) { const f = path.join(DIST, k); if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  return null;
}
const server = http.createServer((req, res) => {
  const f = fil(req.url);
  if (!f) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPER[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// Sider: alle artikler (dist/ÅÅÅÅ/MM/*.html) + forside og hylder
const sider = ['/', '/shelf/ai', '/shelf/cybersecurity', '/shelf/software', '/shelf/marketing', '/shelf/everyday-tech'];
for (const aar of fs.readdirSync(DIST).filter((d) => /^\d{4}$/.test(d)))
  for (const md of fs.readdirSync(path.join(DIST, aar)).filter((d) => /^\d{2}$/.test(d)))
    for (const f of fs.readdirSync(path.join(DIST, aar, md)).filter((f) => f.endsWith('.html')))
      sider.push(`/${aar}/${md}/${encodeURIComponent(f.slice(0, -5))}`);
if (process.env.BREDDE_MAX) sider.splice(+process.env.BREDDE_MAX); // kun til fejlsøgning: de første N sider

function startChrome() {
  const sti = process.env.CHROME_PATH;
  return sti ? chromium.launch({ executablePath: sti }) : chromium.launch({ channel: 'chrome' });
}
let browser;
try { browser = await startChrome(); } catch (e) {
  console.error('tjek-bredde: kunne ikke starte Chrome (installeret Chrome eller CHROME_PATH kræves):', e.message.split('\n')[0]);
  server.close(); process.exit(2);
}

// Det, der måles på hver side (kører i browseren)
function maal() {
  const fejl = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) fejl.push(`siden kan rulles sidelæns (${document.documentElement.scrollWidth} px i et ${innerWidth} px vindue)`);
  const spalte = document.querySelector('.post-body');
  if (spalte) {
    const hoejre = spalte.getBoundingClientRect().right;
    for (const e of spalte.querySelectorAll('img, table, iframe, video, pre, figure, .tma-wm')) {
      const r = e.getBoundingClientRect();
      if (r.width && r.right > hoejre + 2) fejl.push(`${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} går ${Math.round(r.right - hoejre)} px ud over spalten`);
    }
  }
  return [...new Set(fejl)].slice(0, 3);
}

const BREDDER = [['computer', { width: 1366, height: 900 }], ['mobil', { width: 390, height: 844 }]];
const fund = [];
for (const [navn, viewport] of BREDDER) {
  const ctx = await browser.newContext({ viewport });
  // Kun sitets egne filer; billeder og video hentes ikke (de har faste mål fra byggeriet, så pladsen er den
  // samme) — det gør tjekket flere gange hurtigere (målt 1/11: 2–13 s pr. side med billeder).
  await ctx.route('**/*', (r) => {
    const q = r.request();
    return q.url().startsWith(BASE) && !['image', 'media'].includes(q.resourceType()) ? r.continue() : r.abort();
  });
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    const side = await ctx.newPage();
    while (i < sider.length) {
      const s = sider[i++];
      const t0 = Date.now();
      try {
        // "load" = HTML, CSS og skrifter er indlæst (billeder er blokeret ovenfor, så det går hurtigt)
        const svar = await side.goto(BASE + s, { waitUntil: 'load', timeout: 30000 });
        if (!svar || svar.status() !== 200) { fund.push(`${navn} ${decodeURIComponent(s)}: svarede ${svar ? svar.status() : 'intet'}`); continue; }
        await side.evaluate(() => document.fonts.ready);
        for (const f of await side.evaluate(maal)) fund.push(`${navn} ${decodeURIComponent(s)}: ${f}`);
        if (process.env.BREDDE_TID) console.log(`  ${navn} ${Date.now() - t0} ms ${decodeURIComponent(s)}`);
      } catch (e) { fund.push(`${navn} ${decodeURIComponent(s)}: kunne ikke åbnes (${e.message.split('\n')[0]})`); }
    }
    await side.close();
  }));
  await ctx.close();
}
await browser.close();
server.close();

console.log(`breddetjek: ${sider.length} sider x ${BREDDER.length} bredder, ${Math.round((Date.now() - START) / 1000)} s, problemer: ${fund.length}`);
if (fund.length) {
  fund.slice(0, 25).forEach((f) => console.log('  ' + f));
  if (fund.length > 25) console.log(`  … og ${fund.length - 25} flere`);
  process.exit(1);
}
