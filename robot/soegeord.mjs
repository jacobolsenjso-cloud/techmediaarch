// TRIN 1 — søgeordsværktøjet. Laver KUN en læseliste; udgiver intet og
// ændrer ingen filer i sitet.
//
// For hvert emne i menuen:
//  1. henter spørgsmål fra Googles autoforslag (startord i robot/froe.json)
//  2. smider dem væk, der allerede er dækket af en artikel (robot/lib/dubletter.mjs)
//  3. samler de bedste i pakker: 1 hovedsøgeord + 5 beslægtede
// Derudover, hvis Search Console-nøglen findes: søgninger hvor Google allerede
// viser en af sitets artikler (→ styrk den artikel i stedet for at skrive ny).
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
import { artikler, antalPrEmne, antalPrHylde, brugte, proevedeForNylig, emner, sti } from './lib/arkiv.mjs';
import { lavIndeks, tjek, sammenlign, mestEns, geminiSammeHensigt, delvistOverlap } from './lib/dubletter.mjs';
import { kerne, normaliser } from './lib/tekst.mjs';
import { gemPrisVedExit } from './lib/gemini.mjs';
import { hentTal, saldo, vaerdi, gruppe, talTekst, SALDO_ADVARSEL } from './lib/dataforseo.mjs';
gemPrisVedExit('soegeord');   // pristælleren (trin 7): Geminis dublet-tjek (lag 3) koster også

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
// Præfikser, der KUN må blive hovedsøgeord, når DataForSEO viser mindst DATA_HOVED_MIN søgninger/md (9/11-2026).
// Måling #54: "is cybersecurity a good career" (2.400/md, sværhed 6) og "how much does cybersecurity pay" (4.400/md,
// sværhed 10) blev aldrig valgt, fordi præfikset var spærret. Uden søgetal er de stadig for smalle.
const DATA_HOVED = new Set(['is', 'can', 'how much does', 'should i']);
const DATA_HOVED_MIN = 100;

const froe = JSON.parse(fs.readFileSync(sti('robot/froe.json'), 'utf8'));
const alle = artikler();
const optalt = antalPrEmne(alle);
const indeks = lavIndeks(alle, brugte(), { afsnit: true });   // også afsnitsoverskrifter (9/11-2026, rettelse 1)
const hvilende = new Set(proevedeForNylig(30).map((x) => normaliser(x.q)));

// Emner i den rækkefølge, rotationen senere vil tage dem. Trin 7 (Jacob 29/10-2026): kun emner på de 5 hylder
// (robot/lib/arkiv.mjs), og den TYNDESTE HYLDE først (så hylderne vokser mod de 20-30 svar hver), derefter det
// tyndeste emne på hylden. Før gik det efter emnet alene, så Fintech, Crypto og Web3 kom først.
const prHylde = antalPrHylde(alle);
const hyldeAf = Object.fromEntries(emner().map((e) => [e.etiket, e.hylde]));
const emneListe = emner().map((e) => e.etiket)
  .filter((n) => !KUN_EMNE || n.toLowerCase() === KUN_EMNE.toLowerCase())
  .sort((a, b) => prHylde[hyldeAf[a]] - prHylde[hyldeAf[b]] || optalt[a] - optalt[b]);

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
let geminiKoert = 0; let geminiDelvis = 0;
// Den gamle rækkefølge for hovedsøgeord (bruges stadig, når søgetal mangler eller er lige):
// fri før tvivl · mindst 3 tætte naboer · præfiks-lag 1 før 2 (før "kun med søgetal") · flest naboer (op til 5) · Googles rækkefølge.
const lag = (x) => HOVED_LAG[x.praefiks] || 3;
const gammelOrden = (a, b) => (a.dom === b.dom ? 0 : a.dom === 'fri' ? -1 : 1)
  || (a.naboer >= 3 ? 0 : 1) - (b.naboer >= 3 ? 0 : 1)
  || lag(a) - lag(b)
  || Math.min(b.naboer, 5) - Math.min(a.naboer, 5) || a.plads - b.plads || b.q.length - a.q.length;

