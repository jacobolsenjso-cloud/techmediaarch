// Selvtest af søgetallene (DataForSEO, 9/11-2026). Intet net: fetch er udskiftet med falske svar, og hukommelsen
// skrives til en midlertidig fil (aldrig robot/data/dataforseo.json). Kør: node robot/test-dataforseo.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { oversaet, vaerdi, gruppe, hentTal, laesHusk, talTekst, MIN_SOEGNINGER, vaelgHoved, gscOmEmnet, KD_MAKS } from './lib/dataforseo.mjs';
import { spred } from './lib/spredning.mjs';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
const mdr = (xs) => xs.map((v, i) => ({ year: 2026, month: 12 - i, search_volume: v }));
const item = (keyword, v, kd, kurve, yearly = 0) => ({ keyword, keyword_info: { search_volume: v, monthly_searches: mdr(kurve || Array(12).fill(v)), search_volume_trend: { yearly } }, keyword_properties: { keyword_difficulty: kd } });

// 1. Oversættelse og værdi
const cyber = oversaet(item('how much does cybersecurity pay', 4400, 10));
t('jævn kurve = tidløs', cyber.j === true);
t('svingende kurve = ikke tidløs', oversaet(item('x', 500, 10, [2000, 100, 100, 100, 1500, 100, 100, 100, 100, 1500, 100, 100])).j === false);
t(`værdi: 4400 søgn., sværhed 10, tidløs = 4400×0,9³×1,5 = 4811 (${vaerdi(cyber)})`, vaerdi(cyber) === 4811);
t(`sværhed over ${KD_MAKS} = for svær: værdi 0, gruppe 2 (bagerst)`, vaerdi({ v: 22200, kd: KD_MAKS + 1, j: true, a: 0 }) === 0 && gruppe({ v: 22200, kd: KD_MAKS + 1 }) === 2);
t('sværhed præcis på grænsen tæller med', gruppe({ v: 100, kd: KD_MAKS }) === 0 && vaerdi({ v: 1000, kd: KD_MAKS, j: false, a: null }) === 343);
t('lettere spørgsmål med færre søgninger slår sværere med flere (1000/sværhed 0 > 2400/sværhed 30)', vaerdi({ v: 1000, kd: 0, j: false, a: null }) > vaerdi({ v: 2400, kd: 30, j: false, a: null }));
t('under 20 søgninger = værdi 0', vaerdi(oversaet(item('x', MIN_SOEGNINGER - 1, 0))) === 0);
t('ukendt sværhed regnes som 50 (100×0,5³ = 12,5 → 13)', vaerdi({ v: 100, kd: null, j: false, a: null }) === 13);
t('faldet ≥ 50 % på et år ×0,7', vaerdi({ v: 1000, kd: 0, j: false, a: -70 }) === 700);
t('gruppe: ikke spurgt / ukendt / nok / for få = 1/1/0/2', gruppe(undefined) === 1 && gruppe(null) === 1 && gruppe({ v: 20 }) === 0 && gruppe({ v: 19 }) === 2);
t('tekst', talTekst(cyber) === '4400 søgn./md · sværhed 10 · tidløs' && talTekst(null).includes('ukendt') && talTekst(undefined).includes('ikke spurgt'));

