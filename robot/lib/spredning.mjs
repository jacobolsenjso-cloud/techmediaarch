// Emnespredning (Jacob 9/11-2026, rettelse 3): højst én ny artikel pr. kerneemne pr. uge, og hylderne på skift.
//
// Målt 9/11: 6 af de sidste 9 nye artikler handlede om generativ AI (forskel fra traditionel AI, hvordan den lærer,
// billeder, miljø, vand, hvad den ikke kan). Årsagen var min ændring 6/11 ("klynger først"): klyngerne samler sig om
// AI, så den samme hylde og det samme emne kom forrest hver gang.
//
// Rækkefølgen for dagens pakker bliver nu:
//  1. pakker, hvis kerneemne IKKE har fået en ny artikel de sidste 7 dage (ellers "hviler" emnet)
//  2. (9/11-2026) pakker med under 20 søgninger/md (DataForSEO) bagerst — også før hylde-skiftet
//  3. hylden med færrest nye artikler de sidste 7 dage
//  4. kendte søgetal før ukendte; flest søgninger × lethed først (klynger tæller dobbelt); uden tal: klynger før andre
//  5. den gamle orden (tyndeste hylde/emne først, fra robot/soegeord.mjs)
// "Kerneemne" = fælles kerneord med en ny artikels hovedsøgeord, når meget brede ord ("ai", "tech", "tool" …) ikke
// tæller: "how does generative ai use water" deler "generative" med "how does generative ai affect the environment".
import { kerne } from './tekst.mjs';

// Brede ord, der ikke gør to emner til det samme (stammer, som kerne() laver dem)
// + almindelige udsagns- og tillægsord (målt i prøve #51, 9/11: "how does ai force differentiate itself from ai coding
// assistant" hvilede mod "how does generative ai differ from traditional ai" kun pga. "differ")
const BREDE = new Set(['ai', 'tech', 'techno', 'digita', 'online', 'tool', 'app', 'comput', 'softwa', 'best', 'guide', 'free', 'new', 'top', 'way', 'people', 'busine',
  'differ', 'compar', 'learn', 'make', 'cost', 'long', 'take', 'help', 'need', 'happen', 'start', 'better', 'good', 'bad', 'want', 'find', 'choose', 'used', 'itself', 'right', 'now', 'year', '2026', '2025']);
const emneOrd = (q) => new Set([...kerne(q)].filter((w) => !BREDE.has(w)));

// nye: [{ hoved, hylde, dato }] — nye artikler (ikke omskrivninger) de sidste `dage` dage
export function nyeArtikler(arkiv, hyldeAf, { dage = 7, nu = Date.now() } = {}) {
  const graense = nu - dage * 864e5;
  return arkiv.filter((a) => a.robot && a.dato && new Date(a.dato).getTime() >= graense && a.soegeord?.[0])
    .map((a) => ({ hoved: a.soegeord[0], hylde: hyldeAf(a), dato: a.dato, sti: a.sti }));
}

export function hvilerMod(hoved, nye) {
  const k = emneOrd(hoved);
  return nye.find((n) => [...emneOrd(n.hoved)].some((w) => k.has(w))) || null;
}

// kandidater: [{ hoved, emne, klynge, ... }] i den gamle orden. hyldeForEmne(emne) → hylde.
export function spred(kandidater, nye, hyldeForEmne) {
  const prHylde = {};
  for (const n of nye) prHylde[n.hylde] = (prHylde[n.hylde] || 0) + 1;
  const m = kandidater.map((p, i) => ({ p, i, hviler: hvilerMod(p.hoved, nye), hylde: hyldeForEmne(p.emne) }));
  // Søgetal (Jacob 9/11-2026, robot/lib/dataforseo.mjs): gruppe 0 = mindst 20 søgninger/md, 1 = ukendt, 2 = under 20.
  // Under 20 søgninger kommer efter alt andet (men før hvilende emner) — ellers kunne hylde-skiftet vælge et emne, ingen
  // søger på. Inden for samme hylde: kendte søgetal før ukendte, så "søgninger × lethed" med klynger (Google viser os
  // allerede for emnet) talt dobbelt. Pakker uden søgetal (gruppe mangler) sorteres som før.
  const g = (p) => p.gruppe ?? 1;
  const score = (p) => (g(p) === 0 ? (p.vaerdi || 0) * ((p.klynge || 0) > 0 ? 2 : 1) : 0);
  m.sort((a, b) => (!!a.hviler - !!b.hviler)
    || ((g(a.p) === 2) - (g(b.p) === 2))
    || ((prHylde[a.hylde] || 0) - (prHylde[b.hylde] || 0))
    || (g(a.p) - g(b.p))
    || (score(b.p) - score(a.p))
    || (((b.p.klynge || 0) > 0) - ((a.p.klynge || 0) > 0))
    || a.i - b.i);
  return { sorteret: m.map((x) => x.p), hviler: m.filter((x) => x.hviler).map((x) => ({ hoved: x.p.hoved, mod: x.hviler.hoved })), prHylde };
}
