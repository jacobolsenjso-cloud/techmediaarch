// Emnespredning (Jacob 9/11-2026, rettelse 3): højst én ny artikel pr. kerneemne pr. uge, og hylderne på skift.
//
// Målt 9/11: 6 af de sidste 9 nye artikler handlede om generativ AI (forskel fra traditionel AI, hvordan den lærer,
// billeder, miljø, vand, hvad den ikke kan). Årsagen var min ændring 6/11 ("klynger først"): klyngerne samler sig om
// AI, så den samme hylde og det samme emne kom forrest hver gang.
//
// Rækkefølgen for dagens pakker bliver nu:
//  1. pakker, hvis kerneemne IKKE har fået en ny artikel de sidste 7 dage (ellers "hviler" emnet)
//  2. hylden med færrest nye artikler de sidste 7 dage
//  3. klynger (Google viser os allerede for emnet) før andre
//  4. den gamle orden (tyndeste hylde/emne først, fra robot/soegeord.mjs)
// "Kerneemne" = fælles kerneord med en ny artikels hovedsøgeord, når meget brede ord ("ai", "tech", "tool" …) ikke
// tæller: "how does generative ai use water" deler "generative" med "how does generative ai affect the environment".
import { kerne } from './tekst.mjs';

// Brede ord, der ikke gør to emner til det samme (stammer, som kerne() laver dem)
const BREDE = new Set(['ai', 'tech', 'techno', 'digita', 'online', 'tool', 'app', 'comput', 'softwa', 'best', 'guide', 'free', 'new', 'top', 'way', 'people', 'busine']);
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
  m.sort((a, b) => (!!a.hviler - !!b.hviler)
    || ((prHylde[a.hylde] || 0) - (prHylde[b.hylde] || 0))
    || (((b.p.klynge || 0) > 0) - ((a.p.klynge || 0) > 0))
    || a.i - b.i);
  return { sorteret: m.map((x) => x.p), hviler: m.filter((x) => x.hviler).map((x) => ({ hoved: x.p.hoved, mod: x.hviler.hoved })), prHylde };
}
