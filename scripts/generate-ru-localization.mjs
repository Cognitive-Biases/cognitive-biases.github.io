import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";

const ruBiasesDoc = JSON.parse(await readFile("data/ru/biases.json", "utf8"));
const ruTechniquesDoc = JSON.parse(await readFile("data/ru/techniques.json", "utf8"));
const ruSkillsDoc = JSON.parse(await readFile("data/ru/skills.json", "utf8"));
const ruEverydayDoc = JSON.parse(await readFile("data/ru/everyday-guides.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const sourceSkillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));
const sourceBiasesDoc = JSON.parse(await readFile("data/biases.json", "utf8"));
const evidenceClassesDoc = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));

const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviewBySlug = new Map(evidenceDocs.flatMap((doc) => doc.reviews || []).map((review) => [review.slug, review]));

const ruBiases = ruBiasesDoc.entries || [];
const ruTechniques = ruTechniquesDoc.techniques || [];
const ruSkills = ruSkillsDoc.entries || [];
const ruEveryday = ruEverydayDoc.entries || [];
const ruBiasBySlug = new Map(ruBiases.map((entry) => [entry.slug, entry]));
const sourceTechniqueBySlug = new Map((sourceTechniquesDoc.techniques || []).map((entry) => [entry.slug, entry]));
const sourceSkillBySlug = new Map((sourceSkillsDoc.entries || []).map((entry) => [entry.slug, entry]));
const sourceBiasBySlug = new Map(sourceBiasesDoc.map((entry) => [entry.slug, entry]));
const everydayByBias = new Map();
for (const article of ruEveryday) {
  if (!everydayByBias.has(article.biasSlug)) everydayByBias.set(article.biasSlug, []);
  everydayByBias.get(article.biasSlug).push(article);
}

const evidenceClassLabels = {
  established: "Хорошо подтверждено",
  supported: "Поддерживается исследованиями",
  mixed: "Данные неоднозначны",
  contested: "Спорный вывод",
  "domain-specific": "Ограничено областью",
  concept: "Обзор понятия"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const conceptTitle = (bias) => String(bias?.title || bias?.slug || "").split(/\s+[–—]\s+/)[0].trim();
const ruDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
};

function header(current = "", englishSwitchPath = "/") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/ru/"><img src="/assets/biases_icon.png" width="48" height="48" alt=""><span>Cognitive<br>Biases</span></a><nav aria-label="Основная навигация">${link("/ru/biases/", "Искажения", "biases")}${link("/ru/techniques/", "Техники", "techniques")}${link("/ru/skills/", "Навыки", "skills")}${link("/ru/everyday/", "Статьи", "everyday")}<a href="${escapeHtml(englishSwitchPath)}" lang="en" hreflang="en">English</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/ru/"><img src="/assets/biases_icon.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>Практический справочник о когнитивных искажениях, доказательствах и проверяемых решениях.</p></div><div class="footer-links"><a href="/ru/biases/">Искажения</a><a href="/ru/techniques/">Техники</a><a href="/ru/skills/">Навыки</a><a href="/ru/everyday/">Статьи</a><a href="/methodology/" lang="en">Методология — English</a></div><p class="fine-print">Образовательный материал. Он не заменяет медицинскую, юридическую, финансовую или психологическую консультацию.</p></footer>`;
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

function page({ title, description, ruPath, enPath = null, englishSwitchPath = enPath || "/", current = "", body, schema }) {
  const canonical = `${SITE}${ruPath}`;
  const scripts = [
    body.includes("data-page-utility") ? '<script src="/internal-discovery.js" defer></script>' : "",
    body.includes("data-ru-filter") ? '<script src="/ru-interface.js" defer></script>' : ""
  ].join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}">${alternates(ruPath, enPath)}<link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="ru_RU"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Перейти к содержанию</a>${header(current, englishSwitchPath)}<main id="main">${body}</main>${footer()}${scripts}</body></html>`;
}

