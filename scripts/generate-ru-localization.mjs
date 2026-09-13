import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";

const ruBiasesDoc = JSON.parse(await readFile("data/ru/biases.json", "utf8"));
const ruTechniquesDoc = JSON.parse(await readFile("data/ru/techniques.json", "utf8"));
const ruSkillsDoc = JSON.parse(await readFile("data/ru/skills.json", "utf8"));
const sourceTechniquesDoc = JSON.parse(await readFile("data/techniques.json", "utf8"));
const sourceSkillsDoc = JSON.parse(await readFile("data/skills.json", "utf8"));

const ruBiases = ruBiasesDoc.entries || [];
const ruTechniques = ruTechniquesDoc.techniques || [];
const ruSkills = ruSkillsDoc.entries || [];
const ruBiasBySlug = new Map(ruBiases.map((entry) => [entry.slug, entry]));
const sourceTechniqueBySlug = new Map((sourceTechniquesDoc.techniques || []).map((entry) => [entry.slug, entry]));
const sourceSkillBySlug = new Map((sourceSkillsDoc.entries || []).map((entry) => [entry.slug, entry]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function header(current = "") {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header"><a class="brand" href="/ru/"><img src="/assets/biases_icon.png" width="48" height="48" alt=""><span>Cognitive<br>Biases</span></a><nav aria-label="Основная навигация">${link("/ru/biases/", "Искажения", "biases")}${link("/ru/techniques/", "Техники", "techniques")}${link("/ru/skills/", "Навыки", "skills")}<a href="/">EN</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div><a class="brand brand--footer" href="/ru/"><img src="/assets/biases_icon.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>Практический справочник о когнитивных искажениях, доказательствах и более качественных решениях.</p></div><div class="footer-links"><a href="/ru/biases/">Искажения</a><a href="/ru/techniques/">Техники</a><a href="/ru/skills/">Навыки</a><a href="/methodology/">Методология (EN)</a></div><p class="fine-print">Образовательный материал. Он не заменяет медицинскую, юридическую, финансовую или психологическую консультацию.</p></footer>`;
}

function alternates(ruPath, enPath = null) {
  const self = `<link rel="alternate" hreflang="ru" href="${SITE}${ruPath}">`;
  if (!enPath) return self;
  return `${self}<link rel="alternate" hreflang="en" href="${SITE}${enPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${enPath}">`;
}

function page({ title, description, ruPath, enPath = null, current = "", body, schema }) {
  const canonical = `${SITE}${ruPath}`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}">${alternates(ruPath, enPath)}<link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="ru_RU"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${jsonForHtml(schema)}</script></head><body><a class="skip" href="#main">Перейти к содержанию</a>${header(current)}<main id="main">${body}</main>${footer()}</body></html>`;
}

async function write(relativePath, html) {
  const target = join(OUT, relativePath, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

async function addEnglishAlternate(enPath, ruPath) {
  const target = join(OUT, enPath.replace(/^\//, ""), "index.html");
  try {
    await access(target);
  } catch {
    return false;
  }
  let html = await readFile(target, "utf8");
  if (!html.includes(`hreflang="ru" href="${SITE}${ruPath}"`)) {
    html = html.replace("</head>", `${alternates(ruPath, enPath)}</head>`);
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
  const body = `<section class="page-hero"><p class="eyebrow">Когнитивное искажение</p><h1>${escapeHtml(bias.title)}</h1><p class="lede">${escapeHtml(bias.summary)}</p><p class="fine-print">${escapeHtml(bias.englishTitle)} · также ищут: ${escapeHtml((bias.aliases || []).join(", "))}</p></section><section class="section"><p class="kicker">Где ловушка</p><h2>Что именно может пойти не так</h2><p>${escapeHtml(bias.trap)}</p></section><section class="section section--ink"><p class="kicker">Практическая проверка</p><h2>Что делать</h2>${list(bias.actions)}<p class="fine-print">Эти действия не «выключают» искажение. Они помогают сделать решение более проверяемым и снизить риск типичной ошибки.</p></section><section class="section"><p class="kicker">Источники и статус</p><h2>Проверяйте доказательства, а не только название</h2><p>Русский текст — редакционная локализация практического слоя. Каноническая запись, исследования и evidence review остаются связаны с английской страницей.</p><p><a href="${enPath}#evidence">Открыть evidence review (EN) →</a></p></section>`;
  await write(`ru/biases/${bias.slug}`, page({ title: `${bias.title} — что это и как проверить себя | Cognitive Biases`, description: bias.summary, ruPath, enPath, current: "biases", body, schema }));
}

const biasCards = localizedBiases.map((bias) => `<article class="practice-set-card"><p class="kicker">${escapeHtml(bias.englishTitle)}</p><h2><a href="/ru/biases/${bias.slug}/">${escapeHtml(bias.title)}</a></h2><p>${escapeHtml(bias.summary)}</p><p><a href="/ru/biases/${bias.slug}/">Открыть практическую проверку →</a></p></article>`).join("");
await write("ru/biases", page({
  title: "Когнитивные искажения на русском | Cognitive Biases",
  description: "Редакционно проверенные русские объяснения когнитивных искажений с практическими действиями и связью с evidence review.",
  ruPath: "/ru/biases/",
  enPath: "/explore/",
  current: "biases",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Когнитивные искажения на русском", inLanguage: "ru", numberOfItems: localizedBiases.length },
  body: `<section class="page-hero"><p class="eyebrow">Русская библиотека</p><h1>Когнитивные искажения без переводной канцелярщины</h1><p class="lede">Здесь публикуются только редакционно проверенные русские версии. Мы не выдаём автоматический перевод всего legacy-корпуса за готовую локализацию.</p></section><section class="section"><p class="kicker">Проверенный слой</p><h2>${localizedBiases.length} локализованных концептов</h2><div class="practice-set-grid">${biasCards}</div></section>`
}));
await addEnglishAlternate("/explore/", "/ru/biases/");

for (const technique of ruTechniques) {
  const source = sourceTechniqueBySlug.get(technique.slug);
  if (!source) throw new Error(`Missing source technique: ${technique.slug}`);
  const ruPath = `/ru/techniques/${technique.slug}/`;
  const linked = (source.biases || []).map((slug) => {
    const translated = ruBiasBySlug.get(slug);
    return translated
      ? `<li><a href="/ru/biases/${slug}/">${escapeHtml(translated.title)}</a></li>`
      : `<li><a href="/biases/${slug}/">${escapeHtml(slug.replaceAll("-", " "))} (EN)</a></li>`;
  }).join("");
  const schema = { "@context": "https://schema.org", "@type": "HowTo", name: technique.title, description: technique.purpose, inLanguage: "ru", step: technique.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })) };
  const body = `<section class="page-hero"><p class="eyebrow">Техника решения</p><h1>${escapeHtml(technique.title)}</h1><p class="lede">${escapeHtml(technique.purpose)}</p></section><section class="section"><p class="kicker">Когда применять</p><h2>Сигнал к использованию</h2><p>${escapeHtml(technique.whenToUse)}</p></section><section class="section section--ink"><p class="kicker">Шаги</p><h2>Как выполнить проверку</h2><ol>${technique.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section><section class="section"><p class="kicker">Ограничение</p><h2>Когда техника может подвести</h2><p>${escapeHtml(technique.limitations)}</p>${linked ? `<h3>Связанные искажения</h3><ul>${linked}</ul>` : ""}</section>`;
  await write(`ru/techniques/${technique.slug}`, page({ title: `${technique.title} | Техники решений | Cognitive Biases`, description: technique.purpose, ruPath, current: "techniques", body, schema }));
}

const techniqueCards = ruTechniques.map((technique) => `<article class="practice-set-card"><h2><a href="/ru/techniques/${technique.slug}/">${escapeHtml(technique.title)}</a></h2><p>${escapeHtml(technique.purpose)}</p><p><a href="/ru/techniques/${technique.slug}/">Открыть технику →</a></p></article>`).join("");
await write("ru/techniques", page({
  title: "11 практических техник против ошибок мышления | Cognitive Biases",
  description: "Практические техники: проверка базовой частоты, журнал решений, red team, независимая оценка, критерии пересмотра и другие.",
  ruPath: "/ru/techniques/", current: "techniques",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Практические техники принятия решений", inLanguage: "ru", numberOfItems: ruTechniques.length },
  body: `<section class="page-hero"><p class="eyebrow">Практика</p><h1>Не просто знать название искажения. Делать следующий шаг лучше.</h1><p class="lede">${escapeHtml(ruTechniquesDoc.description)}</p></section><section class="section"><p class="kicker">Набор техник</p><h2>${ruTechniques.length} структурированных проверок</h2><div class="practice-set-grid">${techniqueCards}</div></section>`
}));

for (const skill of ruSkills) {
  const source = sourceSkillBySlug.get(skill.slug);
  if (!source) throw new Error(`Missing source skill: ${skill.slug}`);
  const ruPath = `/ru/skills/${skill.slug}/`;
  const enPath = `/skills/${skill.slug}/`;
  const linked = (source.biases || []).map((slug) => {
    const translated = ruBiasBySlug.get(slug);
    return translated
      ? `<li><a href="/ru/biases/${slug}/">${escapeHtml(translated.title)}</a></li>`
      : `<li><a href="/biases/${slug}/">${escapeHtml(slug.replaceAll("-", " "))} (EN)</a></li>`;
  }).join("");
  const schema = { "@context": "https://schema.org", "@type": "LearningResource", name: skill.title, description: skill.summary, inLanguage: "ru", learningResourceType: "Decision skill guide", teaches: skill.outcome };
  const body = `<section class="page-hero"><p class="eyebrow">Навык принятия решений</p><h1>${escapeHtml(skill.title)}</h1><p class="lede">${escapeHtml(skill.summary)}</p><p><strong>Результат:</strong> ${escapeHtml(skill.outcome)}</p></section><section class="section"><p class="kicker">Когда пригодится</p><h2>Сначала узнайте ситуацию</h2>${list(skill.whenToUse)}</section><section class="section section--ink"><p class="kicker">Практика</p><h2>Что делать</h2>${list(skill.actions)}</section>${linked ? `<section class="section"><p class="kicker">Связанные искажения</p><h2>Линзы для проверки</h2><ul>${linked}</ul></section>` : ""}`;
  await write(`ru/skills/${skill.slug}`, page({ title: `${skill.title} | Навыки решений | Cognitive Biases`, description: skill.summary, ruPath, enPath, current: "skills", body, schema }));
  await addEnglishAlternate(enPath, ruPath);
}

const skillCards = ruSkills.map((skill) => `<article class="practice-set-card"><h2><a href="/ru/skills/${skill.slug}/">${escapeHtml(skill.title)}</a></h2><p>${escapeHtml(skill.summary)}</p><p><strong>Результат:</strong> ${escapeHtml(skill.outcome)}</p><p><a href="/ru/skills/${skill.slug}/">Развивать навык →</a></p></article>`).join("");
await write("ru/skills", page({
  title: "Навыки принятия решений на русском | Cognitive Biases",
  description: "Шесть практических навыков: оценка доказательств, решения в неопределённости, прогнозирование, метакогнитивная проверка, проверка информации и работа с ИИ.",
  ruPath: "/ru/skills/", enPath: "/skills/", current: "skills",
  schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Навыки принятия решений", inLanguage: "ru", numberOfItems: ruSkills.length },
  body: `<section class="page-hero"><p class="eyebrow">Навыки</p><h1>Переводим знания об искажениях в повторяемые действия</h1><p class="lede">Название bias помогает заметить паттерн. Навык помогает действовать, когда решение уже перед вами.</p></section><section class="section"><p class="kicker">Библиотека навыков</p><h2>${ruSkills.length} практических направлений</h2><div class="practice-set-grid">${skillCards}</div></section>`
}));
await addEnglishAlternate("/skills/", "/ru/skills/");

await write("ru", page({
  title: "Cognitive Biases на русском — искажения, техники и навыки решений",
  description: "Русский практический слой Cognitive Biases: проверенные объяснения, 11 техник и 6 навыков для более качественных решений.",
  ruPath: "/ru/", enPath: "/",
  schema: { "@context": "https://schema.org", "@type": "WebPage", name: "Cognitive Biases — русский практический слой", url: `${SITE}/ru/`, inLanguage: "ru" },
  body: `<section class="page-hero"><p class="eyebrow">Русская версия</p><h1>Когнитивные искажения полезны только тогда, когда меняют следующий шаг.</h1><p class="lede">Не энциклопедия ради терминов. Проверенные объяснения, конкретные вопросы и техники, которые можно применить к реальному решению.</p></section><section class="section"><div class="practice-set-grid"><article><p class="kicker">Искажения</p><h2><a href="/ru/biases/">Понять механизм</a></h2><p>Редакционно проверенные русские объяснения и практические действия.</p></article><article><p class="kicker">Техники</p><h2><a href="/ru/techniques/">Проверить решение</a></h2><p>11 пошаговых методов: от базовой частоты до маленького обратимого теста.</p></article><article><p class="kicker">Навыки</p><h2><a href="/ru/skills/">Тренировать способ мышления</a></h2><p>6 навыков для доказательств, прогнозов, неопределённости, информации и работы с ИИ.</p></article></div></section><section class="section section--ink"><p class="kicker">Принцип локализации</p><h2>Лучше меньше переведённого, но больше проверенного.</h2><p class="lede">Английский корпус остаётся каноническим источником. В русский индекс попадает только редакционно проверенный материал; непроверенный legacy-текст не маскируется под готовую локализацию.</p></section>`
}));
await addEnglishAlternate("/", "/ru/");

await mkdir(join(OUT, "data", "ru"), { recursive: true });
await writeFile(join(OUT, "data", "ru", "biases.json"), `${JSON.stringify({ ...ruBiasesDoc, entries: localizedBiases }, null, 2)}\n`);
await writeFile(join(OUT, "data", "ru", "techniques.json"), `${JSON.stringify(ruTechniquesDoc, null, 2)}\n`);
await writeFile(join(OUT, "data", "ru", "skills.json"), `${JSON.stringify(ruSkillsDoc, null, 2)}\n`);

const ruUrls = [
  "/ru/", "/ru/biases/", "/ru/techniques/", "/ru/skills/",
  ...localizedBiases.map((entry) => `/ru/biases/${entry.slug}/`),
  ...ruTechniques.map((entry) => `/ru/techniques/${entry.slug}/`),
  ...ruSkills.map((entry) => `/ru/skills/${entry.slug}/`)
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

console.log(`Russian localization: ${localizedBiases.length} reviewed biases, ${ruTechniques.length} techniques, ${ruSkills.length} skills.`);
