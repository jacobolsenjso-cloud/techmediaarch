// Faste sider, der er taget ud med vilje, og hvor de nu sender læseren hen (301, ét hop).
// Bruges af workeren (worker/index.js) og af tjek-site.mjs, så tjekket ved, at adressen
// SKAL mangle som fil — ellers ville den svare 200 i stedet for 301.
// Nøgle: adressen uden .html. Workeren tager også imod .html og en afsluttende /.
export const NEDLAGTE = {
  // Trin 5 i svar-arkivet (Jacob 28/10-2026): videoerne er taget ud, så Watch-siden er nedlagt
  '/p/watch': '/',
};
