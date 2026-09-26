// Fælles tekstregler for søgeordsrobotten.
//
// kerneord() og stamme() er kopieret fra techfeedwatch (src/lib/headline.mjs),
// så de to sites sammenligner søgeord på præcis samme måde. Ændres reglerne
// dér, bør de ændres her også.

// Ord der ikke siger noget om EMNET: spørgeord, småord og "forklar"-ord.
// "what is zero trust" og "how does zero trust work" har samme kerne: "zero trust".
const SPOERGEORD = new Set(['what', 'how', 'why', 'when', 'where', 'which', 'who', 'is', 'are', 'does', 'do', 'can', 'should', 'will', 'did', 'to', 'use', 'get', 'a', 'an', 'the', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'your', 'you', 'it', 'its', 'this', 'that', 'from', 'by', 'as', 'at', 'into', 'vs', 'mean', 'means', 'meaning', 'work', 'works', 'explained', 'definition']);

// Stamme: "chips"/"chip" og "computing"/"computers" skal tælle som samme ord.
export function stamme(w) {
  w = String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.length > 5) w = w.replace(/(ing|ies|es|ed)$/, '').replace(/([^s])s$/, '$1'); // "access" beholder sit s
  return w.slice(0, 6);
}

export function kerneord(tekst) {
  return String(tekst).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !SPOERGEORD.has(w));
}

// TILFØJET PÅ TECHMEDIAARCH (findes ikke på techfeedwatch):
// Fyldord, der ikke ændrer hensigten ("in simple words", "step by step"), og
// ord med samme betydning, der skal tælle som ét. Uden dem slap fx
// "how are ai chips designed" / "how are ai chips created" igennem på
// techfeedwatch. Målt på techfeedwatchs 126 brugte spørgsmål 26/9-2026.
const FYLD = new Set(['simple', 'simply', 'terms', 'words', 'example', 'examples', 'step', 'steps', 'beginner', 'beginners', 'basics', 'stand', 'exactly', 'really', 'actually', 'technology', 'difference', 'between', 'versus', 'so', 'mean', 'like', 'look', 'about', 'there', 'much', 'many', 'some', 'all']);
const SYNONYMER = {
  made: 'make', created: 'make', create: 'make', generated: 'make', generate: 'make', designed: 'make', built: 'make',
  important: 'matter', importance: 'matter', matters: 'matter', matter: 'matter',
  application: 'app', applications: 'app', apps: 'app',
  educational: 'education', classroom: 'education', learning: 'education', school: 'education', schools: 'education',
  chipset: 'chip', chipsets: 'chip', chips: 'chip',
};

// Kernen som mængde af stammer — det, der sammenlignes.
export function kerne(tekst) {
  return new Set(kerneord(tekst).filter((w) => !FYLD.has(w)).map((w) => stamme(SYNONYMER[w] || w)));
}

// Ensartet form til "præcis samme søgeord": små bogstaver, ét mellemrum, intet tegn til sidst.
export function normaliser(q) {
  return String(q).toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ').trim();
}

// Hvor stor en del af A's kerne findes i B? 1 = alle A's kerneord står i B.
// Bruges i stedet for "fælles ord ud af alle ord", fordi en eksisterende
// overskrift er lang ("Apple Releases First Preview of Its Long-Awaited iPhone
// AI"), mens et søgeord er kort ("apple intelligence iphone"). Spørgsmålet er:
// dækker den eksisterende side det, søgeordet handler om?
export function daekning(a, b) {
  const A = a instanceof Set ? a : kerne(a);
  const B = b instanceof Set ? b : kerne(b);
  if (!A.size) return { andel: 0, faelles: 0 };
  const faelles = [...A].filter((w) => B.has(w)).length;
  return { andel: faelles / A.size, faelles };
}
