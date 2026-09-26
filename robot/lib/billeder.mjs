// Billeder til artiklerne: Cloudflare Workers AI (flux-1-schnell) og Gemini.
// Alle billeder gemmes som JPEG i 1366×768 (16:9) — samme størrelse som de
// fleste eksisterende billeder på sitet (målt 26/9-2026). Vandmærket lægges på
// af sitet selv, når siden vises (src/lib/temakoder.mjs).
import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { billede as geminiBillede } from './gemini.mjs';
import { sti } from './arkiv.mjs';

const CF_KONTO = '34f0e1dc54050e97066f335a6911c54f'; // Cloudflare-kontoens id (ikke hemmeligt)

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

// Beskær midten til 16:9 og gem som JPEG. Returnerer webstien (/images/xxx.jpg).
export async function gem(buf, kilde) {
  const jpg = await sharp(buf).resize(1366, 768, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const navn = crypto.createHash('sha256').update(jpg).digest('hex').slice(0, 16);
  const fil = `/images/${navn}-${kilde}.jpg`;
  fs.writeFileSync(sti('public' + fil), jpg);
  return { fil, bytes: jpg.length };
}

// Lav ét billede med begge motorer (til sammenligning i prøveartiklerne).
export async function begge(prompt) {
  const ud = {};
  for (const [kilde, lav] of [['cf', cloudflare], ['gm', geminiBillede]]) {
    try { ud[kilde] = await gem(await lav(prompt), kilde); }
    catch (e) { ud[kilde] = { fejl: e.message }; }
  }
  return ud;
}
