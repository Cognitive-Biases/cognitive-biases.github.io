// Progressive disclosure around the existing content, without changing claims
// or removing routes. Balanced extraction keeps nested cards and controls intact.
const copy = {
  en: ['Article options', 'On this page', 'Browse by topic or concept type', 'More ways to explore'],
  ru: ['Действия со статьёй', 'На этой странице', 'Темы и типы понятий', 'Другие способы изучать'],
  de: ['Artikeloptionen', 'Auf dieser Seite', 'Nach Thema oder Begriffstyp stöbern', 'Weitere Wege zum Entdecken'],
  fr: ['Options de l’article', 'Sur cette page', 'Par thème ou type de concept', 'Autres façons d’explorer'],
  es: ['Opciones del artículo', 'En esta página', 'Por tema o tipo de concepto', 'Más formas de explorar'],
  'pt-br': ['Opções do artigo', 'Nesta página', 'Por tema ou tipo de conceito', 'Mais formas de explorar'],
  it: ['Opzioni dell’articolo', 'In questa pagina', 'Per tema o tipo di concetto', 'Altri modi per esplorare'],
};

function element(html, pattern) {
  const match = pattern.exec(html);
  if (!match) return null;
  const tag = match[0].match(/^<([a-z0-9]+)/i)[1];
  const tokens = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tokens.lastIndex = match.index;
  let depth = 0, token;
  while ((token = tokens.exec(html))) {
    depth += token[1] ? -1 : 1;
    if (depth === 0) return { start: match.index, end: tokens.lastIndex, html: html.slice(match.index, tokens.lastIndex) };
  }
  throw new Error(`Unclosed ${tag} in reader journey`);
}

function wrap(html, pattern, className, label) {
  if (html.includes(`class="${className}"`)) return html;
  const found = element(html, pattern);
  return found ? html.slice(0, found.start) + `<details class="${className}"><summary>${label}</summary>${found.html}</details>` + html.slice(found.end) : html;
}

function simplifyArticle(html, labels) {
  // Keep the complete title available to citations and assistive technology,
  // but give the short concept name and its explanation different visual sizes.
  html = html.replace(/<h1([^>]*)>([^<]+?) (–|—) ([^<]+)<\/h1>/, (_match, attrs, name, dash, explanation) =>
    `<h1${attrs}><span class="reader-title">${name}</span> <span class="reader-subtitle">${dash} ${explanation}</span></h1>`);
  if (!html.includes('class="reader-tools"')) {
    const utility = element(html, /<div\b[^>]*class="page-utility"[^>]*>/);
    if (utility) {
      const review = utility.html.match(/<span class="page-utility__meta">[\s\S]*?<\/span>/)?.[0] || '';
      const reviewText = review.replace(/<[^>]+>/g, '');
      const duplicateLabel = reviewText && html.slice(0, html.indexOf('</h1>')).includes(`>${reviewText}<`);
      const visibleReview = duplicateLabel ? '' : review;
      const actions = visibleReview ? utility.html.replace(review, '') : utility.html;
      html = html.replace(utility.html, `${visibleReview ? `<p class="reader-review-state">${visibleReview}</p>` : ''}<details class="reader-tools"><summary>${labels[0]}</summary>${actions}</details>`);
      const classification = html.match(/<p class="eyebrow">[\s\S]*?<\/p>/)?.[0];
      if (classification && /\b(?:kind-chip|taxonomy-link)\b/.test(classification)) {
        html = html.replace(classification, '').replace(`<summary>${labels[0]}</summary>`, `<summary>${labels[0]}</summary>${classification}`);
      }
    }
  }
  html = wrap(html, /<nav\b[^>]*class="long-form-article__toc"[^>]*>/, 'reader-outline', labels[1]);
  // Legacy quick sections already contain authored bullet lists. Render them
  // as real headings/lists, preserving every word rather than a wall of dashes.
  html = html.replace(/<p>([^<]+)(<br\s*\/?>(?:[\s\S]*?))<\/p>/g, (match, heading, body) => {
    const lines = body.split(/<br\s*\/?>/).map(line => line.trim()).filter(Boolean);
    if (heading.length > 90 || !lines.length || !lines.every(line => /^-\s+/.test(line))) return match;
    return `<h2 class="reader-quick-title">${heading}</h2><ul class="reader-quick-list">${lines.map(line => `<li>${line.replace(/^-\s+/, '')}</li>`).join('')}</ul>`;
  });
  return html;
}

