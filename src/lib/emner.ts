// Emnerne er de samme som i Blogger-menuen (LinkList200), så besøgende genkender
// inddelingen. Bloggers 130 løse labels er for mange og for tilfældige til at
// navigere efter (fx "AI-Video" på 105 indlæg) — de bliver stående i
// indlæggenes data, men kun disse emner får en side og en plads i menuen.
// "Founders" er udeladt: den havde 0 indlæg og gav en tom side.
//
// Farverne bruges som accent (prik, kant) — aldrig som tekst eller som baggrund
// under hvid tekst, samme regel som på techfeedwatch.
// etiket: Blogger-etiketten i indlæggenes data, når den er stavet anderledes end det viste navn
import { HYLDE_FOR_EMNE } from './adresse.mjs';
export interface Emne { navn: string; slug: string; farve: string; egenMenu?: boolean; etiket?: string; }

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
  // "Resources" var sit eget menupunkt på Blogger (mega-menu med etiketten Resources),
  // ikke en af kategorierne — derfor egenMenu: den får en emneside, men står ikke
  // under "Topics" og ikke blandt emne-chipsene.
  { navn: 'Resources', slug: 'resources', farve: '#0891b2', egenMenu: true },
];

// Emnerne under "Topics" og i emne-chipsene (Bloggers "Categories")
export const KATEGORIER = EMNER.filter((e) => !e.egenMenu);

export const emneEtiket = (e: Emne) => e.etiket ?? e.navn;
export const emneFraNavn = (navn: string) => EMNER.find((e) => e.navn === navn || emneEtiket(e) === navn);
export const emneFraSlug = (slug: string) => EMNER.find((e) => e.slug === slug);
// Fra trin 4 (28/10-2026): et emne, der hører til en hylde, linker til hylden (emnesiden findes ikke mere,
// den gamle adresse sendes med 301 til hylden). Emner uden hylde beholder /topic/<emne>.
export const emneUrl = (e: Emne) => (HYLDE_FOR_EMNE[e.slug] ? `/shelf/${HYLDE_FOR_EMNE[e.slug]}` : `/topic/${e.slug}`);
export const harHylde = (e: Emne) => Boolean(HYLDE_FOR_EMNE[e.slug]);
// Emnerne uden hylde (fintech, crypto, web3, vlog) — vises under "Other topics" i menuen
export const ANDRE_EMNER = KATEGORIER.filter((e) => !harHylde(e));

// Et emne med under 3 artikler er en tynd side: den findes (Blogger havde den),
// men beder ikke Google om at indeksere den.
export const TYND_GRAENSE = 3;
