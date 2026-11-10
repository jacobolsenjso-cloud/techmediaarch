// /app-data/nyeste.json (10/11-2026, appen trin 3): de 20 nyeste artikler til push-tjenesten tma-push
// (cloudflare/tma-push). Kun det, en besked skal bruge: adresse, titel, udgivelsestidspunkt og hylde.
// Lille med vilje — tma-push henter den én gang pr. udsendelse og ved hver /besked.
import { INDLAEG } from '../../lib/indhold';
import { hyldeFor } from '../../lib/hylder';
export function GET() {
  const data = INDLAEG.slice(0, 20).map((p) => ({ u: p.href, t: p.title, p: p.published, h: hyldeFor(p)?.navn || '' }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
