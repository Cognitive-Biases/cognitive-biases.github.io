import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const DATA = JSON.parse(await readFile("data/ru/research-notes.json", "utf8"));
const SOURCE = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const RU_BIASES = JSON.parse(await readFile(join(OUT, "data", "ru", "biases.json"), "utf8"));
const sourceBySlug = new Map((SOURCE.entries || []).map((entry) => [entry.slug, entry]));
const ruBiasBySlug = new Map((RU_BIASES.entries || []).map((entry) => [entry.slug, entry]));
const entries = DATA.entries || [];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const hasRussian = (value) => /[А-Яа-яЁё]/.test(String(value || ""));

function header(current = "research", englishSwitchPath = "/research/") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/ru/"><img src="/assets/biases_icon.png" width="48" height="48" alt=""><span>Cognitive<br>Biases</span></a><nav aria-label="Основная навигация">${link("/ru/biases/", "Искажения", "biases")}${link("/ru/techniques/", "Техники", "techniques")}${link("/ru/skills/", "Навыки", "skills")}${link("/ru/everyday/", "Статьи", "everyday")}${link("/ru/research/", "Исследования", "research")}<a href="${escapeHtml(englishSwitchPath)}" lang="en" hreflang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/ru/"><img src="/assets/biases_icon.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>Практический справочник о когнитивных искажениях, доказательствах и проверяемых решениях.</p></div><div class="footer-links"><a href="/ru/biases/">Искажения</a><a href="/ru/techniques/">Техники</a><a href="/ru/skills/">Навыки</a><a href="/ru/everyday/">Статьи</a><a href="/ru/research/">Исследования</a><a href="/methodology/" lang="en">Методология — English</a></div><p class="fine-print">Образовательный материал. Он не заменяет медицинскую, юридическую, финансовую или психологическую консультацию.</p></footer>`;
}

function alternates(ruPath, enPath = null) {
  const self = `<link rel="alternate" hreflang="ru" href="${SITE}${ruPath}">`;
  if (!enPath) return self;
  return `${self}<link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}">`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs internal-breadcrumbs" aria-label="Хлебные крошки">${items.map((item, index) => {
    const separator = index ? '<span aria-hidden="true">/</span>' : "";
    return item.href
      ? `${separator}<a href="${item.href}">${escapeHtml(item.label)}</a>`
      : `${separator}<span aria-current="page">${escapeHtml(item.label)}</span>`;
  }).join("")}</nav>`;
}

function utilityBar(meta) {
  return `<div class="page-utility" data-page-utility><span class="page-utility__meta">${escapeHtml(meta)}</span><div class="page-utility__actions" aria-label="Инструменты страницы"><button type="button" data-page-action="save" aria-pressed="false">Сохранить</button><button type="button" data-page-action="share">Поделиться</button><button type="button" data-page-action="copy">Копировать ссылку</button><button type="button" data-page-action="cite">Цитировать</button></div><span class="page-utility__status" data-page-utility-status role="status" aria-live="polite"></span></div>`;
}

function page({ title, description, ruPath, enPath = null, englishSwitchPath = enPath || "/research/", body, schema, filter = false }) {
  const canonical = `${SITE}${ruPath}`;
  const scripts = `${body.includes("data-page-utility") ? '<script src="/internal-discovery.js" defer></script>' : ""}${filter ? '<script src="/ru-interface.js" defer></script>' : ""}`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}">${alternates(ruPath, enPath)}<link rel="icon" href="/favicon.png"><meta property="og:type" content="article"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="ru_RU"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Перейти к содержанию</a>${header("research", englishSwitchPath)}<main id="main">${body}</main>${footer()}${scripts}</body></html>`;
}

