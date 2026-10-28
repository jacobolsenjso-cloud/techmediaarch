// /sitemap-pages.xml: forside, faste sider og emnesider (Bloggers havde forside + faste sider).
import { SIDER_UDEN_WATCH as SIDER, iEmne } from '../lib/indhold';
import { EMNER, TYND_GRAENSE, emneUrl, harHylde } from '../lib/emner';
import { HAR_BEDSTE } from '../lib/bedste';
import { HYLDER, hyldeUrl } from '../lib/hylder';
const SITE = 'https://www.techmediaarch.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function GET() {
  // Best of each topic kun når der er tal — ellers er siden tom og noindex
  const urls = ['/', '/latest', '/trending', ...(HAR_BEDSTE ? ['/best-of-each-topic'] : []), ...SIDER.filter((s) => s.navn !== 'techmediaarchcomp404html').map((s) => s.href),
    // Trin 4: de 5 hylder + A–Z; emnesider kun for emner uden hylde (de andre er 301 til hylden)
    ...HYLDER.map(hyldeUrl), '/a-z',
    ...EMNER.filter((e) => !harHylde(e) && iEmne(e).length >= TYND_GRAENSE).map(emneUrl)];
  const body = urls.map((u) => `<url><loc>${esc(SITE + u)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
