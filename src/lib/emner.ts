// De gamle emner fra Blogger-menuen (LinkList200). Fra 1/11-2026 har de ingen egen side og vises ikke på kortene:
// de bruges kun til at finde en artikels hylde (hylder.ts / adresse.mjs), til relaterede artikler og til robottens
// rotation (robot/lib/arkiv.mjs læser denne fil). Bloggers 130 løse labels bliver stående i indlæggenes data.
//
// Farverne bruges som accent (prik, kant) — aldrig som tekst eller som baggrund
// under hvid tekst, samme regel som på techfeedwatch.
// etiket: Blogger-etiketten i indlæggenes data, når den er stavet anderledes end det viste navn
import { EMNESIDE_TIL_HYLDE } from './adresse.mjs';
export interface Emne { navn: string; slug: string; farve: string; etiket?: string; }

export const EMNER: Emne[] = [
  { navn: 'AI', slug: 'ai', farve: '#06b6d4' },
  { navn: 'Tech', slug: 'tech', farve: '#6366f1' },
  { navn: 'Data', slug: 'data', farve: '#14b8a6' },
  { navn: 'DevOps', slug: 'devops', farve: '#2563eb' },
  { navn: 'Dev', slug: 'dev', farve: '#0ea5e9' },
  // Vises som "IT" (Jacob 28/9); etiketten i indlæggene hedder stadig "It", og adressen er uændret
  { navn: 'IT', slug: 'it', farve: '#64748b', etiket: 'It' },
  { navn: 'Design', slug: 'design', farve: '#db2777' },
  { navn: 'Marketing', slug: 'marketing', farve: '#8b5cf6' },
  { navn: 'Product', slug: 'product', farve: '#ea580c' },
  { navn: 'Fintech', slug: 'fintech', farve: '#1e3a8a' },
  { navn: 'Crypto', slug: 'crypto', farve: '#f59e0b' },
  { navn: 'Web3', slug: 'web3', farve: '#059669' },
  { navn: 'Infosec', slug: 'infosec', farve: '#dc2626' },
  { navn: 'Vlog', slug: 'vlog', farve: '#d926c8' },
  // Resources var sit eget menupunkt på Blogger; emnesiden er 301 til Marketing & SEO (1/11-2026)
  { navn: 'Resources', slug: 'resources', farve: '#0891b2' },
];

// Etiketten i indlæggenes data (IT hedder "It" der)
export const emneEtiket = (e: Emne) => e.etiket ?? e.navn;
// Fra 1/11-2026 har intet emne en egen side: alle emner linker til en hylde, og /topic/<emne> sendes med 301
// til hylden (EMNESIDE_TIL_HYLDE i adresse.mjs + worker/index.js). Fallback /latest, hvis et nyt emne mangler i tabellen.
export const emneUrl = (e: Emne) => (EMNESIDE_TIL_HYLDE[e.slug] ? `/shelf/${EMNESIDE_TIL_HYLDE[e.slug]}` : '/latest');

