# techmediaarch.com

Det nye techmediaarch.com: et statisk Astro-site, der erstatter Blogger. Designet
og opbygningen følger techfeedwatch.com, men uden videodelen.

## Vigtigst at vide

- **Adresserne er de samme som på Blogger**: `/2024/10/navn.html` og `/p/navn.html`.
  Det kræver `build.format: 'file'` i `astro.config.mjs` OG `html_handling: "none"`
  i `wrangler.jsonc`. Fjerner man én af dem, skifter alle adresser.
- **Hosting er Cloudflare Workers, ikke Pages**: Pages omdirigerer altid `/x.html`
  til `/x`. Se kommentaren i `wrangler.jsonc`.
- **`worker/index.js`** kører kun for adresser, der ikke er en fil: forsiden,
  Bloggers gamle adresser (etiketter, søgning, feeds, arkiver) og robots.txt.
  Testadressen (workers.dev) er lukket for søgemaskiner; www.techmediaarch.com er åben.
- **Indholdet er HTML, ikke markdown**: `src/content/posts/ÅÅÅÅ/MM/navn.md` er
  frontmatter + Bloggers HTML, flyttet ordret af `scripts/konverter.mjs`.

## Kommandoer

- `npm run build` — bygger til `dist/`
- `npm run preview` — kører sitet lokalt, som Cloudflare vil køre det (wrangler dev)
- `node scripts/konverter.mjs <eksportmappe> [--billeder]` — Blogger-eksport → indholdsfiler
