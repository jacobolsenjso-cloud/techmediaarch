// Indlæser indlæg og faste sider fra src/content.
//
// Filerne er "frontmatter + HTML", ikke markdown: indholdet er flyttet ordret
// fra Blogger (se scripts/konverter.mjs). Derfor læses de rå og vises med
// set:html i stedet for at gå gennem Astros markdown-motor, som ville kunne
// ændre i HTML'en.
import { parse } from 'yaml';
import { EMNER, emneEtiket, type Emne } from './emner';
import { temaKoder, youtubeLazy, vandmaerke, bloggerVideo } from './temakoder.mjs';
import { faqBoks } from './faqboks.mjs';
import { interneLinks } from './adresse.mjs';

export interface Indlaeg {
  aar: string; maaned: string; navn: string;
  sti: string;         // /2024/10/navn — Bloggers adresse uden .html (29/9-2026), uden kodning
  href: string;        // samme sti, kodet til brug i links (mellemrum -> %20)
  title: string; description: string;
  seoTitle: string;     // kort søgetitel til <title> (højst ~600 px i Google), ellers = title
  published: string; updated: string;
  labels: string[]; emner: Emne[];
  image: string | null;
  bloggerId: string;
  robot: boolean;       // skrevet af robotten (frontmatter "robot: true") — styrer teksten i forfatterboksen
  html: string;
  feedHtml: string;     // indholdet som i Blogger-eksporten (kun Blogger-videoer peger på vores kopi) — til /feeds/-svarene
  faqHtml: string;      // indholdet før vandmærket — FAQ-data laves af det (som på Blogger)
  overskrifter: { niveau: number; tekst: string; id: string }[];
  minutter: number;
  faqEkstra: { q: string; a: string }[]; // ekstra FAQ-spørgsmål fra frontmatter "faq:" (vises nederst i boksen)
  faqStatus: string;    // 'boks' | 'uroert' | 'ny' | 'ingen' — se faqboks.mjs
  faqEgne: number;      // antal af artiklens egne FAQ-spørgsmål, der står i boksen
}
export interface Side {
  navn: string; sti: string; href: string;
  title: string; description: string; published: string; updated: string; html: string; feedHtml: string; faqHtml: string; bloggerId: string;
}

function del(raa: string) {
  const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('Mangler frontmatter');
  return { data: parse(m[1]) as any, body: m[2] };
}

const tilId = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'afsnit';

// Overskrifternes niveauer uden spring (LLM-/SEO-gennemgangen 27/9-2026, Jacobs ok):
// siden har selv <h1> (titlen), så teksten skal starte på h2 og aldrig springe et
// niveau over. Målt: 146 artikler sprang, 114 af dem fordi "Key Takeaways" stod som
// h3 før første h2 (Blogger-indhold). Kun tag-navnet ændres — aldrig et ord.
//  1. Ingen h2 i teksten: alle overskrifter rykkes op, så den højeste bliver h2.
//  2. Overskrifter før første h2, der er dybere end h2, bliver h2.
//  3. Resten: et spring (fx h2 → h4) rettes til ét niveau under den forrige.
function udenSpring(html: string) {
  const niv = [...html.matchAll(/<h([2-6])[\s>]/gi)].map((m) => Number(m[1]));
  if (!niv.length) return html;
  const ingenH2 = !niv.includes(2);
  const ryk = ingenH2 ? Math.min(...niv) - 2 : 0;
  let forrige = 1; let foerH2 = !ingenH2;
  return html.replace(/<(\/?)h([2-6])(\s[^>]*)?>/gi, (hel, slut, n, attrs = '') => {
    if (slut) return hel; // sluttags rettes nedenfor, så de passer til starttagget
    let ny = Number(n) - ryk;
    if (foerH2) { if (Number(n) === 2) foerH2 = false; else ny = 2; }
    if (ny > forrige + 1) ny = forrige + 1;
    forrige = ny;
    return `<h${ny}${attrs} data-h="${n}">`;
  }).replace(/<h([2-6])([^>]*) data-h="(\d)">([\s\S]*?)<\/h\3>/gi, (hel, ny, attrs, gl, indre) => `<h${ny}${attrs}>${indre}</h${ny}>`);
}

