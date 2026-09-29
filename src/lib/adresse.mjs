// Adresser UDEN .html (Jacobs beslutning 29/9-2026): /2026/05/navn, /p/about-us, /topic/ai.
// Filerne i dist/ hedder stadig navn.html (build.format 'file'); Cloudflare serverer /navn fra
// navn.html (html_handling "drop-trailing-slash" i wrangler.jsonc), og workeren sender de gamle
// Blogger-adresser /navn.html videre med 301 (permanent), så Google og gamle links følger med.

// "/2026/05/navn.html" -> "/2026/05/navn"; "/index.html" -> "/"
export const udenHtml = (sti) => sti.replace(/\/index\.html$/, '/').replace(/\.html$/, '');

// Interne links i artiklernes HTML (flyttet ordret fra Blogger) peger på de gamle .html-adresser.
// De rettes, når siden bygges - selve teksten og filerne i src/content røres ikke.
// Kun links til sitet selv: relative (/…) og https://(www.)techmediaarch.com/…; ikke billeder (kun href).
const INTERN = /(\shref=(["'])(?:https?:\/\/(?:www\.)?techmediaarch\.com)?\/[^"'#?]*?)\.html(?=[#?"'])/gi;
export const interneLinks = (html) => html.replace(INTERN, (m, start, anf) => (/\/index$/.test(start) ? start.slice(0, -5) : start));
