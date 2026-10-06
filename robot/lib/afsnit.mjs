// Korte afsnit (Jacob 5/10-2026, med TV 2 som forbillede): højst 3 sætninger og ca. 40 ord pr. afsnit.
// delAfsnit(html) deler for lange <p> MELLEM sætninger. Ingen ord ændres, kun hvor afsnittet knækker,
// så de ældre artikler stadig bevises ord for ord mod Blogger (scripts/tjek-site.mjs).
// Bruges af robotten (artikel.mjs) og af robot/ud/_del-afsnit.mjs på de udgivne artikler.
export const MAKS_SAETNINGER = 3;
// 40 ord ≈ 6 linjer på mobil (43 tegn/linje, målt 5/10). Første forsøg med 55 gav stadig 9 linjer.
export const MAKS_ORD = 40;
// To sætninger må stå sammen op til 55 ord (6/10, forslag C): med 40 kunne to sætninger på 20+ ord aldrig
// stå sammen, så 75 % af de delte robotafsnit blev én sætning (målt 6/10, _afsnit-varianter.mjs).
export const MAKS_ORD_TO = 55;

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
    const loft = cur.length === 1 ? MAKS_ORD_TO : MAKS_ORD; // 2. sætning: op til 55 ord; 3. sætning: op til 40
    if (cur.length && (cur.length >= MAKS_SAETNINGER || n + ord(d.html) > loft)) { grp.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) grp.push(cur);
  return grp;
}

// Skal afsnittet deles? (bruges også af målinger)
// For langt = over 3 sætninger, eller 3 sætninger over 40 ord, eller 2 sætninger over 55 ord. Én sætning kan ikke deles.
const forLangtTal = (n, w) => n > MAKS_SAETNINGER || (n === MAKS_SAETNINGER && w > MAKS_ORD) || (n === 2 && w > MAKS_ORD_TO);
export function forLangt(indre) { const s = saetninger(indre); const n = s ? s.length : 1; return forLangtTal(n, ord(indre)); }

// Deler alle for lange <p> i html. FAQ-afsnit (fra en overskrift med "FAQ"/"Frequently Asked" til næste <h2>)
// røres ikke, fordi FAQ-boksen og FAQ-dataene bygger på svaret som ét afsnit.
export function delAfsnit(html) {
  let delt = 0;
  const faqStart = (() => { const m = String(html).match(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Frequently Asked Questions)/i); return m ? m.index : -1; })();
  const faqSlut = faqStart < 0 ? -1 : (() => { const r = String(html).slice(faqStart + 4).search(/<h2\b/i); return r < 0 ? html.length : faqStart + 4 + r; })();
  const ud = String(html).replace(/<p(\s[^>]*)?>((?:(?!<\/?p[\s>])[\s\S])*?)<\/p>/gi, (hel, attr = '', indre, pos) => {
    if (faqStart >= 0 && pos > faqStart && pos < faqSlut) return hel;
    const dele = saetninger(indre);
    if (!dele || dele.length < 2 || !forLangtTal(dele.length, ord(indre))) return hel;
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

// Fjerner afsnit uden for FAQ, der ordret gentager et tidligere afsnit (målt 5/10: prøveartikel #23
// havde 2 afsnit, der stod ens i to afsnit af artiklen). Sammenligner synlig tekst uden tags og tegnsætning.
// Returnerer også, hvor mange afsnit der er én sætning, så loggen viser, om teksten er blevet hakket.
export function fjernGentagelser(html) {
  const faqStart = (() => { const m = String(html).match(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Frequently Asked Questions)/i); return m ? m.index : -1; })();
  const faqSlut = faqStart < 0 ? -1 : (() => { const r = String(html).slice(faqStart + 4).search(/<h2\b/i); return r < 0 ? html.length : faqStart + 4 + r; })();
  const set = new Set(); let fjernet = 0, afsnit = 0, enSaetning = 0;
  const norm = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase().replace(/[^a-z0-9$%]+/g, ' ').trim();
  const ud = String(html).replace(/<p(\s[^>]*)?>((?:(?!<\/?p[\s>])[\s\S])*?)<\/p>/gi, (hel, attr, indre, pos) => {
    if (faqStart >= 0 && pos > faqStart && pos < faqSlut) return hel;
    const n = norm(indre);
    if (n.split(' ').length >= 6 && set.has(n)) { fjernet++; return ''; }
    set.add(n); afsnit++;
    const s = saetninger(indre); if (s && s.length === 1) enSaetning++;
    return hel;
  });
  return { html: ud, fjernet, afsnit, enSaetning };
}

// --- Fyldsætninger (Jacob 5/10-2026) -----------------------------------------
// Prøve #24 havde sætninger, der intet siger ("Corporate executives depend on both disciplines ...").
// Gemini udpeger dem i artikel.mjs; her findes de sætninger, der MÅ fjernes, og de fjernes uden at
// noget omskrives. Kun brødtekst før FAQ, ikke første afsnit (det korte svar), ikke lister. Sætninger
// med HTML (links, fed), tal, eller som slutter med ":" (indleder en liste) røres aldrig.
function kropAfsnit(html) {
  const faqPos = String(html).search(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Frequently Asked Questions)/i);
  const alle = [...String(html).matchAll(/<p\b[^>]*>((?:(?!<\/?p[\s>])[\s\S])*?)<\/p>/gi)].filter((m) => faqPos < 0 || m.index < faqPos);
  return alle.slice(1); // første afsnit = det korte svar
}
const delSaetninger = (indre) => indre.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter(Boolean);
export function fyldKandidater(html) {
  const ud = [];
  for (const m of kropAfsnit(html)) for (const s of delSaetninger(m[1])) if (!/[<>\d]/.test(s) && !/:\s*$/.test(s) && s.split(/\s+/).length >= 5 && !ud.includes(s)) ud.push(s);
  return ud;
}
export function antalKropSaetninger(html) { return kropAfsnit(html).reduce((n, m) => n + delSaetninger(m[1]).length, 0); }
// Fjerner de givne sætninger (højst maks), ét afsnit ad gangen; et afsnit, der bliver tomt, fjernes helt.
export function fjernSaetninger(html, liste, maks) {
  let ud = String(html), fjernet = 0;
  for (const m of kropAfsnit(ud)) {
    const dele = delSaetninger(m[1]); const behold = [];
    for (const s of dele) { if (fjernet < maks && liste.includes(s)) fjernet++; else behold.push(s); }
    if (behold.length === dele.length) continue;
    const aabn = m[0].match(/^<p\b[^>]*>/i)[0];
    ud = ud.replace(m[0], () => (behold.length ? `${aabn}${behold.join(' ')}</p>` : ''));
  }
  return { html: ud, fjernet };
}

