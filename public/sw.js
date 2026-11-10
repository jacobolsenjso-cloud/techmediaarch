// Service worker for Tech Media Arch-appen (10/11-2026, Jacob: "byg appen ligesom techfeedwatch", trin 1-3).
// Bygget efter techfeedwatchs public/sw.js, men holdt adskilt (egne navne, egen push-tjeneste).
//
// Hvad den gør:
//  1. Sider: netværket ALTID først — læseren får aldrig en forældet artikel, når der er net. Uden net vises
//     en gemt kopi (de sidste 40 sider), ellers offline-siden (/offline).
//  2. Gemte artikler (trin 2): "Save"-knappen beder service workeren lægge artiklen i cachen "tma-gemte",
//     så den kan læses uden net. "Remove" fjerner den igen. Den cache ryddes aldrig ved en ny version.
//  3. Push (trin 3): højst én besked om dagen fra tma-push (se cloudflare/tma-push).
//
// Rører ALDRIG: annoncer, Analytics og andre domæner (kun egne adresser), videoer (/video/ sendes i stykker
// til Safari, se worker/index.js), feeds, sitemap, Markdown og adresser med søgedel — de går urørt til nettet.

// __BUILD_ID__ erstattes af scripts/stamp-sw.mjs efter hvert byg, så hver udgivelse får nye cachenavne, og
// activate rydder de gamle. Sker stemplingen ikke, virker alt stadig — cachen fornyes bare ikke ved udgivelse.
const VERSION = 'tma-__BUILD_ID__';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const IMAGES = `${VERSION}-img`;
const FONTS = `${VERSION}-font`;
const GEMTE = 'tma-gemte'; // UDEN version: læserens gemte artikler skal overleve nye udgivelser
const OFFLINE_URL = '/offline';
const MAX_PAGES = 40;
const MAX_IMAGES = 300;
const MAX_GEMTE_FILER = 1500; // gemte artikler + deres billeder (Read later har højst 100 artikler)

// Et svar med redirected: true må ikke gives til en navigation (browseren viser så en fejlside).
// Derfor bygges svaret om, før det gemmes — samme fund som på techfeedwatch.
async function gemRent(cacheName, key, response) {
  const ren = new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
  const cache = await caches.open(cacheName);
  await cache.put(key, ren);
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    for (const sti of [OFFLINE_URL, '/icon-192.png', '/logo.svg']) {
      try { const r = await fetch(sti, { cache: 'reload' }); if (r.ok) await gemRent(SHELL, sti, r); } catch { /* prøves igen ved næste version */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== GEMTE && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      // Navigation preload: siden hentes fra nettet SAMTIDIG med, at service workeren vågner (sparede
      // 50-180 ms pr. sideskift på techfeedwatch, målt 18/10). Mangler den i browseren, hentes som før.
      .then(() => self.registration.navigationPreload && self.registration.navigationPreload.enable())
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

// Sider, der må gemmes som nødkopi
function maaGemmes(url) {
  if (url.search) return false;
  return !/^\/(api|video|feeds|sitemap|rss|search-index|feed-data|llms)/.test(url.pathname) && !url.pathname.endsWith('.md') && !url.pathname.endsWith('.xml');
}

// Nødplanen uden net: nøjagtig adresse, adresse uden søgedel (appens start_url har ?utm_…), så offline-siden
async function udenNet(request, url) {
  const hit = (await caches.match(request)) || (await caches.match(url.pathname, { ignoreSearch: true }))
    || (await caches.match(url.pathname.replace(/\/$/, '') || '/', { ignoreSearch: true }));
  if (hit) return hit;
  return (await caches.match(OFFLINE_URL)) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // annoncer, Analytics, YouTube: urørt
  if (url.pathname.startsWith('/video/')) return;  // videoer sendes i stykker (Range) — aldrig gennem cachen

  if (request.mode === 'navigate') {
    if (event.preloadResponse) event.waitUntil(event.preloadResponse.catch(() => {}));
    event.respondWith((async () => {
      try {
        const forhaand = event.preloadResponse ? await event.preloadResponse.catch(() => null) : null;
        const frisk = forhaand || await fetch(request);
        if (frisk.ok && maaGemmes(url)) {
          // Gemmes under den endelige adresse (efter en evt. omdirigering)
          // Kopierne laves STRAKS: når svaret er givet til browseren, kan det ikke kopieres mere
          const tilSider = frisk.clone(), tilGemte = frisk.clone();
          event.waitUntil(gemRent(PAGES, frisk.url, tilSider).then(() => trim(PAGES, MAX_PAGES)).catch(() => {}));
          // En gemt artikel fornyes, hver gang den åbnes med net
          event.waitUntil(caches.open(GEMTE).then((c) => c.match(url.pathname)).then((g) => (g ? gemRent(GEMTE, url.pathname, tilGemte) : tilGemte.body?.cancel())).catch(() => {}));
        }
        return frisk;
      } catch {
        return udenNet(request, url);
      }
    })());
    return;
  }

  // Skrifter fra byggeriet (/_astro/…woff2) har fingeraftryk i navnet og ændrer sig aldrig: cachen først
  if (request.destination === 'font' && url.pathname.startsWith('/_astro/')) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const r = await fetch(request);
      if (r.ok) { const k = r.clone(); event.waitUntil(caches.open(FONTS).then((c) => c.put(request, k)).then(() => trim(FONTS, 30)).catch(() => {})); }
      return r;
    })());
    return;
  }

  // Egne billeder: den gemte kopi vises straks, og en frisk udgave hentes i baggrunden til næste gang
  // (som techfeedwatch 17/10: ellers blev et udskiftet billede under samme adresse aldrig fornyet).
  if (request.destination === 'image') {
    let gemt = Promise.resolve();
    const hent = fetch(request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const kopi = res.clone();
        gemt = caches.open(IMAGES).then((c) => c.put(request, kopi)).then(() => trim(IMAGES, MAX_IMAGES)).catch(() => {});
      }
      return res;
    });
    event.waitUntil(hent.then(() => gemt, () => {}));
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      try { return await hent; } catch { return Response.error(); }
    })());
  }
});

