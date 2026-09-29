// FAQ-boksen under artiklerne (Jacob 28/9-2026: FAQ under artiklen, mindst 5 spørgsmål).
//
// Artiklens EGEN FAQ bliver stående, hvor den står, og med de samme ord — kun HTML-mærkerne
// skiftes, så spørgsmålene kan foldes ud (<details>). Derfor kan tjek-site stadig bevise, at
// teksten er ord for ord ens med Blogger. Ekstra spørgsmål (frontmatter "faq:", skrevet ud fra
// artiklens egen tekst) lægges nederst i samme boks og mærkes data-ekstra, så tjekket kan se dem.
//
// Reglen for at finde FAQ'en er den samme som FAQ-dataene (faqschema.mjs): første h2 med
// "faq" eller "frequently asked questions"; spørgsmål = h3/h4/strong eller et afsnit, der
// starter med fed tekst, som ender på "?"; svar = afsnit og lister indtil næste h2.
// Står der tekst i afsnittet, som hverken er spørgsmål eller svar (fx en tabel), røres det ikke —
// hellere en FAQ uden boks end en boks, der mister indhold. Billeder og videodata uden tekst
// flyttes uændret til lige efter boksen (se udenTekst nedenfor).
import { parseFragment, serialize } from 'parse5';
import { VANDMAERKE_TEKST } from './temakoder.mjs';

const tekstIndhold = (n) => n.nodeName === '#text' ? n.value : (n.childNodes || []).map(tekstIndhold).join('');
const ydre = (n) => serialize({ nodeName: '#document-fragment', childNodes: [n] });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tom = (n) => n.nodeName === '#comment' || (n.nodeName === '#text' && !n.value.trim())
  || (n.tagName && !tekstIndhold(n).replace(/\u00a0/g, ' ').trim() && !/<(img|iframe|video|table)\b/i.test(ydre(n)));

function alle(n, ud = []) { for (const c of n.childNodes || []) if (c.tagName) { ud.push(c); alle(c, ud); } return ud; }

// "<p><strong>Spørgsmål?</strong><br>Svar</p>" -> { q, a }
function fedt(n) {
  if (n.tagName !== 'p') return null;
  const b = (n.childNodes || []).filter((c) => !(c.nodeName === '#text' && !c.value.trim()));
  if (!b[0] || b[0].tagName !== 'strong' || !tekstIndhold(b[0]).trim().endsWith('?')) return null;
  let rest = b.slice(1); while (rest.length && rest[0].tagName === 'br') rest = rest.slice(1);
  const a = serialize({ nodeName: '#document-fragment', childNodes: rest }).trim();
  return a ? { q: serialize(b[0]).trim(), a: `<p>${a}</p>` } : null;
}

const punkt = (q, a, ekstra) => `<details class="faq-item"${ekstra ? ' data-ekstra="1"' : ''}><summary>${q}</summary><div class="faq-answer">${a}</div></details>`;
const ekstraHtml = (liste) => liste.map((x) => punkt(esc(x.q), `<p>${esc(x.a)}</p>`, true)).join('');

// Returnerer { html, egne, ekstra, status } — status: 'boks' | 'uroert' (FAQ med ukendt indhold) | 'ny' | 'ingen'
export function faqBoks(html, ekstra = []) {
  const rod = parseFragment(html, { sourceCodeLocationInfo: true });
  const h2 = alle(rod).filter((e) => e.tagName === 'h2');
  const faq = h2.find((h) => { const t = tekstIndhold(h).toLowerCase(); return t.includes('frequently asked questions') || t.includes('faq'); });
  if (!faq) {
    if (!ekstra.length) return { html, egne: 0, ekstra: 0, status: 'ingen' };
    const boks = `<section class="faq-box" data-ekstra="1"><h2 id="frequently-asked-questions">Frequently Asked Questions</h2>${ekstraHtml(ekstra)}</section>`;
    return { html: html + boks, egne: 0, ekstra: ekstra.length, status: 'ny' };
  }
  const soesk = faq.parentNode.childNodes;
  const start = soesk.indexOf(faq);
  let slut = start + 1;
  while (slut < soesk.length && soesk[slut].tagName !== 'h2') slut++;
  const del = soesk.slice(start + 1, slut);
  const punkter = []; let cur = null; let ok = true;
  // Elementer UDEN læsbar tekst (videodata i <script>, et billede) flyttes uændret til lige efter boksen
  // (29/9: 9 artikler har VideoObject-data og 2 et billede midt i FAQ'en). Element MED tekst, som ikke er
  // spørgsmål/svar, gør stadig, at FAQ'en står urørt — så forsvinder der aldrig tekst.
  const efterBoks = [];
  const udenTekst = (n) => n.tagName === 'script' || (!tekstIndhold(n).split(VANDMAERKE_TEKST).join('').replace(/\u00a0/g, ' ').trim() && /<(img|iframe|video|picture)\b/i.test(ydre(n)));
  for (const n of del) {
    if (tom(n)) continue;
    const f = fedt(n);
    if (['h3', 'h4', 'strong'].includes(n.tagName)) { cur = { q: serialize(n).trim(), a: [] }; punkter.push(cur); }
    else if (f) { cur = { q: f.q, a: [f.a] }; punkter.push(cur); }
    else if (udenTekst(n)) efterBoks.push(ydre(n));
    else if (['p', 'ul', 'ol'].includes(n.tagName) && cur) cur.a.push(ydre(n));
    else { ok = false; break; }
  }
  if (!ok || !punkter.length || punkter.some((p) => !p.a.length)) {
    // Ukendt indhold: FAQ'en står urørt; ekstra spørgsmål lægges i en egen boks lige efter den
    const efter = del.length ? del.at(-1) : faq;
    const pos = efter.sourceCodeLocation.endOffset;
    const boks = ekstra.length ? `<section class="faq-box" data-ekstra="1">${ekstraHtml(ekstra)}</section>` : '';
    return { html: html.slice(0, pos) + boks + html.slice(pos), egne: 0, ekstra: ekstra.length, status: 'uroert' };
  }
  const fra = faq.sourceCodeLocation.startOffset;
  const til = (del.length ? del.at(-1) : faq).sourceCodeLocation.endOffset;
  const boks = `<section class="faq-box">${ydre(faq)}${punkter.map((p) => punkt(p.q, p.a.join(''), false)).join('')}${ekstraHtml(ekstra)}</section>${efterBoks.join('')}`;
  return { html: html.slice(0, fra) + boks + html.slice(til), egne: punkter.length, ekstra: ekstra.length, status: 'boks' };
}
