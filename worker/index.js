// Worker foran de statiske filer.
//
// Adresserne er UDEN .html (Jacob 29/9-2026): /2026/05/navn serveres fra navn.html af
// Cloudflare selv (html_handling "drop-trailing-slash" i wrangler.jsonc). Billeder, CSS og
// sider uden .html serveres altså direkte og hurtigt; workeren tager sig kun af resten:
//   1. Gamle .html-adresser (alle Bloggers) -> 301 til samme adresse uden .html.
//      Cloudflare ville selv svare 307 ("midlertidigt"); Google skal have 301 ("permanent").
//      Derfor går *.html altid gennem workeren først (run_worker_first).
//   2. Bloggers øvrige gamle adresser (etiketter, søgning, feeds, arkiver) -> 301 til den nye
//   3. robots.txt          -> lukket på testadressen, åben på det rigtige domæne
//   4. alt andet           -> 404-siden med status 404
// /video/* går også gennem workeren (run_worker_first), så den kan sende videoen i
// stykker til Safari — se video() nedenfor.
const PROD = 'www.techmediaarch.com';
import { SLETTEDE } from './slettede.js';
import { NEDLAGTE } from './nedlagte.js';

// "/2026/05/navn.html" -> "/2026/05/navn"; "/index.html" -> "/" (samme regel som src/lib/adresse.mjs)
const udenHtml = (sti) => sti.replace(/\/index\.html$/, '/').replace(/\.html$/, '');

// Blogger-menuens emner -> ny emneside. Skal matche src/lib/emner.ts.
const EMNER = {
  ai: 'ai', tech: 'tech', data: 'data', devops: 'devops', dev: 'dev', it: 'it',
  design: 'design', marketing: 'marketing', product: 'product', fintech: 'fintech',
  crypto: 'crypto', web3: 'web3', infosec: 'infosec', vlog: 'vlog', resources: 'resources',
};

// Svar-arkivets hylder: fra 1/11-2026 har INTET emne en egen side mere — alle /topic/<emne> sendes med 301 til en hylde.
// Skal matche EMNESIDE_TIL_HYLDE i src/lib/adresse.mjs (de 10 emner fra trin 4 + fintech, crypto, web3, vlog, resources).
const HYLDE_FOR_EMNE = {
  ai: 'ai', infosec: 'cybersecurity',
  dev: 'software', devops: 'software', product: 'software', data: 'software',
  marketing: 'marketing', design: 'marketing',
  tech: 'everyday-tech', it: 'everyday-tech',
  fintech: 'everyday-tech', crypto: 'everyday-tech', web3: 'ai', vlog: 'ai', resources: 'marketing',
};
const nyEmneAdresse = (slug) => (HYLDE_FOR_EMNE[slug] ? `/shelf/${HYLDE_FOR_EMNE[slug]}` : `/topic/${slug}`);

