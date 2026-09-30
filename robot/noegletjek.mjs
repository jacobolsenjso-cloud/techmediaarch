// Tjekker, at robottens nøgler virker — uden at skrive nøglerne ud.
// Hver test melder kun "virker" eller en fejlkode + kort grund.
// Kør på GitHub (workflowet "Robot", opgave "noegletjek").
import fs from 'node:fs';

const CF_KONTO = '34f0e1dc54050e97066f335a6911c54f'; // Cloudflare-kontoens id (ikke hemmeligt)
const TEKSTMODEL = 'gemini-3.5-flash-lite';

// Fjern alt, der ligner en nøgle, fra fejltekster, før de skrives ud.
const skjul = (t) => String(t).replace(/AIza[0-9A-Za-z_-]{20,}/g, '***').replace(/[A-Za-z0-9_-]{32,}/g, '***').slice(0, 160);
const linjer = ['# Nøgletjek — techmediaarch-robotten', ''];
const meld = (navn, ok, detalje) => { linjer.push(`- ${ok ? '✅' : '❌'} **${navn}** — ${detalje}`); };

async function kald(url, opt = {}) {
  const r = await fetch(url, opt);
  const tekst = await r.text();
  let json = null; try { json = JSON.parse(tekst); } catch {}
  return { status: r.status, ok: r.ok, json, tekst };
}

// 1. Gemini: hvilke modeller må projektet bruge?
const G = process.env.GEMINI_API_KEY;
let modeller = [];
if (!G) meld('Gemini', false, 'GEMINI_API_KEY mangler');
else {
  const r = await kald('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': G } });
  if (!r.ok) meld('Gemini: modelliste', false, `HTTP ${r.status} ${skjul(r.json?.error?.message || '')}`);
  else {
    modeller = (r.json.models || []).map((m) => m.name.replace('models/', ''));
    const billede = modeller.filter((m) => /image/i.test(m));
    meld('Gemini: modelliste', true, `${modeller.length} modeller. Billedmodeller: ${billede.join(', ') || 'ingen'}`);
  }
  // 2. Gemini: skriv én kort sætning.
  const t = await kald(`https://generativelanguage.googleapis.com/v1beta/models/${TEKSTMODEL}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': G, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }] }),
  });
  meld(`Gemini tekst (${TEKSTMODEL})`, t.ok, t.ok ? `svar: "${skjul(t.json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()}"` : `HTTP ${t.status} ${skjul(t.json?.error?.message || '')}`);
  // 3. Gemini med Google-søgning (kilder til artiklerne).
  const s = await kald(`https://generativelanguage.googleapis.com/v1beta/models/${TEKSTMODEL}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': G, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'What is Kubernetes? One sentence.' }] }], tools: [{ google_search: {} }] }),
  });
  const kilder = s.json?.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0;
  meld('Gemini med Google-søgning', s.ok, s.ok ? `${kilder} kilder fundet` : `HTTP ${s.status} ${skjul(s.json?.error?.message || '')}`);
  // 4. Gemini-billede: prøv den første billedmodel, projektet har.
  const bm = modeller.find((m) => /image/i.test(m) && /flash/i.test(m)) || modeller.find((m) => /image/i.test(m));
  if (!bm) meld('Gemini billede', false, 'ingen billedmodel på listen');
  else {
    const b = await kald(`https://generativelanguage.googleapis.com/v1beta/models/${bm}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': G, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'A simple flat illustration of a blue cloud icon on a white background.' }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    });
    const del = (b.json?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
    meld(`Gemini billede (${bm})`, Boolean(b.ok && del), b.ok ? (del ? `billede på ${Math.round(del.inlineData.data.length * 0.75 / 1024)} KB` : 'svar uden billede') : `HTTP ${b.status} ${skjul(b.json?.error?.message || '')}`);
  }
}

// 5. YouTube: søg efter én video.
const Y = process.env.YOUTUBE_API_KEY;
if (!Y) meld('YouTube', false, 'YOUTUBE_API_KEY mangler');
else {
  const r = await kald(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent('what is kubernetes')}&key=${Y}`);
  meld('YouTube-søgning', r.ok, r.ok ? `${r.json.items?.length || 0} videoer fundet` : `HTTP ${r.status} ${skjul(r.json?.error?.message || '')}`);
}

// 6. Cloudflare Workers AI: lav ét lille billede.
const C = process.env.CLOUDFLARE_AI_TOKEN;
if (!C) meld('Cloudflare Workers AI', false, 'CLOUDFLARE_AI_TOKEN mangler');
else {
  const r = await kald(`https://api.cloudflare.com/client/v4/accounts/${CF_KONTO}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: 'POST', headers: { authorization: `Bearer ${C}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'A simple flat illustration of a blue cloud icon on a white background.', steps: 4 }),
  });
  const img = r.json?.result?.image;
  meld('Cloudflare billede (flux-1-schnell)', Boolean(r.ok && img), r.ok ? (img ? `billede på ${Math.round(img.length * 0.75 / 1024)} KB` : 'svar uden billede') : `HTTP ${r.status} ${skjul(r.json?.errors?.[0]?.message || '')}`);
}

// 7-8. Search Console og Google Analytics med tjenestekontoen (30/9: Best of each topic og Trending bruger dem)
if (!process.env.GSC_SERVICE_ACCOUNT_JSON) meld('Search Console / Analytics', false, 'GSC_SERVICE_ACCOUNT_JSON mangler');
else {
  const { hentSider } = await import('./lib/searchconsole.mjs');
  const { hentSidevisninger, EJENDOM_ID } = await import('./lib/analytics.mjs');
  try { const s = await hentSider({ dage: 90 }); meld('Search Console (klik pr. side, 90 dage)', true, `${s.sider.length} sider, ${s.sider.reduce((a, x) => a + x.klik, 0)} klik`); }
  catch (e) { meld('Search Console (klik pr. side, 90 dage)', false, skjul(e.message || e)); }
  try { const a = await hentSidevisninger({ dage: 7 }); meld(`Google Analytics (ejendom ${EJENDOM_ID}, 7 dage)`, true, `${a.sider.length} sider, ${a.sider.reduce((x, y) => x + y.visninger, 0)} sidevisninger`); }
  catch (e) { meld(`Google Analytics (ejendom ${EJENDOM_ID}, 7 dage)`, false, skjul(e.message || e)); }
}

const md = linjer.join('\n') + '\n';
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
