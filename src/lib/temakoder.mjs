// Blogger-temaets "genvejskoder" i indlæggene.
//
// På Blogger skrev man fx {getButton} $text={Visit Harbor} $color={#0d1eb9} inde i et
// link, og temaets JavaScript lavede det om til en knap, når siden blev vist.
// Selve teksten i indlægget er stadig koden, så vi laver den samme omskrivning her,
// når siden bygges. Indholdsfilerne røres ikke.
//
// Bruges både af siden (src/lib/indhold.ts) og af scripts/tjek-site.mjs, så tjekket
// sammenligner med det, læseren faktisk så på Blogger.
import fs from 'node:fs';
import path from 'node:path';

// Samme opslag som temaets getAttr: find "$navn={værdi}" i teksten.
function hentVaerdi(tekst, navn) {
  const m = tekst.match(new RegExp('\\$' + navn + '=\\{([^}]*)\\}'));
  return m ? m[1].trim() : '';
}

const rensTekst = (html) => html.replace(/<[^>]+>/g, '')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const escTekst = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Lille "åbn link"-ikon (temaet brugte en ikon-skrifttype; her en indlejret tegning)
const IKON = '<svg class="tma-knap-ikon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function temaKoder(html) {
  // 1) {getButton}: linket bliver en knap med teksten fra $text og farven fra $color
  let ud = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (hel, attrs, indre) => {
    const tekst = rensTekst(indre);
    if (!tekst.includes('{getButton}')) return hel;
    const knapTekst = hentVaerdi(tekst, 'text');
    if (!knapTekst) return hel;
    const farve = hentVaerdi(tekst, 'color');
    const ikon = hentVaerdi(tekst, 'icon');
    // Temaets egen stil på linket (skrifttype m.m. fra Google Docs) erstattes af knappens
    const rene = attrs.replace(/\sstyle=("[^"]*"|'[^']*')/i, '').replace(/\sclass=("[^"]*"|'[^']*')/i, '');
    const stil = /^#[0-9a-f]{3,8}$/i.test(farve) ? ` style="background:${farve}"` : '';
    return `<a${rene} class="tma-knap"${stil}>${ikon ? IKON : ''}<span>${escTekst(knapTekst)}</span></a>`;
  });
  // 2) {getToc}: temaet satte sin indholdsfortegnelse ind her. Artikelsiden har sin egen
  //    øverst, så koden (og det link, den står i) fjernes blot.
  ud = ud.replace(/<a\b[^>]*href="\{getToc\}[^"]*"[^>]*>\s*<b>[^<]*\{getToc\}[^<]*<\/b>\s*<\/a>/gi, '');
  ud = ud.replace(/<b>[^<]*\{getToc\}[^<]*<\/b>/gi, '');
  return ud;
}

// Bruges af tjek-site: findes der stadig en rå genvejskode i den færdige side?
export const RAA_KODE = /\{(getButton|getToc|getCard|getLink|getDownload|alert[A-Z]\w*|codeBox|inAds|ads|showAds|nextPage|contactForm)\}/;

// YouTube-videoer: Blogger-temaets script skiftede hver YouTube-ramme ud med et
// billede + afspilknap og hentede først selve YouTube-afspilleren, når man klikkede.
// Det gør siden hurtig (ingen tunge YouTube-filer ved indlæsning) og sætter ingen
// YouTube-cookies, før læseren selv vælger at se videoen. Samme regel her:
// kun rigtige <iframe>-tags med "youtube.com/embed/" i src. Klik-koden ligger i MainLayout.
export function youtubeLazy(html) {
  return html.replace(/<iframe\b[^>]*\ssrc=(["'])([^"']*youtube\.com\/embed\/([^?"'\/]+)[^"']*)\1[^>]*>\s*<\/iframe>/gi, (hel, q, src, id) => {
    if (!/^[\w-]{6,20}$/.test(id)) return hel;
    return `<div class="yt-lazy" data-yt="${id}" style="background-image:url(https://i.ytimg.com/vi_webp/${id}/hqdefault.webp)"><button type="button" class="yt-play-btn" aria-label="Play video"></button></div>`;
  });
}

