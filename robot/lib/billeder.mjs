// Billeder til artiklerne: Gemini (techfeedwatchs billedmodel) med Cloudflare Workers AI (flux-1-schnell) som reserve.
// Alle billeder gemmes som JPEG i 1366×768 (16:9) — samme størrelse som de fleste eksisterende billeder på sitet
// (målt 26/9-2026). Vandmærket lægges på af byggeriet (scripts/vandmaerk-billeder.mjs).
//
// Opskriften (Jacob valgte den 31/10-2026 efter 13 prøverunder på grenen proeve-billeder):
//  1. ét klart visuelt motiv pr. billede — tekstmodellen skriver det ud fra artiklen (robot/artikel.mjs)
//  2. bred scene, der fylder hele billedet; kun hjørnerne til mærkerne holdes rolige
//  3. skiferblå grundtone med to dæmpede lyspletter + hyldens accentfarve (ingen logofarver)
//  4. billedkontrol: tekst, logoer, personer/kropsdele → nyt motiv og nyt billede, højst 3 forsøg
//  5. lyspletterne dæmpes bagefter, så alle billeder bliver lige dæmpede (som det godkendte MFA-billede)
//  6. "AI-generated" øverst til venstre + IPTC-mærket "trainedAlgorithmicMedia" i filen (Google læser det)
import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { billede as geminiBillede, json, seBillede } from './gemini.mjs';
import { sti } from './arkiv.mjs';
import { maerkeLag } from '../../scripts/maerker.mjs';

const CF_KONTO = '34f0e1dc54050e97066f335a6911c54f'; // Cloudflare-kontoens id (ikke hemmeligt)

// Hyldens accentfarve (src/lib/hylder.ts) i ord, som billedmodellen forstår
const ACCENT = { ai: 'indigo-violet', cybersecurity: 'burnt orange', software: 'deep teal', marketing: 'raspberry pink', 'everyday-tech': 'warm gold' };
export const accentFor = (hylde) => ACCENT[hylde] || ACCENT.ai;

// Fælles regel for motiverne (bruges også i robot/artikel.mjs, hvor tekstmodellen skriver de første motiver)
export const MOTIVREGLER = 'one clear, clever visual metaphor that a reader instantly connects with the title (like a fishing hook reaching for a key protected by a shield of light for phishing-resistant login), described in 1-2 sentences as a wide scene that fills the whole 16:9 frame from edge to edge with elements in the foreground, middle and background, using only physical objects, mechanisms, materials and light — never screens, monitors, phones, paper, documents, books, signs, labels, letters, numbers, symbols, logos, people, faces, hands, skeletons, skulls or any body parts';

const billedPrompt = (titel, motiv, accent) => `Create a 16:9 editorial illustration for a technology article titled "${titel}".
The scene: ${motiv}
Style: clean conceptual 3D illustration, soft studio lighting, high detail, calm and professional, no clutter.
Background: a smooth deep slate-blue backdrop (around #2f3a46 to #4a5866, never black) with two gentle, low-intensity light pools: a faint, dim warm glow in the upper left (subtle, not a bright spot) and a soft, muted ${accent} glow at the right edge (dim, not bright).
Accent: ${accent} accent light on the main object.
Composition: a wide, rich scene that fills the full width of the frame from edge to edge, with depth from foreground to background — not a small object floating in the middle. Only two small areas stay calmer and low in detail: the very top-left corner and the very bottom-right corner (small marks are placed there).
Strict rules: absolutely NO text, letters, numbers, words, labels or symbols anywhere; NO logos, brand names or trademarked products; NO people, faces, hands, skeletons, skulls or body parts; no screenshots of real apps or websites.
Avoid objects that usually carry writing: screens, monitors, phones, dashboards, charts, signs, documents, books, labels, price tags, banknotes and keyboards. Show the idea with shapes, light, materials and physical objects instead.`;

// Testen 31/10 viste, at et kort ja/nej lod falske bogstaver ("CCO 8" på en maskine) slippe igennem. Nu skal
// kontrollen først skrive alt op, den ser, og er den i tvivl, tæller det som et fund.
const KONTROL = `You are a strict quality checker for article illustrations. Scan the whole image systematically: every object surface, panel, button, label area, screen-like area, sign, edge and the background.
First list EVERYTHING that looks like writing or a mark: letters, numbers, words, pseudo-letters or glyph-like shapes, currency or other symbols, logos or brand marks — even tiny, blurred, partial or decorative ones. Also list any human, face, hand, skeleton, skull or other body part (also sculpted, robotic-looking or stylised).
Answer as JSON in this order:
{"fund": ["each finding, short"], "tekst": true/false, "logo": true/false, "person": true/false, "hvad": "short summary of the problems, or empty"}
"tekst" is true if any letters, numbers, pseudo-letters, glyphs or symbols are listed. If you are unsure whether something is writing, count it as writing.`;
// Modellen svarer af og til "false" som tekst i stedet for false (testen 31/10: afvist med begrundelsen "ingen")
const sand = (v) => v === true || String(v).trim().toLowerCase() === 'true';

// grund: hvorfor det forrige billede blev afvist (tom = der var intet motiv fra artikel.mjs)
const nytMotivPrompt = (titel, besk, grund) => `You design the cover image for a technology article.
Title: "${titel}"
Summary: ${besk}
${grund ? `A previous image idea was rejected because: ${grund}. Invent a completely different idea: ` : 'Invent '}${MOTIVREGLER}.
Answer as JSON: {"motiv": "..."}`;

