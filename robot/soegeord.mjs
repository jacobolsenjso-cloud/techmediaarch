// TRIN 1 — søgeordsværktøjet. Laver KUN en læseliste; udgiver intet og
// ændrer ingen filer i sitet.
//
// For hvert emne i menuen:
//  1. henter spørgsmål fra Googles autoforslag (startord i robot/froe.json)
//  2. smider dem væk, der allerede er dækket af en artikel (robot/lib/dubletter.mjs)
//  3. samler de bedste i pakker: 1 hovedsøgeord + 5 beslægtede
// Derudover, hvis Search Console-nøglen findes: søgninger hvor en eksisterende
// side næsten er på side 1 (→ opdater den side i stedet for at skrive ny).
//
// Kør:  node robot/soegeord.mjs                  alle emner, 3 pakker pr. emne
//       node robot/soegeord.mjs --emne AI --pakker 5
//       node robot/soegeord.mjs --gem f.json      gem rå autoforslag (til test)
//       node robot/soegeord.mjs --fra f.json      brug gemte autoforslag (ingen net)
// Listen skrives til robot/ud/soegeord-liste.md (og GitHubs job-oversigt).
import fs from 'node:fs';
import path from 'node:path';
import { hentForslag, omFroe } from './lib/autoforslag.mjs';
import { harAdgang, hentSoegninger } from './lib/searchconsole.mjs';
import { artikler, antalPrEmne, brugte, proevedeForNylig, emner, sti } from './lib/arkiv.mjs';
import { lavIndeks, tjek, sammenlign, mestEns, geminiSammeHensigt } from './lib/dubletter.mjs';
import { kerne, normaliser } from './lib/tekst.mjs';

const arg = (navn, std) => { const i = process.argv.indexOf(`--${navn}`); return i > 0 ? process.argv[i + 1] : std; };
const PAKKER = Number(arg('pakker', 3));
const KUN_EMNE = arg('emne', null);
const GEM = arg('gem', null);
const FRA = arg('fra', null);
const BESLAEGTEDE = 5;

// Præfikser, der giver en god artikel som HOVEDSØGEORD (forklarende), i to
// lag. Første kørsel 26/9-2026 valgte mest "how long does it take to ..." og
// "what is the best way to ...", fordi de giver mange næsten-ens forslag —
// men de er for smalle som hele artikler. Lag 2 bruges kun, når lag 1 ikke
// har et hovedsøgeord med mindst 3 tætte naboer.
// "is"/"can"/"should i" er fine som beslægtede, men for smalle som hovedsøgeord.
const HOVED_LAG = { 'what is': 1, 'how does': 1, 'what are': 1, 'how to use': 1, 'difference between': 1, 'why': 1, 'what does': 1,
  'what is the best way to': 2, 'how long does it take to': 2, 'what happens when': 2 };

const froe = JSON.parse(fs.readFileSync(sti('robot/froe.json'), 'utf8'));
const alle = artikler();
const optalt = antalPrEmne(alle);
const indeks = lavIndeks(alle, brugte());
const hvilende = new Set(proevedeForNylig(30).map((x) => normaliser(x.q)));

// Emner i den rækkefølge, rotationen senere vil tage dem: tyndeste først.
const emneListe = emner().map((e) => e.navn)
  .filter((n) => !KUN_EMNE || n.toLowerCase() === KUN_EMNE.toLowerCase())
  .sort((a, b) => optalt[a] - optalt[b]);

// --- 1. Autoforslag -------------------------------------------------------
let raa = {};
if (FRA) raa = JSON.parse(fs.readFileSync(FRA, 'utf8'));
else {
  for (const emne of emneListe) {
    raa[emne] = [];
    for (const f of froe[emne] || []) {
      const { forslag, svar } = await hentForslag(f);
      raa[emne].push(...forslag);
      console.error(`${emne} / ${f}: ${forslag.length} forslag (${svar} af 14 præfikser svarede)`);
    }
  }
  if (GEM) { fs.mkdirSync(path.dirname(path.resolve(GEM)), { recursive: true }); fs.writeFileSync(GEM, JSON.stringify(raa, null, 1)); }
}

