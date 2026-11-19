// Prøve af natteregelen i robot/plan.mjs (Jacob 12/11-2026) — ingen artikler, intet net:  node robot/test-plan.mjs
const { maaUdgive, erNat, FRIDAGE, OMSKRIV_FRIDAGE, MAANED_LOFT_KR, OMSKRIV_LOFT_KR, GOOGLE_LOFT_KR } = await import('./plan.mjs');
const proever = [
  ['2026-11-15T23:31:00Z', true],  // 00:31 mandag (vintertid) — som #84 (19/11: mandage, torsdag er fridag)
  ['2026-11-16T04:59:00Z', true],  // 05:59
  ['2026-11-16T05:00:00Z', false], // 06:00
  ['2026-11-16T07:43:00Z', false], // 08:43 (tma-starter)
  ['2026-11-16T22:59:00Z', false], // 23:59
  ['2026-07-05T22:30:00Z', true],  // 00:30 mandag, sommertid
  ['2026-07-06T04:05:00Z', false], // 06:05 mandag, sommertid
];
let fejl = 0;
for (const [t, nat] of proever) {
  const d = new Date(t); const r = maaUdgive(d, []);
  const ok = erNat(d) === nat && (nat ? !r.ok && r.grund.startsWith('nat') : !r.grund.startsWith('nat'));
  if (!ok) fejl++;
  console.log(ok ? 'OK  ' : 'FEJL', t, 'nat=' + erNat(d), '|', r.grund);
}
// Rytme (19/11-2026): nye artikler kun mandag, onsdag, fredag kl. 10 dansk tid (uge 47)
for (const [d, ok] of [['2026-11-16', true], ['2026-11-17', false], ['2026-11-18', true], ['2026-11-19', false], ['2026-11-20', true], ['2026-11-21', false], ['2026-11-22', false]]) {
  const r = maaUdgive(new Date(d + 'T09:00:00Z'), []);
  const godt = r.ok === ok && (ok || r.grund.startsWith('fridag'));
  if (!godt) fejl++;
  console.log(godt ? 'OK  ' : 'FEJL', d, 'ny artikel:', r.ok, '|', r.grund);
}
const sammeDage = JSON.stringify([...FRIDAGE].sort()) === JSON.stringify([...OMSKRIV_FRIDAGE].sort());
if (!sammeDage) fejl++; console.log(sammeDage ? 'OK  ' : 'FEJL', 'omskrivning har samme fridage som nye artikler');
const lofter = MAANED_LOFT_KR < GOOGLE_LOFT_KR && OMSKRIV_LOFT_KR < MAANED_LOFT_KR;
if (!lofter) fejl++; console.log(lofter ? 'OK  ' : 'FEJL', `lofter: omskriv ${OMSKRIV_LOFT_KR} < nye ${MAANED_LOFT_KR} < Googles ${GOOGLE_LOFT_KR} kr`);
console.log(fejl ? `${fejl} FEJL` : 'alt OK');
