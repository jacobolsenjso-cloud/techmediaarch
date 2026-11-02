// Oversæt .astro-filer med Astros oversætter og vis fejl med linje/kolonne (2/11-2026).
// Brug: node scripts/tjek-compile.mjs <fil.astro> [flere …]
// Hvorfor: "npm run build" siger kun "Unexpected token" og et sted, der kan være misvisende —
// her kan man prøve en ændring af på få sekunder uden et helt byg.
import fs from 'node:fs';
import { transform } from '@astrojs/compiler-rs';
let fejl = 0;
for (const f of process.argv.slice(2)) {
  const r = transform(fs.readFileSync(f, 'utf8'), { filename: f });
  const d = r.diagnostics || [];
  fejl += d.filter((x) => x.severity === 'error').length;
  console.log(f, d.length ? d.map((x) => `${x.severity}: ${x.text} (linje ${x.labels?.[0]?.line}, kolonne ${x.labels?.[0]?.column})`).join('; ') : 'OK');
}
process.exit(fejl ? 1 : 0);