async function write(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function relatedBiasList(slugs) {
  return (slugs || []).map((slug) => {
    const translated = ruBiasBySlug.get(slug);
    if (translated) return `<li><a href="/ru/biases/${slug}/">${escapeHtml(translated.title)}</a></li>`;
    const source = sourceBiasBySlug.get(slug);
    return `<li><a href="/biases/${slug}/" lang="en">${escapeHtml(conceptTitle(source) || slug)} — English</a></li>`;
  }).join("");
}

function filterWidget({ id, label, placeholder, countLabel, cards, emptyText }) {
  return `<div class="ru-filter" data-ru-filter><label for="${id}"><strong>${escapeHtml(label)}</strong></label><input id="${id}" type="search" inputmode="search" autocomplete="off" placeholder="${escapeHtml(placeholder)}" data-ru-filter-input><p class="fine-print" data-ru-filter-count>${escapeHtml(countLabel)}</p><div class="practice-set-grid" data-ru-filter-list>${cards}</div><p class="fine-print" data-ru-filter-empty hidden>${escapeHtml(emptyText)}</p></div>`;
}

async function addEnglishAlternate(enPath, ruPath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  try {
    await access(target);
  } catch {
    return false;
  }
  let html = await readFile(target, "utf8");
  const alternate = `<link rel="alternate" hreflang="ru" href="${SITE}${ruPath}">`;
  if (!html.includes(alternate)) {
    html = html.replace("</head>", `${alternate}</head>`);
    await writeFile(target, html);
  }
  return true;
}

const localizedBiases = [];
for (const bias of ruBiases) {
  const enPath = `/biases/${bias.slug}/`;
  const ruPath = `/ru/biases/${bias.slug}/`;
  if (!(await addEnglishAlternate(enPath, ruPath))) {
    console.warn(`Skipping Russian bias without canonical English page: ${bias.slug}`);
    continue;
  }
  localizedBiases.push(bias);
  const aliases = [bias.englishTitle, ...(bias.aliases || [])].filter(Boolean);
  const review = reviewBySlug.get(bias.slug);
  const classSlug = evidenceClassesDoc.bySlug?.[bias.slug];
  const classLabel = evidenceClassLabels[classSlug] || "Проверено редакцией";
  const sources = (review?.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" rel="external noreferrer" lang="en">${escapeHtml(source.title)}</a>${source.year ? ` <span>· ${escapeHtml(source.year)}</span>` : ""}</li>`).join("");
  const articles = everydayByBias.get(bias.slug) || [];
  const articleCards = articles.map((article) => `<article class="practice-set-card"><p class="kicker">${escapeHtml(article.category)}</p><h3><a href="/ru/everyday/${article.slug}/">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.summary)}</p><p><a href="/ru/everyday/${article.slug}/">Читать статью →</a></p></article>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${SITE}${ruPath}#term`,
        url: `${SITE}${ruPath}`,
        name: bias.title,
        alternateName: aliases,
        description: bias.summary,
        inDefinedTermSet: `${SITE}/ru/biases/`
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Cognitive Biases", item: `${SITE}/ru/` },
          { "@type": "ListItem", position: 2, name: "Когнитивные искажения", item: `${SITE}/ru/biases/` },
          { "@type": "ListItem", position: 3, name: bias.title, item: `${SITE}${ruPath}` }
        ]
      }
    ]
  };
  const body = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Искажения", href: "/ru/biases/" }, { label: bias.title }])}<section class="page-hero"><p class="eyebrow">Когнитивное искажение · ${escapeHtml(classLabel)}</p><h1>${escapeHtml(bias.title)}</h1>${utilityBar("Проверенная русская версия")}<p class="lede">${escapeHtml(bias.summary)}</p><p class="fine-print"><span lang="en">${escapeHtml(bias.englishTitle)}</span>${(bias.aliases || []).length ? ` · варианты поиска: ${escapeHtml((bias.aliases || []).join(", "))}` : ""}</p></section><section class="section"><p class="kicker">Где ловушка</p><h2>Что именно может пойти не так</h2><p>${escapeHtml(bias.trap)}</p></section><section class="section"><p class="kicker">Что показывают исследования</p><h2>Что можно утверждать осторожно</h2><p>${escapeHtml(bias.evidence)}</p><h3>Граница применения</h3><p>${escapeHtml(bias.boundary)}</p>${sources ? `<h3>Основные источники</h3><ol class="evidence-sources">${sources}</ol>` : ""}${review?.reviewedAt ? `<p class="fine-print">Обзор доказательств обновлён: ${escapeHtml(ruDate(review.reviewedAt))}.</p>` : ""}<p><a href="${enPath}#evidence" lang="en">Полный обзор доказательств и источников — English →</a></p></section><section class="section section--ink"><p class="kicker">Практическая проверка</p><h2>Что сделать перед следующим решением</h2>${list(bias.actions)}<p class="fine-print">Это не диагноз и не способ «выключить» искажение. Проверка делает рассуждение более наблюдаемым и помогает заметить типичную ошибку.</p></section>${articleCards ? `<section class="section"><p class="kicker">Пример из жизни</p><h2>Посмотрите, как это выглядит в обычной ситуации</h2><div class="practice-set-grid">${articleCards}</div></section>` : ""}`;
  await write(`ru/biases/${bias.slug}`, page({ title: `${bias.title}: что это и как проверить решение | Cognitive Biases`, description: bias.summary, ruPath, enPath, current: "biases", body, schema }));
}