function robots(host) {
  if (host !== PROD) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    // Content Signals (Jacobs valg 1/11-2026 kl. 22:11): må vises i søgning, citeres i AI-svar OG bruges
    // til træning. Grunden: Google bruger samme regel (Google-Extended) til træning og til at Gemini-appen
    // henter tekst til sine svar — at blokere træning ville koste citater i Gemini. Skal stemme med
    // Cloudflare → Security → Settings → "AI Crawler and Agent access policies" (Training = Allow).
    // Se contentsignals.org. Cloudflare Agent Readiness tjekker linjen.
    'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
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

// ---- AI-agenter (1/11-2026, Jacobs ja; Cloudflare Agent Readiness) ----
// 1. Markdown: beder en AI om en side med "Accept: text/markdown", får den artiklen som ren tekst
//    (/…/navn.md, bygget af src/pages/…/[slug].md.ts) og forsiden som /llms.txt. Browsere og Google
//    sender ikke det ønske og får HTML som altid. Markdown-svarene er noindex og peger på HTML-siden
//    som den rigtige (canonical), så Google ikke ser dem som dubletter.
// 2. Link-headers (RFC 8288) på HTML-siderne: fortæller robotter, hvor llms.txt, sitemap, RSS og
//    sidens Markdown-udgave ligger, uden at de skal læse HTML'en først.
// Derfor går forsiden, artiklerne (/20…), de faste sider (/p/…) og *.md gennem workeren først
// (run_worker_first i wrangler.jsonc). Billeder, CSS og skrifter går stadig direkte.
const vilMarkdown = (request) => /\btext\/markdown\b/i.test(request.headers.get('Accept') || '');
const erArtikel = (sti) => /^\/\d{4}\/\d{2}\/[^/]+$/.test(sti);
const erFastSide = (sti) => /^\/p\/[^/]+$/.test(sti);
// Hvilken Markdown-fil hører til en HTML-adresse (null = ingen)
function markdownFor(sti) {
  const s = sti.length > 1 ? sti.replace(/\/$/, '') : sti;
  if (s === '/') return '/llms.txt';
  if (erArtikel(s) || (erFastSide(s) && s !== '/p/sitemap')) return s + '.md';
  return null;
}
async function markdownSvar(url, mdSti, htmlSti, env, head) {
  const r = await env.ASSETS.fetch(new Request(new URL(mdSti, url), { method: 'GET' }));
  if (r.status !== 200) { await r.body?.cancel(); return null; }
  const headers = new Headers();
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('vary', 'Accept');
  headers.set('x-robots-tag', 'noindex');
  headers.set('link', `<https://${PROD}${htmlSti}>; rel="canonical"; type="text/html"`);
  headers.set('cache-control', 'public, max-age=3600');
  return new Response(head ? null : r.body, { status: 200, headers });
}
function linkHeader(sti) {
  const md = markdownFor(sti);
  return [
    md ? `<${md}>; rel="alternate"; type="text/markdown"` : null,
    '</llms.txt>; rel="describedby"; type="text/markdown"',
    '</sitemap.xml>; rel="sitemap"; type="application/xml"',
    '</rss.xml>; rel="alternate"; type="application/rss+xml"',
  ].filter(Boolean).join(', ');
}
function medLinks(res, sti) {
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  const ny = new Response(res.body, res);
  ny.headers.set('link', linkHeader(sti));
  ny.headers.append('vary', 'Accept');
  return ny;
}

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

  // AI-agenter: Markdown-udgaven, når den bedes om (se øverst), og selve .md-filerne
  const head = request.method === 'HEAD';
  if (sti.endsWith('.md')) {
    const m = await markdownSvar(url, sti, sti.slice(0, -3), env, head);
    if (m) return m;
  } else if (vilMarkdown(request) && !sti.endsWith('.html')) {
    const mdSti = markdownFor(sti);
    const m = mdSti && await markdownSvar(url, mdSti, sti.length > 1 ? sti.replace(/\/$/, '') : '/', env, head);
    if (m) return m;
  }

  // Emnesider (alle fra 1/11-2026): /topic/ai og /topic/ai.html -> /shelf/ai (301, ét hop)
  const emneSide = sti.match(/^\/topic\/([A-Za-z0-9-]+?)(?:\.html)?\/?$/);
  if (emneSide && HYLDE_FOR_EMNE[emneSide[1].toLowerCase()]) return flyt(url, nyEmneAdresse(emneSide[1].toLowerCase()));

  // Nedlagte faste sider (worker/nedlagte.js, fx Watch i trin 5): med og uden .html -> målet (301, ét hop)
  const nedlagt = NEDLAGTE[sti.replace(/\/$/, '').replace(/\.html$/, '')];
  if (nedlagt) return flyt(url, nedlagt);

  // Slettede artikler (worker/slettede.js): 301 til nærmeste levende artikel — både den
  // gamle .html-adresse og den nye uden
  if (SLETTEDE[sti]) return flyt(url, SLETTEDE[sti]);
  if (SLETTEDE[sti + '.html']) return flyt(url, SLETTEDE[sti + '.html']);

  // Gamle .html-adresser -> samme adresse uden .html (301), hvis siden findes.
  // Søgedelen (?m=1 fra Bloggers mobilvisning, ?q= på søgesiden) følger med.
  if (sti.endsWith('.html') && sti !== '/404.html') {
    const ny = udenHtml(url.pathname);
    const findes = await env.ASSETS.fetch(new Request(new URL(ny, url), { method: 'GET' }));
    await findes.body?.cancel();
    if (findes.status === 200) return flyt(url, ny + url.search);
  } else {
    // Sikkerhedsnet: når en adresse uden .html alligevel workeren først, serveres filen
    const fil = await env.ASSETS.fetch(request);
    if (fil.status !== 404) return fil.status === 200 ? medLinks(fil, sti) : fil;
  }

  // --- Bloggers gamle adresser ---
  // Etiketsider: /search/label/AI -> hylden (kun menuens emner; andre etiketter -> forsiden); direkte, uden mellemhop
  const label = sti.match(/^\/search\/label\/([^/?]+)/);
  if (label) {
    const slug = EMNER[label[1].toLowerCase()];
    return flyt(url, slug ? nyEmneAdresse(slug) : '/');
  }
  // Søgning: /search?q=x er nu selve søgesiden (search.html serveres direkte som /search).
  // Andre /search/…-adresser fra Blogger -> /latest (på Blogger viste de de nyeste indlæg; 30/9: Trending er nu "mest læste")
  if (sti.startsWith('/search/')) return flyt(url, '/latest');
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
  // ("/404" - med drop-trailing-slash ville "/404.html" give en omdirigering)
  // 5/10-2026: ny Request uden den oprindelige krop. Med `request` som skabelon gav POST (sårbarhedsscannere,
  // fx /login og /vendor/phpunit/…) fejlen "ReadableStream is disturbed" og svar 500, fordi kroppen allerede
  // var læst ovenfor (env.ASSETS.fetch(request)). Målt i Cloudflare Observability: 12 sådanne fejl 4/10.
  const side404 = await env.ASSETS.fetch(new Request(new URL('/404', url), { method: request.method === 'HEAD' ? 'HEAD' : 'GET' }));
  return new Response(side404.body, { status: 404, headers: side404.headers });
}


// ---- Efterligning af Bloggers JSON-feed ----
// Understøtter det, sidernes kode faktisk bruger: /feeds/posts/default, /feeds/posts/summary,
// /feeds/pages/default, etiket-stien /-/Etiket, start-index, max-results og JSONP (callback).
// Data er genereret ved buildet (src/pages/feed-data/*.json.ts).
async function hentData(env, request, fil) {
  const r = await env.ASSETS.fetch(new Request(new URL(fil, request.url), { method: 'GET' }));   // 5/10: uden krop, se 404 ovenfor
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
