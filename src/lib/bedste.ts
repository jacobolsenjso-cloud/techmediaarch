// "Best of each topic" (30/9-2026, Jacobs valg A): de artikler, der fik flest klik fra Google Search de sidste 90 dage.
// Tallene kommer fra robot/data/bedste.json, som robotten henter fra Search Console (robot/bedste.mjs).
// Tom fil = ingen data endnu: siden står der, men er noindex og står ikke i menuen eller sitemap.
import BEDSTE_RAA from '../../robot/data/bedste.json';
import { iEmne, type Indlaeg } from './indhold';
import { KATEGORIER, type Emne } from './emner';

interface Tal { klik: number; visninger: number }
interface Data { hentet?: string; fra?: string; til?: string; dage?: number; sider?: Record<string, Tal> }
export const BEDSTE = BEDSTE_RAA as Data;

export const PR_EMNE = 4;   // Jacob 30/9: 4 pr. emne (var 5), så to hele rækker à 2 på mobil
export const MIN_KLIK = 1;   // en artikel uden et eneste klik er ikke "bedst" til noget

const tal = (p: Indlaeg): Tal => BEDSTE.sider?.[p.sti] ?? { klik: 0, visninger: 0 };

// Én sektion pr. emne; de store emner først (flest artikler i alt), men alle får højst PR_EMNE pladser.
// Rangering: klik, og ved lige mange klik: visninger.
export const SEKTIONER: { emne: Emne; total: number; artikler: (Indlaeg & Tal)[] }[] = KATEGORIER
  .map((emne) => {
    const alle = iEmne(emne);
    return {
      emne, total: alle.length,
      artikler: alle.map((p) => ({ ...p, ...tal(p) }))
        .filter((p) => p.klik >= MIN_KLIK)
        .sort((a, b) => b.klik - a.klik || b.visninger - a.visninger)
        .slice(0, PR_EMNE),
    };
  })
  .filter((s) => s.artikler.length > 0)
  .sort((a, b) => b.total - a.total);

export const HAR_BEDSTE = SEKTIONER.length > 0;

// "1,234 clicks" / "1 click"
export const klikTekst = (n: number) => `${Math.round(n).toLocaleString('en-US')} ${Math.round(n) === 1 ? 'click' : 'clicks'}`;

// Dato som "Sep 28, 2026" (UTC, så bygget giver det samme uanset maskinens tidszone)
export const kortDato = (d?: string) => {
  const t = d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : null;
  return t && !isNaN(+t) ? t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
