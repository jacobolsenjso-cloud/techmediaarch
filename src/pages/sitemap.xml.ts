// /sitemap.xml: alle artikler — samme adresse som Bloggers, så Search Console
// kan blive ved med at læse den indsendte sitemap. lastmod er artiklens egen dato.
import { INDLAEG } from '../lib/indhold';
const SITE = 'https://www.techmediaarch.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function GET() {
  const body = INDLAEG.map((p) => `<url><loc>${esc(SITE + p.href)}</loc><lastmod>${new Date(p.updated).toISOString()}</lastmod></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
