// Forældet-vagten (Jacob 31/10-2026): er et produkt, en funktion eller en plan i artiklen udgået, nedlagt eller erstattet?
// Målt 31/10 (kørsel #55 og prøve #41): når Gemini skulle svare i JSON, søgte den ikke på Google (0 søgekilder), og
// "Microsoft Publisher" og "Windows 10 security updates" blev stående, selv om begge er ved at udgå. Et forskningsspørgsmål
// med punkter og en slutlinje ("VERDICT: …") får den til at søge — samme form som researchen, der altid søger.
import { skriv } from './gemini.mjs';

// Returnerer { forældet: true|false|null, status, kilder } — null = kunne ikke afgøres (tæller som "ikke bekræftet").
export async function tjekForaeldet(hvad, saetning, idag = new Date().toISOString().slice(0, 10)) {
  const r = await skriv(`Use Google Search to research this question. Today is ${idag}.
Is "${hvad}" still current, or has it been discontinued, deprecated, retired, removed, renamed or replaced (or is it scheduled to be)?
Context - a sentence from an article: "${saetning}"
Answer with 1-3 short bullet points with dates from the search results, then a final line that is exactly one of:
VERDICT: OUTDATED
VERDICT: CURRENT`, { soeg: true, temperatur: 0 });
  const dom = (r.tekst.match(/VERDICT:\s*(OUTDATED|CURRENT)/i) || [])[1];
  const status = r.tekst.replace(/VERDICT:.*$/is, '').replace(/^\s*[-*•]\s*/gm, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return { forældet: dom ? dom.toUpperCase() === 'OUTDATED' : null, status, kilder: r.kilder.length };
}
