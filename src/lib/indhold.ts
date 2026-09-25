// Indlæser indlæg og faste sider fra src/content.
//
// Filerne er "frontmatter + HTML", ikke markdown: indholdet er flyttet ordret
// fra Blogger (se scripts/konverter.mjs). Derfor læses de rå og vises med
// set:html i stedet for at gå gennem Astros markdown-motor, som ville kunne
// ændre i HTML'en.
import { parse } from 'yaml';
import { EMNER, type Emne } from './emner';
import { temaKoder, youtubeLazy, vandmaerke, bloggerVideo } from './temakoder.mjs';

export interface Indlaeg {
  aar: string; maaned: string; navn: string;
  sti: string;         // /2024/10/navn.html — som Blogger, uden kodning
  href: string;        // samme sti, kodet til brug i links (mellemrum -> %20)
  title: string; description: string;
  published: string; updated: string;
  labels: string[]; emner: Emne[];
  image: string | null;
  bloggerId: string;
  html: string;
  feedHtml: string;     // indholdet som i Blogger-eksporten (kun Blogger-videoer peger på vores kopi) — til /feeds/-svarene
  faqHtml: string;      // indholdet før vandmærket — FAQ-data laves af det (som på Blogger)
  overskrifter: { niveau: number; tekst: string; id: string }[];
  minutter: number;
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
  const { html, liste } = overskrifter(vandmaerke(body));
  const labels: string[] = data.labels || [];
  const sti = `/${aar}/${maaned}/${navn}.html`;
  return {
    aar, maaned, navn, sti, href: kodet(sti),
    title: data.title, description: data.description || '',
    published: data.published, updated: data.updated || data.published,
    labels, emner: EMNER.filter((e) => labels.includes(e.navn)),
    // Uden eget billede bruges miniaturen af den første indlejrede YouTube-video
    image: data.image || youtubeBillede(raaBody),
    bloggerId: String(data.bloggerId || ''),
    html, feedHtml: bloggerVideo(raaBody), faqHtml: body, overskrifter: liste, minutter: minutter(body),
  };
// Sorteres som tidspunkter, ikke som tekst: datoerne har forskellig tidszone (+01:00/+02:00)
}).sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

export const SIDER: Side[] = Object.entries(sideFiler).map(([fil, raa]) => {
  const navn = fil.match(/\/pages\/(.+)\.md$/)![1];
  const { data, body: raaBody } = del(raa);
  const body = youtubeLazy(bloggerVideo(temaKoder(raaBody)));
  const sti = `/p/${navn}.html`;
  return { navn, sti, href: kodet(sti), title: data.title, description: data.description || '',
    published: data.published, updated: data.updated || data.published, html: vandmaerke(body), feedHtml: bloggerVideo(raaBody), faqHtml: body, bloggerId: String(data.bloggerId || '') };
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
