// HTML -> Markdown til AI-agenter (1/11-2026, Jacobs ja 21:10).
// Bruges af /…/navn.md-filerne, som workeren sender, når en AI beder om "Accept: text/markdown"
// (Cloudflare Agent Readiness: "Markdown Negotiation"). Ren tekst er billigere og lettere for en AI
// at læse end hele HTML-siden med menu, annoncer og design.
// Læses med parse5 (allerede i projektet), så der ikke skal installeres nye pakker.
import { parseFragment } from 'parse5';

const SITE = 'https://www.techmediaarch.com';
const SPRING = new Set(['script', 'style', 'noscript', 'svg', 'button', 'input', 'select', 'textarea', 'form', 'ins', 'template', 'link', 'meta']);
const BLOK = new Set(['p', 'div', 'section', 'article', 'aside', 'nav', 'main', 'header', 'footer', 'figure', 'figcaption', 'details', 'center', 'dl', 'dt', 'dd']);

const attr = (el, navn) => (el.attrs || []).find((a) => a.name === navn)?.value ?? '';
const fuld = (u) => {
  if (!u || u.startsWith('data:') || u.startsWith('javascript:')) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return SITE + u;
  return u;
};
const skjult = (el) => attr(el, 'aria-hidden') === 'true' || /\bdisplay:\s*none\b/.test(attr(el, 'style'));

// Tekst inde i en linje (fed, kursiv, links …)
function inline(noder) {
  let ud = '';
  for (const n of noder) {
    if (n.nodeName === '#text') { ud += n.value.replace(/\s+/g, ' '); continue; }
    if (!n.tagName || SPRING.has(n.tagName) || skjult(n)) continue;
    const t = n.tagName;
    const indre = () => inline(n.childNodes || []);
    if (t === 'br') ud += '  \n';
    else if (t === 'strong' || t === 'b') { const x = indre().trim(); if (x) ud += `**${x}**`; }
    else if (t === 'em' || t === 'i') { const x = indre().trim(); if (x) ud += `*${x}*`; }
    else if (t === 'code') ud += '`' + indre().trim() + '`';
    else if (t === 'a') {
      const x = indre().trim();
      const href = attr(n, 'href');
      // Ankre inde på siden (#afsnit) og tomme links giver kun teksten
      if (!href || href.startsWith('#')) ud += x;
      else if (x) ud += `[${x}](${fuld(href)})`;
    } else if (t === 'img') {
      const src = fuld(attr(n, 'src'));
      if (src) ud += `![${attr(n, 'alt').replace(/[[\]]/g, '')}](${src})`;
    } else if (t === 'iframe') {
      const src = fuld(attr(n, 'src') || attr(n, 'data-src'));
      if (src) ud += `[Video](${src})`;
    } else ud += indre();
  }
  return ud;
}

const harBlok = (el) => (el.childNodes || []).some((c) => c.tagName && (BLOK.has(c.tagName) || /^(h[1-6]|ul|ol|table|blockquote|pre)$/.test(c.tagName)));

// En liste (punkter eller numre), med indrykning ved lister i lister
function liste(el, niveau) {
  const nummer = el.tagName === 'ol';
  let i = 0, ud = '';
  for (const li of el.childNodes || []) {
    if (li.tagName !== 'li' || skjult(li)) continue;
    i++;
    const tegn = nummer ? `${i}.` : '-';
    const tekst = inline((li.childNodes || []).filter((c) => c.tagName !== 'ul' && c.tagName !== 'ol')).trim();
    ud += `${'  '.repeat(niveau)}${tegn} ${tekst}\n`;
    for (const c of li.childNodes || []) if (c.tagName === 'ul' || c.tagName === 'ol') ud += liste(c, niveau + 1);
  }
  return ud;
}

