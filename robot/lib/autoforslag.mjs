// Henter de spørgsmål, folk skriver i Google, via Googles autoforslag.
// Gratis og uden nøgle. Virker fra Jacobs pc og fra GitHubs maskiner, men
// IKKE fra Claudes sky (Google blokerer den) — målt på techfeedwatch 8/9-2026.
//
// Præfikser, afvisningsord og slangliste er kopieret fra techfeedwatch
// (src/lib/suggest.mjs), hvor de er målt og justeret over flere uger:
//  - rå autoforslag duer ikke ("quantum computing" giver "stock", "etf");
//    spørgsmålsformerne giver rigtige spørgsmål
//  - Google gætter videre på præfikset, så forslaget SKAL stadig
//    indeholde emnet, ellers kasseres det
//  - præfikserne er målt 20/9: de giver lange spørgsmål (median 5-9 ord)
import { kerneord } from './tekst.mjs';

export const PRAEFIKSER = ['what is', 'how does', 'why', 'what are', 'how to use', 'is', 'can', 'what does', 'how much does', 'difference between', 'should i', 'how long does it take to', 'what is the best way to', 'what happens when'];

// Søgninger sitet ikke skal skrive til: køb, priser, kurser, job, login og
// lande-varianter der peger på lokale regler, vi ikke dækker.
const AFVIS = /\b(stock|stocks|etf|price|prices|buy|cheap|free|download|coupon|salary|course|courses|jobs|near me|reddit|login|sign in|app|india|uk|usa|australia|canada|denmark|nigeria|philippines|nz|singapore|ireland|pdf|ppt|book|act)\b/i;

// Slang og meme-sprog ("how are ai chips cooked"). Kort med vilje — Gemini-
// tjekket senere i kæden er det egentlige filter.
const SLANG = /\b(cooked|goated|sus|cringe|rizz|lowkey|highkey|meme|memes|tier list|dank|based|mid|bussin|no cap|fr|lol|lmao|wtf|tbh)\b/i;

// Returnerer [{ q, praefiks, froe, plads }] — hvilket præfiks der gav forslaget bruges
// senere til at gøre de 5 beslægtede søgeord forskellige.
export async function hentForslag(froe, { timeoutMs = 8000, pauseMs = 300 } = {}) {
  const ud = new Map();
  let svar = 0;
  for (const p of PRAEFIKSER) {
    const q = `${p} ${froe}`;
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      svar++;
      for (const [plads, s] of (j[1] || []).entries()) {
        const lav = String(s).toLowerCase().trim();
        if (lav === q.toLowerCase()) continue; // selve præfikset
        if (lav.length < 12 || lav.length > 80) continue;
        if (AFVIS.test(lav) || SLANG.test(lav)) continue;
        if (!omFroe(lav, froe)) continue;
        if (!ud.has(lav)) ud.set(lav, { q: lav, praefiks: p, froe, plads }); // plads 0 = Googles første forslag
      }
    } catch { /* ét præfiks der fejler må ikke vælte kørslen */ }
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  return { forslag: [...ud.values()], svar };
}

// Google gætter videre på præfikset — forslaget skal stadig handle om startordet.
// ALLE startordets ord skal stå som hele ord i forslaget (flertals-s tilladt).
// Før (som på techfeedwatch) var det nok, at ét ord stod et sted i teksten, og
// det gav målt 26/9-2026: "defi" → "defibrillation", "seo" → "seoul",
// "open banking" → "open bank account hollow knight". Stammer bruges IKKE her,
// fordi "banking" og "bank" har samme stamme.
export function omFroe(q, froe) {
  const ord = kerneord(froe);
  return ord.length > 0 && ord.every((w) => new RegExp(`\\b${w.replace(/s$/, '')}(s|es)?\\b`).test(q));
}
