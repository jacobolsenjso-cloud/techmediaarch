// Det, robotten skal kende til, før den foreslår et nyt søgeord:
// alle eksisterende artikler og sider, deres overskrifter, emner og gemte
// søgeord, samt listerne over brugte og prøvede søgeord.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const sti = (...d) => path.join(ROD, ...d);

// Menuens emner, læst direkte fra src/lib/emner.ts, så robotten og sitet aldrig
// er uenige om navnene. Vlog og Resources er ikke med i robottens rotation:
// Vlog er videoindslag, og Resources er håndplukkede links (egen menu).
export function emner() {
  const ts = fs.readFileSync(sti('src/lib/emner.ts'), 'utf8');
  return [...ts.matchAll(/\{\s*navn:\s*'([^']+)',\s*slug:\s*'([^']+)'/g)]
    .map(([, navn, slug]) => ({ navn, slug }))
    .filter((e) => !['Vlog', 'Resources'].includes(e.navn));
}

function frontmatter(fil) {
  const raa = fs.readFileSync(fil, 'utf8');
  const m = raa.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? (parse(m[1]) || {}) : {};
}

// Alle artikler (og sider) som [{ titel, sti, labels, soegeord: [..] }].
// "soegeord" er hovedsøgeordet + de 5 beslægtede for artikler, robotten har
// skrevet; de gamle Blogger-artikler har kun overskriften.
export function artikler() {
  const ud = [];
  const posts = sti('src/content/posts');
  for (const aar of fs.readdirSync(posts)) for (const md of fs.readdirSync(path.join(posts, aar))) {
    const mappe = path.join(posts, aar, md);
    for (const f of fs.readdirSync(mappe).filter((x) => x.endsWith('.md'))) {
      const d = frontmatter(path.join(mappe, f));
      ud.push({
        titel: String(d.title || ''), sti: `/${aar}/${md}/${f.replace(/\.md$/, '')}.html`, labels: d.labels || [],
        soegeord: [d.keyword, ...(d.relatedKeywords || [])].filter(Boolean).map(String),
      });
    }
  }
  const sider = sti('src/content/pages');
  for (const f of fs.readdirSync(sider).filter((x) => x.endsWith('.md'))) {
    const d = frontmatter(path.join(sider, f));
    ud.push({ titel: String(d.title || ''), sti: `/p/${f.replace(/\.md$/, '')}.html`, labels: [], soegeord: [] });
  }
  return ud;
}

// Antal artikler pr. emne (et emne = en label med samme navn).
export function antalPrEmne(alle = artikler()) {
  return Object.fromEntries(emner().map((e) => [e.navn, alle.filter((a) => a.labels.includes(e.navn)).length]));
}

const laesJson = (f, tom) => { try { return JSON.parse(fs.readFileSync(sti(f), 'utf8')); } catch { return tom; } };
export const BRUGTE = 'robot/data/brugte-soegeord.json';   // [{ q, emne, dato, artikel }] — skrevet ind, når en artikel er udgivet
export const PROEVEDE = 'robot/data/proevede-soegeord.json'; // [{ q, emne, dato, grund }] — prøvet uden held; hviler 30 dage
export const brugte = () => laesJson(BRUGTE, []);
export function proevedeForNylig(dage = 30) {
  const graense = Date.now() - dage * 864e5;
  return laesJson(PROEVEDE, []).filter((x) => new Date(x.dato).getTime() > graense);
}
