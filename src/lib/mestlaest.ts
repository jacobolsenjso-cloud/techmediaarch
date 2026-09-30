// Trending = de mest læste artikler de sidste 7 dage (30/9-2026, Jacobs valg: Google Analytics).
// Tallene kommer fra robot/data/mest-laest.json, som robotten henter efter hver kørsel (robot/mest-laest.mjs).
// Er der for få læste artikler (tom fil eller under MIN_ARTIKLER), viser Trending de nyeste i stedet og siger det.
import MEST_RAA from '../../robot/data/mest-laest.json';
import { INDLAEG, type Indlaeg } from './indhold';

interface Tal { visninger: number; brugere: number }
interface Data { hentet?: string; fra?: string; til?: string; dage?: number; sider?: Record<string, Tal> }
export const MEST = MEST_RAA as Data;

export const ANTAL = 24;
export const MIN_ARTIKLER = 4;   // færre end 4 læste artikler er ikke en rangliste — så vises de nyeste

// Rangering: sidevisninger; ved lige mange: den nyeste først
export const MEST_LAESTE: (Indlaeg & Tal)[] = INDLAEG
  .filter((p) => (MEST.sider?.[p.sti]?.visninger ?? 0) > 0)
  .map((p) => ({ ...p, ...MEST.sider![p.sti] }))
  .sort((a, b) => b.visninger - a.visninger || new Date(b.published).valueOf() - new Date(a.published).valueOf())
  .slice(0, ANTAL);

export const HAR_MEST_LAESTE = MEST_LAESTE.length >= MIN_ARTIKLER;
