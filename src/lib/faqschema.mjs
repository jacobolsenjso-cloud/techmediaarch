// FAQ-data til Google (FAQPage) — samme regel som Blogger-temaets script.
//
// På Blogger lå der et lille script i temaet, som ved visning fandt afsnittet
// "Frequently Asked Questions" / "FAQ" i indlægget og lavede FAQPage-data ud af det.
// Google læste de data. Her laves de samme data, når siden bygges, så intet går tabt
// ved flytningen. Reglen er kopieret 1:1:
//   - første h2, hvis tekst indeholder "frequently asked questions" eller "faq"
//   - derefter søskende-elementer indtil næste h2:
//       h3 eller strong = spørgsmål; p eller ul = svar (som HTML, ligesom innerHTML)
// Eneste forskel: har indlægget allerede sine egne FAQPage-data, laves der ikke et
// ekstra sæt (to sæt på samme side er en fejl hos Google).
import { parseFragment, serialize } from 'parse5';

const tekstIndhold = (n) => n.nodeName === '#text' ? n.value
  : (n.childNodes || []).map(tekstIndhold).join('');

function alleElementer(n, ud = []) {
  for (const c of n.childNodes || []) {
    if (c.tagName) { ud.push(c); alleElementer(c.content || c, ud); }
  }
  return ud;
}

function naesteElement(n) {
  const soeskende = n.parentNode.childNodes;
  for (let i = soeskende.indexOf(n) + 1; i < soeskende.length; i++) if (soeskende[i].tagName) return soeskende[i];
  return null;
}

export function faqSchema(html) {
  if (/"@type"\s*:\s*"FAQPage"/.test(html)) return null;
  const rod = parseFragment(html);
  const h2 = alleElementer(rod).filter((e) => e.tagName === 'h2');
  const faq = h2.find((h) => { const t = tekstIndhold(h).toLowerCase(); return t.includes('frequently asked questions') || t.includes('faq'); });
  if (!faq) return null;
  const spoergsmaal = [];
  const gem = (q, a) => { if (q && a) spoergsmaal.push({ '@type': 'Question', name: q.trim(), acceptedAnswer: { '@type': 'Answer', text: a.trim() } }); };
  let q = '', a = '';
  for (let n = naesteElement(faq); n && n.tagName !== 'h2'; n = naesteElement(n)) {
    if (n.tagName === 'h3' || n.tagName === 'strong') { gem(q, a); q = tekstIndhold(n); a = ''; }
    else if (n.tagName === 'p' || n.tagName === 'ul') { if (q) a += serialize(n) + ' '; }
  }
  gem(q, a);
  return spoergsmaal.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: spoergsmaal } : null;
}