// Forberedelse for ALLE emner (dubletter + mulige hovedsøgeord), så søgetallene kan hentes i ét kald bagefter.
const forb = {};
for (const emne of emneListe) {
  // omFroe køres også her, så gemte forslag (--fra) får samme filter som nye.
  const liste = (raa[emne] || []).filter((x, i, a) => a.findIndex((y) => y.q === x.q) === i && (froe[emne] || []).includes(x.froe) && omFroe(x.q, x.froe));
  const vurderet = liste.map((x) => {
    if (hvilende.has(normaliser(x.q))) return { ...x, dom: 'afvist', grund: 'prøvet for nylig (hviler 30 dage)', mod: '' };
    return { ...x, ...tjek(x.q, indeks) };
  });
  const fri = vurderet.filter((x) => x.dom === 'fri');
  const tvivl = vurderet.filter((x) => x.dom === 'tvivl');
  // Mulige hovedsøgeord: forklarende præfiks (eller et "kun med søgetal"-præfiks) og mindst 2 kerneord.
  const mulige = [...fri, ...tvivl]
    .filter((x) => (HOVED_LAG[x.praefiks] || DATA_HOVED.has(x.praefiks)) && kerne(x.q).size >= 2)
    .map((x) => ({ ...x, naboer: naboer(x, vurderet) }))
    .sort(gammelOrden);
  forb[emne] = { liste, vurderet, fri, tvivl, mulige };
}

// --- Søgetal (DataForSEO, Jacob 9/11-2026) ---------------------------------
// Ét kald med højst 700 spørgsmål: emnerne på skift i den gamle rækkefølge, så hvert emne får tal på sine bedste bud.
// Hvad der står i hukommelsen (robot/data/dataforseo.json, 30 dage), sendes ikke igen. Fejler kaldet, kører robotten
// videre i den gamle rækkefølge (og listen siger hvorfor).
const prioriteret = [];
for (let i = 0; emneListe.some((e) => i < forb[e].mulige.length); i++) for (const e of emneListe) if (forb[e].mulige[i]) prioriteret.push(forb[e].mulige[i].q);
const { tal, log: dfs } = await hentTal(prioriteret);
const dfsSaldo = await saldo();
const talFor = (q) => (tal.has(normaliser(q)) ? tal.get(normaliser(q)) : undefined);