// 2. hentTal med falsk fetch og midlertidig hukommelse
const fil = path.join(os.tmpdir(), `_dfs-test-${process.pid}.json`);
const nu = Date.parse('2026-11-09T12:00:00Z');
let sendtSidst = null, tagSidst = null, kaldt = 0, svarKode = 20000;
globalThis.fetch = async (url, opt) => {
  kaldt++;
  if (!String(opt.headers.authorization).startsWith('Basic ')) throw new Error('ingen login sendt');
  sendtSidst = JSON.parse(opt.body)[0].keywords;
  tagSidst = JSON.parse(opt.body)[0].tag;
  return { ok: true, status: 200, json: async () => ({ status_code: 20000, tasks: [{ status_code: svarKode, status_message: svarKode === 20000 ? 'Ok.' : 'Daily limit exceeded', cost: 0.0124,
    result: [{ items: [item('how much does cybersecurity pay', 4400, 10), item('what is a vpn', 0, null)] }] }] }) };
};
delete process.env.DATAFORSEO_LOGIN; delete process.env.DATAFORSEO_PASSWORD;
let r = await hentTal(['how much does cybersecurity pay'], { nu, fil });
t('uden nøgle: intet kald, fejl i loggen, robotten kører videre', kaldt === 0 && /nøglen mangler/.test(r.log.fejl) && r.tal.size === 0);
process.env.DATAFORSEO_LOGIN = 'test'; process.env.DATAFORSEO_PASSWORD = 'test';
r = await hentTal(['How much does cybersecurity pay?', 'what is a vpn', 'what is a vpn', 'can ai be banned', 'x '.repeat(50)], { nu, fil });
t(`sender normaliseret, uden dubletter og uden for lange (${JSON.stringify(sendtSidst)})`, JSON.stringify(sendtSidst) === JSON.stringify(['how much does cybersecurity pay', 'what is a vpn', 'can ai be banned']));
t(`kaldet bærer mærket "tma" (${tagSidst})`, tagSidst === 'tma');
t('fundet → tal, ukendt → null', r.tal.get('how much does cybersecurity pay')?.v === 4400 && r.tal.get('can ai be banned') === null && r.tal.get('what is a vpn')?.v === 0);
t('log: sendt 3, fundet 2, pris', r.log.sendt === 3 && r.log.fundet === 2 && r.log.pris === 0.0124);
r = await hentTal(['how much does cybersecurity pay', 'can ai be banned', 'what is devops'], { nu: nu + 864e5, fil });
t('dagen efter: kun det nye sendes (hukommelsen bruges)', JSON.stringify(sendtSidst) === '["what is devops"]' && r.log.fraHusk === 2);
// Datoer gemmes som hele dage: 30¼ dag efter dag 1 er dag 1's svar glemt, dag 2's ("what is devops") husket
t('efter 30 dage er hukommelsen glemt (dag 1 væk, dag 2 husket)', JSON.stringify(Object.keys(laesHusk(nu + 30.25 * 864e5, fil))) === '["what is devops"]');
t('efter 32 dage er alt glemt', Object.keys(laesHusk(nu + 32 * 864e5, fil)).length === 0);
kaldt = 0;
await hentTal(['a b c', 'd e f', 'g h i'], { nu, fil, maks: 2, kald_: 1 });
t('højst maks søgeord pr. kald og højst kald_ kald', sendtSidst.length === 2 && kaldt === 1);
kaldt = 0;
r = await hentTal(['j k l', 'm n o', 'p q r'], { nu, fil, maks: 2 });
t(`flere kald: 3 søgeord à 2 = 2 kald (${kaldt}), sidste med 1`, kaldt === 2 && sendtSidst.length === 1 && r.log.kald === 2 && r.log.sendt === 3);
// Andet kald fejler: det første kalds svar skal stadig gemmes
const gemtFetch = globalThis.fetch; let n = 0;
globalThis.fetch = async (u, o) => (++n === 2 ? { ok: false, status: 500, json: async () => ({ status_code: 50000, status_message: 'Internal error' }) } : gemtFetch(u, o));
r = await hentTal(['s t u', 'v w x', 'y z aa'], { nu, fil, maks: 2 });
t(`andet kald fejler: første kalds svar gemt, fejl i loggen (${r.log.fejl})`, r.log.kald === 1 && /500/.test(r.log.fejl) && laesHusk(nu, fil)['s t u'] !== undefined && laesHusk(nu, fil)['y z aa'] === undefined);
globalThis.fetch = gemtFetch;
svarKode = 40203;
const foer = fs.readFileSync(fil, 'utf8');
r = await hentTal(['how much does cybersecurity pay', 'helt nyt spørgsmål her'], { nu, fil });
t(`dagsloft nået (40203): fejl i loggen, hukommelsen uændret, kendte tal bruges stadig (${r.log.fejl})`, /40203/.test(r.log.fejl) && fs.readFileSync(fil, 'utf8') === foer && r.tal.get('how much does cybersecurity pay')?.v === 4400);
globalThis.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND api.dataforseo.com'); };
r = await hentTal(['endnu et nyt spørgsmål'], { nu, fil });
t('net nede: ingen undtagelse, fejl i loggen', /ENOTFOUND/.test(r.log.fejl));
fs.unlinkSync(fil);

