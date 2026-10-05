// Stopper næsten-ens artikler, før de bliver skrevet.
//
// Tre lag, billigst først:
//  1. Præcis samme søgeord (efter normalisering) — gratis, fanger gentagelser.
//  2. Kerneords-dækning: dækker en eksisterende artikel allerede kernen i det
//     nye søgeord? — gratis, fanger "what are AR glasses" / "what is AR glasses",
//     som techfeedwatch lod slippe igennem 142 gange (målt 26/9-2026).
//  3. Gemini afgør "samme hensigt?" mod de 10 mest ens artikler — kun for dem,
//     der slap gennem lag 1-2. Kræver GEMINI_API_KEY (trin 2); uden nøgle
//     springes laget over, og listen siger det.
import { kerne, normaliser, daekning } from './tekst.mjs';

// Grænser for lag 2, kalibreret med robot/kalibrer.mjs på techfeedwatchs 126
// brugte spørgsmål (26/9-2026). To retninger måles:
//   ny→gammel: hvor stor del af det NYE søgeords kerne står i den gamle
//   gammel→ny: hvor stor del af den GAMLE tekst's kerne står i det nye
// Den ene helt inde i den anden, den anden ≥ 75 % → AFVIST uden videre.
// Kun den ene = den ene dækker den anden → TVIVL, Gemini afgør (lag 3).
export const GRAENSE = { afvist: 0.75, tvivl: 0.75 };

// Delvist overlap (Jacob 5/10-2026, forslag 4): "what are phishing attacks" blev
// skrevet, selv om "What Are Phishing Emails…" fandtes, fordi kun 1 kerneord var
// fælles ("phishing"), og lag 2 kræver 2. Står mindst halvdelen af det nye søgeords
// kerne i en eksisterende artikel, skal Gemini (lag 3) også afgøre "fri"-søgeord.
export const DELVIS = 0.5;
export const delvistOverlap = (q, indeks) => (mestEns(q, indeks, 1)[0]?.andel || 0) >= DELVIS;

export function lavIndeks(artikler, brugte = []) {
  const ind = [];
  for (const a of artikler) {
    ind.push({ tekst: a.titel, sti: a.sti, kerne: kerne(a.titel), norm: normaliser(a.titel) });
    for (const s of a.soegeord || []) ind.push({ tekst: s, sti: a.sti, kerne: kerne(s), norm: normaliser(s) });
  }
  for (const b of brugte) ind.push({ tekst: b.q, sti: b.artikel || '(brugt søgeord)', kerne: kerne(b.q), norm: normaliser(b.q) });
  return ind;
}

// Sammenlign to kerner. Returnerer 'afvist', 'tvivl' eller null.
export function sammenlign(k, andenKerne) {
  const frem = daekning(k, andenKerne);
  if (!frem.faelles) return null;
  const tilbage = daekning(andenKerne, k);
  // Afvist kræver, at den ene kerne står HELT i den anden (og den anden næsten
  // helt i den første). Ellers blev "what are qubits made of in quantum computing"
  // afvist mod "how does quantum computing make money" (3 af 4 ord fælles begge veje).
  if (Math.max(frem.andel, tilbage.andel) === 1 && Math.min(frem.andel, tilbage.andel) >= GRAENSE.afvist) return { dom: 'afvist', frem: frem.andel, tilbage: tilbage.andel };
  // Tvivl kræver 2 fælles ord, ellers rammer "what is seo" alt, der nævner SEO.
  if (frem.faelles >= 2 && (frem.andel >= GRAENSE.tvivl || tilbage.andel >= GRAENSE.tvivl)) return { dom: 'tvivl', frem: frem.andel, tilbage: tilbage.andel };
  return null;
}

// Tjek ét søgeord mod indekset.
// Returnerer { dom: 'fri' } eller { dom: 'afvist'|'tvivl', lag, grund, mod, sti, alle }.
export function tjek(q, indeks) {
  const n = normaliser(q);
  const hit1 = indeks.find((el) => el.norm === n);
  if (hit1) return { dom: 'afvist', lag: 1, grund: 'præcis samme søgeord', mod: hit1.tekst, sti: hit1.sti, alle: [hit1] };
  const k = kerne(q);
  if (!k.size) return { dom: 'afvist', lag: 2, grund: 'ingen kerneord (kun spørgeord)', mod: '', sti: '', alle: [] };
  const hits = [];
  for (const el of indeks) {
    const r = sammenlign(k, el.kerne);
    if (r) hits.push({ ...r, tekst: el.tekst, sti: el.sti });
  }
  if (!hits.length) return { dom: 'fri' };
  const af = hits.filter((h) => h.dom === 'afvist');
  const top = (af.length ? af : hits).sort((x, y) => (y.frem + y.tilbage) - (x.frem + x.tilbage))[0];
  return {
    dom: af.length ? 'afvist' : 'tvivl', lag: 2,
    grund: af.length ? 'næsten samme kerneord' : 'overlapper — Gemini skal afgøre',
    mod: top.tekst, sti: top.sti, alle: hits,
  };
}

// De n mest ens artikler (til Gemini i lag 3 og til læselisten).
export function mestEns(q, indeks, n = 10) {
  const k = kerne(q);
  const set = new Map();
  for (const el of indeks) {
    const { andel } = daekning(k, el.kerne);
    if (andel > 0 && (!set.has(el.sti) || set.get(el.sti).andel < andel)) set.set(el.sti, { andel, tekst: el.tekst, sti: el.sti });
  }
  return [...set.values()].sort((a, b) => b.andel - a.andel).slice(0, n);
}

// Lag 3 — Gemini. Kaldes kun, når nøglen findes (trin 2).
// Returnerer { samme: bool, mod } eller null, hvis laget ikke kunne køre.
export async function geminiSammeHensigt(q, kandidater, { model = 'gemini-3.5-flash-lite' } = {}) {
  const noegle = process.env.GEMINI_API_KEY;
  if (!noegle || !kandidater.length) return null;
  const liste = kandidater.map((c, i) => `${i + 1}. ${c.tekst}`).join('\n');
  // 5/10-2026: "fully served" var for strengt til delvist overlap — nu "samme kerneemne".
  const prompt = `New article keyword: "${q}"\nExisting articles:\n${liste}\n\nWould a reader searching the new keyword get their question answered by one of the existing articles, because it covers the same core topic and search intent, even if worded differently (e.g. "what are phishing attacks" vs. "What Are Phishing Emails and How Do Cyberattacks Work?")? A narrower sub-topic with its own clear intent (e.g. "ransomware canary files" vs. "what is ransomware") is NOT the same. Answer only JSON: {"same": true|false, "number": <number or 0>}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': noegle },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const svar = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    return { samme: Boolean(svar.same), mod: kandidater[(svar.number || 0) - 1] || null };
  } catch { return null; }
}