const biasCards = localizedBiases.map((bias) => `<article class="practice-set-card" data-ru-filter-item data-search="${escapeHtml([bias.title, bias.englishTitle, ...(bias.aliases || []), bias.summary].join(" ").toLowerCase())}"><p class="kicker" lang="en">${escapeHtml(bias.englishTitle)}</p><h2><a href="/ru/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(bias.summary)}</p><p><a href="/ru/biases/${bias.slug}/">Понять и проверить →</a></p></article>`).join("");
await write("ru/biases", page({
  title: "Когнитивные искажения на русском: понятные объяснения и практика | Cognitive Biases",
  description: "Проверенные русские объяснения когнитивных искажений: что происходит, где границы эффекта и какую практическую проверку использовать.",
  ruPath: "/ru/biases/",
  englishSwitchPath: "/explore/",
  current: "biases",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Когнитивные искажения на русском", inLanguage: "ru", numberOfItems: localizedBiases.length },
  body: `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Искажения" }])}<section class="page-hero"><p class="eyebrow">Русская библиотека</p><h1>Когнитивные искажения — понятно, с доказательствами и практикой</h1><p class="lede">Не нужно сначала выучить терминологию. Найдите знакомую ситуацию, разберитесь, что именно может влиять на решение, и используйте конкретную проверку.</p></section><section class="section"><p class="kicker">Проверенный слой</p><h2>${localizedBiases.length} материалов на русском</h2>${filterWidget({ id: "ru-bias-search", label: "Найти искажение или ситуацию", placeholder: "Например: якорь, ИИ, сроки, повторение", countLabel: `${localizedBiases.length} материалов`, cards: biasCards, emptyText: "Ничего не нашли. Попробуйте более общее слово или откройте английскую библиотеку." })}</section>`
}));

for (const technique of ruTechniques) {
  const source = sourceTechniqueBySlug.get(technique.slug);
  if (!source) throw new Error(`Missing source technique: ${technique.slug}`);
  const ruPath = `/ru/techniques/${technique.slug}/`;
  const candidateEnPath = `/techniques/${technique.slug}/`;
  const hasEnglishPage = await addEnglishAlternate(candidateEnPath, ruPath);
  const enPath = hasEnglishPage ? candidateEnPath : null;
  const linked = relatedBiasList(source.biases || []);
  const schema = { "@context": "https://schema.org", "@type": "HowTo", name: technique.title, description: technique.purpose, inLanguage: "ru", step: technique.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })) };
  const body = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Техники", href: "/ru/techniques/" }, { label: technique.title }])}<section class="page-hero"><p class="eyebrow">Практическая техника</p><h1>${escapeHtml(technique.title)}</h1>${utilityBar("Пошаговая проверка")}<p class="lede">${escapeHtml(technique.purpose)}</p></section><section class="section"><p class="kicker">Когда это полезно</p><h2>Сигнал, что стоит остановиться и проверить решение</h2><p>${escapeHtml(technique.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">Пошагово</p><h2>Как выполнить проверку</h2><ol>${technique.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Ограничения</p><h2>Что эта техника не гарантирует</h2><p>${escapeHtml(technique.limitations)}</p>${linked ? `<h3>Какие искажения она помогает проверить</h3><ul>${linked}</ul>` : ""}</section>`;
  await write(`ru/techniques/${technique.slug}`, page({ title: `${technique.title} — пошаговая техника | Cognitive Biases`, description: technique.purpose, ruPath, enPath, englishSwitchPath: enPath || "/techniques/", current: "techniques", body, schema }));
}

const techniqueCards = ruTechniques.map((technique) => `<article class="practice-set-card"><h2><a href="/ru/techniques/${technique.slug}/">${escapeHtml(technique.title)}</a></h2><p>${escapeHtml(technique.purpose)}</p><p><a href="/ru/techniques/${technique.slug}/">Открыть пошаговую проверку →</a></p></article>`).join("");
await write("ru/techniques", page({
  title: "11 техник для более проверяемых решений | Cognitive Biases",
  description: "11 коротких процедур: независимая оценка, базовая частота, журнал решений, проверка источника, критерии пересмотра и другие.",
  ruPath: "/ru/techniques/", enPath: "/techniques/", current: "techniques",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Практические техники принятия решений", inLanguage: "ru", numberOfItems: ruTechniques.length },
  body: `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Техники" }])}<section class="page-hero"><p class="eyebrow">Практика</p><h1>11 техник, которые превращают «подумать ещё» в конкретное действие</h1><p class="lede">${escapeHtml(ruTechniquesDoc.description)}</p></section><section class="section"><p class="kicker">Набор техник</p><h2>Выберите проверку под текущую задачу</h2><div class="practice-set-grid">${techniqueCards}</div></section>`
}));
await addEnglishAlternate("/techniques/", "/ru/techniques/");

