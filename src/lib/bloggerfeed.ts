// Poster i Bloggers eget JSON-feed-format.
//
// Hvorfor: Watch- og Sitemap-siden er skrevet til Blogger og henter deres data fra
// /feeds/posts/... med JavaScript. I stedet for at skrive de to sider om, svarer
// workeren på de samme adresser med de samme data i samme format — så sidernes
// egen kode kører uændret, og de ser ud og opfører sig som før.
// Adresser gemmes relative; workeren gør dem absolutte med domænet, der spørges fra.
import { INDLAEG, SIDER, type Indlaeg } from './indhold';

const tekst = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function post(p: Indlaeg, medIndhold: boolean) {
  return {
    id: { $t: `tag:blogger.com,1999:blog-427886895467585040.post-${p.bloggerId}` },
    published: { $t: p.published },
    updated: { $t: p.updated },
    category: p.labels.map((term) => ({ scheme: 'http://www.blogger.com/atom/ns#', term })),
    title: { type: 'text', $t: p.title },
    ...(medIndhold ? { content: { type: 'html', $t: p.feedHtml } } : { summary: { type: 'text', $t: tekst(p.feedHtml).slice(0, 400) } }),
    link: [{ rel: 'alternate', type: 'text/html', href: p.href, title: p.title }],
    author: [{ name: { $t: 'Techmediaarch.com' } }],
  };
}

export const feedMedIndhold = (label?: string) =>
  INDLAEG.filter((p) => !label || p.labels.includes(label)).map((p) => post(p, true));
export const feedResume = () => INDLAEG.map((p) => post(p, false));
export const feedSider = () => SIDER.map((s) => ({
  id: { $t: `tag:blogger.com,1999:blog-427886895467585040.page-${s.bloggerId}` },
  published: { $t: s.published }, updated: { $t: s.updated },
  title: { type: 'text', $t: s.title },
  content: { type: 'html', $t: s.feedHtml },
  link: [{ rel: 'alternate', type: 'text/html', href: s.href, title: s.title }],
  author: [{ name: { $t: 'Techmediaarch.com' } }],
}));
