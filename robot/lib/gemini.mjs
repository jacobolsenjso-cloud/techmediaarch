// Kald til Gemini (tekst, JSON og billeder). Nøglen kommer fra GEMINI_API_KEY
// og skrives aldrig ud. Projektet "Gemini Project Tech Media Arch" har betaling
// og et beløbsloft på 50 kr/md (sat af Jacob 26/9-2026).
export const TEKSTMODEL = 'gemini-3.5-flash-lite';
export const BILLEDMODEL = 'gemini-3.1-flash-lite-image'; // $0,0336 pr. billede (prisside 26/9-2026)

const URL = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const skjul = (t) => String(t).replace(/AIza[0-9A-Za-z_-]{20,}/g, '***').slice(0, 200);

async function kald(model, body, forsoeg = 3) {
  const noegle = process.env.GEMINI_API_KEY;
  if (!noegle) throw new Error('GEMINI_API_KEY mangler');
  for (let i = 1; ; i++) {
    const r = await fetch(URL(model), { method: 'POST', headers: { 'x-goog-api-key': noegle, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    // 429/500/503: vent og prøv igen (Google er af og til overbelastet)
    if (i < forsoeg && [429, 500, 503].includes(r.status)) { await new Promise((s) => setTimeout(s, 5000 * i)); continue; }
    throw new Error(`Gemini ${model} svarede ${r.status}: ${skjul(j.error?.message || '')}`);
  }
}

const tekstAf = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');

// Tekst, evt. med Google-søgning. Returnerer { tekst, kilder: [{ uri, titel }] }.
export async function skriv(prompt, { soeg = false, temperatur = 0.7 } = {}) {
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temperatur } };
  if (soeg) body.tools = [{ google_search: {} }];
  const j = await kald(TEKSTMODEL, body);
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
  return Buffer.from(del.inlineData.data, 'base64');
}