for (const skill of ruSkills) {
  const source = sourceSkillBySlug.get(skill.slug);
  if (!source) throw new Error(`Missing source skill: ${skill.slug}`);
  const ruPath = `/ru/skills/${skill.slug}/`;
  const enPath = `/skills/${skill.slug}/`;
  const linked = relatedBiasList(source.biases || []);
  const schema = { "@context": "https://schema.org", "@type": "LearningResource", name: skill.title, description: skill.summary, inLanguage: "ru", learningResourceType: "Decision skill guide", teaches: skill.outcome };
  const body = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Навыки", href: "/ru/skills/" }, { label: skill.title }])}<section class="page-hero"><p class="eyebrow">Навык принятия решений</p><h1>${escapeHtml(skill.title)}</h1>${utilityBar("Практический навык")}<p class="lede">${escapeHtml(skill.summary)}</p><p><strong>Чему вы научитесь:</strong> ${escapeHtml(skill.outcome)}</p></section><section class="section"><p class="kicker">Когда пригодится</p><h2>Сначала узнайте знакомую ситуацию</h2>${list(skill.whenToUse)}</section><section class="section section--ink"><p class="kicker">Практика</p><h2>Что делать на следующем решении</h2>${list(skill.actions)}</section>${linked ? `<section class="section"><p class="kicker">Что стоит проверить</p><h2>Связанные когнитивные механизмы</h2><ul>${linked}</ul></section>` : ""}`;
  await write(`ru/skills/${skill.slug}`, page({ title: `${skill.title} — практический навык | Cognitive Biases`, description: skill.summary, ruPath, enPath, current: "skills", body, schema }));
  await addEnglishAlternate(enPath, ruPath);
}

const skillCards = ruSkills.map((skill) => `<article class="practice-set-card"><h2><a href="/ru/skills/${skill.slug}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.summary)}</p><p><strong>Чему вы научитесь:</strong> ${escapeHtml(skill.outcome)}</p><p><a href="/ru/skills/${skill.slug}/">Открыть навык →</a></p></article>`).join("");
await write("ru/skills", page({
  title: "Навыки принятия решений на русском | Cognitive Biases",
  description: "Шесть практических навыков: оценка доказательств, решения в неопределённости, прогнозирование, проверка собственного рассуждения, информации и работы с ИИ.",
  ruPath: "/ru/skills/", enPath: "/skills/", current: "skills",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Навыки принятия решений", inLanguage: "ru", numberOfItems: ruSkills.length },
  body: `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Навыки" }])}<section class="page-hero"><p class="eyebrow">Навыки</p><h1>Не только замечать искажение — уметь проверять решение</h1><p class="lede">Название помогает заметить возможную ловушку. Навык помогает действовать, когда перед вами уже есть реальное решение, срок, прогноз, источник или ответ ИИ.</p></section><section class="section"><p class="kicker">Библиотека навыков</p><h2>${ruSkills.length} направлений для регулярной практики</h2><div class="practice-set-grid">${skillCards}</div></section>`
}));
await addEnglishAlternate("/skills/", "/ru/skills/");

