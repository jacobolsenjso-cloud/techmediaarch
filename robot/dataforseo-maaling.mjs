// Måling (Jacob 9/11-2026): har DataForSEO Labs tal på robottens spørgsmål?
// Ét kald til keyword_overview med op til 700 af de spørgsmål, søgeordsrobotten lige har fundet
// (pakkernes hoved- og beslægtede søgeord først, derefter resten). Pris: $0,012 + $0,00012 pr. fundet søgeord,
// dvs. højst ca. $0,10. Søgeord, DataForSEO ikke kender, kommer ikke med i svaret og koster intet.
// Kræver DATAFORSEO_LOGIN og DATAFORSEO_PASSWORD (GitHub-nøgler). Nøglerne skrives ALDRIG ud.
// Kør efter: node robot/soegeord.mjs --pakker 5 --gem robot/ud/raa.json
import fs from 'node:fs';
import { sti } from './lib/arkiv.mjs';
import { normaliser } from './lib/tekst.mjs';

const MAKS = 700;   // DataForSEO's grænse pr. kald
const linjer = ['# DataForSEO-måling — techmediaarch', ''];
const ud = (t = '') => linjer.push(t);
const skjul = (t) => String(t).replace(/[A-Za-z0-9+/=_-]{24,}/g, '***').slice(0, 200);
function slut(kode = 0) {
  const md = linjer.join('\n') + '\n';
  fs.writeFileSync(sti('robot/ud/dataforseo-maaling.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + md);
  console.log(md);
  process.exit(kode);
}

const L = process.env.DATAFORSEO_LOGIN, P = process.env.DATAFORSEO_PASSWORD;
if (!L || !P) { ud('❌ DATAFORSEO_LOGIN eller DATAFORSEO_PASSWORD mangler i GitHub-nøglerne.'); slut(1); }
const auth = 'Basic ' + Buffer.from(`${L}:${P}`).toString('base64');
async function kald(sti_, body) {
  const r = await fetch(`https://api.dataforseo.com/v3/${sti_}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, j };
}

// 1. Nøglen virker? (gratis kald) + saldo før
const bruger = await kald('appendix/user_data');
if (!bruger.ok || bruger.j?.status_code !== 20000) { ud(`❌ Login afvist: HTTP ${bruger.status} ${skjul(bruger.j?.status_message || '')}`); slut(1); }
const saldo = (j) => j?.tasks?.[0]?.result?.[0]?.money?.balance;
const foer = saldo(bruger.j);
ud(`✅ Nøglen virker. Saldo før: $${foer}`);

// 2. Søgeordene: pakkernes først (dem robotten ville skrive om), derefter resten af autoforslagene
const liste = JSON.parse(fs.readFileSync(sti('robot/ud/soegeord-liste.json'), 'utf8'));
const raa = JSON.parse(fs.readFileSync(sti('robot/ud/raa.json'), 'utf8'));
const valgt = new Map();   // normaliseret → { q, slags, emne }
const tilfoej = (q, slags, emne) => {
  const n = normaliser(q);
  // DataForSEO: højst 80 tegn og 10 ord pr. søgeord
  if (!n || valgt.has(n) || q.length > 80 || q.trim().split(/\s+/).length > 10 || valgt.size >= MAKS) return;
  valgt.set(n, { q: q.toLowerCase().trim(), slags, emne });
};
for (const [emne, r] of Object.entries(liste.resultat || {})) for (const p of r.pakker || []) tilfoej(p.hoved, 'hoved', emne);
for (const [emne, r] of Object.entries(liste.resultat || {})) for (const p of r.pakker || []) for (const b of p.beslaegtede || []) tilfoej(b, 'beslægtet', emne);
// Resten: skiftevis fra hvert emne, så alle emner er med i stikprøven
const resten = Object.entries(raa).map(([emne, xs]) => xs.map((x) => [x.q, emne]));
for (let i = 0; valgt.size < MAKS && resten.some((xs) => i < xs.length); i++) for (const xs of resten) if (xs[i]) tilfoej(xs[i][0], 'andet', xs[i][1]);
const soeg = [...valgt.values()];
ud(`Sendt: ${soeg.length} søgeord (${soeg.filter((s) => s.slags === 'hoved').length} hovedsøgeord, ${soeg.filter((s) => s.slags === 'beslægtet').length} beslægtede, ${soeg.filter((s) => s.slags === 'andet').length} andre autoforslag). Land: USA, sprog: engelsk.`);

// 3. Ét kald
const svar = await kald('dataforseo_labs/google/keyword_overview/live', [{ keywords: soeg.map((s) => s.q), location_code: 2840, language_code: 'en' }]);
const opg = svar.j?.tasks?.[0];
if (!svar.ok || opg?.status_code !== 20000) { ud(`❌ Kaldet fejlede: HTTP ${svar.status} ${opg?.status_code || ''} ${skjul(opg?.status_message || svar.j?.status_message || '')}`); slut(1); }
const items = opg.result?.[0]?.items || [];
const efter = saldo((await kald('appendix/user_data')).j);
ud(`Pris for kaldet: $${opg.cost} (saldo efter: $${efter}).`);
ud('');

// 4. Resultat
const fundet = new Map(items.map((it) => [String(it.keyword).toLowerCase().trim(), it]));
const info = (s) => {
  const it = fundet.get(s.q);
  if (!it) return null;
  const mdr = (it.keyword_info?.monthly_searches || []).slice(0, 12).map((m) => m.search_volume || 0);
  const snit = mdr.length ? mdr.reduce((a, b) => a + b, 0) / mdr.length : 0;
  const spredning = snit ? Math.sqrt(mdr.reduce((a, b) => a + (b - snit) ** 2, 0) / mdr.length) / snit : null;
  return {
    vol: it.keyword_info?.search_volume ?? null,
    kd: it.keyword_properties?.keyword_difficulty ?? null,
    hensigt: it.search_intent_info?.main_intent || '',
    aar: it.keyword_info?.search_volume_trend?.yearly ?? null,
    // "Tidløs" = jævn kurve: månederne svinger mindre end 35 % omkring snittet (og der er søgninger)
    jaevn: spredning !== null && spredning < 0.35 && snit >= 10,
  };
};
const rk = soeg.map((s) => ({ ...s, i: info(s) }));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + ' %';
ud('## Dækning (hvor mange af spørgsmålene DataForSEO har tal på)');
ud('| Slags | Sendt | Fundet | Andel |');
ud('|---|---|---|---|');
for (const slags of ['hoved', 'beslægtet', 'andet']) {
  const xs = rk.filter((x) => x.slags === slags);
  ud(`| ${slags} | ${xs.length} | ${xs.filter((x) => x.i).length} | ${pct(xs.filter((x) => x.i).length, xs.length)} |`);
}
ud(`| **i alt** | ${rk.length} | ${rk.filter((x) => x.i).length} | ${pct(rk.filter((x) => x.i).length, rk.length)} |`);
ud('');
const f = rk.filter((x) => x.i);
const spand = (navn, test) => `| ${navn} | ${f.filter(test).length} |`;
ud('## Søgninger pr. måned (blandt de fundne)');
ud('| Søgninger | Antal |'); ud('|---|---|');
ud(spand('0 eller ukendt', (x) => !x.i.vol)); ud(spand('1–50', (x) => x.i.vol > 0 && x.i.vol <= 50));
ud(spand('51–500', (x) => x.i.vol > 50 && x.i.vol <= 500)); ud(spand('over 500', (x) => x.i.vol > 500));
ud('');
ud('## Sværhedsgrad 0–100 (chancen for top 10; lav = lettere)');
ud('| Sværhed | Antal |'); ud('|---|---|');
ud(spand('ukendt', (x) => x.i.kd === null)); ud(spand('0–20 (let)', (x) => x.i.kd !== null && x.i.kd <= 20));
ud(spand('21–40', (x) => x.i.kd > 20 && x.i.kd <= 40)); ud(spand('over 40 (svær)', (x) => x.i.kd > 40));
ud(''); ud(`Tidløse (jævn kurve over 12 mdr.): ${f.filter((x) => x.i.jaevn).length} af ${f.length} fundne.`); ud('');
const raekke = (x) => `| ${x.q} | ${x.emne} | ${x.i ? x.i.vol ?? '–' : 'ikke fundet'} | ${x.i?.kd ?? '–'} | ${x.i?.hensigt || '–'} | ${x.i?.aar ?? '–'} | ${x.i?.jaevn ? 'ja' : ''} |`;
const hoved = '| Søgeord | Emne | Søgn./md | Sværhed | Hensigt | Udvikling år % | Tidløs |';
ud('## Robottens hovedsøgeord'); ud(hoved); ud('|---|---|---|---|---|---|---|');
for (const x of rk.filter((x) => x.slags === 'hoved')) ud(raekke(x));
ud('');
ud('## Bedste muligheder blandt alle (sværhed ≤ 30, flest søgninger)'); ud(hoved); ud('|---|---|---|---|---|---|---|');
for (const x of f.filter((x) => x.i.vol && (x.i.kd ?? 0) <= 30).sort((a, b) => b.i.vol - a.i.vol).slice(0, 20)) ud(raekke(x));
fs.writeFileSync(sti('robot/ud/dataforseo-maaling.json'), JSON.stringify({ pris: opg.cost, foer, efter, rk }, null, 1));
slut(0);