// 3. Spredning med søgetal
const nye = [{ hoved: 'what is ransomware', hylde: 'cybersecurity' }];
const hylde = { AI: 'ai', Infosec: 'cybersecurity', DevOps: 'software' };
const k = [
  { hoved: 'what is an ai agent', emne: 'AI', gruppe: 2, vaerdi: 0 },                                       // tom hylde, men for få søgninger
  { hoved: 'how does kubernetes work', emne: 'DevOps', gruppe: 1, vaerdi: 0, klynge: 3 },                    // ukendt
  { hoved: 'what is devops engineer', emne: 'DevOps', gruppe: 0, vaerdi: 1100 },
  { hoved: 'how much does cybersecurity pay', emne: 'Infosec', gruppe: 0, vaerdi: 5940 },                    // hylden har fået en ny
  { hoved: 'what is a ci cd pipeline', emne: 'DevOps', gruppe: 0, vaerdi: 700, klynge: 2 },                  // 700×2 = 1400
];
const s = spred(k, nye, (e) => hylde[e]).sorteret.map((p) => p.hoved);
t(`for få søgninger bagerst trods tom hylde (${s.at(-1)})`, s.at(-1) === 'what is an ai agent');
t(`tom hylde før travl hylde: DevOps før Infosec (${s.join(' | ')})`, s.indexOf('what is devops engineer') < s.indexOf('how much does cybersecurity pay'));
t('klynge tæller dobbelt: ci/cd (700×2) før devops engineer (1100)', s[0] === 'what is a ci cd pipeline' && s[1] === 'what is devops engineer');
t('kendte søgetal før ukendte på samme hylde', s.indexOf('what is devops engineer') < s.indexOf('how does kubernetes work'));
// 4. Omskrivning: valg af hovedsøgeord (vaelgHoved) og Search Console-filteret (gscOmEmnet)
const T = { 'what is ransomware': { v: 9900, kd: 70, j: true, a: 0 }, 'ransomware meaning': { v: 1300, kd: 20, j: true, a: 0 },
  'ransomware definition': { v: 15, kd: 10, j: false, a: 0 }, 'how does ransomware attack work': { v: 400, kd: 25, j: true, a: 0 } };
const tf = (q) => (q in T ? T[q] : null);
let v = vaelgHoved([{ q: 'what is ransomware', kilde: 'gemini' }, { q: 'ransomware meaning', kilde: 'gemini' }, { q: 'ransomware definition', kilde: 'gemini' }], tf);
// 13/11: 'what is ransomware' har sværhed 70 = for svær → 'ransomware meaning' (1300×0,8³×1,5 = 998) vælges
t(`for svær taber til et lettere søgeord (${v.valgt.q})`, v.valgt.q === 'ransomware meaning' && v.kendte.length === 1);
v = vaelgHoved([{ q: 'ransomware meaning', kilde: 'gemini' }, { q: 'how does ransomware attack work', kilde: 'gsc', vis: 40 }], tf);
// 998 mod 400×0,75³×1,5×1,5 (Search Console-bonus) = 380 → Geminis vinder stadig
t(`Search Console-bonus ×1,5 vender ikke et klart større tal (${v.valgt.q})`, v.valgt.q === 'ransomware meaning');
v = vaelgHoved([{ q: 'ransomware definition', kilde: 'gemini' }, { q: 'how does ransomware attack work', kilde: 'gsc', vis: 40 }], tf);
t(`kendte søgetal slår for få søgninger (${v.valgt.q}, ${v.grund})`, v.valgt.q === 'how does ransomware attack work');
v = vaelgHoved([{ q: 'ukendt a b', kilde: 'gemini' }, { q: 'ukendt c d', kilde: 'gsc', vis: 12 }], () => null);
t(`ingen søgetal: Search Console-søgningen med flest visninger (${v.grund})`, v.valgt.q === 'ukendt c d' && /Search Console/.test(v.grund));
v = vaelgHoved([{ q: 'ukendt a b', kilde: 'gemini' }, { q: 'ukendt c d', kilde: 'gsc', vis: 4 }], () => undefined);
t(`ingen søgetal og få visninger: Geminis første forslag som før (${v.grund})`, v.valgt.q === 'ukendt a b' && /første forslag/.test(v.grund));
const emne = ['What Is Ransomware and How Does It Work?', 'what is ransomware'];
t('Search Console om emnet tæller (ét kerneord)', gscOmEmnet('how does ransomware work', emne));
t('Search Console om emnet tæller (flere kerneord)', gscOmEmnet('what is ransomware attack', ['What Is a Ransomware Attack?']));
t('et underemne, artiklen ikke handler om, tæller ikke ("ransomware spread")', !gscOmEmnet('how does ransomware spread', emne));
t('bred søgning uden for emnet tæller ikke ("what is ai")', !gscOmEmnet('what is ai', emne) && !gscOmEmnet('what is malware', emne));
t('navnesøgning på sitet tæller aldrig', !gscOmEmnet('techmediaarch ransomware', emne));
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
