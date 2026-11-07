// RSS-feed. Bloggers /feeds/posts/default sendes hertil af workeren, så
// eksisterende abonnenter fortsætter.
//
// Billede pr. artikel (7/11-2026, til Pinterest): Pinterest laver kun pins af feed-punkter med et billede (<media:content>,
// <enclosure> eller <image>), og feedet havde ingen (0 af 50). Vi bruger artiklens delebillede — det samme som og:image på
// artikelsiden (mærkekopien i /images/m/). <media:content> kræver ingen filstørrelse (det gør <enclosure>), og mærkekopien
// laves først efter bygningen. Artikler uden billede får intet.
import rss from '@astrojs/rss';
import { INDLAEG } from '../lib/indhold';
import { maerketBillede } from '../lib/temakoder.mjs';

const SITE = 'https://www.techmediaarch.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function billede(src?: string) {
  if (!src || !src.startsWith('/images/')) return undefined;
  return `<media:content url="${esc(SITE + maerketBillede(src))}" medium="image" />`;
}

export function GET(context: any) {
  return rss({
    title: 'Tech Media Arch',
    description: 'Tech and AI blog with news, trends, and easy guides on artificial intelligence, tech innovation, and the impact of technology on everyday life.',
    site: context.site,
    xmlns: { media: 'http://search.yahoo.com/mrss/' },
    items: INDLAEG.slice(0, 50).map((p) => ({ title: p.title, link: p.href, pubDate: new Date(p.published), description: p.description, customData: billede(p.image) })),
    customData: '<language>en</language>',
    // Adresserne er uden .html og uden "/" til sidst (29/9-2026) — ellers sætter @astrojs/rss "/" på,
    // og Cloudflare sender /navn/ videre til /navn med en omvej
    trailingSlash: false,
  });
}
