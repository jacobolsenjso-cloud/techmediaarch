// "People also ask" under hver artikel (29/9, Jacobs ønske): op til 3 spørgsmål, der er BESVARET på sitet —
// de andre artiklers egne FAQ-spørgsmål og robottens Google-spørgsmål (keyword). Hvert spørgsmål linker til
// den artikel, der besvarer det. Højst ét spørgsmål pr. artikel, så de peger forskellige steder hen.
//
// Relevans (2. udgave 29/9, efter gennemlæsning af hele listen): fælles ord vægtes efter hvor SJÆLDNE de er
// på sitet (IDF — et ord i få artikler siger mere end "AI" eller "Google", som står i næsten alle). Et spørgsmål
// skal nå en minimumsscore; hellere 2 gode end 3, hvor ét er skævt. Spørgsmål, der ikke giver mening uden
// deres egen artikel ("How might this transformation…", "the platform …"), og tidsbundne spørgsmål
// ("current stock price today") bruges ikke.
import { somSporgsmaal } from './sporgsmaal.mjs';

const STOP = new Set(('the and for are but not you your with from that this what which who whom how why when where does did can could should would will '
  + 'into about than then them they their there these those have has had was were been being its it\'s our out all any more most some such only own same '
  + 'also just very too via per using use used vs versus between difference best top new guide explained complete ultimate full review reviews '
  + 'is a an of to in on or be by as at do if so no up we us my me i 2023 2024 2025 2026 way ways thing things need know get make '
  + 'key main major first like work works help helps many much one two three why\'s whats '
  // 4. udgave 29/9: almindelige ord, der gav skæve match mellem artikler om noget helt andet
  + 'benefit benefits impact improve improves support offer offers feature features company companies user users customer customers '
  + 'experience experiences business businesses small large change changes plan plans public value percentage increase warning expert experts '
  + 'option options kind type role important able provide provides allow allows create build start started future world people time year years '
  + 'better good great real simple easy free important common different specific other others likely might may').split(/\s+/));
const stamme = (w) => w.replace(/ies$/, 'y').replace(/(ing|ed|es)$/, (m, _, pos, s) => (s.length > 5 ? '' : m)).replace(/s$/, (m, pos, s) => (s.length > 4 ? '' : m));
export const kerne = (t) => [...new Set(String(t || '').toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').replace(/[’']s\b/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter((w) => w.length >= 3 && !STOP.has(w)).map(stamme))];

const ENT = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”' };
const rens = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, (m) => ENT[m.toLowerCase()] ?? ' ').replace(/\s+/g, ' ').trim()
  .replace(/^(?:\d+[.)]\s*|q\d*\s*[:.]\s*)/i, '');

// Spørgsmål, der kun giver mening inde i deres egen artikel, eller som bliver forældede
const AFHAENGIG = /\b(this|these|those|here|above|below|mentioned|the (platform|project|tool|app|video|course|workflow|study|report|survey|author|creator|company|article|guide|speaker|presenter|host|new platform|process|method|system|setup|step|template))\b/i;
const TIDSBUNDEN = /\b(current|currently|today|now|this (week|month|year)|latest|recent|recently|stock price|share price)\b/i;
const brugbar = (q) => q.endsWith('?') && q.length >= 12 && q.length <= 95 && !AFHAENGIG.test(q) && !TIDSBUNDEN.test(q);

// Artiklens FAQ-spørgsmål, som de står i den færdige FAQ-boks (<details class="faq-item"><summary>…)
export function faqSpoergsmaal(html) {
  const ud = [];
  for (const m of String(html).matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary>/g)) ud.push(rens(m[1]));
  return ud;
}

let PULJE = null, IDF = null;
function forbered(alle) {
  if (PULJE) return;
  PULJE = alle.map((a) => {
    const qs = [];
    if (a.robot && a.keyword) qs.push({ q: somSporgsmaal(a.keyword), hoved: true });
    for (const q of faqSpoergsmaal(a.html)) if (brugbar(q)) qs.push({ q, hoved: false });
    return { a, qs: qs.map((x) => ({ ...x, ord: kerne(x.q) })) };
  });
  // Hvor mange artikler bruger ordet (titel + søgeord + FAQ-spørgsmål)? Sjældne ord vægter mest.
  const df = new Map();
  for (const a of alle) for (const w of new Set(kerne(`${a.title} ${a.keyword || ''} ${faqSpoergsmaal(a.html).join(' ')}`))) df.set(w, (df.get(w) || 0) + 1);
  IDF = (w) => Math.log(alle.length / (df.get(w) || 1));
}