// Trin 5 i svar-arkivet (Jacob 28/10): YouTube-videoerne tages ud af artiklerne. Det sker her ved
// byggeriet — artikelfilerne i src/content røres ikke, så det kan rulles tilbage ved at bruge youtubeLazy igen.
// Målt 28/10: 151 rammer i 151 artikler (123 i <div data-youtube-video="">), og 45 artikler har
// VideoObject-data om netop den video. Dataene fjernes også: data om en video, der ikke står på siden,
// er vildledende for Google. Et omslag, der kun indeholdt rammen (div/p med evt. &nbsp;), fjernes med,
// så der ikke står et tomt hul i teksten.
const YT_RAMME = /<iframe\b[^>]*\ssrc=(["'])[^"']*(?:youtube(?:-nocookie)?\.com|youtu\.be)[^"']*\1[^>]*>\s*<\/iframe>/gi;
const VIDEO_DATA = /<script\b[^>]*application\/ld\+json[^>]*>(?:(?!<\/script>)[\s\S])*?"@type"\s*:\s*"VideoObject"(?:(?!<\/script>)[\s\S])*?<\/script>/gi;
const MAERKE = '\u0000yt\u0000';
export function udenYoutube(html) {
  return html.replace(YT_RAMME, MAERKE).replace(VIDEO_DATA, '')
    .replace(/<(div|p|center|figure)\b[^>]*>(?:\s|&nbsp;)*\u0000yt\u0000(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '')
    .split(MAERKE).join('');
}
// Links til den nedlagte Watch-side (/p/watch er 301 til forsiden, se worker): et listepunkt, der kun er
// det link, tages ud (målt 28/10: kun "Other places to go" på Start here).
export const udenWatchLink = (html) => html.replace(/<li>\s*<a href="\/p\/watch(?:\.html)?">[^<]*<\/a>\s*<\/li>\s*/gi, '');

// Videoer uploadet direkte til Blogger (ikke YouTube). Blogger viste dem i en ramme fra
// blogger.com/video.g?token=…, som kun virker, så længe Blogger-bloggen findes. Her
// skiftes rammen ud med en almindelig videoafspiller og en kopi af videoen på vores eget
// site (public/video/). Kopien er lavet fra Takeout-eksportens original: 720×1280 i stedet
// for 1080×1920 (7,7 MB i stedet for 45 MB) — målt 0,991 i SSIM (billedlighed, 1 = ens).
// preload="none": intet af videoen hentes, før læseren trykker afspil.
// Ukendte Blogger-videoer lades urørt (så tjek-site finder dem).
const BLOGGER_VIDEOER = {
  'AD6v5dyYEf_opkBGPjqEt44spNuPYCv72X7Ghw7I-tAw8tuVTkGhb8WYl3iUemyQQnYUhZ1TytTpKEJiPuO7bP8TQQ':
    { fil: '/video/tubemagic.mp4', billede: '/video/tubemagic.jpg', bredde: 720, hoejde: 1280 },
};

export function bloggerVideo(html) {
  return html.replace(/<iframe\b[^>]*\ssrc=(["'])https?:\/\/www\.blogger\.com\/video\.g\?token=([\w-]+)\1[^>]*>\s*<\/iframe>/gi, (hel, q, token) => {
    const v = BLOGGER_VIDEOER[token];
    if (!v) return hel;
    return `<video class="tma-video" controls playsinline preload="none" poster="${v.billede}" width="${v.bredde}" height="${v.hoejde}"><source src="${v.fil}" type="video/mp4"></video>`;
  });
}

// Vandmærke på billederne — samme regel som Blogger-temaets script ("STØVSUGEREN" +
// vandmærke), som kørte i browseren, når siden var indlæst:
//   - billeder under 150 px i bredden (tracking-pixels, ikoner) røres ikke
//   - alle andre pakkes ind i en kasse med "TechMediaArch.com" nederst til højre
//   - er billedet et link, fjernes linket (på Blogger kunne man ikke klikke sig
//     til det rå billede uden vandmærke)
// Her sker det, når siden bygges: bredden læses direkte i billedfilen i public/images.

const breddeCache = new Map();
function billedBredde(src) {
  const m = src.match(/^\/images\/([\w.-]+)$/);
  if (!m) return null;
  if (breddeCache.has(m[1])) return breddeCache.get(m[1]);
  let b = null;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', m[1]));
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') b = buf.readUInt32BE(16);
    else if (buf.toString('ascii', 0, 3) === 'GIF') b = buf.readUInt16LE(6);
    else if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const t = buf.toString('ascii', 12, 16);
      if (t === 'VP8 ') b = buf.readUInt16LE(26) & 0x3fff;
      else if (t === 'VP8L') b = 1 + (((buf[22] & 0x3f) << 8) | buf[21]);
      else if (t === 'VP8X') b = 1 + buf.readUIntLE(24, 3);
    } else if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG: find første SOF-markør (C0-CF undtagen C4, C8, CC)
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) { b = buf.readUInt16BE(i + 7); break; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { b = null; }
  breddeCache.set(m[1], b);
  return b;
}

// Et billede får vandmærke, hvis det er 150 px eller bredere (ukendt bredde = ja, som på Blogger)
const faarMaerke = (imgTag) => {
  const src = (imgTag.match(/\ssrc=["']([^"']+)["']/i) || [])[1] || '';
  const b = billedBredde(src);
  return b === null || b >= 150;
};

export const VANDMAERKE_TEKST = 'TechMediaArch.com';

export function vandmaerke(html) {
  // 1) Links rundt om billeder med vandmærke: linket fjernes (href væk, som på Blogger)
  let ud = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (hel, attrs, indre) => {
    const imgs = indre.match(/<img\b[^>]*>/gi) || [];
    if (!imgs.some(faarMaerke)) return hel;
    const uden = attrs.replace(/\shref=("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<a${uden} data-tma-uden-link="">${indre}</a>`;
  });
  // 2) Kassen rundt om hvert billede. Fra 30/10-2026 er vandmærket brændt ind i en kopi af billedfilen
  //    (scripts/vandmaerk-billeder.mjs → /images/m/), så siden peger på kopien og lægger ingen tekst ovenpå.
  //    Kun billeder, der ikke ligger i /images (fx gamle Blogger-adresser), får stadig teksten ovenpå.
  ud = ud.replace(/<img\b[^>]*>/gi, (img) => {
    if (!faarMaerke(img)) return img;
    const src = (img.match(/\ssrc=["']([^"']+)["']/i) || [])[1] || '';
    const m = maerketBillede(src);
    if (m !== src) return `<span class="tma-wm">${img.replace(/(\ssrc=["'])[^"']+/i, `$1${m}`)}</span>`;
    return `<span class="tma-wm">${img}<span class="tma-wm-tekst">${VANDMAERKE_TEKST}</span></span>`;
  });
  return ud;
}

// Adressen på kopien med indbrændt vandmærke for et billede i /images (bredde mindst 150 px og jpg/png/webp
// — samme regel som scripts/vandmaerk-billeder.mjs). Andre adresser returneres uændret.
// Bruges også til delingsbilledet (og:image), så et delt billede bærer vandmærket.
export function maerketBillede(src) {
  const m = String(src || '').match(/^\/images\/([\w.-]+\.(?:jpe?g|png|webp))$/i);
  if (!m) return src;
  const b = billedBredde(src);
  return b !== null && b >= 150 ? `/images/m/${m[1]}` : src;
}
