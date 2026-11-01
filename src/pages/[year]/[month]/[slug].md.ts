// /2026/10/navn.md — artiklen som ren Markdown til AI-agenter (1/11-2026, Jacobs ja).
// Workeren sender denne fil, når en AI beder om siden med "Accept: text/markdown";
// almindelige besøgende og Google får stadig HTML-siden. Se worker/index.js og src/lib/markdown.mjs.
import { INDLAEG } from '../../../lib/indhold';
import { hyldeFor } from '../../../lib/hylder';
import { htmlTilMarkdown, markdownSide } from '../../../lib/markdown.mjs';

export function getStaticPaths() {
  return INDLAEG.map((p) => ({ params: { year: p.aar, month: p.maaned, slug: p.navn }, props: { p } }));
}

export function GET({ props }: { props: { p: (typeof INDLAEG)[number] } }) {
  const { p } = props;
  const md = markdownSide({
    title: p.title,
    description: p.description,
    url: `https://www.techmediaarch.com${p.href}`,
    published: p.published,
    updated: p.updated,
    hylde: hyldeFor(p)?.navn,
  }) + htmlTilMarkdown(p.html);
  return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
}
