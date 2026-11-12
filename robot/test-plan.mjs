// Prøve af natteregelen i robot/plan.mjs (Jacob 12/11-2026) — ingen artikler, intet net:  node robot/test-plan.mjs
const { maaUdgive, erNat } = await import('./plan.mjs');
const proever = [
  ['2026-11-11T23:31:00Z', true],  // 00:31 torsdag (vintertid) — som #84
  ['2026-11-12T04:59:00Z', true],  // 05:59
  ['2026-11-12T05:00:00Z', false], // 06:00
  ['2026-11-12T07:43:00Z', false], // 08:43 (tma-starter)
  ['2026-11-12T22:59:00Z', false], // 23:59
  ['2026-07-01T22:30:00Z', true],  // 00:30 sommertid
  ['2026-07-01T04:05:00Z', false], // 06:05 sommertid
];
let fejl = 0;
for (const [t, nat] of proever) {
  const d = new Date(t); const r = maaUdgive(d, []);
  const ok = erNat(d) === nat && (nat ? !r.ok && r.grund.startsWith('nat') : !r.grund.startsWith('nat'));
  if (!ok) fejl++;
  console.log(ok ? 'OK  ' : 'FEJL', t, 'nat=' + erNat(d), '|', r.grund);
}
console.log(fejl ? `${fejl} FEJL` : 'alt OK');
