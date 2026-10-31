// Sæt et link på en frase, der ALLEREDE står i teksten — uden at ændre et ord.
// Samme regel som techfeedwatch (link-forslag.mjs / eksterne-links.mjs):
//  - kun i almindelige afsnit (<p> og <li>), aldrig i overskrifter
//  - aldrig inde i et eksisterende link
//  - kun første forekomst, og frasen skal stå ordret (store/små bogstaver er ligegyldige)
// Returnerer den nye HTML, eller null hvis frasen ikke kunne bruges.
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// passer(blok): valgfri kontrol af afsnittet, fx at det ikke nævner en ANDEN kilde (målt 31/10, prøve #37:
// "Microsoft Q&A notes that Windows 11 Pro …" fik et link til Acemagic).
export function linkIndsaet(html, frase, href, { ekstern = false, passer = null } = {}) {
  const f = String(frase || '').trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (f.split(/\s+/).length < 2 || f.length < 6) return null; // for kort til at være et meningsfuldt link
  if (html.includes(`href="${href}"`)) return null;            // linker allerede dertil
  const re = new RegExp(`(?<![A-Za-z0-9-])${esc(f).replace(/\s+/g, '\\s+')}(?![A-Za-z0-9-])`, 'i');
  const blok = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blok.exec(html))) {
    const indre = m[2];
    if (passer && !passer(indre)) continue;
    // Del op i tags og tekst; spring tekst over, der ligger inde i <a>…</a>.
    const dele = indre.split(/(<[^>]+>)/);
    let iLink = 0;
    for (let i = 0; i < dele.length; i++) {
      const d = dele[i];
      if (d.startsWith('<')) { if (/^<a\b/i.test(d)) iLink++; else if (/^<\/a>/i.test(d)) iLink = Math.max(0, iLink - 1); continue; }
      if (iLink) continue;
      const fund = d.match(re);
      if (!fund) continue;
      const attr = ekstern ? ` rel="noopener" target="_blank"` : '';
      dele[i] = d.slice(0, fund.index) + `<a href="${href}"${attr}>${fund[0]}</a>` + d.slice(fund.index + fund[0].length);
      const nyIndre = dele.join('');
      const start = m.index + m[0].indexOf(indre);
      return html.slice(0, start) + nyIndre + html.slice(start + indre.length);
    }
  }
  return null;
}

// Kontrol: fjernes alle links igen, skal teksten være ord for ord den samme.
export const udenLinks = (h) => h.replace(/<a\b[^>]*>|<\/a>/gi, '');
