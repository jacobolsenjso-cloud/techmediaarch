// Selvtest af talvagt 2 (robot/lib/talvagt.mjs). Kør: node robot/test-talvagt.mjs — intet net.
// Eksemplerne er de målte fejl fra 4/11-2026 ("How Does Generative AI Learn?" m.fl.).
import { enhedFor, talNoegler, kildeIndeks, talUdenKildeV2, ordTilTal } from './lib/talvagt.mjs';
import { kildeHenvisninger, kendtNavn } from './lib/kildenavne.mjs';
let fejl = 0;
const t = (navn, ok) => { console.log(`${ok ? 'OK  ' : 'FEJL'} ${navn}`); if (!ok) fejl++; };
const enhed = (tekst, tal) => enhedFor(tekst, tekst.indexOf(tal), tal.length);
t('"30 to 60 hours": 30 får enheden timer', enhed('takes about 30 to 60 hours over', '30') === 'hour');
t('"30 to 60 hours": 60 får enheden timer', enhed('takes about 30 to 60 hours over', '60') === 'hour');
t('"30-minute course" = minutter', enhed('This 30-minute course includes', '30') === 'minute');
t('"10 to 20 total study hours" = timer', enhed('takes approximately 10 to 20 total study hours', '10') === 'hour');
t('"50 GB" = gb', enhed('a 50 GB mailbox', '50') === 'gb');
t('"25%" = pct', enhed('cut costs by 25% last year', '25') === 'pct');
t('"$300" = usd', enhed('costs $300 per seat', '300') === 'usd');
t('"15 devices" = enheder', enhed('on up to 15 devices', '15') === 'device');
// Kilder: IBM uden timer, TechTarget med "30-minute", Google med "60 minutes", Coursera med "6 hours"
const kilder = [
  { url: 'https://developer.ibm.com/technologies/generative-ai/courses/', titel: 'Generative AI - Courses - IBM Developer' },
  { url: 'https://www.techtarget.com/news/x', titel: 'Top courses | TechTarget' },
  { url: 'https://cloud.google.com/blog/x', titel: 'New trainings | Google Cloud Blog' },
  { url: 'https://www.coursera.org/learn/generative-ai-for-everyone', titel: 'Generative AI for Everyone | Coursera' },
];
const lang = (s) => s + ' ' + 'filler text '.repeat(120);
const idx = kildeIndeks(kilder, [lang('Build guardrails for your AI with open source.'), lang('This 30-minute course includes a certificate.'), lang('Introductory, 60 minutes. Generative AI with'), lang('6 hours to complete. Week 1, 2 hours to complete.')]);
const tjek = (s) => talUdenKildeV2([s], idx, talNoegler(''), kildeHenvisninger, kendtNavn);
t('FANGER: "IBM reports … 30 to 60 hours" (IBM nævner ingen timer)', tjek('IBM reports that acquiring intermediate skills takes about 30 to 60 hours over 1 to 2 months.').length === 1);
t('FANGER: "60 hours" når kilden siger "60 minutes"', tjek('The course takes 60 hours.').length === 1);
t('GODKENDER: "6 hours" fra Coursera', tjek('According to Coursera, the course takes 6 hours to complete.').length === 0);
t('GODKENDER: "60 minutes" (samme enhed, ingen nævnt kilde)', tjek('An introductory module lasts 60 minutes.').length === 0);
t('FANGER: "6 hours" tilskrevet IBM (står kun hos Coursera)', tjek('IBM says the course takes 6 hours.').length === 1);
t('IGNORERER: billedformat "9:16"', tjek('It reframes footage into 9:16 vertical video.').length === 0);
t('FANGER: enkeltciffer med enhed ("over 1 to 2 months"), som ingen kilde har', tjek('Most learners finish over 1 to 2 months.').length === 1);
t('IGNORERER: enkeltciffer uden måleenhed ("3 types", "step 2")', tjek('There are 3 types of models, and step 2 is training.').length === 0);
t('GODKENDER: "2 hours" fra Coursera ("Week 1, 2 hours to complete")', tjek('According to Coursera, each week takes 2 hours to complete.').length === 0);
// Tal skrevet med bogstaver (4/11-2026, prøven af "How Does Generative AI Learn?": "two to four weeks", "six to twelve months")
t('FANGER: "two to four weeks" (ingen kilde har det)', tjek('Non-programmers can gain proficiency within two to four weeks of daily practice.').length === 1);
t('FANGER: "six to twelve months"', tjek('Mastering fine-tuning typically requires six to twelve months of study.').length === 1);
t('GODKENDER: "six hours" når Coursera skriver "6 hours"', tjek('According to Coursera, the course takes six hours to complete.').length === 0);
t('IGNORERER: "one of the" og "two types" (ingen måleenhed)', tjek('One of the two types of models is the transformer.').length === 0);
t('ordTilTal: "twenty-five minutes" → "25 minutes"', ordTilTal('about twenty-five minutes') === 'about 25 minutes');
const idx3 = kildeIndeks([kilder[3]], [lang('Most learners finish in three weeks.')]);
t('GODKENDER: "3 weeks" når kilden skriver "three weeks"', talUdenKildeV2(['Coursera says most learners finish in 3 weeks.'], idx3, talNoegler(''), kildeHenvisninger, kendtNavn).length === 0);
// Fakta-noter gælder kun, når den nævnte kilde ikke kunne læses
const idx2 = kildeIndeks([kilder[0]], ['']);
t('Fakta godkender tal, når kilden ikke kunne læses', talUdenKildeV2(['IBM says it takes 40 hours.'], idx2, talNoegler('IBM: takes 40 hours'), kildeHenvisninger, kendtNavn).length === 0);
t('Fakta godkender IKKE tal, når kilden kunne læses', talUdenKildeV2(['IBM says it takes 40 hours.'], idx, talNoegler('IBM: takes 40 hours'), kildeHenvisninger, kendtNavn).length === 1);
console.log(fejl ? `${fejl} FEJL` : 'alt OK'); process.exit(fejl ? 1 : 0);
