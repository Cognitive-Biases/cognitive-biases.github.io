import { readFile, writeFile } from "node:fs/promises";

const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const copy = {
  en: {
    base: "/", lang: "en", title: "Page not found", skip: "Skip to content", nav: "Primary navigation",
    eyebrow: "404 · Page not found", heading: "This page was not found.",
    lede: "The address may have changed, or the page may no longer exist. You can continue from the Cognitive Biases home page.",
    home: "Go to the home page", english: "Browse the English library", decide: "Decision tools", research: "Research",
    note: "A public guide to cognitive biases, evidence and better decisions."
  },
  de: {
    base: "/de/", lang: "de", title: "Seite nicht gefunden", skip: "Zum Inhalt springen", nav: "Hauptnavigation",
    eyebrow: "404 · Seite nicht gefunden", heading: "Diese Seite wurde nicht gefunden.",
    lede: "Die Adresse hat sich möglicherweise geändert oder die Seite existiert nicht mehr. Du kannst auf der deutschen Startseite weitermachen.",
    home: "Zur deutschen Startseite", english: "Englische Bibliothek öffnen", decide: "Entscheidungstools (Englisch)", research: "Forschung (Englisch)",
    note: "Ein öffentlicher Leitfaden zu kognitiven Verzerrungen, Evidenz und besseren Entscheidungen."
  },
  ru: {
    base: "/ru/", lang: "ru", title: "Страница не найдена", skip: "Перейти к содержанию", nav: "Основная навигация",
    eyebrow: "404 · Страница не найдена", heading: "Такой страницы нет.",
    lede: "Адрес мог измениться, или страница больше не существует. Продолжить можно с русской главной страницы.",
    home: "На русскую главную", english: "Открыть английскую библиотеку", decide: "Инструменты принятия решений (англ.)", research: "Исследования (англ.)",
    note: "Открытый справочник о когнитивных искажениях, доказательствах и более качественных решениях."
  },
  fr: {
    base: "/fr/", lang: "fr", title: "Page introuvable", skip: "Aller au contenu", nav: "Navigation principale",
    eyebrow: "404 · Page introuvable", heading: "Cette page est introuvable.",
    lede: "L’adresse a peut-être changé ou la page n’existe plus. Vous pouvez continuer depuis l’accueil en français.",
    home: "Retour à l’accueil en français", english: "Ouvrir la bibliothèque en anglais", decide: "Outils de décision (anglais)", research: "Recherche (anglais)",
    note: "Un guide public sur les biais cognitifs, les preuves et de meilleures décisions."
  },
  "pt-BR": {
    base: "/pt-br/", lang: "pt-BR", title: "Página não encontrada", skip: "Ir para o conteúdo", nav: "Navegação principal",
    eyebrow: "404 · Página não encontrada", heading: "Esta página não foi encontrada.",
    lede: "O endereço pode ter mudado ou a página pode não existir mais. Você pode continuar pela página inicial em português.",
    home: "Ir para a página inicial", english: "Abrir a biblioteca em inglês", decide: "Ferramentas de decisão (inglês)", research: "Pesquisa (inglês)",
    note: "Um guia público sobre vieses cognitivos, evidências e decisões melhores."
  },
  es: {
    base: "/es/", lang: "es", title: "Página no encontrada", skip: "Ir al contenido", nav: "Navegación principal",
    eyebrow: "404 · Página no encontrada", heading: "No encontramos esta página.",
    lede: "La dirección puede haber cambiado o la página puede haber dejado de existir. Puedes continuar desde la página de inicio en español.",
    home: "Ir al inicio en español", english: "Abrir la biblioteca en inglés", decide: "Herramientas de decisión (inglés)", research: "Investigación (inglés)",
    note: "Una guía pública sobre sesgos cognitivos, evidencia y mejores decisiones."
  },
  it: {
    base: "/it/", lang: "it", title: "Pagina non trovata", skip: "Vai al contenuto", nav: "Navigazione principale",
    eyebrow: "404 · Pagina non trovata", heading: "Questa pagina non è stata trovata.",
    lede: "L’indirizzo potrebbe essere cambiato oppure la pagina potrebbe non esistere più. Puoi continuare dalla home page in italiano.",
    home: "Vai alla home in italiano", english: "Apri la raccolta in inglese", decide: "Strumenti decisionali (inglese)", research: "Ricerca (inglese)",
    note: "Una guida pubblica sui bias cognitivi, le evidenze e decisioni migliori."
  }
};

const serialized = JSON.stringify(copy).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="theme-color" content="#101622">
<title>Page not found | ${identity.siteName}</title>
<meta name="description" content="This Cognitive Biases page does not exist. Continue from the localized home page or the English library.">
<link rel="icon" type="image/png" href="${identity.faviconPath}"><link rel="stylesheet" href="/styles.css">
<script>window.__CB_404_COPY=${serialized};(()=>{const p=location.pathname.toLowerCase();const entries=Object.entries(window.__CB_404_COPY).sort((a,b)=>b[1].base.length-a[1].base.length);const hit=entries.find(([,v])=>v.base!=="/"&&p.startsWith(v.base))||entries.find(([k])=>k==="en");window.__CB_404_LOCALE=hit[0];document.documentElement.lang=hit[1].lang;})();</script>
</head>
<body>
<a class="skip" href="#main" data-i18n="skip">Skip to content</a>
<header class="site-header"><a class="brand" data-home-link href="/"><img src="/assets/brand.webp" width="48" height="48" alt=""><span>Cognitive<br>Biases</span></a><nav data-i18n-aria="nav" aria-label="Primary navigation"><a data-home-link data-i18n="home" href="/">Go to the home page</a><a href="/explore/" lang="en" data-i18n="english">Browse the English library</a></nav></header>
<main id="main"><section class="page-hero"><p class="eyebrow" data-i18n="eyebrow">404 · Page not found</p><h1 data-i18n="heading">This page was not found.</h1><p class="lede" data-i18n="lede">The address may have changed, or the page may no longer exist. You can continue from the Cognitive Biases home page.</p><p><a class="button" data-home-link data-i18n="home" href="/">Go to the home page</a> <a class="button button--dark" href="/explore/" lang="en" data-i18n="english">Browse the English library</a></p><p class="fine-print"><a href="/decide/" hreflang="en" data-i18n="decide">Decision tools</a> · <a href="/research/" hreflang="en" data-i18n="research">Research</a></p></section></main>
<footer class="site-footer"><div><a class="brand brand--footer" data-home-link href="/"><img src="/assets/brand.webp" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p data-i18n="note">A public guide to cognitive biases, evidence and better decisions.</p></div><p class="fine-print">Maintained by ${identity.publisher.name}.</p></footer>
<script>(()=>{const c=window.__CB_404_COPY[window.__CB_404_LOCALE]||window.__CB_404_COPY.en;document.title=c.title+" | ${identity.siteName}";const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=c.lede;for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=c[el.dataset.i18n]||el.textContent;for(const el of document.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',c[el.dataset.i18nAria]||el.getAttribute('aria-label'));for(const el of document.querySelectorAll('[data-home-link]'))el.setAttribute('href',c.base);})();</script>
</body></html>`;

await writeFile("dist/404.html", html);
console.log("Generated locale-aware noindex GitHub Pages 404.html.");
