// Læser Google Analytics 4-tal for techmediaarch.com (30/9-2026, Jacobs valg: Trending = mest læste).
//
// Adgang: samme tjenestekonto som Search Console (techmediaarch-robot@techmediaarch-tools.iam.gserviceaccount.com)
// har rollen "Seer" på Analytics-ejendommen, og "Google Analytics Data API" er slået til i projektet
// techmediaarch-tools. Nøglen er den samme hemmelighed (GSC_SERVICE_ACCOUNT_JSON) og skrives ALDRIG ud.
import { hentAdgangsbevis } from './searchconsole.mjs';

export const EJENDOM_ID = '453119869';   // Analytics-ejendommen (måle-id G-TJTC0HR0JK); ikke hemmeligt
const OMFANG = 'https://www.googleapis.com/auth/analytics.readonly';

// Sidevisninger pr. side (pagePath) de sidste `dage` dage, til og med i dag.
// Returnerer { fra, til, sider: [{ side, visninger, brugere }] }.
export async function hentSidevisninger({ dage = 7, raekker = 10000 } = {}) {
  const bevis = await hentAdgangsbevis(OMFANG);
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${EJENDOM_ID}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bevis}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${dage - 1}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      limit: raekker,
    }),
  });
  const j = await r.json().catch(() => ({}));
  // Kun status og Googles korte grund — aldrig noget fra nøglen
  if (!r.ok) throw new Error(`Analytics svarede ${r.status} ${j.error?.status || ''} ${String(j.error?.message || '').slice(0, 120)}`);
  const dato = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  return {
    fra: dato(dage - 1), til: dato(0),
    sider: (j.rows || []).map((x) => ({ side: x.dimensionValues[0].value, visninger: Number(x.metricValues[0].value), brugere: Number(x.metricValues[1].value) })),
  };
}