// Giver h2/h3 et id (hvis de mangler) og samler dem til indholdsfortegnelsen.
function overskrifter(html: string) {
  const liste: Indlaeg['overskrifter'] = [];
  const brugt = new Set<string>();
  const ny = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (hel, n, attrs = '', indre) => {
    const tekst = indre.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (!tekst) return hel;
    const eksisterende = (attrs.match(/\sid=["']([^"']+)["']/) || [])[1];
    let id = eksisterende || tilId(tekst);
    if (!eksisterende) { let i = 2; const base = id; while (brugt.has(id)) id = `${base}-${i++}`; }
    brugt.add(id);
    liste.push({ niveau: Number(n), tekst, id });
    return eksisterende ? hel : `<h${n}${attrs} id="${id}">${indre}</h${n}>`;
  });
  return { html: ny, liste };
}

const minutter = (html: string) =>
  Math.max(1, Math.round(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 200));

function youtubeBillede(html: string): string | null {
  const m = html.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

const kodet = (sti: string) => sti.split('/').map(encodeURIComponent).join('/');

const postFiler = import.meta.glob('/src/content/posts/*/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const sideFiler = import.meta.glob('/src/content/pages/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const INDLAEG: Indlaeg[] = Object.entries(postFiler).map(([fil, raa]) => {
  const [, aar, maaned, navn] = fil.match(/\/posts\/(\d{4})\/(\d{2})\/(.+)\.md$/)!;
  const { data, body: raaBody } = del(raa);
  // Blogger-temaets genvejskoder ({getButton} m.fl.) og YouTube-rammer vises som på Blogger,
  // og videoer uploadet til Blogger afspilles fra vores egen kopi — se temakoder.mjs
  const body = youtubeLazy(bloggerVideo(temaKoder(raaBody)));
  // Vandmærket på billederne (som Blogger-temaets script) — se temakoder.mjs
  // FAQ-boksen (faqboks.mjs): artiklens egen FAQ foldes ud på stedet + ekstra spørgsmål fra frontmatter "faq:"
  const ekstraFaq: { q: string; a: string }[] = Array.isArray(data.faq) ? data.faq.filter((x: any) => x && x.q && x.a) : [];
  const fb = faqBoks(vandmaerke(body), ekstraFaq);
  // Interne links mister .html (adresse.mjs)
  const { html, liste } = overskrifter(udenSpring(interneLinks(fb.html)));
  const labels: string[] = data.labels || [];
  const sti = `/${aar}/${maaned}/${navn}`;
  return {
    aar, maaned, navn, sti, href: kodet(sti),
    title: data.title, description: data.description || '', seoTitle: data.seoTitle || data.title,
    published: data.published, updated: data.updated || data.published,
    labels, emner: EMNER.filter((e) => labels.includes(emneEtiket(e))),
    // Uden eget billede bruges miniaturen af den første indlejrede YouTube-video
    image: data.image || youtubeBillede(raaBody),
    bloggerId: String(data.bloggerId || ''),
    robot: data.robot === true,
    html, feedHtml: interneLinks(bloggerVideo(raaBody)), faqHtml: body, overskrifter: liste, minutter: minutter(body),
    faqEkstra: ekstraFaq, faqStatus: fb.status, faqEgne: fb.egne,
  };
// Sorteres som tidspunkter, ikke som tekst: datoerne har forskellig tidszone (+01:00/+02:00)
}).sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

export const SIDER: Side[] = Object.entries(sideFiler).map(([fil, raa]) => {
  const navn = fil.match(/\/pages\/(.+)\.md$/)![1];
  const { data, body: raaBody } = del(raa);
  const body = youtubeLazy(bloggerVideo(temaKoder(raaBody)));
  const sti = `/p/${navn}`;
  return { navn, sti, href: kodet(sti), title: data.title, description: data.description || '',
    published: data.published, updated: data.updated || data.published, html: interneLinks(navn === 'watch' ? vandmaerke(body) : udenSpring(vandmaerke(body))), feedHtml: interneLinks(bloggerVideo(raaBody)), faqHtml: body, bloggerId: String(data.bloggerId || '') };
});

export const iEmne = (e: Emne) => INDLAEG.filter((p) => p.emner.some((x) => x.slug === e.slug));

export const datoTekst = (d: string) => {
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Samme udsnits-regel som techfeedwatch: klip på et ord, fjern afsluttende tegn.
export const udsnit = (tekst: string, max = 145) => {
  const s = (tekst || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '').replace(/[.,;:!?—-]+$/, '').trim() + '…';
};
