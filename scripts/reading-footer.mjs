// Normalize the different generated footers without changing their routes,
// locale-switch attributes, educational notices or publisher attribution.
const labels = {
  en: ['Explore', 'Practice', 'About the project', 'Languages', 'Project resources'],
  ru: ['Изучать', 'Практика', 'О проекте', 'Языки', 'Материалы проекта'],
  de: ['Entdecken', 'Üben', 'Über das Projekt', 'Sprachen', 'Projektressourcen'],
  fr: ['Explorer', 'Pratiquer', 'À propos du projet', 'Langues', 'Ressources du projet'],
  es: ['Explorar', 'Practicar', 'Sobre el proyecto', 'Idiomas', 'Recursos del proyecto'],
  'pt-br': ['Explorar', 'Praticar', 'Sobre o projeto', 'Idiomas', 'Recursos do projeto'],
  it: ['Esplora', 'Pratica', 'Il progetto', 'Lingue', 'Risorse del progetto'],
};
const languageNames = { en: 'English', de: 'Deutsch', ru: 'Русский', fr: 'Français', es: 'Español', 'pt-br': 'Português (Brasil)', it: 'Italiano' };

function linksIn(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)]
    .map((match) => ({ href: match[1], html: match[0] }));
}

function list(links) {
  return `<ul>${links.map((link) => `<li>${link.html}</li>`).join('')}</ul>`;
}

export function applyReadingFooter(html, isReadingPage) {
  if (!/<footer\b/.test(html) || /<footer\b[^>]*data-footer-design/.test(html)) return html;
  const language = html.match(/<html\b[^>]*lang="([^"]+)"/)?.[1]?.toLowerCase() || 'en';
  const copy = labels[language] || labels.en;
  let announcement = '';
  if (isReadingPage) {
    announcement = html.match(/<aside class="vedokrok-banner" data-vedokrok-banner[^>]*>[\s\S]*?<\/aside>/)?.[0] || '';
    if (announcement) html = html.replace(announcement, '');
  }

  return html.replace(/<footer\b([^>]*)>([\s\S]*?)<\/footer>/, (_footer, attributes, content) => {
    const brand = content.match(/<a\b[^>]*class="brand\b[^"]*"[^>]*>[\s\S]*?<\/a>/)?.[0];
    const home = language === 'en' ? '/' : `/${language}/`;
    const identity = brand?.replace(/<small>[\s\S]*?<\/small>/, '') || `<a class="brand brand--footer" href="${home}"><img src="/assets/brand.webp" width="40" height="40" alt=""><span>Cognitive Biases</span></a>`;
    const description = brand ? content.match(/<\/a>\s*<p>([\s\S]*?)<\/p>/)?.[1] : '';
    const trust = content.match(/<p class="fine-print trust-line">[\s\S]*?<\/p>/)?.[0] || '';
    const connection = content.match(/<p class="vedokrok-footer">[\s\S]*?<\/p>/)?.[0] || '';
    const creditHrefs = new Set(linksIn(trust + connection).map((link) => link.href));
    const brandHref = linksIn(identity)[0]?.href;
    const seen = new Set([brandHref, ...creditHrefs]);
    const groups = [[], [], []];
    const languages = new Map(), legal = [], resources = [];
    for (const link of linksIn(content)) {
      if (seen.has(link.href)) continue;
      seen.add(link.href);
      const route = link.href.replace(/^\/(?:de|ru|fr|es|it|pt-br)(?=\/)/, '');
      if (/\bdata-locale-switch=/.test(link.html)) languages.set(link.html.match(/data-locale-switch="([^"]+)"/)[1].toLowerCase(), link);
      else if (/^\/(?:privacy|terms|support)\//.test(route)) legal.push(link);
      else if (/^\/(?:data(?:\/|$)|ai\/|llms\.|citation-index\.)/.test(route) || /\.(?:json|txt)(?:$|\?)/.test(route)) resources.push(link);
      else if (/^\/(?:practice|tools|techniques|tecnicas|tecniche|skills|competences|competenze|how-it-works)\//.test(route)) groups[1].push(link);
      else if (/^\/(?:about|evidence|methodology|quality|research|history|trust)\//.test(route)) groups[2].push(link);
      else groups[0].push(link);
    }

    const navigation = groups.map((links, index) => links.length ? `<section class="footer-group"><h2>${copy[index]}</h2>${list(links)}</section>` : '').join('');
    // Keep authored notices verbatim. Navigation-only and duplicate credit
    // paragraphs are represented by the grouped links and the single trust line.
    const notices = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
      .filter((match) => !/<a\b/.test(match[1]) && match[1] !== description && !/^\s*(?:Maintained by|Made by)/.test(match[1]))
      .map((match) => `<p class="footer-notice">${match[1]}</p>`).join('');
    // Offer only equivalents actually declared by the localization graph.
    // Keep existing switch links intact, including their routing attributes.
    for (const match of html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)) {
      const code = match[0].match(/hreflang="([^"]+)"/)?.[1];
      const key = code?.toLowerCase();
      const href = match[0].match(/href="([^"]+)"/)?.[1];
      if (!languageNames[key] || !href || languages.has(key)) continue;
      const route = href.replace(/^https:\/\/cognitive-biases\.github\.io/, '');
      const link = key === language ? `<span lang="${code}" aria-current="true">${languageNames[key]}</span>` : `<a href="${route}" hreflang="${code}" lang="${code}">${languageNames[key]}</a>`;
      languages.set(key, { href: route, html: link });
    }
    const languageRow = languages.size ? `<nav class="footer-languages" aria-label="${copy[3]}"><span>${copy[3]}</span>${Object.keys(languageNames).filter((code) => languages.has(code)).map((code) => languages.get(code).html).join('')}</nav>` : '';
    const extra = resources.length || announcement ? `<details class="footer-resources"><summary>${copy[4]}</summary><div class="footer-resources__body">${resources.length ? list(resources) : ''}${announcement}</div></details>` : '';
    const classes = attributes.match(/\bclass="([^"]*)"/)?.[1] || 'site-footer';
    const footer = `<footer class="${classes} reading-footer" data-footer-design><div class="reading-footer__inner"><div class="reading-footer__top"><div class="reading-footer__brand">${identity}${description ? `<p>${description}</p>` : ''}${connection}</div><nav class="reading-footer__nav" aria-label="${copy[0]}"><div class="footer-links">${navigation}</div></nav></div><div class="reading-footer__meta">${languageRow}${notices}<div class="reading-footer__bottom">${trust}${legal.length ? `<nav class="footer-legal">${legal.map((link) => link.html).join('')}</nav>` : ''}</div>${extra}</div></div></footer>`;
    const retained = new Set(linksIn(footer).map((link) => link.href));
    for (const { href } of linksIn(content)) {
      if (!retained.has(href)) throw new Error(`Footer redesign lost an existing target: ${href}`);
    }
    return footer;
  });
}