async function write(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function addEnglishAlternate(enPath, ruPath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  try { await access(target); } catch { return false; }
  let html = await readFile(target, "utf8");
  const alternate = `<link rel="alternate" hreflang="ru" href="${SITE}${ruPath}">`;
  if (!html.includes(alternate)) {
    html = html.replace("</head>", `${alternate}</head>`);
    await writeFile(target, html);
  }
  return true;
}

for (const entry of entries) {
  const source = sourceBySlug.get(entry.slug);
  if (!source) throw new Error(`${entry.slug}: canonical research note is missing.`);
  if (!String(source.status || "").toLowerCase().includes("reviewed")) throw new Error(`${entry.slug}: only reviewed source syntheses may be localized.`);
  if (!hasRussian(entry.title) || !hasRussian(entry.summary)) throw new Error(`${entry.slug}: title and summary must be Russian editorial prose.`);
  if (!Array.isArray(entry.sections) || entry.sections.length < 4) throw new Error(`${entry.slug}: research localization needs at least four useful sections.`);
  for (const section of entry.sections) {
    if (!hasRussian(section.heading) || !Array.isArray(section.paragraphs) || section.paragraphs.length < 2 || !section.paragraphs.every(hasRussian)) {
      throw new Error(`${entry.slug}: every research section needs a Russian heading and at least two Russian paragraphs.`);
    }
  }
  if (!Array.isArray(source.sources) || source.sources.length < 2) throw new Error(`${entry.slug}: canonical research note needs source provenance.`);
}

const cards = entries.map((entry) => {
  const source = sourceBySlug.get(entry.slug);
  const haystack = [entry.title, entry.summary, ...(source.related || []).map((slug) => ruBiasBySlug.get(slug)?.title || slug)].join(" ").toLocaleLowerCase("ru-RU");
  return `<article class="practice-set-card" data-ru-filter-item data-ru-filter-text="${escapeHtml(haystack)}"><p class="kicker">Проверенный исследовательский разбор</p><h2><a href="/ru/research/${entry.slug}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.summary)}</p><p class="fine-print">${escapeHtml(source.sources.length)} источников · исходный статус: <span lang="en">${escapeHtml(source.status)}</span></p><p><a href="/ru/research/${entry.slug}/">Читать разбор →</a></p></article>`;
}).join("");

const indexPath = "/ru/research/";
const indexSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${SITE}${indexPath}#collection`,
  url: `${SITE}${indexPath}`,
  name: "Исследования когнитивных искажений — русские разборы",
  inLanguage: "ru",
  description: "Проверенные русские версии исследовательских синтезов Cognitive Biases с сохранёнными источниками и границами доказательств.",
  hasPart: entries.map((entry) => ({ "@id": `${SITE}/ru/research/${entry.slug}/#article` }))
};
const indexBody = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Исследования" }])}<section class="page-hero"><p class="eyebrow">Исследования · русская редакционная версия</p><h1>Что показывают исследования — без лишней уверенности</h1><p class="lede">Здесь мы переводим не только слова, но и границы доказательств. Каждый материал связан с каноническим проверенным синтезом, сохраняет первичные источники и заканчивается практическим выводом.</p><p class="fine-print">Сейчас опубликованы наиболее полезные русские разборы. Более широкий английский Research остаётся каноническим источником для ещё не локализованных материалов.</p></section><section class="section"><div class="ru-filter" data-ru-filter><label for="ru-research-search"><strong>Найти разбор</strong></label><input id="ru-research-search" type="search" inputmode="search" autocomplete="off" placeholder="Например: ИИ, прогнозы, дезинформация" data-ru-filter-input><p class="fine-print" data-ru-filter-count>Всего: ${entries.length}</p><div class="practice-set-grid" data-ru-filter-list>${cards}</div><p class="fine-print" data-ru-filter-empty hidden>По этому запросу пока нет русской исследовательской статьи.</p></div></section><section class="section section--ink"><p class="kicker">Граница</p><h2>Что означает «проверенный разбор»</h2><p>Это локализация уже существующего reviewed synthesis проекта. Она не превращает препринт в установленный факт и не делает все связанные когнитивные искажения одинаково хорошо подтверждёнными. Для каждого конкретного понятия смотрите его класс доказательности и источники.</p><p><a href="/research/" lang="en">Все исследовательские материалы — English →</a></p></section>`;
await write("ru/research", page({
  title: "Исследования когнитивных искажений на русском | Cognitive Biases",
  description: "Проверенные русские разборы исследований когнитивных искажений: источники, ограничения, практические выводы и осторожная интерпретация.",
  ruPath: indexPath,
  englishSwitchPath: "/research/",
  body: indexBody,
  schema: indexSchema,
  filter: true
}));

