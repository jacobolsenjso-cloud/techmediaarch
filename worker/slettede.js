// Artikler, der er slettet med Jacobs ok. Den gamle adresse sender med 301 videre til
// den nærmeste levende artikel, så links udefra og Googles indeks ikke ender i en 404.
// Bruges af workeren (worker/index.js) og af tjek-site/tjek-live, så de tre altid er enige.
// Tilføj kun en linje her, når artiklens fil er fjernet fra src/content/posts.
// Nøglen er Bloggers gamle adresse (med .html); målet er den nye adresse uden .html (29/9-2026).
export const SLETTEDE = {
  // 28/9-2026: påstod 10 steder at sitet selv havde testet Googles AI, med opfundne tal (Jacob: "du sletter bare den")
  '/2026/06/beyond-hype-technical-breakdown-of-new.html': '/2026/05/google-workspace-studio-analysts-take',
  // 29/10-2026, skridt 3 i svar-arkivet (Jacob: "de skal bare slettes"): 29 ældre artikler uden for sitets 5 hylder
  // (krypto, aktier, investering, rumfart m.m.). Ingen af dem havde 20+ visninger i Google de sidste 3 måneder.
  "/2024/08/explore-wirexs-vision-for-web3-payment.html": "/", // Explore Wirex's vision for a Web3 payment platform, bridging tradition
  "/2024/08/meta-surpasses-q2-forecasts-but-warns.html": "/", // Meta surpasses Q2 forecasts but warns of major spending increase in 20
  "/2024/08/experience-future-of-financial.html": "/", // Experience the Future of Financial Technology with Wirex
  "/2024/08/Cracking the Code A Beginners Guide to Cryptocurrency Basics.html": "/", // Cracking the Code: A Beginner's Guide to Cryptocurrency Basics
  "/2024/08/super-micro-computers-10-for-1-stock.html": "/", // Super Micro Computer's 10-for-1 Stock Split: What Investors Need to Kn
  "/2024/08/the pros and cons of cryptocurrency a guide for investors and beginners alike.html": "/", // The Pros and Cons of Cryptocurrency: A Guide for Investors and Beginne
  "/2024/09/etoro-us-pays-price-agrees-to-15m-fine.html": "/", // eToro US Pays the Price: Agrees to $1.5M Fine and Trading Curbs in SEC
  "/2024/09/blog-post_24.html": "/shelf/software", // The Once-Invincible Tech Career: A New Era of Uncertainty Arrives
  "/2024/09/bondora-passive-income-invest-in-loan-fractions-and-earn-up to-6-percent.html": "/", // Bondora passive Income: Invest in Loan Fractions and Earn Up to 6 % p.
  "/2024/09/bitmex-ceo-us-crypto-by-sector-to-take.html": "/", // BitMEX CEO: US Crypto by Sector to Take a Different Route, Diverging f
  "/2024/09/faq.html": "/p/faq", // FAQ
  "/2024/10/AI Trumps Web3 as Fintech What is Defi and Web3.html": "/", // AI Trumps Web3 as Fintech What is Defi and Web3
  "/2024/10/how defi Is shaping the future of web3.html": "/", // Beyond the Blockchain: How AI-Powered DeFi Is Shaping the Future of We
  "/2024/10/the future of examples of passive income..html": "/shelf/ai", // Transform Your Finances with ChatGPT: 5 Surprising Examples of Passive
  "/2024/10/earn-online-legit-sites-step-by-step.html": "/", // Earn Online Legit Sites - A Step by Step Review of Swashapp!
  "/2024/10/world coin news sam altmans surprise.html": "/", // World Coin News - Sam Altman's Surprise Announcement Rocks the Globe
  "/2024/10/closure-completed-on-dragon.html": "/", // Safe As Closure Completed On Dragon Hatch undocking - The Crew-8 missi
  "/2024/10/the-ultimate-power-list-359-companies.html": "/", // The Ultimate Power List - The 359 Companies Success And Profit
  "/2024/10/Elon musks net worth soars by 30 billion in 24 hours.html": "/", // The Thrust of Success: Elon Musk's Net Worth Soars by $30 Billion in 2
  "/2024/10/wildfire-of-growth-teslas-energy-storage.html": "/", // Wildfire of Growth: Tesla's Energy Storage companies & Business Ignite
  "/2024/12/metaplanet-secures-61-million-to-expand.html": "/", // Metaplanet Secures $61 Million to Expand Bitcoin Holdings, Following M
  "/2024/12/web3s missing piece the grid aims to map blockchain.html": "/", // Web3's Missing Piece The Grid Aims to Map Blockchain Data with New Tec
  "/2025/01/the-clock-is-ticking-quantum-computing-on-the-brink-of-singularity.html": "/2026/05/quantum-computing-demystified-what-it", // The Clock is Ticking Quantum Computing on the Brink of Singularity
  "/2025/01/diversify-your-portfolio-and-boost-your.html": "/", // Diversify Your Portfolio and Boost Your Returns with Mintos
  "/2025/01/The-1-trillion-question-can-tech-stocks-recover-from-deepseeks-impact.html": "/", // The $1 Trillion Question Can Tech Stocks Recover from DeepSeek's Impac
  "/2026/05/strategy-likely-to-sell-bitcoin-to.html": "/", // Strategy likely to sell bitcoin to cover STRC dividends
  "/2026/05/hcl-tech-today-real-time-price-ai.html": "/", // HCL Tech Today: Real-Time Price & AI-Powered Trends—Trade Confidently
  "/2026/05/decoding-power-of-fintech-what.html": "/", // Decoding the Power of Fintech: What Fintech Companies Mean for Banks, 
  "/2026/05/fintech-stocks-sober-analysis-of.html": "/", // Fintech Stocks: A Sober Analysis of the Digital Fintech Xchange
};
