// De 5 hylder i svar-arkivet (Jacob 28/10-2026). Bruges af megamenuen, mobilmenuen, forsiden,
// hyldesiderne (/shelf/<slug>) og A–Z-siden.
// emner: de gamle emner (slugs fra emner.ts), der hører til hylden — samme tabel som HYLDE_FOR_EMNE i adresse.mjs.
// start: "Start here — read in this order" (stier til artikler). FORSLAG 28/10, skal godkendes af Jacob.
// farve: hyldens egen rolige farve (kun til ikon og prik, aldrig til tekst).
// ikon: én SVG-sti (24x24, streg), tegnet til hylden.
import { INDLAEG, type Indlaeg } from './indhold';
import { HYLDE_FOR_EMNE } from './adresse.mjs';

export interface Hylde { slug: string; navn: string; besk: string; farve: string; ikon: string; emner: string[]; start: string[]; }

export const HYLDER: Hylde[] = [
  { slug: 'ai', navn: 'AI Tools & Agents', besk: 'What AI tools do and how to choose between them.', farve: '#6d5bd0', emner: ['ai'],
    ikon: 'M12 3v3M12 18v3M3 12h3M18 12h3M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    start: ['/2026/09/large-language-models-vs-generative-ai', '/2026/04/unlock-80-free-ai-tools-your-guide-to', '/2024/10/the trust in ai systems how companies'] },
  { slug: 'cybersecurity', navn: 'Cybersecurity', besk: 'Phishing, ransomware and keeping accounts safe.', farve: '#d9622b', emner: ['infosec'],
    ikon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9c-4.6-.7-8-4.5-8-9V6z',
    start: ['/2026/10/what-is-cybersecurity-importance', '/2026/10/what-are-phishing-attacks', '/2026/09/what-is-ransomware-cyber-security', '/2026/10/how-phishing-resistant-mfa-works'] },
  { slug: 'software', navn: 'Building Software', besk: 'Learning to code and how software gets made.', farve: '#0f8a7a', emner: ['dev', 'devops', 'product', 'data'],
    ikon: 'M8 8l-4 4l4 4M16 8l4 4l-4 4M14 5l-4 14',
    start: ['/2026/10/web-vs-software-development', '/2026/09/what-is-python-used-for', '/2026/10/what-does-api-mean-in-software', '/2026/10/how-long-learn-web-development'] },
  { slug: 'marketing', navn: 'Marketing & SEO', besk: 'Search, email and content marketing explained.', farve: '#c04f8a', emner: ['marketing', 'design'],
    ikon: 'M3 11v2l13 5V6zM16 9a4 4 0 0 1 0 6M6 13l1 6h3l-1-5',
    start: ['/2026/10/why-seo-is-important', '/2026/10/seo-best-practices-guide', '/2026/10/what-is-content-marketing-strategy', '/2026/10/email-marketing-best-practices'] },
  { slug: 'everyday-tech', navn: 'Everyday Tech', besk: 'Computers, phones and tech at home.', farve: '#b08a1e', emner: ['tech', 'it'],
    ikon: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
    start: ['/2026/04/your-windows-pc-has-secret-cleaning', '/2026/05/is-your-website-online-right-now-how-to', '/2026/04/mastering-chatgpt', '/2026/04/mdm-activate-your-mac-with-this-essential-guide'] },
];

export const hyldeUrl = (h: Hylde) => `/shelf/${h.slug}`;
// Ekstra Blogger-etiketter, der også sætter en artikel på en hylde, selv om de ikke er et af de 10 emner.
// Målt 28/10: 19 artikler har etiketten "Cyber Security"/"Cyber-Security", men ikke "Infosec", og stod ellers
// ikke på Cybersecurity-hylden. De mange "AI-*"-etiketter bruges IKKE: de sidder på næsten alt (AI-Video på 105).
const EKSTRA_ETIKETTER: Record<string, string> = { 'Cyber Security': 'cybersecurity', 'Cyber-Security': 'cybersecurity' };
// Alle hylder en artikel hører til (ud fra emner + de ekstra etiketter)
const hyldeSlugs = (p: Indlaeg) => new Set([
  ...p.emner.map((e) => (HYLDE_FOR_EMNE as Record<string, string>)[e.slug]),
  ...p.labels.map((l) => EKSTRA_ETIKETTER[l]),
].filter(Boolean));
// Artiklerne på hylden, nyeste først (en artikel kan stå på flere hylder)
export const iHylde = (h: Hylde): Indlaeg[] => INDLAEG.filter((p) => hyldeSlugs(p).has(h.slug));
// "Start here"-listen som artikler (en sti, der ikke findes, springes over)
export const startListe = (h: Hylde): Indlaeg[] => h.start.map((s) => INDLAEG.find((p) => p.sti === s)).filter((p): p is Indlaeg => Boolean(p));
// Artiklens hylde til brødkrummer og mærker. Står den på flere hylder, vinder den mest specifikke.
// Everyday Tech er bredest og kommer sidst.
const PRIORITET = ['cybersecurity', 'ai', 'marketing', 'software', 'everyday-tech'];
export const hyldeFor = (p: Indlaeg): Hylde | undefined => {
  const mine = hyldeSlugs(p);
  const slug = PRIORITET.find((s) => mine.has(s));
  return slug ? HYLDER.find((h) => h.slug === slug) : undefined;
};

// Kontrol ved byggeriet: tabellen her og HYLDE_FOR_EMNE skal sige det samme
for (const h of HYLDER) for (const e of h.emner) {
  if ((HYLDE_FOR_EMNE as Record<string, string>)[e] !== h.slug) throw new Error(`hylder.ts og adresse.mjs er uenige om emnet ${e}`);
}
