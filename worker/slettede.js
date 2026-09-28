// Artikler, der er slettet med Jacobs ok. Den gamle adresse sender med 301 videre til
// den nærmeste levende artikel, så links udefra og Googles indeks ikke ender i en 404.
// Bruges af workeren (worker/index.js) og af tjek-site/tjek-live, så de tre altid er enige.
// Tilføj kun en linje her, når artiklens fil er fjernet fra src/content/posts.
export const SLETTEDE = {
  // 28/9-2026: påstod 10 steder at sitet selv havde testet Googles AI, med opfundne tal (Jacob: "du sletter bare den")
  '/2026/06/beyond-hype-technical-breakdown-of-new.html': '/2026/05/google-workspace-studio-analysts-take.html',
};
