// Måler dublet-tjekket (lag 1-2) på kendte par, så grænserne ikke er gætværk.
// Parrene er taget fra techfeedwatchs brugte spørgsmål (src/data/used-questions.json,
// 126 stk. 26/9-2026) og håndmærket: SAMME = samme hensigt, FORSKELLIG = to artikler.
// Kør: node robot/kalibrer.mjs  — ingen nøgler, intet netværk.
import { kerne } from './lib/tekst.mjs';
import { sammenlign, lavIndeks, tjek } from './lib/dubletter.mjs';
import { artikler } from './lib/arkiv.mjs';

const SAMME = [
  ['what are augmented reality glasses', 'what is augmented reality glasses'],
  ['what are augmented reality smart glasses', 'what are augmented reality glasses'],
  ['what is augmented reality (ar)', 'what is augmented reality technology'],
  ['what is augmented reality in simple words', 'what is augmented reality mean'],
  ['how to use augmented reality in education', 'how to use augmented reality in educational settings'],
  ['how to use augmented reality in education', 'how does augmented reality help in education'],
  ['how to use augmented reality in education', 'how to use augmented reality in classroom'],
  ['what is augmented reality vs virtual reality', 'difference between augmented reality and virtual reality'],
  ['what are augmented reality apps', 'what are augmented reality applications'],
  ['what are ai chipsets', 'what is ai chipset'],
  ['how are ai chips designed', 'how are ai chips created'],
  ['how are ai videos generated', 'how are ai videos made'],
  ['what is ai video generator', 'what are ai video generator'],
  ['why is cybersecurity so important', 'why cybersecurity matters'],
  ['what is quantum computing in simple terms', 'what is quantum computing with example'],
  ['how does augmented reality work', 'how does augmented reality work step by step'],
  ['what is augmented reality examples', 'what is augmented reality technology'],
  ['how does augmented reality work', 'what is augmented reality technology'],
];
const FORSKELLIG = [
  ['what are augmented reality darts', 'what are augmented reality glasses'],
  ['what are augmented reality games', 'what are augmented reality apps'],
  ['how to use augmented reality on iphone', 'how to use augmented reality in google maps'],
  ['how are ai chips different from gpus', 'how are ai chips designed'],
  ['what are quantum computing companies', 'what are quantum computing threats'],
  ['how does quantum computing affect ai', 'what is quantum computing good for'],
  ['how to use nist cybersecurity framework', 'what are cybersecurity risks'],
  ['what is seo stand for', 'how does seo optimization work'],
  ['how does augmented reality work', 'what are augmented reality darts'],
  ['what is augmented reality art', 'what is augmented reality bowling'],
  ['what are ai chips in laptops', 'what are ai chips nvidia'],
  ['what is cybersecurity analyst', 'what is cybersecurity engineering'],
];

const vis = (d) => (d ? d.dom : 'fri');
let ok = 0, alle = 0;
console.log('SAMME (skal være afvist eller tvivl):');
for (const [a, b] of SAMME) {
  const d = sammenlign(kerne(a), kerne(b)); alle++; if (d) ok++;
  console.log(`  ${d ? 'OK ' : 'MISSET'} ${vis(d).padEnd(6)} ${a}  |  ${b}`);
}
console.log('FORSKELLIG (skal være fri eller tvivl — aldrig afvist):');
for (const [a, b] of FORSKELLIG) {
  const d = sammenlign(kerne(a), kerne(b)); alle++; if (!d || d.dom !== 'afvist') ok++;
  console.log(`  ${d?.dom === 'afvist' ? 'FEJL' : 'OK  '} ${vis(d).padEnd(6)} ${a}  |  ${b}`);
}
console.log(`\nRigtige: ${ok}/${alle}`);

// Hvor mange af sitets egne 193 titler ville blive afvist mod resten? (falske alarmer)
const al = artikler();
let af = 0, tv = 0;
const eksempler = [];
for (let i = 0; i < al.length; i++) {
  const resten = lavIndeks(al.filter((_, j) => j !== i));
  const r = tjek(al[i].titel, resten);
  if (r.dom === 'afvist') { af++; eksempler.push(`  afvist: ${al[i].titel}  ←  ${r.mod}`); }
  if (r.dom === 'tvivl') tv++;
}
console.log(`\nSitets ${al.length} titler mod hinanden: ${af} afvist, ${tv} tvivl`);
console.log(eksempler.join('\n'));
