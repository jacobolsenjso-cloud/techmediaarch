// Fælles for robot/bedste.mjs (Search Console) og robot/mest-laest.mjs (Analytics), 30/9-2026:
// alle artiklers stier og omregning fra en adresse/sti til artiklens sti.
import fs from 'node:fs';
import path from 'node:path';
import { sti } from './arkiv.mjs';

// Alle artiklers stier (/2024/10/navn), som sitet kender dem
export function alleStier() {
  const ud = new Set();
  const rod = sti('src/content/posts');
  for (const aar of fs.readdirSync(rod)) for (const md of fs.readdirSync(path.join(rod, aar)))
    for (const f of fs.readdirSync(path.join(rod, aar, md)).filter((x) => x.endsWith('.md'))) ud.add(`/${aar}/${md}/${f.replace(/\.md$/, '')}`);
  return ud;
}

// Adresse eller sti -> artiklens sti. Samme artikel kan stå som både .html (Blogger) og uden (nu), med og uden www,
// med ?m=1 og med kodede tegn — alt lægges sammen på én sti. Analytics giver kun stien (pagePath), Search Console hele adressen.
export function tilSti(adresse) {
  let s;
  // En sti tages som den er (uden ?… og #…): URL-fortolkeren fjerner mellemrum til sidst, og 3 Blogger-stier ender på mellemrum (målt 30/9)
  if (String(adresse).startsWith('/')) s = String(adresse).split(/[?#]/)[0];
  else { try { s = new URL(adresse).pathname; } catch { return null; } }
  try { s = decodeURIComponent(s); } catch { /* ukodet i forvejen */ }
  return s.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
}
