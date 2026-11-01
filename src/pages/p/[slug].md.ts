// /p/navn.md — de faste sider (About, Contact, Privacy …) som ren Markdown til AI-agenter (1/11-2026).
// Samme sider som p/[slug].astro; sitemap-siden har sin egen skabelon og er udeladt.
import { SIDER } from '../../lib/indhold';
import { htmlTilMarkdown, markdownSide } from '../../lib/markdown.mjs';

export function getStaticPaths() {
  const UDELAD = new Set(['sitemap']);
  return SIDER.filter((s) => !UDELAD.has(s.navn)).map((s) => ({ params: { slug: s.navn }, props: { s } }));
}

export function GET({ props }: { props: { s: (typeof SIDER)[number] } }) {
  const { s } = props;
  const md = markdownSide({
    title: s.title,
    description: s.description,
    url: `https://www.techmediaarch.com${s.href}`,
  }) + htmlTilMarkdown(s.html);
  return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
}
