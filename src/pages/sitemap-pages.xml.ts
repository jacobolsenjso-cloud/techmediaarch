// /sitemap-pages.xml: forside, faste sider og hylder (Bloggers havde forside + faste sider). Emnesider findes ikke mere (1/11-2026).
import { SIDER_UDEN_WATCH as SIDER } from '../lib/indhold';
import { HAR_BEDSTE } from '../lib/bedste';
import { HYLDER, hyldeUrl } from '../lib/hylder';
const SITE = 'https://www.techmediaarch.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function GET() {
  // Best of each topic kun når der er tal — ellers er siden tom og noindex
  const urls = ['/', '/latest', '/trending', ...(HAR_BEDSTE ? ['/best-of-each-topic'] : []), ...SIDER.filter((s) => s.navn !== 'techmediaarchcomp404html').map((s) => s.href),
    // De 5 hylder + A–Z (emnesiderne er 301 til hylderne fra 1/11-2026)
    ...HYLDER.map(hyldeUrl), '/a-z'];
  const body = urls.map((u) => `<url><loc>${esc(SITE + u)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