const publicEntries = [];
for (const entry of entries) {
  const source = sourceBySlug.get(entry.slug);
  const enPath = `/research/${entry.slug}/`;
  const ruPath = `/ru/research/${entry.slug}/`;
  if (!(await addEnglishAlternate(enPath, ruPath))) throw new Error(`${entry.slug}: canonical English research page is missing.`);

  const citations = (source.sources || []).map((item) => ({
    "@type": "CreativeWork",
    name: item.title,
    url: item.url,
    ...(item.year ? { datePublished: String(item.year) } : {}),
    ...(item.doi ? { identifier: `https://doi.org/${item.doi}` } : {})
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE}${ruPath}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/ru/` },
          { "@type": "ListItem", position: 2, name: "Исследования", item: `${SITE}/ru/research/` },
          { "@type": "ListItem", position: 3, name: entry.title, item: `${SITE}${ruPath}` }
        ]
      },
      {
        "@type": "Article",
        "@id": `${SITE}${ruPath}#article`,
        url: `${SITE}${ruPath}`,
        headline: entry.title,
        description: entry.summary,
        inLanguage: "ru",
        datePublished: source.publishedAt,
        dateModified: DATA.updatedAt,
        author: { "@id": `${SITE}/#organization` },
        publisher: { "@id": `${SITE}/#organization` },
        breadcrumb: { "@id": `${SITE}${ruPath}#breadcrumb` },
        citation: citations,
        isAccessibleForFree: true,
        license: "https://creativecommons.org/licenses/by-nc-sa/4.0/"
      }
    ]
  };
  const sectionHtml = entry.sections.map((section) => `<section class="section"><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("");
  const sourceHtml = (source.sources || []).map((item) => `<li><a href="${escapeHtml(item.url)}" rel="external noreferrer" lang="en">${escapeHtml(item.title)}</a>${item.year ? ` <span>· ${escapeHtml(item.year)}</span>` : ""}${item.type ? ` <span>· ${escapeHtml(item.type)}</span>` : ""}</li>`).join("");
  const relatedHtml = (source.related || []).map((slug) => {
    const bias = ruBiasBySlug.get(slug);
    if (bias) return `<li><a href="/ru/biases/${slug}/">${escapeHtml(bias.title)}</a></li>`;
    return `<li><a href="/biases/${slug}/" lang="en">${escapeHtml(slug)} — English</a></li>`;
  }).join("");
  const body = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Исследования", href: "/ru/research/" }, { label: entry.title }])}<section class="page-hero"><p class="eyebrow">Проверенный исследовательский разбор</p><h1>${escapeHtml(entry.title)}</h1>${utilityBar(`Русская редакционная версия · ${source.sources.length} источников`)}<p class="lede">${escapeHtml(entry.summary)}</p><p class="fine-print">Канонический статус: <span lang="en">${escapeHtml(source.status)}</span> · опубликовано ${escapeHtml(source.publishedAt)}</p></section>${sectionHtml}<section class="section section--ink"><p class="kicker">Источники</p><h2>На чём основан разбор</h2><ol class="evidence-sources">${sourceHtml}</ol><p class="fine-print">Названия научных работ оставлены на языке публикации. Русский текст сохраняет выводы и ограничения канонического синтеза, а не заменяет первичные источники.</p><p><a href="${enPath}" lang="en">Каноническая английская версия →</a></p></section>${relatedHtml ? `<section class="section"><p class="kicker">Связанные понятия</p><h2>Что проверить дальше</h2><ul>${relatedHtml}</ul></section>` : ""}`;
  await write(`ru/research/${entry.slug}`, page({
    title: `${entry.title} | Cognitive Biases`,
    description: entry.summary,
    ruPath,
    enPath,
    englishSwitchPath: enPath,
    body,
    schema
  }));
  publicEntries.push({
    ...entry,
    publishedAt: source.publishedAt,
    status: source.status,
    sources: source.sources,
    related: source.related
  });
}

await mkdir(join(OUT, "data", "ru"), { recursive: true });
await writeFile(join(OUT, "data", "ru", "research-notes.json"), `${JSON.stringify({ ...DATA, entries: publicEntries }, null, 2)}\n`);

let sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const path of [indexPath, ...entries.map((entry) => `/ru/research/${entry.slug}/`)]) {
  const loc = `${SITE}${path}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc></url></urlset>`);
}
await writeFile(join(OUT, "sitemap.xml"), sitemap);

const researchNav = '<a href="/ru/research/">Исследования</a>';
async function injectDiscovery(file) {
  let html = await readFile(file, "utf8");
  let dirty = false;
  if (!html.includes(researchNav)) {
    const english = html.match(/<a href="[^"]+" lang="en" hreflang="en">English<\/a>/)?.[0];
    if (english) {
      html = html.replace(english, `${researchNav}${english}`);
      dirty = true;
    }
  }
  if (html.includes('<div class="footer-links">') && !html.includes('<div class="footer-links"><a href="/ru/research/"')) {
    const footerLinks = /<div class="footer-links">([\s\S]*?)<\/div>/i;
    const match = html.match(footerLinks);
    if (match && !match[1].includes('/ru/research/')) {
      html = html.replace(footerLinks, `<div class="footer-links">${match[1]}${researchNav}</div>`);
      dirty = true;
    }
  }
  if (dirty) await writeFile(file, html);
}

for (const path of ["ru/index.html", "ru/biases/index.html", "ru/techniques/index.html", "ru/skills/index.html", "ru/everyday/index.html"]) {
  await injectDiscovery(join(OUT, path));
}

const homePath = join(OUT, "ru", "index.html");
let home = await readFile(homePath, "utf8");
if (!home.includes("data-ru-research-home")) {
  const section = `<section class="section" data-ru-research-home><p class="kicker">Исследования</p><h2>Разобраться глубже, но без академического тумана</h2><p>Проверенные русские синтезы сохраняют источники и границы доказательств, а затем переводят результат в практический вопрос: что именно стоит проверить в следующем решении.</p><p><a href="/ru/research/">Открыть русские исследовательские разборы →</a></p></section>`;
  home = home.replace("</main>", `${section}</main>`);
  await writeFile(homePath, home);
}

console.log(`Russian research localization generated: ${entries.length} reviewed syntheses with canonical sources and reciprocal language links.`);