for (const emne of emneListe) {
  const { liste, vurderet, fri, tvivl, mulige } = forb[emne];
  const pakker = [];
  // Rækkefølge (9/11-2026): søgeord med mindst 20 søgninger/md først, flest søgninger × lethed først (tidløse vægter
  // ×1,5); derefter dem DataForSEO ikke kender; sidst dem med under 20 søgninger. Ellers som før (gammelOrden).
  // "is …", "can …", "how much does …", "should i …" kan kun blive hovedsøgeord med mindst DATA_HOVED_MIN søgninger.
  const kandidater = mulige
    .map((x) => { const t = talFor(x.q); return { ...x, tal: t, vaerdi: vaerdi(t), gruppe: gruppe(t) }; })
    .filter((x) => HOVED_LAG[x.praefiks] || (x.gruppe === 0 && x.tal.v >= DATA_HOVED_MIN))
    .sort((a, b) => a.gruppe - b.gruppe || b.vaerdi - a.vaerdi || gammelOrden(a, b));
  for (const h of kandidater) {
    if (pakker.length >= PAKKER) break;
    const hk = kerne(h.q);
    // Inden for samme kørsel er vi strenge: også "tvivl" mod en allerede valgt
    // pakke springes over, så listen ikke får to pakker om næsten det samme.
    if (valgteIndeks.some((v) => sammenlign(hk, v.kerne))) continue;
    if (brugteBes.has(normaliser(h.q))) continue;
    // Tvivl: lag 3 (Gemini) afgør, hvis nøglen findes. Ellers markeres den.
    // 5/10-2026: også "fri" med delvist overlap (robot/lib/dubletter.mjs, DELVIS).
    let lag3 = null;
    const delvis = h.dom === 'fri' && delvistOverlap(h.q, indeks);
    if (h.dom === 'tvivl' || delvis) {
      lag3 = await geminiSammeHensigt(h.q, mestEns(h.q, indeks, 10));
      if (lag3) { geminiKoert++; if (delvis) geminiDelvis++; }
      if (lag3?.samme) {
        h.dom = 'afvist'; h.grund = delvis ? 'Gemini: samme hensigt (delvist overlap)' : 'Gemini: samme hensigt'; h.mod = lag3.mod?.tekst || h.mod;
        // Også i læselistens "Afvist", så man kan se, hvad Gemini stoppede
        Object.assign(vurderet.find((x) => x.q === h.q) || {}, { dom: 'afvist', grund: h.grund, mod: h.mod });
        continue;
      }
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
      // Søgetal (9/11-2026): tal mangler = ikke spurgt · null = ukendt hos DataForSEO. Bruges af robot/lib/spredning.mjs.
      ...(h.tal !== undefined ? { tal: h.tal } : {}), vaerdi: h.vaerdi, gruppe: h.gruppe,
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
    // Samme side med og uden Bloggers gamle "?m=1" tælles som én side, og
    // adresser uden www (fra Blogger-tiden) regnes med som samme side.
    const renSti = (u) => u.replace(/^https?:\/\/(www\.)?techmediaarch\.com/, '').replace(/\?m=1$/, '') || '/';
    const prSoegning = new Map();
    for (const r of raekker) {
      const g = prSoegning.get(r.q) || { q: r.q, klik: 0, visninger: 0, sider: new Map() };
      g.klik += r.klik; g.visninger += r.visninger;
      const side = renSti(r.side);
      const s = g.sider.get(side) || { side, visninger: 0, klik: 0, placeringSum: 0 };
      s.visninger += r.visninger; s.klik += r.klik; s.placeringSum += r.placering * r.visninger;
      g.sider.set(side, s);
      prSoegning.set(r.q, g);
    }
    // Hver søgning får den side, Google viser oftest for den (Search Console
    // ved det selv). Første kørsel 26/9 gættede i stedet ud fra overskrifterne
    // og kaldte "is brave browser good" for "uden egen artikel", selv om
    // Brave-anmeldelsen er den side, Google viser.
    const soegninger = [...prSoegning.values()].map((g) => {
      const bedst = [...g.sider.values()].sort((a, b) => b.visninger - a.visninger)[0];
      return { q: g.q, klik: g.klik, visninger: g.visninger, side: bedst.side, placering: Math.round((bedst.placeringSum / bedst.visninger) * 10) / 10 };
    });
    // En af sitets sider (ikke forsiden) vises allerede → styrk den (ikke en ny artikel).
    const opdater = soegninger.filter((g) => g.side !== '/' && g.visninger >= 5).sort((a, b) => b.visninger - a.visninger);
    // Kun forsiden vises → ofte navne-søgninger på sitet; resten er mulige nye emner.
    const forsiden = soegninger.filter((g) => g.side === '/' && g.visninger >= 5).sort((a, b) => b.visninger - a.visninger);
    sc = { raekker: raekker.length, soegninger: soegninger.length, opdater, forsiden };
  } catch (e) { sc = { fejl: e.message }; }
}

// --- Klynger (Jacob 6/11-2026, forslag 3) -----------------------------------
// En pakke er en "klynge", når dens søgeord deler mindst 2 kerneord med søgninger, hvor Google ALLEREDE viser en af
// sitets sider (fx MVP, product roadmap, content marketing). Nye artikler om de emner styrker siderne omkring dem og kan
// linke til hinanden. Kun ANTALLET gemmes (repoet er offentligt — søgningerne skrives aldrig ud, Jacobs regel 26/9).
// robot/artikel.mjs tager klynge-pakker før de andre.
if (sc && !sc.fejl) {
  const gscKerner = sc.opdater.map((g) => kerne(g.q));
  for (const r of Object.values(resultat)) for (const p of r.pakker) {
    const pk = [p.hoved, ...p.beslaegtede].map((q) => kerne(q));
    p.klynge = gscKerner.filter((gk) => pk.some((k) => [...k].filter((w) => gk.has(w)).length >= 2)).length;
  }
}

// --- Læselisten ------------------------------------------------------------
const L = [];
const dato = new Date().toISOString().slice(0, 16).replace('T', ' ');
L.push(`# Søgeordsliste — techmediaarch.com`, '', `Lavet ${dato} UTC. Kun til gennemsyn — intet er udgivet.`, '');
const sumP = Object.values(resultat).reduce((s, r) => s + r.pakker.length, 0);
const sumF = Object.values(resultat).reduce((s, r) => s + r.forslag, 0);
const sumA = Object.values(resultat).reduce((s, r) => s + r.afvist.length, 0);
L.push(`**${sumF}** spørgsmål fra Google · **${sumA}** afvist som dubletter · **${sumP}** pakker foreslået · Gemini-tjek (lag 3): ${geminiKoert ? `${geminiKoert} kørt (heraf ${geminiDelvis} for delvist overlap)` : process.env.GEMINI_API_KEY ? 'ikke brugt (ingen tvivlstilfælde blandt de valgte)' : 'ikke kørt (ingen nøgle)'}`, '');
// DataForSEO-linjen (9/11-2026): hvad blev hentet, hvad kostede det, og er saldoen ved at slippe op?
L.push(`**Søgetal (DataForSEO):** ${dfs.fraHusk} fra hukommelsen · ${dfs.sendt} sendt (${dfs.kald} kald) · ${dfs.fundet} fundet · pris $${dfs.pris}`
  + ` · saldo ${dfsSaldo.saldo !== undefined ? `$${dfsSaldo.saldo}` : `ukendt (${dfsSaldo.fejl})`}`
  + `${dfs.fejl ? `  \n⚠ **DataForSEO fejlede: ${dfs.fejl}** — pakkerne er valgt uden søgetal i dag.` : ''}`
  + `${dfsSaldo.saldo !== undefined && dfsSaldo.saldo !== null && dfsSaldo.saldo < SALDO_ADVARSEL ? `  \n⚠ **Saldoen er under $${SALDO_ADVARSEL} — fyld op på app.dataforseo.com.**` : ''}`, '');
for (const emne of emneListe) {
  const r = resultat[emne];
  L.push(`## ${emne} (hylden ${hyldeAf[emne]}: ${prHylde[hyldeAf[emne]]}) — ${r.antal} artikler i dag`, '', `${r.forslag} forslag: ${r.fri} fri, ${r.tvivl} tvivl, ${r.afvist.length} afvist.`, '');
  if (!r.pakker.length) L.push('_Ingen pakker — for få frie forslag. Startordene bør skiftes._', '');
  r.pakker.forEach((p, i) => {
    L.push(`**${i + 1}. ${p.hoved}**  · ${talTekst(p.tal)}${p.klynge ? `  · klynge (${p.klynge} søgninger, Google viser os for)` : ''}${p.tvivlMod ? `  ⚠ tvivl — ligner: "${p.tvivlMod}"` : ''}`);
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
  // KUN ANTAL I LISTEN (Jacobs valg 26/9-2026): repoet er offentligt, så
  // kørslens oversigt og den hentbare fil kan ses af alle. Selve søgningerne,
  // visningerne og siderne bruges af robotten, men skrives aldrig ud.
  const siderMed = new Set(sc.opdater.map((g) => g.side)).size;
  const naer = sc.opdater.filter((g) => g.placering >= 8 && g.placering <= 30).length;
  L.push(`Adgang virker: ${sc.raekker} rækker, ${sc.soegninger} forskellige søgninger de sidste 90 dage.`, '');
  L.push(`- Søgninger hvor Google viser en af dine sider (ikke forsiden, mindst 5 visninger): **${sc.opdater.length}** på ${siderMed} sider, heraf ${naer} tæt på side 1 (placering 8-30).`);
  L.push(`- Søgninger hvor kun forsiden vises (mindst 5 visninger): **${sc.forsiden.length}**.`);
  L.push('', '_Selve søgningerne vises ikke her, fordi loggen er offentlig. Se dem i Search Console._');
}
const md = L.join('\n') + '\n';
fs.mkdirSync(sti('robot/ud'), { recursive: true });
fs.writeFileSync(sti('robot/ud/soegeord-liste.md'), md);
// Search Console også kun som antal i filen (den kan hentes af alle).
const scAntal = sc && !sc.fejl ? { raekker: sc.raekker, soegninger: sc.soegninger, opdater: sc.opdater.length, forsiden: sc.forsiden.length } : sc;
fs.writeFileSync(sti('robot/ud/soegeord-liste.json'), JSON.stringify({ dato, resultat, sc: scAntal, dfs: { ...dfs, saldo: dfsSaldo.saldo ?? null } }, null, 1));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