// ---- Trin 2: gemte artikler til offline-læsning ----
// Siden sender { type: 'gem', href, billeder } ved "Save" og { type: 'fjern', href } ved "Remove".
// billeder = de billedfiler, browseren FAKTISK viste på siden (img.currentSrc), så der ikke hentes alle
// størrelser i srcset. Kun egne adresser accepteres. Svar sendes tilbage, så knappen kan skrive "Saved offline".
const egenSti = (s) => typeof s === 'string' && /^\/[^/]/.test(s) && !s.startsWith('/video/');

async function gemArtikel(href, billeder) {
  const cache = await caches.open(GEMTE);
  const r = await fetch(href, { cache: 'no-cache' });
  if (!r.ok) return false;
  await gemRent(GEMTE, href, r);
  for (const b of (Array.isArray(billeder) ? billeder : []).slice(0, 12)) {
    try {
      const u = new URL(b, self.location.origin);
      if (u.origin !== self.location.origin || !egenSti(u.pathname)) continue;
      if (await cache.match(u.href)) continue;
      const br = await fetch(u.href);
      if (br.ok) await cache.put(u.href, br);
    } catch { /* et manglende billede stopper ikke resten */ }
  }
  // Loft: ældste filer ud, hvis lageret er vokset for meget (normalt aldrig — Read later har højst 100)
  await trim(GEMTE, MAX_GEMTE_FILER);
  return true;
}

// Billederne hører til flere artikler (fx miniaturer): kun selve siden fjernes. Løse billeder ryddes af loftet.
async function fjernArtikel(href) {
  const cache = await caches.open(GEMTE);
  return cache.delete(href);
}

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (!egenSti(d.href) || (d.type !== 'gem' && d.type !== 'fjern')) return;
  const svar = (ok) => { try { event.source && event.source.postMessage({ type: 'tma-gemt', href: d.href, handling: d.type, ok }); } catch { /* fanen er lukket */ } };
  const arbejde = (d.type === 'gem' ? gemArtikel(d.href, d.billeder) : fjernArtikel(d.href)).then((ok) => svar(!!ok), () => svar(false));
  event.waitUntil(arbejde);
});

// ---- Trin 3: push-beskeder (højst én om dagen, fra tma-push — se cloudflare/tma-push) ----
// Beskeden kommer UDEN indhold ("bank på"). Teksten hentes her: id'et er SHA-256 af denne browsers
// push-adresse — samme id, som tma-push gemmer tilmeldingen under. Svigter opslaget, vises en neutral
// besked: en push SKAL vise noget, ellers straffer browseren sitet (og Safari fjerner tilladelsen).
const PUSH_API = 'https://tma-push.jacobolsenjso.workers.dev';
const PUSH_STANDARD = { title: 'Tech Media Arch', body: 'New answers are waiting for you.', url: '/latest?utm_source=push&utm_medium=notification&utm_campaign=daily' };

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let b = PUSH_STANDARD;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const stop = new AbortController();
        const ur = setTimeout(() => stop.abort(), 4000); // Safari: vis straks, ellers mister sitet tilladelsen
        const r = await fetch(`${PUSH_API}/besked?id=${await sha256hex(sub.endpoint)}`, { cache: 'no-store', signal: stop.signal });
        clearTimeout(ur);
        if (r.ok) { const j = await r.json(); if (j && j.title) b = j; }
      }
    } catch { /* neutral besked */ }
    await self.registration.showNotification(b.title, {
      body: b.body, icon: '/icon-192.png', badge: '/icon-monochrome-512.png', tag: 'tma-daily', data: { url: b.url },
    });
    // Kvittering til åbne faner (10/11-2026): så en test kan MÅLE, at beskeden blev vist. getNotifications()
    // viste intet på Windows, selv om beskeden kom frem — måleværktøjet duede ikke, så nu melder service workeren selv.
    const faner = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of faner) f.postMessage({ type: 'tma-push-vist', title: b.title, body: b.body, url: b.url, tid: Date.now() });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Kun adresser på sitet selv — aldrig et andet domæne, selv hvis svaret skulle være forkert
  let url = new URL('/', self.location.origin).href;
  try {
    const u = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
    if (u.origin === self.location.origin) url = u.href;
  } catch { /* forsiden */ }
  event.waitUntil((async () => {
    const vinduer = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of vinduer) if (v.url === url && 'focus' in v) return v.focus();
    return clients.openWindow(url);
  })());
});
