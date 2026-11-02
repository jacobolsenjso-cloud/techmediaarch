// Hvem sitet er — ÉT sted (Jacob 2/11-2026, PROMPT-entitet-techmediaarch.md).
// Google og AI-tjenester skal kunne se, at Tech Media Arch er én bestemt ting, og at forfatteren
// i alle artikler er den samme person. Derfor har organisationen og personen hver sit faste @id,
// og alle sider peger på dem i stedet for at gentage dem.
// Faste rammer: kun navnet "Jacob S. Olsen" (aldrig det fulde navn), ingen LinkedIn i sameAs,
// sameAs kun til profiler, Jacob har bekræftet er sitets egne. Opfind aldrig fakta.
export const SITE = 'https://www.techmediaarch.com';
export const BRAND = 'Tech Media Arch';
export const ORG_ID = `${SITE}/#organization`;
export const PERSON_ID = `${SITE}/p/about-us#jacob`;
export const PERSON_NAVN = 'Jacob S. Olsen';
// Titlen (Jacobs valg 2/11-2026) — samme i schema, llms.txt og på about-siden
export const PERSON_TITEL = 'Founder & Editor';
// Startet juli 2024 (Jacob 2/11-2026; den ældste artikel i arkivet er fra juli 2024)
export const STARTET = '2024-07';
export const STARTET_TEKST = 'July 2024';
// Sitets egne profiler (YouTube, Pinterest, X, Facebook …). TOM indtil Jacob har oprettet dem,
// og de linker tilbage til sitet. Én linje pr. profil, fx 'https://www.pinterest.com/techmediaarch/'.
export const PROFILER = [];
// Samme tekst som første afsnit på about-siden (src/content/pages/about-us.md).
// p/[slug].astro stopper byggeriet, hvis de to ikke står ens — så de kan ikke glide fra hinanden.
export const BESKRIVELSE = 'Tech Media Arch is the checked tech answer archive. It collects short, sourced answers to the tech questions people actually ask, and keeps them in one place you can come back to. It was started in July 2024 and is run independently by Jacob S. Olsen from Denmark.';

// emner = de 5 hylders navne (src/lib/hylder.ts), sendes ind så listen kun findes ét sted
export function organisation(emner) {
  return {
    '@type': 'Organization', '@id': ORG_ID, name: BRAND, alternateName: 'techmediaarch.com', url: SITE + '/',
    logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
    description: BESKRIVELSE, email: 'info@techmediaarch.com', foundingDate: STARTET,
    address: { '@type': 'PostalAddress', addressCountry: 'DK' },
    founder: { '@id': PERSON_ID }, knowsAbout: emner,
    ...(PROFILER.length ? { sameAs: PROFILER } : {}),
  };
}
export function person(emner) {
  return {
    '@type': 'Person', '@id': PERSON_ID, name: PERSON_NAVN, jobTitle: PERSON_TITEL,
    url: `${SITE}/p/about-us`, image: `${SITE}/jacob-olsen.png`,
    worksFor: { '@id': ORG_ID }, knowsAbout: emner,
  };
}
// Kort henvisning til udgiveren i artikler (navn med, så den også giver mening alene).
// Forfatteren skrives direkte i artikelskabelonen — se ADVARSEL dér om Astros oversætter.
export const udgiverRef = () => ({ '@type': 'Organization', '@id': ORG_ID, name: BRAND });
