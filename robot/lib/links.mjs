// Eksterne links: kun kilder, Gemini faktisk brugte (Google-søgningen), og kun
// når siden svarer live. Afvisningslisterne er kopieret fra techfeedwatch
// (src/lib/eksterne-links.mjs), hvor de er målt i drift: ingen forkortere,
// ingen sociale medier/butikker, ingen affiliate-links, højst ét pr. domæne.
const UA = 'techmediaarch-robot/1.0 (+https://www.techmediaarch.com)';
const FORKORTERE = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|is\.gd|amzn\.to|geni\.us|linktr\.ee|lnk\.to|bitdefend\.me|shorturl\.at|tiny\.cc|rb\.gy|s\.id|bl\.ink|dub\.sh|shor\.by|smarturl\.it|hyperurl\.co|kit\.co|beacons\.ai|stan\.store|bio\.link)$/i;
const PLATFORME = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.com|fb\.me|twitter\.com|x\.com|tiktok\.com|linkedin\.com|discord\.gg|discord\.com|patreon\.com|t\.me|telegram\.me|whatsapp\.com|reddit\.com|threads\.net|spotify\.com|podcasts\.apple\.com|snapchat\.com|twitch\.tv|gumroad\.com|amazon\.[a-z.]+|etsy\.com|ko-fi\.com|buymeacoffee\.com|calendly\.com|skool\.com|kajabi\.com|teachable\.com|systeme\.io|whop\.com|techmediaarch\.com|docs\.google\.com|drive\.google\.com|forms\.gle|quora\.com|medium\.com|pinterest\.com)$/i;
const AFFILIATE_URL = /[?&](ref|referral|aff|affiliate|affid|partner|via|fpr|sscid|irclickid|clickid|coupon|promo|discount|tag|campaign_id)=|\/(ref|go|r|aff|affiliate|partners?|refer|coupon|deal|deals|promo)\//i;

const hovedNavn = (host) => { const d = host.toLowerCase().replace(/^www\./, '').split('.'); return d.length > 2 ? d.slice(-2).join('.') : d.join('.'); };
const ren = (u) => { const url = new URL(u); for (const k of [...url.searchParams.keys()]) if (/^utm_|^(si|fbclid|gclid|mc_[a-z]+)$/i.test(k)) url.searchParams.delete(k); url.hash = ''; return url.toString(); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Følg Googles omdirigering til den rigtige side; kræv 200 + HTML + en titel.
async function hent(u, timeoutMs = 10000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html' } });
    if (res.status !== 200 || !/text\/html/i.test(res.headers.get('content-type') || '')) return null;
    const html = (await res.text()).slice(0, 300000);
    const titel = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();
    return titel ? { url: res.url, titel } : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Kilder fra Gemini → højst `max` kontrollerede links. Returnerer { sat, afvist }.
export async function kontrollerKilder(kilder, max = 4) {
  const sat = []; const afvist = []; const domaener = new Set();
  for (const k of kilder) {
    if (sat.length >= max) break;
    const s = await hent(k.uri);
    if (!s) { afvist.push({ kilde: k.titel, grund: 'svarer ikke med en side' }); continue; }
    let url; try { url = ren(s.url); } catch { afvist.push({ kilde: k.titel, grund: 'ugyldig adresse' }); continue; }
    const host = new URL(url).hostname;
    if (FORKORTERE.test(host) || PLATFORME.test(host)) { afvist.push({ kilde: host, grund: 'forkorter/platform' }); continue; }
    if (AFFILIATE_URL.test(url)) { afvist.push({ kilde: host, grund: 'affiliate' }); continue; }
    const dom = hovedNavn(host);
    if (domaener.has(dom)) { afvist.push({ kilde: host, grund: 'domæne brugt' }); continue; }
    domaener.add(dom);
    sat.push({ url, titel: s.titel.slice(0, 110) });
  }
  return { sat, afvist };
}

export function kildeliste(sat) {
  if (!sat.length) return '';
  return `<h2>Sources</h2><ul>${sat.map((k) => `<li><a href="${esc(k.url)}" rel="noopener" target="_blank">${esc(k.titel)}</a></li>`).join('')}</ul>`;
}