// --- 2+3. Dubletter og pakker ---------------------------------------------
// Antal forslag fra samme startord, der deler mindst ét kerneord med x udover
// selve startordet — dvs. hvor mange gode beslægtede søgeord x kan få.
function naboer(x, vurderet) {
  const xk = kerne(x.q); const fk = kerne(x.froe);
  return vurderet.filter((y) => y.q !== x.q && y.froe === x.froe && y.dom !== 'afvist'
    && [...kerne(y.q)].some((w) => xk.has(w) && !fk.has(w))).length;
}
const valgteIndeks = []; // hovedsøgeord valgt i DENNE kørsel — så to pakker ikke bliver ens
const brugteBes = new Set(); // beslægtede søgeord brugt i denne kørsel
const resultat = {};
let geminiKoert = 0;
for (const emne of emneListe) {
  // omFroe køres også her, så gemte forslag (--fra) får samme filter som nye.
  const liste = (raa[emne] || []).filter((x, i, a) => a.findIndex((y) => y.q === x.q) === i && (froe[emne] || []).includes(x.froe) && omFroe(x.q, x.froe));
  const vurderet = liste.map((x) => {
    if (hvilende.has(normaliser(x.q))) return { ...x, dom: 'afvist', grund: 'prøvet for nylig (hviler 30 dage)', mod: '' };
    return { ...x, ...tjek(x.q, indeks) };
  });
  const fri = vurderet.filter((x) => x.dom === 'fri');
  const tvivl = vurderet.filter((x) => x.dom === 'tvivl');
  const pakker = [];
  // Hovedsøgeord: forklarende præfiks, mindst 2 kerneord, Googles højeste plads først.
  const kandidater = [...fri, ...tvivl]
    .filter((x) => HOVED_LAG[x.praefiks] && kerne(x.q).size >= 2)
    .map((x) => ({ ...x, naboer: naboer(x, vurderet) }))
    // Rækkefølge: fri før tvivl · mindst 3 tætte naboer · præfiks-lag 1 før 2 ·
    // flest naboer (op til 5) · Googles rækkefølge.
    .sort((a, b) => (a.dom === b.dom ? 0 : a.dom === 'fri' ? -1 : 1)
      || (a.naboer >= 3 ? 0 : 1) - (b.naboer >= 3 ? 0 : 1)
      || HOVED_LAG[a.praefiks] - HOVED_LAG[b.praefiks]
      || Math.min(b.naboer, 5) - Math.min(a.naboer, 5) || a.plads - b.plads || b.q.length - a.q.length);
  for (const h of kandidater) {
    if (pakker.length >= PAKKER) break;
    const hk = kerne(h.q);
    // Inden for samme kørsel er vi strenge: også "tvivl" mod en allerede valgt
    // pakke springes over, så listen ikke får to pakker om næsten det samme.
    if (valgteIndeks.some((v) => sammenlign(hk, v.kerne))) continue;
    if (brugteBes.has(normaliser(h.q))) continue;
    // Tvivl: lag 3 (Gemini) afgør, hvis nøglen findes. Ellers markeres den.
    let lag3 = null;
    if (h.dom === 'tvivl') {
      lag3 = await geminiSammeHensigt(h.q, mestEns(h.q, indeks, 10));
      if (lag3) geminiKoert++;
      if (lag3?.samme) { h.dom = 'afvist'; h.grund = 'Gemini: samme hensigt'; h.mod = lag3.mod?.tekst || h.mod; continue; }
    }
    // Beslægtede: fra samme startord og ikke selv en eksisterende artikel.
    // Tættest på hovedet først: flest fælles kerneord UDOVER startordet (ellers
    // er "augmented reality art" og "augmented reality in education" "beslægtede").
    // Tætte varianter af hovedet ("... in classroom" til "... in education") er
    // gode beslægtede — artiklen skal også findes på dem, og de gemmes, så de
    // ikke senere bliver deres egen artikel. Kun næsten-ens beslægtede indbyrdes
    // springes over, så de 5 dækker forskellige vinkler.
    const froeKerne = kerne(h.froe);
    const bes = [];
    const brugtePraefikser = new Set([h.praefiks]);
    const mulige = vurderet
      .filter((x) => normaliser(x.q) !== normaliser(h.q) && x.froe === h.froe && x.dom !== 'afvist')
      .map((x) => ({ ...x, naer: [...kerne(x.q)].filter((w) => hk.has(w) && !froeKerne.has(w)).length }))
      .sort((a, b) => b.naer - a.naer || a.plads - b.plads);
    // Runde 1: tæt på + nyt præfiks. Runde 2: tæt på. Runde 3: resten af emnet.
    for (const runde of [1, 2, 3]) {
      for (const x of mulige) {
        if (bes.length >= BESLAEGTEDE) break;
        if (bes.some((b) => b.q === x.q)) continue;
        if (runde < 3 && x.naer < 1) continue;
        if (runde === 1 && brugtePraefikser.has(x.praefiks)) continue;
        const xk = kerne(x.q);
        if (bes.some((b) => sammenlign(xk, kerne(b.q))?.dom === 'afvist')) continue;
        if (valgteIndeks.some((v) => normaliser(v.q) === normaliser(x.q))) continue;
        if (brugteBes.has(normaliser(x.q))) continue; // hvert beslægtet søgeord bruges kun i én pakke
        bes.push(x); brugtePraefikser.add(x.praefiks);
      }
    }
    pakker.push({
      hoved: h.q, praefiks: h.praefiks, plads: h.plads, dom: h.dom,
      tvivlMod: h.dom === 'tvivl' && !lag3 ? h.mod : null,
      beslaegtede: bes.map((b) => b.q), brede: bes.filter((b) => b.naer < 1).map((b) => b.q), mangler: BESLAEGTEDE - bes.length,
    });
    valgteIndeks.push({ q: h.q, kerne: hk });
    for (const b of bes) brugteBes.add(normaliser(b.q));
  }
  resultat[emne] = { antal: optalt[emne], forslag: liste.length, fri: fri.length, tvivl: tvivl.length, afvist: vurderet.filter((x) => x.dom === 'afvist'), pakker };
}

