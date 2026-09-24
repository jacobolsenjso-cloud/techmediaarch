// Emnerne er de samme som i Blogger-menuen (LinkList200), så besøgende genkender
// inddelingen. Bloggers 130 løse labels er for mange og for tilfældige til at
// navigere efter (fx "AI-Video" på 105 indlæg) — de bliver stående i
// indlæggenes data, men kun disse emner får en side og en plads i menuen.
// "Founders" er udeladt: den havde 0 indlæg og gav en tom side.
//
// Farverne bruges som accent (prik, kant) — aldrig som tekst eller som baggrund
// under hvid tekst, samme regel som på techfeedwatch.
export interface Emne { navn: string; slug: string; farve: string; }

export const EMNER: Emne[] = [
  { navn: 'AI', slug: 'ai', farve: '#06b6d4' },
  { navn: 'Tech', slug: 'tech', farve: '#6366f1' },
  { navn: 'Data', slug: 'data', farve: '#14b8a6' },
  { navn: 'DevOps', slug: 'devops', farve: '#2563eb' },
  { navn: 'Dev', slug: 'dev', farve: '#0ea5e9' },
  { navn: 'It', slug: 'it', farve: '#64748b' },
  { navn: 'Design', slug: 'design', farve: '#db2777' },
  { navn: 'Marketing', slug: 'marketing', farve: '#8b5cf6' },
  { navn: 'Product', slug: 'product', farve: '#ea580c' },
  { navn: 'Fintech', slug: 'fintech', farve: '#1e3a8a' },
  { navn: 'Crypto', slug: 'crypto', farve: '#f59e0b' },
  { navn: 'Web3', slug: 'web3', farve: '#059669' },
  { navn: 'Infosec', slug: 'infosec', farve: '#dc2626' },
  { navn: 'Vlog', slug: 'vlog', farve: '#d926c8' },
];

export const emneFraNavn = (navn: string) => EMNER.find((e) => e.navn === navn);
export const emneFraSlug = (slug: string) => EMNER.find((e) => e.slug === slug);
export const emneUrl = (e: Emne) => `/topic/${e.slug}.html`;

// Et emne med under 3 artikler er en tynd side: den findes (Blogger havde den),
// men beder ikke Google om at indeksere den.
export const TYND_GRAENSE = 3;
