// PDF-kilder (Jacob 9/11-2026, rettelse 4: "og 4 hvis det er … gør dig umage").
//
// Målt 9/11: hver artikel mistede 12-17 kilder, mange af dem PDF'er fra officielle steder (gao.gov, arxiv.org,
// csrc.nist.gov, stanford.edu), fordi kildekontrollen kun godtog HTML ("svarer ikke med en side (ikke HTML
// (application/pdf))"). Derfor stod der ofte "Officielle kilder: ingen". Nu læses PDF'ens tekst med unpdf (ren
// JavaScript, ingen programmer at installere), så både kildekontrollen (robot/lib/links.mjs) og talvagten
// (robot/lib/talvagt.mjs) kan bruge den som en almindelig side.
//
// Grænser, så en kæmpe-PDF ikke stopper robotten: højst 15 MB, højst 40 sider, højst 400.000 tegn. En PDF uden tekst
// (skannet billede) afvises som før.
import { getDocumentProxy, extractText } from 'unpdf';

export const PDF_MAKS_BYTES = 15 * 1024 * 1024;
export const PDF_MAKS_SIDER = 40;

export const erPdf = (res, url = '') => /application\/pdf/i.test(res?.headers?.get?.('content-type') || '') || /\.pdf(\?|#|$)/i.test(String(url));

// Titel: PDF'ens egen titel, hvis den er brugbar; ellers første fornuftige linje i teksten.
function godTitel(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s.length < 8 || s.length > 200) return '';
  if (/^(microsoft (word|powerpoint)|untitled|document\d*|slide \d+)\b|\.(docx?|pptx?|indd|tex|pdf)$/i.test(s)) return '';
  return s;
}

// Titlen fra forsiden: første rigtige linje; ender den på et bindeord ("… Addressing the"), fortsætter titlen på næste
// linje (målt 9/11 på arxiv.org/pdf/2304.03271: "Making AI Less “Thirsty”: Uncovering and Addressing the" + "Secret
// Water Footprint of AI Models"). Stempler som "arXiv:2304.03271v5" og sidetal springes over.
export function forsideTitel(tekst) {
  const linjer = String(tekst).split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^(arxiv:|page \d|\d+$|doi:|https?:\/\/)/i.test(l)).slice(0, 6);
  let t = linjer[0] || '';
  for (let i = 1; i < linjer.length && /\b(the|and|of|for|to|in|on|a|an|with|from|by|at|or|vs\.?)$|[:–—-]$/i.test(t) && (t + ' ' + linjer[i]).length <= 180; i++) t += ' ' + linjer[i];
  return godTitel(t);
}

// buf: ArrayBuffer/Uint8Array. Returnerer { titel, tekst, sider } eller { fejl }.
export async function pdfTekst(buf) {
  try {
    const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (data.byteLength > PDF_MAKS_BYTES) return { fejl: `PDF for stor (${Math.round(data.byteLength / 1048576)} MB)` };
    const pdf = await getDocumentProxy(data);
    const sider = pdf.numPages;
    let tekst = '';
    for (let i = 1; i <= Math.min(sider, PDF_MAKS_SIDER) && tekst.length < 400000; i++) {
      const side = await pdf.getPage(i);
      const indhold = await side.getTextContent();
      // Linjeskift, hvor PDF'en selv har dem (hasEOL) — så titlen kan findes som de første linjer
      tekst += indhold.items.map((x) => (x.str || '') + (x.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    tekst = tekst.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 400000);
    if (tekst.replace(/\s/g, '').length < 200) return { fejl: 'PDF uden læsbar tekst' };
    let titel = '';
    try { const m = await pdf.getMetadata(); titel = godTitel(m?.info?.Title); } catch { /* ingen metadata */ }
    if (!titel) titel = forsideTitel(tekst);
    return { titel, tekst, sider };
  } catch (e) { return { fejl: `PDF kunne ikke læses (${String(e.message || e).slice(0, 60)})` }; }
}

// Kun bruges i tests: extractText fra unpdf (samme bibliotek), så testen også fanger en ændret API.
export const _extractText = extractText;