function simplifyCatalogue(html, labels) {
  if (html.includes('data-reader-catalogue')) return html;
  const search = element(html, /<div\b[^>]*class="filter"[^>]*>/);
  if (!search || !html.includes('data-bias') || !/<input\b[^>]*\bdata-search/.test(html)) return html;
  html = html.replace(search.html, '');
  const family = element(html, /<section\b[^>]*class="family-strip"[^>]*>/);
  const kind = element(html, /<aside\b[^>]*class="kind-summary"[^>]*>/);
  let extras = '';
  for (const block of [family, kind]) if (block) { extras += block.html; html = html.replace(block.html, ''); }
  const language = html.match(/<html\b[^>]*lang="([^"]+)"/)?.[1];
  const lede = html.match(/<p class="lede">[\s\S]*?<\/p>/)?.[0];
  if (language === 'en' && lede) {
    html = html.replace(lede, '<p class="lede">Search by name, description or category.</p>');
    extras = lede + extras;
  }
  const guide = extras ? `<details class="reader-library-guide"><summary>${labels[2]}</summary>${extras}</details>` : '';
  const empty = `<p class="reader-search-empty" data-reader-empty role="status" hidden></p>`;
  const count = `<p class="reader-result-count" data-reader-count></p>`;
  const hero = element(html, /<section\b[^>]*class="page-hero[^\"]*"[^>]*>/);
  const controls = `${search.html}${guide}${count}${empty}`;
  if (hero) html = html.slice(0, hero.end) + controls + html.slice(hero.end);
  else html = html.replace(/<main\b[^>]*>/, match => match + controls);
  return html.replace(/<body\b/, '<body data-reader-catalogue');
}

function simplifyHome(html, labels) {
  if (html.includes('class="reader-home-more"')) return html;
  const main = element(html, /<main\b[^>]*>/);
  if (!main || !main.html.includes('class="editorial-hero"')) return html;
  let rest = main.html.replace(/^<main\b[^>]*>/, '').replace(/<\/main>$/, '');
  const primary = [];
  for (const pattern of [/<section class="editorial-hero">/, /<section class="section editorial-atlas">/, /<section class="section everyday-home">/, /<section class="section home-guides">/]) {
    const part = element(rest, pattern);
    if (part) { primary.push(part.html); rest = rest.replace(part.html, ''); }
  }
  const open = main.html.match(/^<main\b[^>]*>/)[0];
  const content = `${open}${primary.join('')}<details class="reader-home-more"><summary>${labels[3]}</summary><div class="reader-home-more__body">${rest}</div></details></main>`;
  return html.replace(main.html, content);
}

export function applyReaderJourney(html, isReadingPage, route) {
  const original = html;
  const language = html.match(/<html\b[^>]*lang="([^"]+)"/)?.[1]?.toLowerCase() || 'en';
  const labels = copy[language] || copy.en;
  if (isReadingPage) html = simplifyArticle(html, labels);
  if (/^(?:explore|biases)\/index\.html$/.test(route)) html = simplifyCatalogue(html, labels);
  if (route === 'index.html' && language === 'en') html = simplifyHome(html, labels);
  const targets = new Set([...html.matchAll(/\bhref="([^"]+)"/g)].map(match => match[1]));
  for (const match of original.matchAll(/\bhref="([^"]+)"/g)) {
    if (!targets.has(match[1])) throw new Error(`Reader journey lost destination: ${match[1]}`);
  }
  return html;
}