for (const article of ruEveryday) {
  const ruPath = `/ru/everyday/${article.slug}/`;
  const enPath = `/everyday/${article.slug}/`;
  if (!(await addEnglishAlternate(enPath, ruPath))) throw new Error(`Missing canonical English everyday guide: ${article.slug}`);
  const bias = ruBiasBySlug.get(article.biasSlug);
  if (!bias) throw new Error(`${article.slug}: Russian everyday guide requires a localized bias: ${article.biasSlug}`);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    inLanguage: "ru",
    dateModified: ruEverydayDoc.updatedAt,
    mainEntityOfPage: `${SITE}${ruPath}`,
    about: { "@id": `${SITE}/ru/biases/${bias.slug}/#term` },
    publisher: { "@type": "Organization", "@id": `${SITE}/#organization`, name: "Cognitive Biases" }
  };
  const body = `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Статьи", href: "/ru/everyday/" }, { label: article.title }])}<article><section class="page-hero"><p class="eyebrow">${escapeHtml(article.category)} · практическая статья</p><h1>${escapeHtml(article.title)}</h1>${utilityBar("Проверенный практический материал")}<p class="lede">${escapeHtml(article.summary)}</p></section><section class="section"><p class="kicker">Ситуация</p><h2>Как это выглядит в обычной жизни</h2><p>${escapeHtml(article.situation)}</p></section><section class="section"><p class="kicker">Что здесь происходит</p><h2>Механизм без лишней терминологии</h2><p>${escapeHtml(article.explanation)}</p></section><section class="section"><p class="kicker">Почему это важно</p><h2>Где решение может съехать в сторону</h2><p>${escapeHtml(article.whyItMatters)}</p></section><section class="section section--ink"><p class="kicker">Попробуйте так</p><h2>Одна проверка перед следующим шагом</h2><p>${escapeHtml(article.tryThis)}</p><p><strong>Вопрос себе:</strong> ${escapeHtml(article.takeaway)}</p></section><section class="section"><p class="kicker">На чём основано</p><h2><a href="/ru/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(bias.evidence)}</p><p><strong>Важно:</strong> ${escapeHtml(bias.boundary)}</p><p><a href="/ru/biases/${bias.slug}/">Открыть объяснение, источники и практическую проверку →</a></p></section></article>`;
  await write(`ru/everyday/${article.slug}`, page({ title: `${article.title} | Cognitive Biases`, description: article.summary, ruPath, enPath, current: "everyday", body, schema }));
}

const everydayCards = ruEveryday.map((article) => `<article class="practice-set-card" data-ru-filter-item data-search="${escapeHtml([article.title, article.category, article.summary, article.situation].join(" ").toLowerCase())}"><p class="kicker">${escapeHtml(article.category)}</p><h2><a href="/ru/everyday/${article.slug}/">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.summary)}</p><p><a href="/ru/everyday/${article.slug}/">Читать →</a></p></article>`).join("");
await write("ru/everyday", page({
  title: "Когнитивные искажения в жизни: практические статьи на русском | Cognitive Biases",
  description: "12 коротких русских статей о работе, покупках, новостях, ИИ и повседневных решениях — с понятным объяснением и одной практической проверкой.",
  ruPath: "/ru/everyday/", enPath: "/everyday/", current: "everyday",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Практические статьи о когнитивных искажениях", inLanguage: "ru", numberOfItems: ruEveryday.length },
  body: `${breadcrumbs([{ label: "Главная", href: "/ru/" }, { label: "Статьи" }])}<section class="page-hero"><p class="eyebrow">Когнитивные искажения в жизни</p><h1>Начните с ситуации, а не с термина</h1><p class="lede">Короткие статьи о решениях, которые действительно встречаются: сроки, цены, новости, плохие проекты и ответы ИИ. В каждой — понятный механизм и одна проверка, которую можно применить сразу.</p></section><section class="section"><p class="kicker">Практические статьи</p><h2>${ruEveryday.length} ситуаций для работы и повседневной жизни</h2>${filterWidget({ id: "ru-article-search", label: "Найти ситуацию", placeholder: "Например: цена, проект, ИИ, новости, сроки", countLabel: `${ruEveryday.length} статей`, cards: everydayCards, emptyText: "Ничего не нашли. Попробуйте другое слово или откройте английский раздел." })}</section>`
}));
await addEnglishAlternate("/everyday/", "/ru/everyday/");

