// Worker foran de statiske filer.
//
// Cloudflare kører kun denne kode, når en adresse IKKE svarer til en fil i dist/
// (html_handling "none" i wrangler.jsonc). Artikler, sider, billeder og CSS
// serveres altså direkte og hurtigt; workeren tager sig kun af resten:
//   1. "/" og mapper      -> index.html (Workers gør det ikke selv med html_handling "none")
//   2. Bloggers gamle adresser (etiketter, søgning, feeds, arkiver) -> 301 til den nye
//   3. robots.txt          -> lukket på testadressen, åben på det rigtige domæne
//   4. alt andet           -> 404-siden med status 404
// Undtagelse: /video/* går ALTID gennem workeren (run_worker_first), så den kan
// sende videoen i stykker til Safari — se video() nedenfor.
const PROD = 'www.techmediaarch.com';

// Blogger-menuens emner -> ny emneside. Skal matche src/lib/emner.ts.
const EMNER = {
  ai: 'ai', tech: 'tech', data: 'data', devops: 'devops', dev: 'dev', it: 'it',
  design: 'design', marketing: 'marketing', product: 'product', fintech: 'fintech',
  crypto: 'crypto', web3: 'web3', infosec: 'infosec', vlog: 'vlog', resources: 'resources',
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

// Videoer (/video/*): Cloudflares statiske filer svarer altid med HELE filen (200), også
// når browseren kun beder om et stykke ("Range: bytes=0-1"). Safari på iPhone/Mac
// afspiller kun video, hvis serveren kan sende stykker (206 Partial Content) — målt
// 25/9: www svarede 200 på Range. Derfor sendes /video/* gennem workeren
// (run_worker_first i wrangler.jsonc), som skærer det ønskede stykke ud.
async function video(request, env) {
  const hel = await env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
  if (hel.status !== 200) return hel;
  const headers = new Headers(hel.headers);
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range');
  const tom = request.method === 'HEAD';
  if (!range) return new Response(tom ? null : hel.body, { status: 200, headers });
  const data = await hel.arrayBuffer();
  const n = data.byteLength;
  const m = range.match(/^bytes=(\d*)-(\d*)$/);
  let start = -1, slut = -1;
  if (m && m[1] !== '') { start = Number(m[1]); slut = m[2] === '' ? n - 1 : Math.min(Number(m[2]), n - 1); }
  else if (m && m[2] !== '') { start = Math.max(0, n - Number(m[2])); slut = n - 1; } // "bytes=-500" = de sidste 500
  if (start < 0 || start >= n || start > slut) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${n}` } });
  }
  headers.set('Content-Range', `bytes ${start}-${slut}/${n}`);
  headers.set('Content-Length', String(slut - start + 1));
  return new Response(tom ? null : data.slice(start, slut + 1), { status: 206, headers });
}

async function haandter(request, env) {
  const url = new URL(request.url);
  const host = url.hostname;
  let sti = url.pathname;
  try { sti = decodeURIComponent(url.pathname); } catch (e) { /* ugyldig kodning: brug stien som den er */ }

  // Domænet uden www sendes til www, som Blogger også gjorde
  if (host === 'techmediaarch.com') return Response.redirect(`https://${PROD}${url.pathname}${url.search}`, 301);

  // Findes videoen ikke, fortsætter vi ned til den almindelige 404-side
  if (sti.startsWith('/video/')) {
    const v = await video(request, env);
    if (v.status !== 404) return v;
  }

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
  // Søgning: /search?q=x -> /search.html?q=x ; /search uden ord -> /trending.html
  // (på Blogger viste /search de nyeste indlæg — menupunkterne "Trending" og "Feed")
  if (sti === '/search' || sti.startsWith('/search/')) {
    const q = url.searchParams.get('q');
    return flyt(url, q ? `/search.html?q=${encodeURIComponent(q)}` : '/trending.html');
  }
  // Feeds: JSON-udgaven (alt=json / alt=json-in-script) efterlignes, så Watch- og
  // Sitemap-siden virker uændret. Alt andet (feedlæsere, alt=rss) -> /rss.xml.
  if (sti.startsWith('/feeds/')) {
    const alt = url.searchParams.get('alt') || '';
    if (alt === 'json' || alt === 'json-in-script') return bloggerFeed(url, sti, alt, env, request);
    return flyt(url, '/rss.xml');
  }
  // Månedsarkiver: /2024/10/ eller /2024/ -> forsiden
  if (/^\/\d{4}(\/\d{2})?\/?$/.test(sti)) return flyt(url, '/');

  // Ukendt adresse: vis 404-siden med den rigtige statuskode
  const side404 = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request));
  return new Response(side404.body, { status: 404, headers: side404.headers });
}


// ---- Efterligning af Bloggers JSON-feed ----
// Understøtter det, sidernes kode faktisk bruger: /feeds/posts/default, /feeds/posts/summary,
// /feeds/pages/default, etiket-stien /-/Etiket, start-index, max-results og JSONP (callback).
// Data er genereret ved buildet (src/pages/feed-data/*.json.ts).
async function hentData(env, request, fil) {
  const r = await env.ASSETS.fetch(new Request(new URL(fil, request.url), request));
  return r.ok ? r.json() : [];
}
async function bloggerFeed(url, sti, alt, env, request) {
  const m = sti.match(/^\/feeds\/(posts|pages)\/(default|summary)(?:\/-\/(.+?))?\/?$/);
  if (!m) return new Response('Not found', { status: 404 });
  const [, type, visning, label] = m;
  let poster;
  if (type === 'pages') poster = await hentData(env, request, '/feed-data/pages.json');
  else if (label && label.toLowerCase() === 'video' && visning === 'default') poster = await hentData(env, request, '/feed-data/label-video.json');
  else {
    // Øvrige etiketter og /posts/default uden etiket: uden brødtekst (for store til at sende hele)
    poster = await hentData(env, request, '/feed-data/posts-summary.json');
    if (label) poster = poster.filter((p) => (p.category || []).some((c) => c.term === label));
  }
  const start = Math.max(1, parseInt(url.searchParams.get('start-index') || '1', 10) || 1);
  const antal = Math.min(500, Math.max(1, parseInt(url.searchParams.get('max-results') || '25', 10) || 25));
  const origin = url.origin;
  const udsnit = poster.slice(start - 1, start - 1 + antal).map((p) => ({
    ...p, link: (p.link || []).map((l) => ({ ...l, href: l.href.startsWith('/') ? origin + l.href : l.href })),
  }));
  const data = { version: '1.0', encoding: 'UTF-8', feed: {
    'openSearch$totalResults': { $t: String(poster.length) },
    'openSearch$startIndex': { $t: String(start) },
    'openSearch$itemsPerPage': { $t: String(antal) },
    entry: udsnit,
  } };
  const json = JSON.stringify(data);
  const cb = url.searchParams.get('callback');
  if (alt === 'json-in-script' && cb && /^[\w.$]+$/.test(cb)) {
    return new Response(`// API callback\n${cb}(${json});`, { headers: { 'content-type': 'text/javascript; charset=UTF-8' } });
  }
  return new Response(json, { headers: { 'content-type': 'application/json; charset=UTF-8', 'access-control-allow-origin': '*' } });
}

export default {
  async fetch(request, env) {
    const res = await haandter(request, env);
    return medRobotsHeader(res, new URL(request.url).hostname);
  },
};
