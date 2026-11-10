// Stempler service workeren (dist/sw.js) med et nyt versionsnavn ved hvert byg (10/11-2026, appen).
//
// Hvorfor: service workeren navngiver sine cacher efter versionen. Nyt navn = browseren henter den nye
// sw.js, og "activate" rydder de gamle sider/billeder. På techfeedwatch var stemplet engang konstant
// (hash af 0 CSS-filer), så cachen aldrig blev fornyet — derfor her: tidspunktet for bygget, som altid skifter.
//
// Kører som Astro-integration (astro.config.mjs), så det sker uanset om bygget startes med
// "npm run build", "npx astro build" eller af Cloudflare/robotten. Kan også køres alene: node scripts/stamp-sw.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function stampSw(distDir) {
  const fil = path.join(distDir, 'sw.js');
  if (!fs.existsSync(fil)) throw new Error(`stamp-sw: ${fil} findes ikke`);
  const id = Date.now().toString(36);
  const foer = fs.readFileSync(fil, 'utf8');
  if (!foer.includes('__BUILD_ID__')) throw new Error('stamp-sw: __BUILD_ID__ mangler i sw.js (allerede stemplet?)');
  fs.writeFileSync(fil, foer.split('__BUILD_ID__').join(id));
  return id;
}

export function stampSwIntegration() {
  return {
    name: 'tma-stamp-sw',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const id = stampSw(fileURLToPath(dir));
        logger.info(`sw.js stemplet: tma-${id}`);
      },
    },
  };
}

// Kørt direkte: stempl dist/
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('sw.js stemplet: tma-' + stampSw(path.resolve('dist')));
}
