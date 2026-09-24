// Worker foran de statiske filer.
//
// Cloudflare kører kun denne kode, når en adresse IKKE svarer til en fil i dist/
// (html_handling "none" i wrangler.jsonc). Artikler, sider, billeder og CSS
// serveres altså direkte og hurtigt; workeren tager sig kun af resten:
//   1. "/" og mapper      -> index.html (Workers gør det ikke selv med html_handling "none")
//   2. Bloggers gamle adresser (etiketter, søgning, feeds, arkiver) -> 301 til den nye
//   3. robots.txt          -> lukket på testadressen, åben på det rigtige domæne
//   4. alt andet           -> 404-siden med status 404
const PROD = 'www.techmediaarch.com';

// Blogger-menuens emner -> ny emneside. Skal matche src/lib/emner.ts.
const EMNER = {
  ai: 'ai', tech: 'tech', data: 'data', devops: 'devops', dev: 'dev', it: 'it',
  design: 'design', marketing: 'marketing', product: 'product', fintech: 'fintech',
  crypto: 'crypto', web3: 'web3', infosec: 'infosec', vlog: 'vlog',
};

function robots(host) {
  if (host !== PROD) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Disallow: /search',
    'Allow: /',
    '',
    `Sitemap: https://${PROD}/sitemap.xml`,
    `Sitemap: https://${PROD}/sitemap-pages.xml`,
    '',
  ].join('\n');
}

// Testadressen må aldrig komme i Googles indeks.
function medRobotsHeader(res, host) {
  if (host === PROD) return res;
  const ny = new Response(res.body, res);
  ny.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return ny;
}

const flyt = (url, sti) => Response.redirect(new URL(sti, url).toString(), 301);

async function haandter(request, env) {
  const url = new URL(request.url);
  const host = url.hostname;
  let sti = url.pathname;
  try { sti = decodeURIComponent(url.pathname); } catch (e) { /* ugyldig kodning: brug stien som den er */ }

  // Domænet uden www sendes til www, som Blogger også gjorde
  if (host === 'techmediaarch.com') return Response.redirect(`https://${PROD}${url.pathname}${url.search}`, 301);

  if (sti === '/robots.txt') {
    return new Response(robots(host), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // Forsiden og mapper
  if (sti === '/' || sti.endsWith('/')) {
    const index = await env.ASSETS.fetch(new Request(new URL(url.pathname + 'index.html', url), request));
    if (index.status === 200) return index;
  }

  // --- Bloggers gamle adresser ---
  // Etiketsider: /search/label/AI -> /topic/ai.html (kun menuens emner har en side)
  const label = sti.match(/^\/search\/label\/([^/?]+)/);
  if (label) {
    const slug = EMNER[label[1].toLowerCase()];
    return flyt(url, slug ? `/topic/${slug}.html` : '/');
  }
  // Søgning: /search?q=x -> /search.html?q=x ; /search uden ord -> forsiden
  if (sti === '/search' || sti.startsWith('/search/')) {
    const q = url.searchParams.get('q');
    return flyt(url, q ? `/search.html?q=${encodeURIComponent(q)}` : '/');
  }
  // Feeds: /feeds/posts/default (også med ?alt=rss osv.) -> /rss.xml
  if (sti.startsWith('/feeds/')) return flyt(url, '/rss.xml');
  // Månedsarkiver: /2024/10/ eller /2024/ -> forsiden
  if (/^\/\d{4}(\/\d{2})?\/?$/.test(sti)) return flyt(url, '/');

  // Ukendt adresse: vis 404-siden med den rigtige statuskode
  const side404 = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request));
  return new Response(side404.body, { status: 404, headers: side404.headers });
}

export default {
  async fetch(request, env) {
    const res = await haandter(request, env);
    return medRobotsHeader(res, new URL(request.url).hostname);
  },
};
