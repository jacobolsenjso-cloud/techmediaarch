// "Best of each topic": de mest læste artikler pr. emne de sidste 90 dage.
// 30/9-2026: skiftet fra Search Console-klik til Google Analytics-læsninger (Jacobs valg; kun 7 Google-klik på 90 dage).
// Tallene kommer fra robot/data/bedste.json, som robotten henter efter hver kørsel (robot/bedste.mjs).
// Tom fil = ingen data endnu: siden står der, men er noindex og står ikke i menuen eller sitemap.
import BEDSTE_RAA from '../../robot/data/bedste.json';
import { iEmne, type Indlaeg } from './indhold';
import { KATEGORIER, type Emne } from './emner';

interface Tal { visninger: number; brugere: number }
interface Data { hentet?: string; fra?: string; til?: string; dage?: number; kilde?: string; sider?: Record<string, Tal> }
const RAA = BEDSTE_RAA as Data;
// Kun Analytics-tal tæller (en gammel Search Console-fil havde "visninger" = visninger i Google, ikke læsninger)
export const BEDSTE: Data = RAA.kilde === 'analytics' ? RAA : {};

export const PR_EMNE = 4;   // Jacob 30/9: 4 pr. emne (var 5), så to hele rækker à 2 på mobil
export const MIN_VISNINGER = 1;   // en artikel, ingen har læst, er ikke "bedst" til noget

const tal = (p: Indlaeg): Tal => BEDSTE.sider?.[p.sti] ?? { visninger: 0, brugere: 0 };

// Én sektion pr. emne; de store emner først (flest artikler i alt), men alle får højst PR_EMNE pladser.
// Rangering: læsninger (sidevisninger), og ved lige mange: flest forskellige læsere.
export const SEKTIONER: { emne: Emne; total: number; artikler: (Indlaeg & Tal)[] }[] = KATEGORIER
  .map((emne) => {
    const alle = iEmne(emne);
    return {
      emne, total: alle.length,
      artikler: alle.map((p) => ({ ...p, ...tal(p) }))
        .filter((p) => p.visninger >= MIN_VISNINGER)
        .sort((a, b) => b.visninger - a.visninger || b.brugere - a.brugere)
        .slice(0, PR_EMNE),
    };
  })
  .filter((s) => s.artikler.length > 0)
  .sort((a, b) => b.total - a.total);

export const HAR_BEDSTE = SEKTIONER.length > 0;

// Dato som "Sep 28, 2026" (UTC, så bygget giver det samme uanset maskinens tidszone)
export const kortDato = (d?: string) => {
  const t = d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : null;
  return t && !isNaN(+t) ? t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
