// Sproglige regler for robotartiklerne (Jacob 5/10-2026, forslag 1 og 3).
// Rene funktioner uden net, så de kan afprøves på de udgivne artikler med
// robot/ud/_sprog-tjek.mjs, før robotten bruger dem.

// Det læseren ser: uden scripts og tags.
export const synlig = (h) => String(h).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
export const antalOrd = (h) => synlig(h).split(/\s+/).filter(Boolean).length;

// --- 1. Markdown-rester -------------------------------------------------------
// Gemini skriver af og til markdown midt i HTML. 5/10 stod "**what is phishing
// attack**" synligt tre steder i en udgivet artikel. Stjerner, `kode` og
// [tekst](adresse) fjernes (teksten bliver); er der stadig rester, afvises artiklen.
export const MD_REST = /\*\*|`|\[[^\]]{1,120}\]\((?:https?:|\/)|(?:^|\n)[ \t]{0,3}#{1,6}[ \t]/;
export function rensMarkdown(h) {
  return String(h)
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/\*\*/g, '')
    .replace(/`([^`<>\n]{1,120})`/g, '$1')
    .replace(/\[([^\]<>]{1,120})\]\((?:https?:\/\/|\/)[^)\s]*\)/g, '$1');
}
export const markdownRest = (h) => (synlig(h).match(MD_REST) || [null])[0];

// Fed skrift om et søgeord ligner søgeordsfyld (målt 5/10: "<strong>can phishing
// emails affect iphone</strong>"). Fed skrift pakkes ud; teksten bliver.
const renSoeg = (s) => String(s).toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ').trim();
export function udenFedeSoegeord(h, soegeord) {
  const s = new Set(soegeord.map(renSoeg));
  return String(h).replace(/<(strong|b)>([^<]{1,160})<\/\1>/gi, (hel, _t, t) => (s.has(renSoeg(t)) ? t : hel));
}

// --- 2. Første afsnit ---------------------------------------------------------
// Målt 5/10: første afsnit var 70-113 ord. Det skal være et kort, direkte svar.
export const FOERSTE_MAKS = 60;  // ord; opgaven beder om højst 50, 60 giver lidt luft
export function foersteAfsnit(h) { const m = String(h).match(/<p\b[^>]*>[\s\S]*?<\/p>/i); return m ? m[0] : ''; }

// --- 3. Sætninger, der skal rettes ---------------------------------------------
// Sætninger i <p> og <li> med deres HTML, så en rettelse kan sættes præcis ind igen.
export function saetninger(h) {
  const ud = [];
  for (const m of String(h).matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    for (const s of m[2].split(/(?<=[.!?])\s+(?=[A-Z"“<])/)) if (s.trim()) ud.push(s.trim());
  }
  return ud;
}

// Uklare kilder: "industry experts note", "studies show", "according to reports".
// Målt 5/10: 18 sætninger i 8 af 15 robotartikler. Navngivne kilder er fine ("Microsoft security
// researchers found", "according to IBM"), og "the researchers" peger tilbage på en
// kilde, der allerede er nævnt.
const KVAL = '(?:many|some|most|leading|recent|industry|security|cybersecurity|tech|technology|market|enterprise|independent|various|several|other|top)';
const SUBJ = '(?:experts?|researchers?|analysts?|professionals|specialists|studies|research|reports|surveys|statistics|observers|insiders|sources|authorities)';
const VERB = '(?:say|says|said|note|notes|noted|agree|agrees|warn|warns|suggest|suggests|confirm|confirms|show|shows|indicate|indicates|estimate|estimates|found|have found|point out|points out|believe|believes|argue|argues|point to|points to|emphasize|emphasizes|recommend|recommends|caution|cautions|observe|observes|highlight|highlights|stress|stresses)';
const VAG_SUBJ = new RegExp(`\\b(?:${KVAL}\\s+)*${SUBJ}\\s+(?:(?:widely|consistently|often|generally|frequently|now|also|repeatedly)\\s+)?${VERB}\\b`, 'gi');
const VAG_IFLG = new RegExp(`\\baccording to (?:the\\s+)?(?:${KVAL}\\s+)*(?:${SUBJ}|data|metrics|cost reports|estimates|figures)\\b`, 'gi');
export function uklarKilde(s) {
  const t = synlig(s).replace(/\s+/g, ' ').trim();
  for (const m of t.matchAll(VAG_IFLG)) return m[0];
  for (const m of t.matchAll(VAG_SUBJ)) {
    const foer = t.slice(0, m.index).trim().split(' ').pop() || '';
    if (/^(the|these|those|its|their|his|her|our|whose)$/i.test(foer)) continue;      // peger tilbage
    if (/^[A-Z0-9][\w&.'’-]*$/.test(foer) && !/[.!?:;]$/.test(foer)) continue;          // navngivet: "IBM researchers"
    return m[0];
  }
  return null;
}

// Søgeord klistret ind midt i en sætning: "Understanding what is phishing attack
// methods", "whether is phishing a social engineering attack" (målt 5/10: 24
// sætninger i 9 af 15 robotartikler). Kun søgeord med
// omvendt ordstilling (what is / how does / is / can ...) er forkerte inde i en
// sætning; "why seo is important" eller "how to use" kan stå naturligt. Et
// spørgsmål (sætning med "?") må gerne bruge søgeordet.
const OMVENDT = /^(?:(?:what|how|which|when|where|who|why)\s+(?:is|are|does|do|did|can|should|will)|is|are|can|does|do|did|should|will)\b/i;
export function klistretSoegeord(s, soegeord) {
  const t = synlig(s).replace(/\s+/g, ' ').trim();
  if (t.includes('?')) return null;
  const lav = t.toLowerCase();
  for (const k of soegeord) {
    const kk = renSoeg(k);
    if (!OMVENDT.test(kk)) continue;
    const i = lav.indexOf(kk);
    if (i > 0 && !/["“'‘]/.test(t[i - 1])) return k;   // et citeret eksempel ("what is seo") er fint
  }
  return null;
}
