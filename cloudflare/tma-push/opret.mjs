// Opretter tma-push (10/11-2026, appen trin 3). Efter techfeedwatchs cloudflare/push/opret.mjs.
//   1. Bruger lageret (KV) "tma-push-subs", som er lavet i forvejen (id'et gives med, se nedenfor).
//   2. Laver VAPID-nøgleparret (push-nøglen). Den HEMMELIGE halvdel findes kun i hukommelsen her: den lægges
//      direkte i Cloudflare som secret VAPID_PRIVATE_JWK og skrives aldrig til disk eller skærm.
//   3. Skriver wrangler.toml med den offentlige halvdel (den er offentlig og står også i sitets kode).
//   4. Udgiver Workeren — altid med "-c wrangler.toml", ALDRIG uden: så ville wrangler tage sitets egen
//      opsætning i repoets rod (fundet 4/11 ved tma-starter).
//
// Kør KUN én gang. Et nyt nøglepar gør alle eksisterende tilmeldinger ugyldige — derfor stopper scriptet,
// hvis wrangler.toml allerede findes.
// Brug (fra cloudflare/tma-push):  node opret.mjs <KV-id>
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const TOML = 'wrangler.toml';
const kør = (cmd, input) => execSync(cmd, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
if (fs.existsSync(TOML)) { console.log('STOP: wrangler.toml findes allerede. Et nyt nøglepar ville afmelde alle læsere.'); process.exit(1); }

// 1. Lageret laves FØRST for sig (npx wrangler kv namespace create tma-push-subs), og id'et gives med her:
//    kv-kommandoen kan spørge interaktivt om at rette sitets wrangler.jsonc — det skal den ikke have lov til i et script.
const kvId = process.argv[2];
if (!/^[0-9a-f]{32}$/.test(kvId || '')) { console.log('Brug: node opret.mjs <KV-id fra "wrangler kv namespace create tma-push-subs">'); process.exit(1); }

// 2. Nøgleparret
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const offentlig = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))).toString('base64url');
const privat = JSON.stringify(await crypto.subtle.exportKey('jwk', par.privateKey));

// 3. Opsætningen
fs.writeFileSync(TOML, [
  '# tma-push (10/11-2026, appen trin 3): push-beskeder for techmediaarch.com. Lavet af opret.mjs.',
  '# Udgives KUN med udgiv.cmd i denne mappe (= npx wrangler deploy -c wrangler.toml).',
  'name = "tma-push"',
  'main = "worker.mjs"',
  'compatibility_date = "2026-11-01"',
  '# Offentlig adresse (workers.dev): sitet sender tilmeldinger hertil og henter beskedens tekst.',
  'workers_dev = true',
  'preview_urls = false',
  '',
  '[[kv_namespaces]]',
  'binding = "SUBS"',
  `id = "${kvId}"`,
  '',
  '# Højst 10 tilmeldinger i minuttet pr. afsender (som tfw-push), ellers kunne et script fylde lageret.',
  '# namespace_id 1702: techfeedwatch bruger 1701 — de to tællere må ikke blandes.',
  '[[ratelimits]]',
  'name = "BEGRAENS"',
  'namespace_id = "1702"',
  'simple = { limit = 10, period = 60 }',
  '',
  '# Udsendelsen: hvert 10. minut 17:00-18:50 UTC = 18:00-19:50 dansk vintertid (19:00-20:50 sommertid),',
  '# efter eftermiddagens artikel (robotten starter 16:43). Én portion á 40 pr. kørsel; KV sørger for, at',
  '# ingen får to beskeder samme dag. 12 kørsler = plads til ca. 480 tilmeldte — skal udvides, når der er flere.',
  '# Bruger 1 af kontoens 5 gratis tidsplaner (de andre: tfw-starter, tma-starter).',
  '[triggers]',
  'crons = ["*/10 17-18 * * *"]',
  '',
  '[vars]',
  '# Den OFFENTLIGE halvdel af push-nøglen (står også i sitets kode, src/layouts/MainLayout.astro). Den hemmelige',
  '# halvdel er secret VAPID_PRIVATE_JWK, lagt af opret.mjs uden at blive vist eller gemt.',
  `VAPID_PUBLIC = "${offentlig}"`,
  '',
  '# Ingen logning: privatlivspolitikken lover, at vi ikke gemmer IP-adresser med tilmeldingen.',
  '[observability]',
  'enabled = false',
  '',
].join('\n'));
fs.writeFileSync('vapid-public.txt', offentlig + '\n');
console.log('wrangler.toml skrevet. Offentlig nøgle:', offentlig);

// 4. Udgiv og læg den hemmelige halvdel
const ud = kør('npx --yes wrangler deploy -c wrangler.toml');
console.log(ud.split('\n').filter((l) => /Uploaded|Deployed|https:\/\/|Version ID|schedule|cron/i.test(l)).join('\n'));
const sec = kør('npx --yes wrangler secret put VAPID_PRIVATE_JWK -c wrangler.toml', privat);
console.log(sec.split('\n').filter((l) => /Success|uploaded/i.test(l)).join('\n') || 'secret: intet svar — tjek manuelt');
