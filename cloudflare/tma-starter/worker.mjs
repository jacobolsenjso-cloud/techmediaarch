// Pålidelig starter for techmediaarch-robotten (4/11-2026, Jacobs ja: "B, egen lille tma-starter").
//
// Hvorfor: GitHubs egen tidsplan er "best effort" — robottens kørsler kom 4-6 timer for sent eller slet ikke
// (målt: 5 af 9 planlagte kørsler 28/10-2/11; morgenkørslen 2/11 og 3/11 kom ikke). Cloudflares tidsplan holder
// tiden. Denne Worker gør kun én ting: på faste tidspunkter beder den GitHub om at starte robotten — det samme som
// at trykke "Run workflow" på GitHub. Selve robotten kører stadig på GitHub som før.
//
// Dobbeltkørsel er ufarlig: kommer GitHubs egen (forsinkede) kørsel også, stopper robot/plan.mjs selv ved loftet
// (højst 2 nye artikler om dagen, fridage, månedsloft; omskrivning højst sin dagskvote), og workflowet kører aldrig
// to gange samtidig (concurrency). GitHubs tidsplan bliver stående som reserve (flyttes til minut 43, når
// ingen planlagt kørsel står i kø — 29/10 forsvandt en kørsel, da workflow-filen blev ændret undervejs).
//
// Opskriften er lånt fra techfeedwatch's tfw-starter (15/10-2026), men koden og nøglen er tma-starters egne.
// Nøglen (GITHUB_TOKEN) kan KUN starte kørsler i repoet techmediaarch ("Actions: Read and write").

const REPO = 'jacobolsenjso-cloud/techmediaarch';
const WORKFLOW = 'robot-tidsplan.yml';

// Hvornår robotten startes (UTC): 07:43 og 15:43, mandag-lørdag = 08:43 og 16:43 dansk vintertid.
// Minut 43 (Jacob 4/11): skævt (GitHub har travlest på hele og halve timer) og aldrig samtidig med
// techfeedwatch's starter (minut 17 og 37 hver time). Ren funktion, så den kan testes uden net (test.mjs).
export function skalStarte(tid) {
  const dag = tid.getUTCDay(); // 0 = søndag
  return dag !== 0 && tid.getUTCMinutes() === 43 && [7, 15].includes(tid.getUTCHours());
}

async function start(env) {
  // GitHub svarer 204 (intet indhold), når kørslen er sat i gang.
  for (let forsoeg = 0; forsoeg < 3; forsoeg++) {
    if (forsoeg) await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'tma-starter',
        'content-type': 'application/json',
      },
      // "artikel" = det samme som tidsplanen: dagens nye artikel OG omskrivning (plan.mjs afgør begge)
      body: JSON.stringify({ ref: 'main', inputs: { opgave: 'artikel' } }),
    });
    if (r.status === 204) { console.log(`startet: ${WORKFLOW}`); return true; }
    // 401/403/404/422 er en nøgle- eller navnefejl: at prøve igen hjælper ikke.
    const tekst = (await r.text()).slice(0, 200);
    console.log(`FEJL ${r.status} for ${WORKFLOW}: ${tekst}`);
    if ([401, 403, 404, 422].includes(r.status)) return false;
  }
  return false;
}

export default {
  async scheduled(controller, env, ctx) {
    const tid = new Date(controller.scheduledTime);
    if (!skalStarte(tid)) { console.log(`intet at starte kl. ${tid.toISOString()}`); return; }
    if (!env.GITHUB_TOKEN) { console.log('FEJL: GITHUB_TOKEN mangler (sættes af Jacob i Cloudflare)'); return; }
    ctx.waitUntil(start(env));
  },
  // Ingen offentlig adresse: alt andet end tidsplanen svarer 404.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
