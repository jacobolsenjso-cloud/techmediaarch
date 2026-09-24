// RSS-feed. Bloggers /feeds/posts/default sendes hertil af workeren, så
// eksisterende abonnenter fortsætter.
import rss from '@astrojs/rss';
import { INDLAEG } from '../lib/indhold';
export function GET(context: any) {
  return rss({
    title: 'Tech Media Arch',
    description: 'Tech and AI blog with news, trends, and easy guides on artificial intelligence, tech innovation, and the impact of technology on everyday life.',
    site: context.site,
    items: INDLAEG.slice(0, 50).map((p) => ({ title: p.title, link: p.href, pubDate: new Date(p.published), description: p.description })),
    customData: '<language>en</language>',
  });
}
