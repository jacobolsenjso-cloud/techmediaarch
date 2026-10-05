// Korte afsnit (Jacob 5/10-2026, med TV 2 som forbillede): højst 3 sætninger og ca. 40 ord pr. afsnit.
// delAfsnit(html) deler for lange <p> MELLEM sætninger. Ingen ord ændres, kun hvor afsnittet knækker,
// så de ældre artikler stadig bevises ord for ord mod Blogger (scripts/tjek-site.mjs).
// Bruges af robotten (artikel.mjs) og af robot/ud/_del-afsnit.mjs på de udgivne artikler.
export const MAKS_SAETNINGER = 3;
// 40 ord ≈ 6 linjer på mobil (43 tegn/linje, målt 5/10). Første forsøg med 55 gav stadig 9 linjer.
export const MAKS_ORD = 40;

// Tags, et knæk må gå igennem: de lukkes før knækket og åbnes igen efter (samme attributter).
const INLINE = new Set(['span', 'strong', 'b', 'em', 'i', 'u', 'font', 'small', 'mark', 'sup', 'sub']);
// Forkortelser, hvor punktum ikke afslutter en sætning ("U.S. Army", "Dr. Smith", "e.g. ChatGPT")
const FORK = /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Inc|Ltd|Co|Corp|vs|etc|e\.g|i\.e|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S|U\.K|E\.U|U\.N|[A-Z])\.$/;
const ord = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').split(/\s+/).filter(Boolean).length;

// Deler ét afsnits indhold i sætninger. Returnerer [{html, stak}] hvor stak er de inline-tags,
// der er åbne ved knækket efter sætningen — eller null, hvis afsnittet ikke kan deles sikkert.
function saetninger(indre) {
  const dele = []; const stak = []; let start = 0; let i = 0;
  while (i < indre.length) {
    if (indre[i] === '<') {
      const slut = indre.indexOf('>', i); if (slut < 0) return null;
      const tag = indre.slice(i, slut + 1); const m = tag.match(/^<\/?([a-z0-9]+)/i);
      if (m) {
        const navn = m[1].toLowerCase();
        if (/^(img|iframe|table|script|video|div|p|ul|ol|li|h\d|blockquote|br)$/.test(navn)) return null; // ikke et rent tekstafsnit
        if (tag.startsWith('</')) { const j = stak.map((s) => s.navn).lastIndexOf(navn); if (j >= 0) stak.splice(j); }
        else if (!tag.endsWith('/>')) stak.push({ navn, tag });
      }
      i = slut + 1; continue;
    }
    const c = indre[i];
    if (c === '.' || c === '!' || c === '?') {
      let k = i + 1; while (k < indre.length && /["”’)]/.test(indre[k])) k++;
      const efter = indre.slice(k);
      const mm = efter.match(/^(\s+|&nbsp;)+/);
      const naeste = mm ? efter.slice(mm[0].length) : '';
      const startStort = /^(?:<(?!\/)[^>]+>)*["“(]?[A-Z0-9]/.test(naeste);
      const foer = indre.slice(Math.max(0, i - 12), i + 1).replace(/<[^>]+>/g, '');
      const kanKnaekke = mm && startStort && !FORK.test(foer) && stak.every((s) => INLINE.has(s.navn));
      if (kanKnaekke) {
        dele.push({ html: indre.slice(start, k), stak: stak.map((s) => ({ ...s })) });
        start = k + mm[0].length; i = start; continue;
      }
    }
    i++;
  }
  dele.push({ html: indre.slice(start), stak: [] });
  return dele;
}

// Grupperer sætninger i bidder på højst MAKS_SAETNINGER sætninger og ca. MAKS_ORD ord.
function grupper(dele) {
  const grp = []; let cur = [];
  for (const d of dele) {
    const n = cur.length ? ord(cur.map((x) => x.html).join(' ')) : 0;
    if (cur.length && (cur.length >= MAKS_SAETNINGER || n + ord(d.html) > MAKS_ORD)) { grp.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) grp.push(cur);
  return grp;
}

// Skal afsnittet deles? (bruges også af målinger)
export function forLangt(indre) { const s = saetninger(indre); const n = s ? s.length : 1; return n > MAKS_SAETNINGER || ord(indre) > MAKS_ORD; }

// Deler alle for lange <p> i html. FAQ-afsnit (fra en overskrift med "FAQ"/"Frequently Asked" til næste <h2>)
// røres ikke, fordi FAQ-boksen og FAQ-dataene bygger på svaret som ét afsnit.
export function delAfsnit(html) {
  let delt = 0;
  const faqStart = (() => { const m = String(html).match(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Frequently Asked Questions)/i); return m ? m.index : -1; })();
  const faqSlut = faqStart < 0 ? -1 : (() => { const r = String(html).slice(faqStart + 4).search(/<h2\b/i); return r < 0 ? html.length : faqStart + 4 + r; })();
  const ud = String(html).replace(/<p(\s[^>]*)?>((?:(?!<\/?p[\s>])[\s\S])*?)<\/p>/gi, (hel, attr = '', indre, pos) => {
    if (faqStart >= 0 && pos > faqStart && pos < faqSlut) return hel;
    const dele = saetninger(indre);
    if (!dele || dele.length < 2 || !(dele.length > MAKS_SAETNINGER || ord(indre) > MAKS_ORD)) return hel;
    const grp = grupper(dele); if (grp.length < 2) return hel;
    // Inline-tags åbne ved et knæk: lukkes sidst i bidden og åbnes igen først i næste
    let ny = ''; let aabne = [];
    grp.forEach((g, gi) => {
      const sidste = g[g.length - 1];
      const ind = aabne.map((s) => s.tag).join('');
      const luk = gi < grp.length - 1 ? [...sidste.stak].reverse().map((s) => `</${s.navn}>`).join('') : '';
      ny += `<p${attr}>${ind}${g.map((x) => x.html).join(' ')}${luk}</p>`;
      aabne = gi < grp.length - 1 ? sidste.stak : [];
    });
    delt++;
    return ny;
  });
  return { html: ud, delt };
}