// Kontrollen: tekst/logo/person → afvist. Svarer kontrollen selv med en fejl, prøves den én gang til; fejler den
// igen, godkendes billedet med en note — en teknisk fejl er ikke en afvisning (prøve 31/10 kasserede 18 billeder,
// fordi kontrolmodellen ikke fandtes).
async function kontroller(buf) {
  for (let i = 1; i <= 2; i++) {
    try {
      const k = await seBillede(buf, KONTROL);
      const fejl = [sand(k.tekst) && 'tekst', sand(k.logo) && 'logo', sand(k.person) && 'person'].filter(Boolean);
      const hvad = String(k.hvad || (Array.isArray(k.fund) ? k.fund.join('; ') : '')).slice(0, 120);
      return { ok: !fejl.length, grund: fejl.length ? `${fejl.join(', ')}: ${hvad}` : '' };
    } catch (e) { if (i === 2) return { ok: true, grund: '', note: `kontrollen fejlede (${String(e.message).slice(0, 80)}) — godkendt uden kontrol` }; }
  }
}

export const kontrollerTest = kontroller; // kun til afprøvning af kontrollen alene

// Dæmper lyspletterne: øverst til venstre meget, til højre lidt (det godkendte MFA-billede 31/10)
async function daemp(buf) {
  const { width: b, height: h } = await sharp(buf).metadata();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${h}"><defs>
    <radialGradient id="vs" cx="0" cy="0" r="0.75"><stop offset="0" stop-color="#34404d" stop-opacity=".72"/><stop offset=".55" stop-color="#34404d" stop-opacity=".35"/><stop offset="1" stop-color="#34404d" stop-opacity="0"/></radialGradient>
    <radialGradient id="hs" cx="1" cy=".55" r="0.4"><stop offset="0" stop-color="#34404d" stop-opacity=".5"/><stop offset="1" stop-color="#34404d" stop-opacity="0"/></radialGradient>
  </defs><rect width="${b}" height="${h}" fill="url(#vs)"/><rect width="${b}" height="${h}" fill="url(#hs)"/></svg>`;
  return sharp(buf).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// IPTC-mærket for AI-genererede billeder (samme som techfeedwatch, src/lib/aibillede.mjs)
const xmp = (titel) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" photoshop:Credit="TechMediaArch.com (AI-generated)"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">AI-generated illustration: ${xml(titel)}</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta>`;

export async function cloudflare(prompt) {
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_AI_TOKEN mangler');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_KONTO}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 8 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.result?.image) throw new Error(`Cloudflare svarede ${r.status}: ${String(j.errors?.[0]?.message || '').slice(0, 150)}`);
  return Buffer.from(j.result.image, 'base64');
}

// Beskær midten til 16:9, dæmp lyspletterne, læg "AI-generated" på, skriv IPTC-mærket og gem som JPEG.
// Returnerer webstien (/images/xxx.jpg).
export async function forbered(buf, titel = '') {
  let b = await sharp(buf).resize(1366, 768, { fit: 'cover', position: 'centre' }).png().toBuffer();
  b = await daemp(b);
  const ai = await maerkeLag(b, { type: 'ai', hjoerne: 'ov' });
  const s = sharp(b).composite(ai ? [{ input: ai.input, left: ai.left, top: ai.top }] : []).withXmp(xmp(titel));
  return s.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
export async function gem(buf, kilde, titel = '') {
  const jpg = await forbered(buf, titel);
  const navn = crypto.createHash('sha256').update(jpg).digest('hex').slice(0, 16);
  const fil = `/images/${navn}-${kilde}.jpg`;
  fs.writeFileSync(sti('public' + fil), jpg);
  return { fil, bytes: jpg.length };
}

// Ét billede efter opskriften. Returnerer { fil, bytes, motor, forsoeg, noter }.
// Gemini laver billedet; bliver det afvist 3 gange, eller fejler Gemini (fx beløbsloftet nået), laver Cloudflare
// billedet, så artiklen stadig kan udgives (Jacobs valg 26/9-2026).
export async function lav({ motiv, titel, besk = '', hylde }) {
  const accent = accentFor(hylde);
  const noter = [];
  let m = String(motiv || '').trim();
  try {
    // Testen 31/10: tekstmodellen gav af og til intet motiv ("undefined") — så skrives et her
    if (m.length < 20) { m = String((await json(nytMotivPrompt(titel, besk, ''))).motiv || titel); noter.push('motiv skrevet her (manglede)'); }
    for (let forsoeg = 1; forsoeg <= 3; forsoeg++) {
      const buf = await geminiBillede(billedPrompt(titel, m, accent));
      const k = await kontroller(buf);
      if (k.note) noter.push(k.note);
      // motiv/nytMotiv (31/10-2026, prøve #38): ved et nyt motiv passer den planlagte alt-tekst ikke længere til billedet
      if (k.ok) return { ...(await gem(buf, 'gm', titel)), motor: 'Gemini', forsoeg, noter, motiv: m, nytMotiv: m !== String(motiv || '').trim() };
      noter.push(`forsøg ${forsoeg} afvist (${k.grund})`);
      if (forsoeg < 3) m = String((await json(nytMotivPrompt(titel, besk, k.grund))).motiv || m);
    }
    throw new Error('afvist af billedkontrollen 3 gange');
  } catch (e) {
    const r = await gem(await cloudflare(billedPrompt(titel, m, accent)), 'cf', titel);
    return { ...r, motor: `Cloudflare (Gemini: ${String(e.message).slice(0, 80)})`, forsoeg: 0, noter, motiv: m, nytMotiv: m !== String(motiv || '').trim() };
  }
}
