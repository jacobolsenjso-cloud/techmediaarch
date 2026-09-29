// /llms.txt — en kort oversigt i ren tekst til AI-tjenester (ChatGPT, Claude,
// Perplexity m.fl.), efter forslaget på llmstxt.org: hvad sitet er, emnerne og
// alle artikler med én linje hver. Bygges af de samme data som sitemappet, så
// nye robotartikler kommer med af sig selv (Jacobs ønske om LLM-optimering 27/9-2026).
import { INDLAEG, SIDER } from '../lib/indhold';
import { KATEGORIER, emneUrl } from '../lib/emner';
const SITE = 'https://www.techmediaarch.com';
const linje = (t: string) => String(t || '').replace(/\s+/g, ' ').trim();
export function GET() {
  const nyeste = [...INDLAEG].sort((a, b) => +new Date(b.published) - +new Date(a.published));
  const ud: string[] = [
    '# Tech Media Arch',
    '',
    '> Tech Media Arch (techmediaarch.com) is an English-language blog about artificial intelligence, technology, software development, data, cybersecurity, fintech and crypto. Articles explain how things work and what changes mean, in plain language. Founder, editor and author: Jacob Olsen.',
    '',
    `Articles: ${INDLAEG.length}. Every article has a publication date and, where relevant, a list of sources. Full list of addresses: ${SITE}/sitemap.xml`,
    '',
    '## About',
    ...SIDER.filter((s) => ['about-us', 'start-here', 'faq', 'disclosure', 'contact-us'].includes(s.navn)).map((s) => `- [${linje(s.title)}](${SITE}${s.href}): ${linje(s.description)}`),
    '',
    '## Topics',
    ...KATEGORIER.map((e) => `- [${e.navn}](${SITE}${emneUrl(e)})`),
  ];
  const brugt = new Set<string>();
  for (const e of KATEGORIER) {
    const liste = nyeste.filter((p) => !brugt.has(p.href) && p.emner.some((x) => x.slug === e.slug));
    if (!liste.length) continue;
    ud.push('', `## ${e.navn}`);
    for (const p of liste) { brugt.add(p.href); ud.push(`- [${linje(p.title)}](${SITE}${p.href}): ${linje(p.description)}`); }
  }
  const rest = nyeste.filter((p) => !brugt.has(p.href));
  if (rest.length) { ud.push('', '## Optional', ...rest.map((p) => `- [${linje(p.title)}](${SITE}${p.href}): ${linje(p.description)}`)); }
  return new Response(ud.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
