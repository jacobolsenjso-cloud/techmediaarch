import { defineConfig } from 'astro/config';

// Adresserne SKAL være de samme som på Blogger: /2024/10/navn.html og /p/navn.html.
// build.format 'file' får Astro til at skrive navn.html i stedet for navn/index.html.
// Den anden halvdel af aftalen står i wrangler.jsonc (html_handling: "none"),
// ellers ville Cloudflare omdirigere /navn.html til /navn.
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