await write("ru", page({
  title: "Cognitive Biases на русском — искажения, техники, навыки и статьи",
  description: `Русский практический слой Cognitive Biases: ${localizedBiases.length} проверенных объяснений, 11 техник, 6 навыков и ${ruEveryday.length} статей о реальных решениях.`,
  ruPath: "/ru/", enPath: "/",
  schema: { "@context": "https://schema.org", "@type": "WebPage", name: "Cognitive Biases на русском", url: `${SITE}/ru/`, inLanguage: "ru" },
  body: `<section class="page-hero"><p class="eyebrow">Русская версия</p><h1>Замечайте ловушку. Проверяйте решение. Делайте следующий шаг лучше.</h1><p class="lede">Здесь когнитивные искажения — не коллекция ярлыков. Это способ задать более хороший вопрос к реальному решению и проверить его до того, как ошибка станет дорогой.</p></section><section class="section"><div class="practice-set-grid"><article><p class="kicker">Искажения</p><h2><a href="/ru/biases/">Понять, что происходит</a></h2><p>Понятные объяснения, границы эффекта, источники и конкретные проверки.</p></article><article><p class="kicker">Техники</p><h2><a href="/ru/techniques/">Проверить решение пошагово</a></h2><p>11 процедур: от независимой оценки до проверки происхождения утверждения.</p></article><article><p class="kicker">Навыки</p><h2><a href="/ru/skills/">Тренировать способ работы с решениями</a></h2><p>6 навыков для доказательств, прогнозов, неопределённости, информации и ИИ.</p></article><article><p class="kicker">Статьи</p><h2><a href="/ru/everyday/">Начать с знакомой ситуации</a></h2><p>${ruEveryday.length} коротких материалов о ценах, проектах, новостях, сроках и работе с ИИ.</p></article></div></section><section class="section section--ink"><p class="kicker">Как читать этот сайт</p><h2>Искажение — это гипотеза для проверки, а не диагноз</h2><p class="lede">Если описание похоже на вашу ситуацию, используйте его как повод проверить данные, альтернативы и процесс решения. На страницах мы отдельно показываем, что поддерживают исследования и где нельзя делать слишком сильный вывод.</p></section>`
}));
await addEnglishAlternate("/", "/ru/");

await mkdir(join(OUT, "data", "ru"), { recursive: true });
await writeFile(join(OUT, "data", "ru", "biases.json"), `${JSON.stringify({ ...ruBiasesDoc, entries: localizedBiases }, null, 2)}\n`);
await writeFile(join(OUT, "data", "ru", "techniques.json"), `${JSON.stringify(ruTechniquesDoc, null, 2)}\n`);
await writeFile(join(OUT, "data", "ru", "skills.json"), `${JSON.stringify(ruSkillsDoc, null, 2)}\n`);
await writeFile(join(OUT, "data", "ru", "everyday-guides.json"), `${JSON.stringify(ruEverydayDoc, null, 2)}\n`);

const ruUrls = [
  "/ru/", "/ru/biases/", "/ru/techniques/", "/ru/skills/", "/ru/everyday/",
  ...localizedBiases.map((entry) => `/ru/biases/${entry.slug}/`),
  ...ruTechniques.map((entry) => `/ru/techniques/${entry.slug}/`),
  ...ruSkills.map((entry) => `/ru/skills/${entry.slug}/`),
  ...ruEveryday.map((entry) => `/ru/everyday/${entry.slug}/`)
];
const sitemapPath = join(OUT, "sitemap.xml");
try {
  let sitemap = await readFile(sitemapPath, "utf8");
  const missing = ruUrls.filter((url) => !sitemap.includes(`<loc>${SITE}${url}</loc>`));
  if (missing.length) {
    const nodes = missing.map((url) => `<url><loc>${SITE}${url}</loc></url>`).join("");
    sitemap = sitemap.replace("</urlset>", `${nodes}</urlset>`);
    await writeFile(sitemapPath, sitemap);
  }
} catch {
  console.warn("sitemap.xml was not available while generating Russian localization");
}

console.log(`Russian localization: ${localizedBiases.length} reviewed biases, ${ruTechniques.length} techniques, ${ruSkills.length} skills, ${ruEveryday.length} everyday guides.`);