// Tabeller: rigtige datatabeller bliver Markdown-tabeller. Bloggers billedtekst-tabeller
// (class tr-caption-container: billede + tekst) læses som almindelige afsnit.
function tabel(el) {
  const raekker = [];
  const find = (n) => { for (const c of n.childNodes || []) { if (c.tagName === 'tr') raekker.push(c); else if (c.tagName) find(c); } };
  find(el);
  // Billedtekst-tabel: hver celle som sit eget afsnit (billedet, derefter teksten)
  if (/\btr-caption-container\b/.test(attr(el, 'class'))) {
    return raekker.flatMap((r) => (r.childNodes || []).filter((c) => c.tagName === 'td' || c.tagName === 'th'))
      .map((c) => blokke(c.childNodes || [])).join('');
  }
  const celler = raekker.map((r) => (r.childNodes || []).filter((c) => c.tagName === 'td' || c.tagName === 'th').map((c) => inline(c.childNodes || []).trim().replace(/\|/g, '\\|')));
  const bredde = Math.max(0, ...celler.map((r) => r.length));
  if (bredde < 2) return celler.map((r) => r.join(' ')).filter(Boolean).join('\n\n') + '\n\n';
  const linje = (r) => '| ' + Array.from({ length: bredde }, (_, i) => r[i] || '').join(' | ') + ' |';
  return [linje(celler[0]), '| ' + Array(bredde).fill('---').join(' | ') + ' |', ...celler.slice(1).map(linje)].join('\n') + '\n\n';
}

function blokke(noder) {
  let ud = '';
  let linje = [];
  const toem = () => { const x = inline(linje).trim(); if (x) ud += x + '\n\n'; linje = []; };
  for (const n of noder) {
    if (!n.tagName) { linje.push(n); continue; }
    if (SPRING.has(n.tagName) || skjult(n)) continue;
    const t = n.tagName;
    const h = t.match(/^h([1-6])$/);
    if (h) { toem(); const x = inline(n.childNodes || []).trim(); if (x) ud += `${'#'.repeat(Number(h[1]))} ${x}\n\n`; }
    else if (t === 'ul' || t === 'ol') { toem(); ud += liste(n, 0) + '\n'; }
    else if (t === 'table') { toem(); ud += tabel(n); }
    else if (t === 'blockquote') { toem(); ud += blokke(n.childNodes || []).trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n'; }
    else if (t === 'pre') { toem(); ud += '```\n' + (n.childNodes || []).map(tekstAf).join('').replace(/\n+$/, '') + '\n```\n\n'; }
    else if (t === 'hr') { toem(); ud += '---\n\n'; }
    else if (t === 'summary') { toem(); const x = inline(n.childNodes || []).trim(); if (x) ud += `**${x}**\n\n`; }
    else if (BLOK.has(t) || harBlok(n)) { toem(); ud += blokke(n.childNodes || []); }
    else linje.push(n);
  }
  toem();
  return ud;
}
const tekstAf = (n) => (n.nodeName === '#text' ? n.value : (n.childNodes || []).map(tekstAf).join(''));

export function htmlTilMarkdown(html) {
  const md = blokke(parseFragment(String(html || '')).childNodes);
  return md.replace(/[ \t]+\n/g, (m) => (m.startsWith('  ') ? '  \n' : '\n')).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// Hovedet på hver .md-fil: titel, kort beskrivelse og fakta, som en AI skal bruge for at citere korrekt
export function markdownSide({ title, description, url, published, updated, hylde }) {
  const dato = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const fakta = [
    `- Source: ${url}`,
    published ? `- Published: ${dato(published)}${updated && dato(updated) !== dato(published) ? ` (updated ${dato(updated)})` : ''}` : '',
    hylde ? `- Shelf: ${hylde}` : '',
    '- Author: Jacob S. Olsen, Tech Media Arch',
  ].filter(Boolean).join('\n');
  return `# ${title}\n\n${description ? `> ${description.replace(/\s+/g, ' ').trim()}\n\n` : ''}${fakta}\n\n`;
}
