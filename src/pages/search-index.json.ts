// Let søgeindeks til søgefeltet: titel, beskrivelse, emner, labels, billede, dato.
import { INDLAEG, datoTekst, synligeEtiketter } from '../lib/indhold';
export function GET() {
  const data = INDLAEG.map((p) => ({ t: p.title, d: p.description, u: p.href, i: p.image, e: p.emner.map((e) => e.navn), l: synligeEtiketter(p), p: datoTekst(p.published) }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