export const MIN_SCORE = 4.0; // mindst 2 fælles kerneord, tilsammen så sjældne som ét ord i ~3 artikler
export const STAERK = 6.0;    // stærkt match: gælder også uden fælles ord i titlen

// Kandidater til Gemini (29/9, Jacobs valg): samme ordsammenligning, men løsere — mindst 1 fælles kerneord,
// ingen minimumsscore — så Gemini har ~20 spørgsmål at vælge de bedste 3 imellem. Gemini vælger KUN fra listen.
export function kandidater(p, alle, antal = 20) {
  forbered(alle);
  const mål = new Set(kerne(`${p.title} ${p.keyword || ''} ${p.description || ''} ${faqSpoergsmaal(p.html).join(' ')}`));
  const titelOrd = new Set(kerne(`${p.title} ${p.keyword || ''}`));
  const egne = new Set(faqSpoergsmaal(p.html).map((q) => q.toLowerCase()));
  const ud = [];
  for (const { a, qs } of PULJE) {
    if (a.href === p.href) continue;
    let bedst = null;
    for (const x of qs) {
      if (egne.has(x.q.toLowerCase())) continue;
      const faelles = x.ord.filter((w) => mål.has(w));
      if (!faelles.length) continue;
      const score = faelles.reduce((s, w) => s + IDF(w) * (titelOrd.has(w) ? 1.5 : 1), 0);
      if (!bedst || score > bedst.score) bedst = { q: x.q, href: a.href, titel: a.title, score };
    }
    if (bedst) ud.push(bedst);
  }
  const set = new Set();
  return ud.sort((x, y) => y.score - x.score).filter((k) => { const n = k.q.toLowerCase(); if (set.has(n)) return false; set.add(n); return true; }).slice(0, antal);
}

// Returnerer op til `antal` { q, href, farve } for artiklen p
export function ogsaaSpurgt(p, alle, antal = 3) {
  forbered(alle);
  // Artiklen beskrives af titel, søgeord, beskrivelse og egne FAQ-spørgsmål; et spørgsmål skal dele mindst 2 kerneord
  // (3. udgave 29/9: ét fælles ord gav skæve match i en anden betydning, fx "voice mode" -> "airplane mode")
  const mål = new Set(kerne(`${p.title} ${p.keyword || ''} ${p.description || ''} ${faqSpoergsmaal(p.html).join(' ')}`));
  const titelOrd = new Set(kerne(`${p.title} ${p.keyword || ''}`));
  const emne = p.emner[0]?.slug;
  const egne = new Set(faqSpoergsmaal(p.html).map((q) => q.toLowerCase()));
  const kandidater = [];
  for (const { a, qs } of PULJE) {
    if (a.href === p.href) continue;
    let bedst = null;
    for (const x of qs) {
      if (egne.has(x.q.toLowerCase())) continue;
      const faelles = x.ord.filter((w) => mål.has(w));
      if (faelles.length < 2) continue;
      const score = faelles.reduce((s, w) => s + IDF(w), 0) + (a.emner[0]?.slug === emne ? 0.8 : 0) + (x.hoved ? 0.3 : 0);
      if (score < MIN_SCORE) continue;
      // Deler spørgsmålet intet ord med artiklens titel/søgeord, skal matchet være stærkt (5. udgave 29/9: svage match
      // kun gennem FAQ-ord gav fx Taco Bell -> Apple; at kræve titelord for ALLE gav 42 artikler uden spørgsmål)
      if (!faelles.some((w) => titelOrd.has(w)) && score < STAERK) continue;
      if (!bedst || score > bedst.score) bedst = { q: x.q, href: a.href, farve: a.emner[0]?.farve || '#0891b2', score, dato: new Date(a.published).getTime() };
    }
    if (bedst) kandidater.push(bedst);
  }
  kandidater.sort((x, y) => y.score - x.score || y.dato - x.dato);
  const set = new Set(); const ud = [];
  for (const k of kandidater) { const n = k.q.toLowerCase(); if (set.has(n)) continue; set.add(n); ud.push(k); if (ud.length === antal) break; }
  return ud;
}
