// Søgespørgsmål vist som tekst: "what are phishing emails" -> "What are phishing emails?".
// Akronymer og firmanavne får deres rigtige skrivemåde. Bruges af forsidens "Questions people are asking" (29/9).
const AKRO = { ai: 'AI', seo: 'SEO', ar: 'AR', vr: 'VR', xr: 'XR', llm: 'LLM', llms: 'LLMs', gpu: 'GPU', gpus: 'GPUs', cpu: 'CPU', api: 'API', apis: 'APIs', nft: 'NFT', nfts: 'NFTs', defi: 'DeFi', etf: 'ETF', saas: 'SaaS', ui: 'UI', ux: 'UX', agi: 'AGI', iot: 'IoT', rag: 'RAG', vpn: 'VPN', mfa: 'MFA', sql: 'SQL', html: 'HTML', css: 'CSS', pdf: 'PDF', us: 'US', uk: 'UK', eu: 'EU',
  google: 'Google', youtube: 'YouTube', chatgpt: 'ChatGPT', openai: 'OpenAI', nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', bitcoin: 'Bitcoin', ethereum: 'Ethereum', apple: 'Apple', microsoft: 'Microsoft', amazon: 'Amazon', claude: 'Claude', gemini: 'Gemini', iphone: 'iPhone', android: 'Android', windows: 'Windows', linux: 'Linux', python: 'Python', javascript: 'JavaScript', wordpress: 'WordPress', tiktok: 'TikTok', linkedin: 'LinkedIn', copilot: 'Copilot', tesla: 'Tesla', deepseek: 'DeepSeek', anthropic: 'Anthropic', meta: 'Meta', sora: 'Sora', github: 'GitHub', cloudflare: 'Cloudflare', aws: 'AWS', azure: 'Azure' };

// "?" skal kunne læses på emnefarven: hvid, medmindre kontrasten mod hvid er under 3 (fx #06b6d4 gav 2,4) — så mørk
const lum = (hex) => { const v = hex.replace('#', '').match(/../g).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
export const tegnFarve = (hex) => (1.05 / (lum(hex) + 0.05) < 3 ? '#0f172a' : '#fff');

export function somSporgsmaal(q) {
  const s = String(q || '').trim().replace(/^["']|["']$/g, '').replace(/[?.!]+$/, '').split(/\s+/).map((w) => AKRO[w.toLowerCase()] || w).join(' ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '?' : '';
}