// --- Search Console --------------------------------------------------------
let sc = null;
if (harAdgang()) {
  try {
    const raekker = await hentSoegninger({ dage: 90 });
    const prSoegning = new Map();
    for (const r of raekker) {
      const g = prSoegning.get(r.q) || { q: r.q, klik: 0, visninger: 0, sider: [] };
      g.klik += r.klik; g.visninger += r.visninger; g.sider.push(r);
      prSoegning.set(r.q, g);
    }
    const soegninger = [...prSoegning.values()];
    // Næsten på side 1: position 8-30 med mindst 10 visninger → opdater siden.
    const opdater = soegninger
      .map((g) => ({ ...g, bedst: g.sider.sort((a, b) => b.visninger - a.visninger)[0] }))
      .filter((g) => g.visninger >= 10 && g.bedst.placering >= 8 && g.bedst.placering <= 30)
      .sort((a, b) => b.visninger - a.visninger);
    // Søgninger, vi vises på, men ingen artikel dækker → mulige nye hovedsøgeord.
    const nye = soegninger
      .filter((g) => g.visninger >= 5 && kerne(g.q).size >= 2 && tjek(g.q, indeks).dom === 'fri')
      .sort((a, b) => b.visninger - a.visninger);
    sc = { raekker: raekker.length, soegninger: soegninger.length, opdater, nye };
  } catch (e) { sc = { fejl: e.message }; }
}

// --- Læselisten ------------------------------------------------------------
const L = [];
const dato = new Date().toISOString().slice(0, 16).replace('T', ' ');
L.push(`# Søgeordsliste — techmediaarch.com`, '', `Lavet ${dato} UTC. Kun til gennemsyn — intet er udgivet.`, '');
const sumP = Object.values(resultat).reduce((s, r) => s + r.pakker.length, 0);
const sumF = Object.values(resultat).reduce((s, r) => s + r.forslag, 0);
const sumA = Object.values(resultat).reduce((s, r) => s + r.afvist.length, 0);
L.push(`**${sumF}** spørgsmål fra Google · **${sumA}** afvist som dubletter · **${sumP}** pakker foreslået · Gemini-tjek (lag 3): ${geminiKoert ? `${geminiKoert} kørt` : 'ikke kørt (ingen nøgle endnu)'}`, '');
for (const emne of emneListe) {
  const r = resultat[emne];
  L.push(`## ${emne} — ${r.antal} artikler i dag`, '', `${r.forslag} forslag: ${r.fri} fri, ${r.tvivl} tvivl, ${r.afvist.length} afvist.`, '');
  if (!r.pakker.length) L.push('_Ingen pakker — for få frie forslag. Startordene bør skiftes._', '');
  r.pakker.forEach((p, i) => {
    L.push(`**${i + 1}. ${p.hoved}**${p.tvivlMod ? `  ⚠ tvivl — ligner: "${p.tvivlMod}"` : ''}`);
    p.beslaegtede.forEach((b) => L.push(`   - ${b}${p.brede.includes(b) ? '  _(kun samme emne)_' : ''}`));
    if (p.mangler) L.push(`   - _(${p.mangler} beslægtede mangler)_`);
    L.push('');
  });
  if (r.afvist.length) {
    L.push(`<details><summary>Afvist (${r.afvist.length})</summary>`, '');
    for (const a of r.afvist) L.push(`- ${a.q} — ${a.grund}${a.mod ? `: "${a.mod}"` : ''}`);
    L.push('', '</details>', '');
  }
}
L.push('## Search Console', '');
if (!sc) L.push('_Ikke kørt — nøglen GSC_SERVICE_ACCOUNT_JSON findes ikke her (kører kun på GitHub)._');
else if (sc.fejl) L.push(`**Fejl:** ${sc.fejl}`);
else {
  L.push(`Adgang virker: ${sc.raekker} rækker, ${sc.soegninger} forskellige søgninger de sidste 90 dage.`, '');
  L.push(`### Opdater eksisterende side (position 8-30, mindst 10 visninger) — ${sc.opdater.length}`, '');
  if (!sc.opdater.length) L.push('_Ingen._');
  for (const g of sc.opdater) L.push(`- "${g.q}" — ${g.visninger} visninger, ${g.klik} klik, position ${g.bedst.placering} → ${g.bedst.side.replace('https://www.techmediaarch.com', '')}`);
  L.push('', `### Søgninger uden egen artikel (mindst 5 visninger) — ${sc.nye.length}`, '');
  if (!sc.nye.length) L.push('_Ingen._');
  for (const g of sc.nye) L.push(`- "${g.q}" — ${g.visninger} visninger, ${g.klik} klik`);
}
const md = L.join('\n') + '\n';
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/soegeord-liste.md'), md);
fs.writeFileSync(sti('robot/ud/soegeord-liste.json'), JSON.stringify({ dato, resultat, sc }, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
