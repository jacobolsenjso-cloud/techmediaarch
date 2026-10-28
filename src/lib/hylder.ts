// De 5 hylder i svar-arkivet (Jacob 28/10-2026). Bruges af megamenuen og mobilmenuen nu,
// og af hyldesiderne i trin 4.
// emner: de gamle emner (slugs fra emner.ts), der hører til hylden.
// link: indtil hyldesiderne findes (trin 4), peger hver hylde på sit vigtigste emne, så intet link er dødt.
// farve: hyldens egen rolige farve (kun til ikon og prik, aldrig til tekst).
// ikon: én SVG-sti (24x24, streg), tegnet til hylden.
export interface Hylde { navn: string; besk: string; farve: string; ikon: string; emner: string[]; link: string; }

export const HYLDER: Hylde[] = [
  { navn: 'AI Tools & Agents', besk: 'What AI tools do and how to choose between them.', farve: '#6d5bd0', emner: ['ai'], link: '/topic/ai',
    ikon: 'M12 3v3M12 18v3M3 12h3M18 12h3M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6' },
  { navn: 'Cybersecurity', besk: 'Phishing, ransomware and keeping accounts safe.', farve: '#d9622b', emner: ['infosec'], link: '/topic/infosec',
    ikon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9c-4.6-.7-8-4.5-8-9V6z' },
  { navn: 'Building Software', besk: 'Learning to code and how software gets made.', farve: '#0f8a7a', emner: ['dev', 'devops', 'product', 'data'], link: '/topic/dev',
    ikon: 'M8 8l-4 4l4 4M16 8l4 4l-4 4M14 5l-4 14' },
  { navn: 'Marketing & SEO', besk: 'Search, email and content marketing explained.', farve: '#c04f8a', emner: ['marketing', 'design'], link: '/topic/marketing',
    ikon: 'M3 11v2l13 5V6zM16 9a4 4 0 0 1 0 6M6 13l1 6h3l-1-5' },
  { navn: 'Everyday Tech', besk: 'Computers, phones and tech at home.', farve: '#b08a1e', emner: ['tech', 'it'], link: '/topic/tech',
    ikon: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2' },
];
