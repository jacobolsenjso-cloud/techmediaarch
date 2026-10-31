# techmediaarch.com

Det nye techmediaarch.com: et statisk Astro-site, der erstatter Blogger. Designet
og opbygningen følger techfeedwatch.com, men uden videodelen.

## Vigtigst at vide

- **Adresser uden .html** (fra 29/9-2026): `/2024/10/navn` og `/p/navn`. Bloggers gamle `.html`-adresser
  sendes videre med 301. Det kræver `build.format: 'file'` i `astro.config.mjs` OG
  `html_handling: "drop-trailing-slash"` i `wrangler.jsonc`.
- **Hosting er Cloudflare Workers, ikke Pages**: Pages omdirigerer altid `/x.html`
  til `/x`. Se kommentaren i `wrangler.jsonc`.
- **`worker/index.js`** kører kun for adresser, der ikke er en fil: forsiden,
  Bloggers gamle adresser (etiketter, søgning, feeds, arkiver) og robots.txt.
  Testadressen (workers.dev) er lukket for søgemaskiner; www.techmediaarch.com er åben.
- **Indholdet er HTML, ikke markdown**: `src/content/posts/ÅÅÅÅ/MM/navn.md` er
  frontmatter + Bloggers HTML, flyttet ordret fra Blogger ved flytningen 25/9-2026 (konverteren er slettet 1/11-2026;
  den findes i git-historikken).

## Kommandoer

- `npm run build` — bygger til `dist/`
- `npm run preview` — kører sitet lokalt, som Cloudflare vil køre det (wrangler dev)
