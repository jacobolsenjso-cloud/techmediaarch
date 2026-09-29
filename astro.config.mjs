import { defineConfig } from 'astro/config';

// Adresserne er /2024/10/navn og /p/navn - uden .html (Jacob 29/9-2026, src/lib/adresse.mjs).
// build.format 'file' får Astro til at skrive navn.html i stedet for navn/index.html;
// Cloudflare serverer /navn fra navn.html (wrangler.jsonc: html_handling "drop-trailing-slash"),
// og workeren sender Bloggers gamle /navn.html videre med 301.
export default defineConfig({
  site: 'https://www.techmediaarch.com',
  trailingSlash: 'never',
  // Astro 7 fjerner som standard mellemrum mellem elementer efter JSX-regler ('jsx'),
  // så fx "Published by <b>X</b> · <span>" kan klistre sammen. true = de gamle
  // HTML-regler fra Astro 6, som siderne er bygget og målt med.
  compressHTML: true,
  build: {
    format: 'file',
    // Som techfeedwatch: CSS inlines i HTML'en, så første visning ikke venter på
    // separate stylesheet-filer.
    inlineStylesheets: 'always',
  },
});
