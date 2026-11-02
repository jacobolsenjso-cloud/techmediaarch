// /llms.txt — en kort oversigt i ren tekst til AI-tjenester (ChatGPT, Claude,
// Perplexity m.fl.), efter forslaget på llmstxt.org: hvad sitet er, hylderne og
// alle artikler med én linje hver. Bygges af de samme data som sitemappet, så
// nye robotartikler kommer med af sig selv (Jacobs ønske om LLM-optimering 27/9-2026).
// 1/11-2026: ordnet efter sitets 5 hylder (som /p/sitemap og menuen) i stedet for de
// gamle Blogger-etiketter, hvor fire navne pegede på samme hylde. Svar først, så arkivet.
import { INDLAEG, SIDER } from '../lib/indhold';
import { HYLDER, hyldeUrl, svarIHylde, arkivIHylde, hyldeFor } from '../lib/hylder';
const SITE = 'https://www.techmediaarch.com';
const linje = (t: string) => String(t || '').replace(/\s+/g, ' ').trim();
const punkt = (p: { title: string; href: string; description?: string }) => `- [${linje(p.title)}](${SITE}${p.href}): ${linje(p.description || '')}`;
export function GET() {
  const nyeste = [...INDLAEG].sort((a, b) => +new Date(b.published) - +new Date(a.published));
  const ud: string[] = [
    '# Tech Media Arch',
    '',
    '> Tech Media Arch (techmediaarch.com) is an English-language archive of clear answers to the tech questions people actually ask: AI tools and agents, cybersecurity, building software, marketing and SEO, and everyday tech. Each answer names its sources. Started in July 2024 in Denmark. Founder & Editor: Jacob S. Olsen.',
    '',
    `Articles: ${INDLAEG.length}. Every article has a publication date and, where relevant, a list of sources. Full list of addresses: ${SITE}/sitemap.xml`,
    '',
    '## About',
    ...SIDER.filter((s) => ['about-us', 'editorial-guidelines', 'faq', 'disclosure', 'contact-us'].includes(s.navn)).map(punkt),
    '',
    '## Shelves',
    ...HYLDER.map((h) => `- [${h.navn}](${SITE}${hyldeUrl(h)}): ${linje(h.besk)}`),
  ];
  for (const h of HYLDER) {
    const svar = svarIHylde(h), arkiv = arkivIHylde(h);
    if (!svar.length && !arkiv.length) continue;
    ud.push('', `## ${h.navn}`, ...svar.map(punkt));
    if (arkiv.length) ud.push('', `### ${h.navn}: from the archive`, ...arkiv.map(punkt));
  }
  const rest = nyeste.filter((p) => !hyldeFor(p));
  if (rest.length) ud.push('', '## Optional', ...rest.map(punkt));
  return new Response(ud.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