// --- Saml enkeltsætninger (Jacob 6/10-2026) -----------------------------------
// Prøve #29: 25 af 50 afsnit var én sætning — Gemini skriver dem selv, og fyldtjekket efterlader en
// enkelt sætning, når det fjerner den anden. To afsnit på én sætning, der står LIGE efter hinanden
// (samme afsnit i artiklen, ingen overskrift/liste imellem), samles til ét, når de tilsammen holder
// regel C (højst MAKS_ORD_TO ord). Ingen ord ændres. Første afsnit (det korte svar) og FAQ røres ikke.
const enSaetning = (indre) => { const s = saetninger(indre); return !!s && s.length === 1 && /[.!?]["”’)]?\s*$/.test(indre.replace(/<[^>]+>/g, '')); };
export function samlEnkelte(html) {
  const s = String(html);
  const faqPos = s.search(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:FAQ|Frequently Asked Questions)/i);
  const dele = s.split(/(<p\b[^>]*>(?:(?!<\/?p[\s>])[\s\S])*?<\/p>)/i); // ulige pladser = <p>-blokke
  const ud = []; let pos = 0, foerste = true, samlet = 0;
  for (let i = 0; i < dele.length; i++) {
    const d = dele[i];
    if (i % 2 === 1 && !foerste && (faqPos < 0 || pos < faqPos) && i + 2 < dele.length && /^\s*$/.test(dele[i + 1])) {
      const naeste = dele[i + 2];
      const a = d.match(/^<p(\s[^>]*)?>([\s\S]*)<\/p>$/i), b = naeste.match(/^<p(\s[^>]*)?>([\s\S]*)<\/p>$/i);
      const ialt = pos + d.length + dele[i + 1].length + naeste.length;
      if (a && b && (a[1] || '') === (b[1] || '') && (faqPos < 0 || ialt <= faqPos) && enSaetning(a[2]) && enSaetning(b[2])
        && !/:\s*$/.test(a[2].replace(/<[^>]+>/g, '')) && ord(a[2]) + ord(b[2]) <= MAKS_ORD_TO) {
        ud.push(`<p${a[1] || ''}>${a[2].trim()} ${b[2].trim()}</p>`); samlet++;
        pos = ialt; i += 2; continue;
      }
    }
    if (i % 2 === 1) foerste = false;
    ud.push(d); pos += d.length;
  }
  return { html: ud.join(''), samlet };
}
