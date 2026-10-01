// Placering af sitets egne bokse inde i brødteksten (1/10-2026, Jacob):
//  - Indholdsfortegnelsen står under artiklens første billede ("det skal være under billedet").
//  - "You might also like" (2 forslag) står midt i artiklen, foran den midterste overskrift.
// Begge bokse er mærket data-ekstra, så tjek-site ser bort fra dem i tekstbeviset mod Blogger, og de er
// bygget uden <p>, <ul>/<li> og overskrift-tags, så Googles Auto-annoncer ikke kan sætte annoncer ind i dem.
// HTML'en læses med parse5 (Astros egen HTML-læser), så placeringen følger de rigtige tags og ikke tekstsøgning.
import { parseFragment } from 'parse5';

const OVERSKRIFT = /^h[1-6]$/;
const erElement = (n) => n && n.tagName;
function* alle(n) { for (const c of n.childNodes || []) { yield c; yield* alle(c); } }
const harOverskrift = (n) => [...alle(n)].some((c) => OVERSKRIFT.test(c.tagName || ''));
const tekstAf = (n) => [...alle(n)].filter((c) => c.nodeName === '#text').map((c) => c.value).join('').trim();

// Hvor indholdsfortegnelsen skal stå: lige efter blokken med det første billede, hvis billedet kommer før artiklens
// anden overskrift (ellers står billedet langt nede, og fortegnelsen hører til øverst). Returnerer et tegn-nummer i html.
export function efterFoersteBillede(html, slut = html.length) {
  const rod = parseFragment(html.slice(0, slut), { sourceCodeLocationInfo: true });
  let overskrifter = 0;
  for (const n of alle(rod)) {
    if (!erElement(n)) continue;
    if (OVERSKRIFT.test(n.tagName)) { overskrifter++; if (overskrifter >= 2) return 0; continue; }
    if (n.tagName !== 'img') continue;
    // Gå op til den største blok omkring billedet, der ikke rummer en overskrift (figur, Bloggers tabel/div, afsnit)
    let blok = n;
    while (blok.parentNode && blok.parentNode !== rod && !harOverskrift(blok.parentNode)) blok = blok.parentNode;
    return blok.sourceCodeLocation?.endOffset ?? 0;
  }
  return 0;
}

// Hvor "You might also like" skal stå: foran den h2 (h3, hvis artiklen ingen h2 har), der står nærmest midt i teksten før FAQ'en.
// "FAQ" og "Sources" tæller ikke. Under 3 overskrifter: ingen plads midt i, så null.
export function foranMidterOverskrift(html, slut = html.length) {
  const rod = parseFragment(html.slice(0, slut), { sourceCodeLocationInfo: true });
  const find = (tag) => [...alle(rod)].filter((n) => n.tagName === tag && !/^(faq|sources?|frequently asked questions)$/i.test(tekstAf(n)));
  const liste = find('h2').length ? find('h2') : find('h3');
  if (liste.length < 3) return null;
  // I nogle Blogger-indlæg står overskriften inde i <span>, en tabel o.l. (målt 1/10: 5 af 186). Boksen må ikke sættes ind
  // midt i sådan en blok, så vi går op til den yderste af dem — men kun så længe blokken ikke rummer andre overskrifter.
  // (Er hele indlægget pakket i én <span>, bliver boksen stående foran overskriften; ellers ville den ryge helt op i toppen.)
  // Den overskrift, der står nærmest midt i TEKSTEN (ikke den midterste i rækken: afsnittene er ikke lige lange —
  // målt 1/10: én artikel fik boksen ved 15 % med "den midterste i rækken")
  const noder = [...alle(rod)];
  let tegn = 0; const foer = new Map();
  for (const x of noder) { if (liste.includes(x)) foer.set(x, tegn); if (x.nodeName === '#text') tegn += x.value.trim().length; }
  let n = liste.reduce((bedst, x) => (Math.abs(foer.get(x) - tegn / 2) < Math.abs(foer.get(bedst) - tegn / 2) ? x : bedst), liste[0]);
  // Aldrig den første overskrift (så står boksen før det første afsnit er læst)
  if (n === liste[0]) n = liste[1];
  const antalOverskrifter = (x) => [...alle(x)].filter((c) => OVERSKRIFT.test(c.tagName || '')).length;
  while (n.parentNode && n.parentNode !== rod && INDE_I.test(n.parentNode.tagName || '') && antalOverskrifter(n.parentNode) <= 1) n = n.parentNode;
  return n.sourceCodeLocation?.startOffset ?? null;
}
const INDE_I = /^(span|a|p|b|i|u|em|strong|font|small|big|li|ul|ol|table|tbody|thead|tr|td|th|center|blockquote|h[1-6])$/;

// Sæt flere stykker HTML ind på hver deres tegn-nummer (bagfra, så de første numre ikke flytter sig)
export function indsaet(html, stykker) {
  let ud = html;
  for (const { pos, html: s } of [...stykker].filter((x) => x.html && x.pos != null).sort((a, b) => b.pos - a.pos)) ud = ud.slice(0, pos) + s + ud.slice(pos);
  return ud;
}
