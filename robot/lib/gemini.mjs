// Kald til Gemini (tekst, JSON og billeder). Nøglen kommer fra GEMINI_API_KEY
// og skrives aldrig ud. Projektet "Gemini Project Tech Media Arch" har betaling
// og et beløbsloft på 50 kr/md (sat af Jacob 26/9-2026).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEKSTMODEL = 'gemini-3.5-flash-lite';
export const BILLEDMODEL = 'gemini-3.1-flash-lite-image'; // $0,0336 pr. billede (prisside 26/9-2026)

// --- Pristæller (trin 7, Jacob 29/10-2026) ---------------------------------------------------------
// Hvert kald tælles ud fra Googles eget svar (usageMetadata), så prisen er målt, ikke gættet.
// Priser i USD pr. 1 mio. tokens, betalt niveau, fra ai.google.dev/pricing 29/10-2026. "ud" er inkl. "thinking".
// En model uden pris her tælles stadig (tokens), men prisen markeres som ukendt i opgørelsen.
export const PRISER = {
  'gemini-3.5-flash-lite': { ind: 0.30, ud: 2.50 },
  'gemini-2.5-flash': { ind: 0.30, ud: 2.50 },
};
export const BILLEDPRIS = 0.0336;            // USD pr. billede (1K), samme prisside
export const SOEG_GRATIS_PR_MD = 5000;       // Google-søgning: 5.000 gratis pr. måned (Gemini 3+), derefter $14 pr. 1.000
export const KURS = 6.87;                    // DKK pr. USD (Wise, midtkurs 29/10-2026)
export const forbrug = { modeller: {}, billeder: 0, soegninger: 0 };

// Også til kald, der ikke går gennem kald() herunder (robot/lib/dubletter.mjs)
export const noterForbrug = (model, j) => noter(model, j, false);
function noter(model, j, soeg) {
  const u = j.usageMetadata || {};
  const m = (forbrug.modeller[model] ||= { kald: 0, ind: 0, ud: 0 });
  m.kald++; m.ind += u.promptTokenCount || 0; m.ud += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
  if (soeg) forbrug.soegninger++;
}

// Opgørelse i USD og kr. Billedmodellen afregnes pr. billede, ikke pr. token.
export function prisOpgoerelse(f = forbrug) {
  let usd = f.billeder * BILLEDPRIS; const ukendt = [];
  for (const [model, m] of Object.entries(f.modeller)) {
    if (model === BILLEDMODEL) continue;
    const p = PRISER[model];
    if (!p) { ukendt.push(model); continue; }
    usd += (m.ind * p.ind + m.ud * p.ud) / 1e6;
  }
  return { ...f, usd: Math.round(usd * 10000) / 10000, kr: Math.round(usd * KURS * 100) / 100, ukendtPris: ukendt };
}

// Skriver opgørelsen til robot/ud/<navn>.json, når processen slutter — også hvis artiklen blev afvist,
// for pengene er brugt alligevel. robot/plan.mjs samler filerne til robot/data/pris.json.
export function gemPrisVedExit(navn) {
  process.on('exit', () => {
    try {
      const mappe = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ud');
      fs.mkdirSync(mappe, { recursive: true });
      fs.writeFileSync(path.join(mappe, `pris-${navn}.json`), JSON.stringify(prisOpgoerelse(), null, 1));
    } catch { /* prisen må aldrig stoppe robotten */ }
  });
}

const URL = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const skjul = (t) => String(t).replace(/AIza[0-9A-Za-z_-]{20,}/g, '***').slice(0, 200);

async function kald(model, body, forsoeg = 3) {
  const noegle = process.env.GEMINI_API_KEY;
  if (!noegle) throw new Error('GEMINI_API_KEY mangler');
  for (let i = 1; ; i++) {
    const r = await fetch(URL(model), { method: 'POST', headers: { 'x-goog-api-key': noegle, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { noter(model, j, Boolean(body.tools?.length)); return j; }
    // 429/500/503: vent og prøv igen (Google er af og til overbelastet)
    if (i < forsoeg && [429, 500, 503].includes(r.status)) { await new Promise((s) => setTimeout(s, 5000 * i)); continue; }
    throw new Error(`Gemini ${model} svarede ${r.status}: ${skjul(j.error?.message || '')}`);
  }
}

const tekstAf = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');

// Tekst, evt. med Google-søgning. Returnerer { tekst, kilder: [{ uri, titel }] }.
export async function skriv(prompt, { soeg = false, temperatur = 0.7, model = TEKSTMODEL } = {}) {
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temperatur } };
  if (soeg) body.tools = [{ google_search: {} }];
  const j = await kald(model, body);
  const kilder = (j.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web).filter(Boolean).map((w) => ({ uri: w.uri, titel: w.title || '' }));
  return { tekst: tekstAf(j), kilder };
}

// Svar som JSON (uden søgning — de to kan ikke kombineres).
export async function json(prompt) {
  const j = await kald(TEKSTMODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
  return JSON.parse(tekstAf(j));
}

// Billede i 16:9. Returnerer en Buffer (PNG/JPEG) eller kaster en fejl.
export async function billede(prompt) {
  const j = await kald(BILLEDMODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } });
  const del = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!del) throw new Error('Gemini svarede uden billede');
  forbrug.billeder++;
  return Buffer.from(del.inlineData.data, 'base64');
}
