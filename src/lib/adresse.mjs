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

// Svar-arkivets hylder (trin 4, 28/10-2026): de gamle emner, der hører til en hylde, har ingen egen side mere.
// /topic/<emne> sendes med 301 til hylden (worker/index.js, samme tabel), og interne links i teksten
// peger direkte på hylden, så læseren ikke får en omvej. Emner uden hylde (fintech, crypto, web3, vlog,
// resources) beholder deres emneside. Skal matche src/lib/hylder.ts og worker/index.js.
export const HYLDE_FOR_EMNE = {
  ai: 'ai', infosec: 'cybersecurity',
  dev: 'software', devops: 'software', product: 'software', data: 'software',
  marketing: 'marketing', design: 'marketing',
  tech: 'everyday-tech', it: 'everyday-tech',
};
const EMNE_LINK = /(\shref=(["'])(?:https?:\/\/(?:www\.)?techmediaarch\.com)?)\/topic\/([A-Za-z0-9-]+)(?=[#?"'])/g;
const tilHylde = (html) => html.replace(EMNE_LINK, (m, start, anf, slug) => {
  const h = HYLDE_FOR_EMNE[slug.toLowerCase()];
  return h ? `${start}/shelf/${h}` : m;
});

export const interneLinks = (html) => tilHylde(html.replace(INTERN, (m, start, anf) => (/\/index$/.test(start) ? start.slice(0, -5) : start)));
