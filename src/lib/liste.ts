// Artikellisten (Jacob 28/10: forsiden grupperes efter hylde, "All articles"-siderne bliver rækker).
// Forsiden viser de FORSIDE_NYESTE nyeste øverst; /page/2 fortsætter lige derefter, så ingen artikel falder ud
// af listen, og /page/N har PR_SIDE artikler hver.
import type { Indlaeg } from './indhold';

export const FORSIDE_NYESTE = 5;
export const PR_SIDE = 24;
export const listeSider = (antal: number) => 1 + Math.ceil(Math.max(0, antal - FORSIDE_NYESTE) / PR_SIDE);
export const listeUdsnit = (alle: Indlaeg[], side: number) =>
  alle.slice(FORSIDE_NYESTE + (side - 2) * PR_SIDE, FORSIDE_NYESTE + (side - 1) * PR_SIDE);
