// IndexNow (Jacob 31/10-2026): fortæl Bing (og de andre IndexNow-søgemaskiner) om nye og omskrevne artikler,
// lige når de er live — så de ikke skal vente på, at Bing selv kommer forbi.
//   node robot/indexnow.mjs <fil.md> [<fil.md> …]     (filerne under src/content/posts, som robottens commit ændrede)
// Nøglen er ikke hemmelig: IndexNow kræver, at den ligger offentligt på sitet (public/<nøgle>.txt), så Bing kan se,
// at det er os, der melder adresserne. Først ventes der (højst 12 min), til Cloudflare viser den nye udgave —
// ellers kan Bing nå at hente den gamle side. Fejl her stopper aldrig robotten.
import fs from 'node:fs';
import { parse } from 'yaml';

const SITE = 'https://www.techmediaarch.com';
export const NOEGLE = '47479d13ee5b0377f0190b64973974ff';
const ENDPUNKT = 'https://www.bing.com/indexnow';
const VENT_MAKS_MS = 12 * 60 * 1000;
const VENT_PAUSE_MS = 30 * 1000;

const filer = process.argv.slice(2).filter((f) => /src\/content\/posts\/\d{4}\/\d{2}\/[^/]+\.md$/.test(f.replace(/\\/g, '/')) && fs.existsSync(f));
if (!filer.length) { console.log('IndexNow: ingen artikler at melde'); process.exit(0); }

// Adresse og "updated" for hver artikel (siden viser "dateModified" med samme værdi, når den nye udgave er live)
const sider = filer.map((f) => {
  const [, aar, md, navn] = f.replace(/\\/g, '/').match(/posts\/(\d{4})\/(\d{2})\/([^/]+)\.md$/);
  const fm = parse(fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '') || {};
  const opd = fm.updated instanceof Date ? fm.updated.toISOString() : String(fm.updated || '');
  return { url: `${SITE}/${aar}/${md}/${encodeURIComponent(navn).replace(/%2F/g, '/')}`, opd };
});

const live = async (s) => {
  try { const r = await fetch(`${s.url}?indexnow=${Date.now()}`, { headers: { 'user-agent': 'techmediaarch-robot/1.0' } }); return r.ok && (!s.opd || (await r.text()).includes(s.opd)); } catch { return false; }
};
const start = Date.now();
let mangler = sider;
while (mangler.length && Date.now() - start < VENT_MAKS_MS) {
  const svar = await Promise.all(mangler.map(live));
  mangler = mangler.filter((_, i) => !svar[i]);
  if (mangler.length) await new Promise((r) => setTimeout(r, VENT_PAUSE_MS));
}
if (mangler.length) console.log(`IndexNow: ${mangler.length} side(r) var ikke live efter ${VENT_MAKS_MS / 60000} min — meldes alligevel`);

try {
  const r = await fetch(ENDPUNKT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: NOEGLE, keyLocation: `${SITE}/${NOEGLE}.txt`, urlList: sider.map((s) => s.url) }),
  });
  // 200/202 = modtaget. 403 = nøglefilen kunne ikke læses, 422 = adresse/nøgle passer ikke.
  console.log(`IndexNow: ${sider.length} adresse(r) meldt til Bing — svar ${r.status}${r.ok ? '' : ` (${(await r.text()).slice(0, 120)})`}`);
} catch (e) { console.log(`IndexNow: kunne ikke melde (${e.message.slice(0, 120)})`); }
