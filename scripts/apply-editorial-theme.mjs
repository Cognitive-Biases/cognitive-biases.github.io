import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const [biasCorpus, taxonomy] = await Promise.all([
  readFile("data/biases.json", "utf8").then(JSON.parse),
  readFile("data/taxonomy-v2.json", "utf8").then(JSON.parse),
]);

const familyIds = new Set(Object.keys(taxonomy.families));
const uniqueBiasAssets = new Set(
  await readdir("public/assets/editorial/biases").catch(() => [])
);

function inferFamily(record) {
  const override = taxonomy.recordFamilyOverrides?.[String(record.id)];
  if (familyIds.has(override)) return override;
  const direct = taxonomy.directCategoryFamily?.[record.typeOfBias];
  if (familyIds.has(direct)) return direct;
  const text = `${record.title} ${record.description} ${record.typeOfBias}`.toLowerCase();
  const rules = [
    ["goals-proxies-incentives", /surrogat|proxy|proxies|metric|target|incentive|goodhart/],
    ["measurement-methods", /systematic bias|selection bias|sampling|measurement|calibrat|experimenter|observer bias/],
    ["past-present-comparison", /declinism|rosy retrospection|fading affect|golden age|past and present/],
    ["retrospective-evaluation", /hindsight|outcome bias|moral luck|knew it all along/],
    ["future-state-forecasting", /impact bias|projection bias|empathy gap|future self|forecast.*feeling/],
    ["time-commitment", /sunk cost|escalation|hyperbolic|present bias|commitment|time discount/],
    ["probability-risk", /probab|risk|base rate|gambler|ambiguity|subadd|conjunction|denominator/],
    ["valuation-choice", /anchor|framing|loss aversion|decoy|default|status quo|endowment|choice|valuation|price/],
    ["belief-updating", /confirmation|belief|truth|backfire|continued influence|congruence|conservatism/],
    ["memory-retrieval", /memory|recall|remember|forget|reminisc|source confusion|misinformation effect/],
    ["perception-patterns", /pareidolia|apophenia|pattern|illusion|perception|agency detection|correlation/],
    ["self-metacognition", /confidence|dunning|self-|introspection|better-than|spotlight|transparency/],
    ["social-judgment", /social|attribution|conform|halo|stereotyp|ingroup|outgroup|authority|bandwagon/],
    ["reasoning-flexibility", /fallacy|fixedness|rigidity|logic|reasoning|substitution|einstellung/],
    ["attention-information", /attention|availability|salience|information|automation|survivorship|neglect/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "attention-information";
}

const biasBySlug = new Map(biasCorpus.filter((record) => record.published).map((record) => [record.slug, {
  ...record,
  editorialFamily: inferFamily(record),
}]));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function routeFor(file) {
  const local = relative(OUT, file).replaceAll("\\", "/");
  if (local === "index.html") return "/";
  return `/${local.replace(/index\.html$/, "")}`;
}

function pageKind(route) {
  if (route === "/") return "home";
  if (route.startsWith("/biases/")) return "entry";
  if (route.startsWith("/tools/") || route.startsWith("/experiments/")) return "tool";
  if (route.startsWith("/research/") || route.startsWith("/evidence/") || route.startsWith("/observatory/")) return "evidence";
  if (route.startsWith("/contexts/") || route.startsWith("/everyday/") || route.startsWith("/practice/")) return "guide";
  if (route.startsWith("/explore/") || route.startsWith("/families/") || route.startsWith("/kinds/")) return "library";
  return "page";
}

function artFor(route) {
  const biasSlug = route.match(/^\/biases\/([^/]+)\//)?.[1];
  const bias = biasSlug ? biasBySlug.get(biasSlug) : null;
  if (bias) return biasArtFor(bias);
  const pageArt = [
    ["/explore/", "explore"],
    ["/evidence/", "evidence"],
    ["/contexts/", "contexts"],
    ["/research/", "research"],
    ["/practice/", "practice"],
    ["/experiments/", "experiments"],
    ["/compare/", "compare"],
    ["/about/", "about"],
    ["/ai-benchmark/", "ai-benchmark"],
    ["/ai-era/", "ai-era"],
    ["/data/", "data"],
    ["/everyday/", "everyday"],
    ["/how-it-works/", "how-it-works"],
    ["/kinds/", "kinds"],
    ["/lenses/", "lenses"],
    ["/methodology/", "methodology"],
    ["/observatory/", "observatory"],
    ["/partners/", "partners"],
    ["/professional/", "professional"],
    ["/quality/", "quality"],
    ["/skills/", "skills"],
    ["/tools/decision-audit/", "decision-audit"],
    ["/tools/career-decision-review/", "career-decision-review"],
    ["/tools/lens-pack-builder/", "lens-pack-builder"],
  ].find(([prefix]) => route === prefix);
  if (pageArt) return `/assets/editorial/pages/${pageArt[1]}.webp`;
  if (/anchoring|pricing|estimate|forecast/.test(route)) return "/assets/editorial/anchoring.webp";
  if (/confirmation|misinformation|truth|claims|compare/.test(route)) return "/assets/editorial/confirmation.webp";
  if (/sunk-cost|project|career|audit|workbench|lens|practice|experiment/.test(route)) return "/assets/editorial/sunk-cost.webp";
  return "/assets/editorial/evidence.webp";
}

function biasArtFor(bias) {
  const file = `${bias.slug}.webp`;
  return uniqueBiasAssets.has(file)
    ? `/assets/editorial/biases/${file}`
    : `/assets/editorial/families/${bias.editorialFamily}.webp`;
}

function active(route, prefix) {
  return route === prefix || route.startsWith(prefix) ? ' aria-current="page"' : "";
}

function header(route) {
  if (route === "/") {
    return `<header class="site-header site-header--home"><a class="brand" href="/" aria-label="Cognitive Biases home"><picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="52" height="52" alt=""></picture><span><strong>Cognitive Biases</strong><small>Public knowledge library</small></span></a><nav aria-label="Primary"><div class="site-nav"><div class="site-nav__core"><a href="/explore/">Explore</a><a href="/contexts/">Guides</a><a href="/evidence/">Evidence</a><a href="/about/">About</a><a class="home-search" href="/explore/#search"><img src="/assets/editorial/home/search-icon.png" width="30" height="30" alt=""><span>Search</span></a></div><button class="nav-menu" type="button" aria-expanded="false" aria-controls="site-nav-drawer">Menu</button><div class="site-nav__drawer" id="site-nav-drawer" hidden><div class="site-nav__drawer-core"><a href="/explore/">Explore</a><a href="/contexts/">Guides</a><a href="/evidence/">Evidence</a><a href="/about/">About</a></div><a href="/tools/decision-audit/">Decision tools</a><a href="/compare/">Compare</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-search" href="/explore/#search">Search the library</a></div></div></nav></header>`;
  }
  return `<header class="site-header"><a class="brand" href="/" aria-label="Cognitive Biases home"><picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="52" height="52" alt=""></picture><span><strong>Cognitive Biases</strong><small>Public knowledge library</small></span></a><nav aria-label="Primary"><div class="site-nav"><div class="site-nav__core"><a href="/explore/"${active(route, "/explore/")}>Explore</a><a href="/contexts/"${active(route, "/contexts/")}>Guides</a><a href="/evidence/"${active(route, "/evidence/")}>Evidence</a><a href="/tools/decision-audit/"${active(route, "/tools/")}>Decision tools</a></div><button class="nav-menu" type="button" aria-expanded="false" aria-controls="site-nav-drawer">Menu</button><div class="site-nav__drawer" id="site-nav-drawer" hidden><div class="site-nav__drawer-core"><a href="/explore/">Explore</a><a href="/contexts/">Guides</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/">Decision tools</a></div><a href="/compare/">Compare</a><a href="/kinds/">Concept kinds</a><a href="/practice/">Practice</a><a href="/everyday/">Everyday life</a><a href="/research/">Research</a><a href="/observatory/">Observatory</a><a href="/lenses/">Lens packs</a><a href="/data/">Data</a><a href="/about/">About</a><a class="nav-search" href="/explore/#search">Search the library</a></div></div></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="site-footer__brand"><a class="brand brand--footer" href="/"><picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="48" height="48" alt=""></picture><span><strong>Cognitive Biases</strong><small>Evidence reviewed. Uncertainty shown.</small></span></a><p>Notice the pattern, check the claim, and make the next move explicit.</p></div><div class="footer-links"><a href="/explore/">Explore</a><a href="/contexts/">Guides</a><a href="/tools/decision-audit/">Decision tools</a><a href="/evidence/">Evidence</a><a href="/compare/">Compare</a><a href="/research/">Research</a><a href="/data/">Public data</a><a href="/how-it-works/">How it works</a><a href="/methodology/">Methodology</a><a href="/quality/">Quality</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer>`;
}

const homepageHero = `<section class="editorial-hero"><img class="home-art home-art--graph" src="/assets/editorial/home/left-graph.webp" width="145" height="215" alt="" aria-hidden="true"><img class="home-art home-art--left-notes" src="/assets/editorial/home/left-notes-narrow.webp" width="120" height="330" alt="" aria-hidden="true"><img class="home-art home-art--quote" src="/assets/editorial/home/quote-note.webp" width="305" height="160" alt="" aria-hidden="true"><img class="home-art home-art--cat" src="/assets/editorial/home/cat-collage.webp" width="650" height="635" alt="Cat wearing a mirrored thinking cap and pixel sunglasses" fetchpriority="high"><img class="home-art home-art--brain" src="/assets/editorial/home/filter-brain.webp" width="235" height="270" alt="" aria-hidden="true"><img class="home-art home-art--partner" src="/assets/editorial/home/partner-note.webp" width="253" height="135" alt="" aria-hidden="true"><img class="home-art home-art--bayes" src="/assets/editorial/home/bayes-note.webp" width="218" height="195" alt="" aria-hidden="true"><div class="editorial-hero__copy"><h1><span>Your</span> <span>brain</span> <span>edits</span> <span>reality.</span></h1><div class="editorial-hero__lower"><p>Learn the patterns. Check the evidence.<br>Make a clearer move.</p><div class="actions"><a class="button" href="/tools/decision-audit/">Explore a real decision<img src="/assets/editorial/home/arrow-icon.webp" width="28" height="28" alt=""></a><a class="button button--outline" href="/explore/">Browse the visual atlas</a></div></div></div></section>`;

const homepageAtlas = `<section class="section editorial-atlas"><h2 class="sr-only">Three thinking patterns to see differently</h2><div class="editorial-atlas__grid"><a class="editorial-story" href="/biases/cognitive-bias-anchoring-effect/" aria-label="Anchoring effect: the first number sticks like a magnet"><img src="/assets/editorial/home/card-anchoring.webp" width="455" height="324" alt="Anchoring: a large red eight pulls later numbers toward it"></a><a class="editorial-story" href="/biases/confirmation-bias-congruence-bias/" aria-label="Confirmation bias: we look for evidence that agrees with what we already think"><img src="/assets/editorial/home/card-confirmation.webp" width="465" height="324" alt="Confirmation bias: blue and red lenses filter evidence"></a><a class="editorial-story" href="/biases/cognitive-bias-sunk-cost-effect/" aria-label="Sunk cost: we keep climbing because we have already come so far"><img src="/assets/editorial/home/card-sunk-cost.webp" width="516" height="324" alt="Sunk cost: a person stands on a looping neon staircase"></a></div></section>`;

function addPageVisual(html, route) {
  const asset = artFor(route);
  return html.replace(/<section class="page-hero([^\"]*)">([\s\S]*?)<\/section>/, (_match, extra, content) => `<section class="page-hero${extra}"><div class="page-hero__copy">${content}</div><figure class="page-visual"><img src="${asset}" width="1024" height="768" alt="" loading="eager" aria-hidden="true"></figure></section>`);
}

function addEntryVisual(html, route) {
  const asset = artFor(route);
  const slug = route.match(/^\/biases\/([^/]+)\//)?.[1];
  const title = biasBySlug.get(slug)?.title?.split(" – ")[0] || "this concept";
  return html.replace(/(<article class="article"[\s\S]*?<h1>[\s\S]*?<\/h1>)/, `$1<figure class="article-visual"><img src="${asset}" width="1024" height="768" alt="Electric editorial collage illustrating ${escapeHtml(title)}" loading="eager"></figure>`);
}

function addBiasCardVisuals(html) {
  return html.replace(/<a class="bias-link" href="\/biases\/([^/]+)\/">/g, (opening, slug) => {
    const bias = biasBySlug.get(slug);
    if (!bias) return opening;
    return `${opening}<img class="bias-thumb" src="${biasArtFor(bias)}" width="1024" height="768" alt="" loading="lazy" aria-hidden="true">`;
  });
}

function transform(html, route) {
  const kind = pageKind(route);
  html = html.replace(/<meta name="theme-color" content="[^"]*">/, '<meta name="theme-color" content="#1515a8">');
  if (!html.includes("max-image-preview:large")) {
    if (/<meta name="robots" content="[^"]*">/.test(html)) {
      html = html.replace(/<meta name="robots" content="([^"]*)">/, (_match, content) => `<meta name="robots" content="${content}, max-image-preview:large">`);
    } else {
      html = html.replace("</head>", '<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1"></head>');
    }
  }
  html = html.replace(/<body(?:\s[^>]*)?>/, `<body data-theme="editorial-collage" data-page-kind="${kind}">`);
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/, header(route));
  html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, footer());
  html = html.replace('<div class="filter"', '<div class="filter" id="search"');

  if (route === "/") {
    html = /<section class="editorial-hero">/.test(html)
      ? html.replace(/<section class="editorial-hero">[\s\S]*?<\/section>/, homepageHero)
      : html.replace(/<section class="hero home-hero">[\s\S]*?<\/section>/, homepageHero);
    html = /<section class="section editorial-atlas">/.test(html)
      ? html.replace(/<section class="section editorial-atlas">[\s\S]*?<\/section>/, homepageAtlas)
      : html.replace('<section class="section home-system">', `${homepageAtlas}<section class="section home-system">`);
    html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/assets/editorial/hero-collage.webp">`);
  } else {
    html = addPageVisual(html, route);
    if (kind === "entry") html = addEntryVisual(html, route);
    html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}${artFor(route)}">`);
  }
  html = addBiasCardVisuals(html);
  return html;
}

const files = await htmlFiles(OUT);
for (const file of files) {
  const source = await readFile(file, "utf8");
  const next = transform(source, routeFor(file));
  if (next !== source) await writeFile(file, next);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
styles = styles.replace(
  /@import url\('[^']+'\);/,
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Inter+Tight:wght@700;800;900&display=swap');",
);
styles += String.raw`

/* Electric Editorial Collage theme */
:root{
  --ink:#10103f;--paper:#fff8ea;--blue:#1515a8;--blue-deep:#09094a;
  --yellow:#ffd900;--pink:#ff2a9b;--coral:#ff554d;--cyan:#16d8e6;
  --violet:#6827d9;--muted:#625f72;--line:2px solid var(--ink);
  --content:1240px;--reading:760px;
  --font-display:'Inter Tight','Arial Black',sans-serif;
}
*{min-width:0}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
html{scroll-padding-top:7rem}
body{background:var(--paper);color:var(--ink);font-family:'DM Sans',Arial,sans-serif;font-size:16px;line-height:1.62;overflow-x:hidden}
body:lang(ru),body:lang(de){hyphens:auto}
img{max-width:100%;height:auto}
a{text-underline-offset:.18em;text-decoration-thickness:.08em}
.skip:focus{left:1rem;top:1rem;z-index:1000;background:var(--yellow);color:var(--ink);border:var(--line);padding:.7rem 1rem}
.site-header{position:sticky;inset-block-start:0;z-index:100;display:flex;justify-content:space-between;align-items:center;gap:2rem;padding:.9rem max(4vw,1rem);border:0;border-bottom:2px solid #ffffff35;background:var(--blue-deep);color:#fff}
.site-header .brand{color:#fff;gap:.8rem;letter-spacing:0;font-family:'DM Sans',sans-serif}
.brand-picture{display:grid;place-items:center;flex:0 0 auto}
.brand img{border:2px solid #fff;border-radius:50%;background:var(--coral)}
.brand>span{display:grid;gap:.2rem;line-height:1.05}
.brand strong{font:700 1.02rem/1.05 'DM Sans',sans-serif;letter-spacing:-.035em}
.brand small{font:600 .65rem/1 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.16em;color:#c7c9ff;white-space:nowrap}
.site-nav{position:relative;display:flex;align-items:center;gap:.9rem;font-weight:700}
.site-nav__core{display:flex;align-items:center;gap:clamp(.8rem,2.2vw,2rem)}
.site-nav a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;white-space:nowrap}
.site-nav a:hover,.site-nav a[aria-current="page"]{color:var(--yellow);text-decoration:none}
.nav-menu{min-height:44px;padding:.55rem .9rem;border:2px solid #fff;background:transparent;color:#fff;font:800 .85rem 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}
.nav-menu:hover,.nav-menu[aria-expanded="true"]{background:var(--yellow);border-color:var(--yellow);color:var(--ink)}
.site-nav__drawer{position:absolute;inset-block-start:calc(100% + 1rem);inset-inline-end:0;z-index:120;display:grid;grid-template-columns:repeat(2,minmax(170px,1fr));gap:.1rem;width:min(460px,calc(100vw - 2rem));padding:.7rem;background:var(--paper);color:var(--ink);border:var(--line);box-shadow:12px 12px 0 var(--pink)}
.site-nav__drawer[hidden]{display:none}
.site-nav__drawer a{padding:.5rem .65rem;white-space:normal}
.site-nav__drawer a:hover{background:var(--yellow);color:var(--ink)}
.site-nav__drawer-core{display:none}
.site-nav__drawer .nav-search{grid-column:1/-1;background:var(--cyan);justify-content:center}
.editorial-hero{position:relative;isolation:isolate;min-height:min(700px,calc(100svh - 82px));display:grid;align-items:center;overflow:hidden;background:var(--blue)}
.editorial-hero__art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-1}
.editorial-hero__copy{width:min(720px,92vw);margin-inline:max(5vw,1.25rem);padding-block:clamp(2.5rem,4vw,4rem);color:#fff}
.editorial-hero__copy .eyebrow{display:inline-block;margin:0 0 1rem;padding:.4rem .65rem;background:var(--yellow);color:var(--ink)}
.editorial-hero h1{max-width:9ch;margin:0 0 1.15rem;font:900 clamp(3.8rem,7vw,7.5rem)/.82 var(--font-display);letter-spacing:-.06em;text-wrap:balance;overflow-wrap:anywhere;text-shadow:0 3px 0 #111173}
.editorial-hero__copy>p:not(.eyebrow):not(.hero-trust){max-width:34rem;font-size:clamp(1.05rem,1.7vw,1.3rem);font-weight:700}
.editorial-hero .actions{gap:.9rem;margin-top:2rem}
.button,.nav-cta{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:.7rem 1rem;border:var(--line);border-radius:0;background:var(--yellow);color:var(--ink);box-shadow:6px 6px 0 var(--ink);font-weight:800;text-decoration:none;transition:transform .16s ease,box-shadow .16s ease,background-color .16s ease}
.button:hover,.nav-cta:hover{transform:translate(3px,3px);box-shadow:3px 3px 0 var(--ink);text-decoration:none}
.button--dark{background:var(--ink);color:#fff}.button--outline{background:var(--blue);color:#fff;border-color:#fff;box-shadow:6px 6px 0 var(--pink)}
.hero-trust{margin-top:1.4rem!important;color:#dfe2ff;font-size:.82rem!important;text-transform:uppercase;letter-spacing:.08em}
.section{padding:clamp(4.5rem,8vw,8rem) max(5vw,1.25rem);border-bottom:0}
.section>*{max-width:var(--content);margin-inline:auto}
.section>.kicker{margin-bottom:.9rem}
.section h2,.page-hero h1,.article h1,.legal h1,.everyday-article h1,.experiment-article h1{font-family:var(--font-display);font-weight:900;letter-spacing:-.045em;text-wrap:balance;overflow-wrap:anywhere}
.section h2{font-size:clamp(2.1rem,4vw,4rem);line-height:1;max-width:980px}
.kicker,.eyebrow{font:800 .78rem/1.25 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.11em;color:var(--pink)}
.lede{font-weight:600;color:#34324d}
.editorial-atlas{background:var(--paper);padding-top:1.6rem}
.editorial-atlas__head{display:flex;justify-content:space-between;align-items:end;gap:2rem;margin-bottom:2.5rem}
.editorial-atlas__head h2{margin:0}.editorial-atlas__head .lede{margin:0;max-width:34rem}
.editorial-atlas__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem}
.editorial-story{position:relative;display:flex;flex-direction:column;background:#fff;text-decoration:none;border:var(--line);box-shadow:9px 9px 0 var(--ink);transition:transform .18s ease,box-shadow .18s ease}
.editorial-story:hover{transform:translate(4px,4px);box-shadow:5px 5px 0 var(--ink);text-decoration:none}
.editorial-story img{width:100%;aspect-ratio:4/3;object-fit:cover;border-bottom:var(--line)}
.editorial-story>span{margin:1rem 1rem .25rem;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em}
.editorial-story>strong{margin:0 1rem;font:800 clamp(1.35rem,2vw,2rem)/1.05 var(--font-display);letter-spacing:-.035em}
.editorial-story>p{margin:.7rem 1rem 1.2rem;color:#4f4b61}
.editorial-story--yellow>span{color:#9b5e00}.editorial-story--cyan>span{color:#006f79}.editorial-story--pink>span{color:#b0005e}
.page-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:clamp(2rem,5vw,5rem);align-items:center;min-height:500px;padding:clamp(3rem,5vw,5.5rem) max(5vw,1.25rem);background:var(--blue);color:#fff;border-bottom:0}
.page-hero__copy{max-width:780px}.page-hero h1{max-width:17ch;font-size:clamp(2.75rem,4.2vw,4.5rem);line-height:.98;margin:.55rem 0 1.3rem}
.page-hero .lede{color:#e4e4ff;max-width:42rem}.page-hero .eyebrow,.page-hero .kicker{color:var(--yellow)}.page-hero .audit-privacy{color:var(--ink)}
.page-hero .guide-jumps a{color:var(--ink)}
.page-visual{position:relative;margin:0;border:2px solid #fff;box-shadow:12px 12px 0 var(--pink);overflow:hidden;transform:rotate(1deg)}
.page-visual img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
.article{max-width:1000px;padding:clamp(3rem,6vw,6rem) max(5vw,1.25rem)}
.article h1{max-width:22ch;font-size:clamp(2.5rem,4.4vw,4.75rem);line-height:1;margin:.9rem 0 2rem}
.everyday-article h1,.experiment-article h1{max-width:20ch;font-size:clamp(2.5rem,4.4vw,4.5rem);line-height:1;margin:.8rem 0 1.5rem}
.article>p,.article>section:not(.related),.article>h2,.article>h3,.article>.breadcrumbs,.article>.eyebrow{max-width:var(--reading);margin-inline:auto}
.article-visual{max-width:1000px;margin:0 auto 3rem;border:var(--line);box-shadow:12px 12px 0 var(--cyan);overflow:hidden}
.article-visual img{display:block;width:100%;aspect-ratio:16/7;object-fit:cover}
.article .definition{max-width:var(--reading);padding:1.2rem 1.4rem;border-left:8px solid var(--yellow);background:#fff;font-size:1.18rem}
.article h2{font:800 clamp(1.55rem,3vw,2.35rem)/1.1 var(--font-display);letter-spacing:-.035em}
.article h3{font:800 1.18rem/1.2 'DM Sans',sans-serif}
.evidence-review{margin-block:4rem;padding:clamp(1.4rem,4vw,3rem)!important;background:var(--blue-deep);color:#fff;border:0;box-shadow:12px 12px 0 var(--pink)}
.evidence-review p,.evidence-review h2,.evidence-review h3{max-width:none!important}.evidence-review a{color:var(--yellow)}
.evidence-review__head{border-bottom:1px solid #ffffff48}.evidence-status{background:var(--yellow);color:var(--ink);border:0}
.bias-grid,.family-grid,.home-system-grid,.context-lens-grid,.evidence-grid,.comparison-grid,.practice-grid,.everyday-grid,.experiment-grid,.application-grid{gap:1rem;border:0!important}
.bias-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.bias-link,.family-card,.home-system-grid article,.context-lens-card,.evidence-card,.comparison-card,.application-card{border:var(--line);background:#fff;box-shadow:6px 6px 0 var(--ink);min-height:0}
.bias-link{overflow:hidden}.bias-link .bias-thumb{display:block;width:calc(100% + 2.8rem);max-width:none;aspect-ratio:4/3;object-fit:cover;margin:-1.4rem -1.4rem .8rem;border-bottom:var(--line)}
.bias-link:hover,.family-card:hover{background:var(--yellow);transform:translate(2px,2px);box-shadow:4px 4px 0 var(--ink)}
.bias-link strong,.family-card strong,.home-system-grid article>strong,.application-card strong{font-family:var(--font-display);font-weight:800;letter-spacing:-.03em}
.home-system,.section--ink{background:var(--blue-deep);color:#fff}.home-system .lede,.section--ink .lede{color:#d9dbff}
.home-system-grid article{color:var(--ink)}
.home-stats{border:0;background:var(--yellow);color:var(--ink);box-shadow:10px 10px 0 var(--pink)}
.home-stats div{border-color:var(--ink)!important}.home-stats span{color:#3d3550}
.section--pink{background:var(--coral);color:var(--ink)}
.feature-list{gap:1rem}.feature-list article{padding:1.2rem;background:#ffffff0d;border:1px solid #ffffff35;border-top:6px solid var(--yellow)}
.filter{position:sticky;inset-block-start:82px;z-index:60;gap:1rem;padding:1rem max(5vw,1.25rem);border:0;background:var(--yellow);box-shadow:0 4px 0 var(--ink)}
.filter label{font-weight:800}.filter input,.filter select,.audit-form input,.audit-form textarea,.audit-form select{min-height:48px;border:var(--line);background:#fff;color:var(--ink);font:inherit;border-radius:0}
.catalogue{padding-inline:max(5vw,1.25rem)}
.category[hidden]{display:none}.category h2{font:800 clamp(1.6rem,3vw,2.5rem)/1.05 var(--font-display)}
.site-footer{padding:clamp(3rem,6vw,5rem) max(5vw,1.25rem);background:var(--blue-deep);color:#fff;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);border-top:8px solid var(--yellow)}
.site-footer .brand{color:#fff}.site-footer .brand img{border-color:#fff}.site-footer p{max-width:34rem}.footer-links{grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem 1rem}.footer-links a{color:#fff}.fine-print{color:#c9caff}
.comparison-teaser,.audit-cta,.context-teaser,.practice-teaser,.research-teaser,.everyday-teaser,.experiment-teaser{max-width:1000px;margin-inline:auto;border:var(--line);background:#fff;box-shadow:6px 6px 0 var(--cyan)}
.audit-cta{background:var(--yellow);box-shadow:8px 8px 0 var(--pink)}
.audit-shell,.career-shell,.lens-builder{max-width:var(--content);margin-inline:auto}
body[data-page-kind="home"] .site-header--home{position:absolute;inset:0 0 auto;z-index:50;height:84px;padding:16px 45px 8px;border:0;background:transparent}
body[data-page-kind="home"] .site-header--home .brand{gap:.75rem}
body[data-page-kind="home"] .site-header--home .brand img{width:52px;height:52px}
body[data-page-kind="home"] .site-header--home .brand strong{font-size:1.22rem;font-weight:700;letter-spacing:-.025em}
body[data-page-kind="home"] .site-header--home .brand small{font-size:.68rem;letter-spacing:.1em;color:#d8d7ff}
body[data-page-kind="home"] .site-header--home .site-nav{font-size:1rem;font-weight:500}
body[data-page-kind="home"] .site-header--home .site-nav__core{gap:2.25rem;transform:translateY(3px)}
body[data-page-kind="home"] .site-header--home .home-search{gap:.35rem}
body[data-page-kind="home"] .site-header--home .home-search img{width:30px;height:30px;mix-blend-mode:screen}
body[data-page-kind="home"] .site-header--home .nav-menu{display:none}
body[data-page-kind="home"] .editorial-hero{height:735px;min-height:735px;display:block;overflow:hidden;background:#09079e;color:#fff}
body[data-page-kind="home"] .home-art{position:absolute;z-index:1;display:block;max-width:none;height:auto;pointer-events:none}
body[data-page-kind="home"] .home-art--graph{left:0;top:125px;width:145px}
body[data-page-kind="home"] .home-art--left-notes{left:0;top:350px;width:120px}
body[data-page-kind="home"] .home-art--quote{left:32.12vw;top:82px;width:305px;z-index:3}
body[data-page-kind="home"] .home-art--cat{left:44.35vw;top:70px;width:650px;z-index:2}
body[data-page-kind="home"] .home-art--brain{left:82.66vw;top:90px;width:235px;z-index:3}
body[data-page-kind="home"] .home-art--partner{left:82.99vw;top:410px;width:253px;z-index:3}
body[data-page-kind="home"] .home-art--bayes{left:85.35vw;top:535px;width:218px;z-index:3}
body[data-page-kind="home"] .editorial-hero__copy{position:absolute;left:4.55vw;top:104px;z-index:4;width:620px;margin:0;padding:0;color:#fff}
body[data-page-kind="home"] .editorial-hero h1{max-width:none;margin:0 0 .55rem;font:900 min(9.2vw,132px)/.82 var(--font-display);letter-spacing:-.055em;text-shadow:none;text-wrap:initial;overflow-wrap:normal}
body[data-page-kind="home"] .editorial-hero h1 span{display:block;width:max-content}
body[data-page-kind="home"] .editorial-hero h1 span:nth-child(n+2){margin-left:6.05vw}
body[data-page-kind="home"] .editorial-hero h1 span:first-child{transform:scaleX(1.1);transform-origin:left center}
body[data-page-kind="home"] .editorial-hero h1 span:last-child{margin-left:6.72vw;transform:scaleX(1.035);transform-origin:left center}
body[data-page-kind="home"] .editorial-hero__lower{margin-left:7.1vw}
body[data-page-kind="home"] .editorial-hero__lower>p{margin:0;max-width:34rem;font-size:1.08rem;line-height:1.35;font-weight:500}
body[data-page-kind="home"] .editorial-hero .actions{display:flex;gap:1.25rem;margin-top:.72rem}
body[data-page-kind="home"] .editorial-hero .button{min-height:49px;padding:.6rem .85rem;border:2px solid var(--yellow);box-shadow:none;font-size:.9rem;font-weight:700;gap:.65rem}
body[data-page-kind="home"] .editorial-hero .button:first-child{width:248px;min-width:0}
body[data-page-kind="home"] .editorial-hero .button:first-child img{width:28px;height:28px}
body[data-page-kind="home"] .editorial-hero .button--outline{min-width:210px;border-color:#fff;background:transparent;color:#fff}
body[data-page-kind="home"] .editorial-hero .button:hover{transform:none;box-shadow:none;background:#fff;color:var(--ink)}
body[data-page-kind="home"] .editorial-atlas{min-height:324px;padding:0 0 0 3.22vw;background:#efece7;overflow:hidden}
body[data-page-kind="home"] .editorial-atlas>.editorial-atlas__grid{grid-template-columns:31.65fr 32.65fr 35.7fr;gap:0;width:calc(100vw - 3.22vw);height:324px;max-width:none;margin:0}
body[data-page-kind="home"] .editorial-story{display:block;height:324px;border:0;background:transparent;box-shadow:none;overflow:hidden}
body[data-page-kind="home"] .editorial-story:hover{transform:none;box-shadow:none}
body[data-page-kind="home"] .editorial-story img{display:block;width:100%;height:100%;max-width:none;aspect-ratio:auto;object-fit:fill;border:0}
@media(max-width:1050px){
  .site-nav__core a:nth-child(n+3){display:none}
  .page-hero{grid-template-columns:1fr minmax(280px,.65fr)}
  body[data-page-kind="home"] .site-header--home .site-nav__core a:nth-child(n+3){display:none}
  body[data-page-kind="home"] .site-header--home .nav-menu{display:block}
  body[data-page-kind="home"] .home-art--brain,body[data-page-kind="home"] .home-art--partner,body[data-page-kind="home"] .home-art--bayes{display:none}
}
@media(max-width:760px){
  body{font-size:15px}
  .site-header{position:relative;align-items:center;padding:.75rem 1rem}.brand img{width:44px;height:44px}.brand small{display:none}
  .site-nav__core{display:none}.site-nav__drawer{position:fixed;inset:72px 1rem auto;grid-template-columns:1fr;padding:1rem;max-height:calc(100svh - 90px);overflow:auto}.site-nav__drawer-core{display:grid;grid-template-columns:1fr 1fr;grid-column:1/-1;background:#ece7ff;border-bottom:2px solid var(--ink)}.site-nav__drawer-core a{justify-content:center}.site-nav__drawer .nav-search{grid-column:auto}
  .editorial-hero{min-height:720px;align-items:end}.editorial-hero__art{object-position:62% center}.editorial-hero__copy{margin:0;padding:3rem 1.25rem;background:#1515a8e8;width:100%}
  .editorial-hero h1{font-size:clamp(3.2rem,16vw,5.5rem);max-width:8ch}
  .editorial-hero .actions{display:grid}.editorial-hero .button{width:100%}
  .editorial-atlas__head{display:block}.editorial-atlas__grid{grid-template-columns:1fr}.editorial-story{box-shadow:7px 7px 0 var(--ink)}
  .page-hero{grid-template-columns:1fr;min-height:0;padding-block:3rem}.page-hero h1{font-size:clamp(2.35rem,10vw,3.2rem);line-height:1}.page-visual{transform:none;box-shadow:8px 8px 0 var(--pink)}
  .article h1{font-size:clamp(2.25rem,10vw,3.35rem);line-height:1.02}.article-visual{box-shadow:8px 8px 0 var(--cyan)}
  .everyday-article h1,.experiment-article h1{font-size:clamp(2.25rem,10vw,3.2rem);line-height:1.02}
  .home-stats{grid-template-columns:1fr 1fr}.home-system-grid{grid-template-columns:1fr}
  .filter{position:relative;inset-block-start:auto;display:grid}.filter label{display:grid;gap:.35rem}.filter input,.filter select{width:100%}
  .site-footer{grid-template-columns:1fr}.footer-links{grid-template-columns:1fr 1fr}
  body[data-page-kind="home"] .site-header--home{position:absolute;height:72px;padding:.75rem 1rem}
  body[data-page-kind="home"] .site-header--home .brand img{width:44px;height:44px}
  body[data-page-kind="home"] .site-header--home .brand strong{font-size:1rem}
  body[data-page-kind="home"] .editorial-hero{height:820px;min-height:820px}
  body[data-page-kind="home"] .home-art--graph,body[data-page-kind="home"] .home-art--left-notes,body[data-page-kind="home"] .home-art--quote{display:none}
  body[data-page-kind="home"] .home-art--cat{left:4vw;top:72px;width:92vw}
  body[data-page-kind="home"] .editorial-hero__copy{left:0;top:390px;width:100%;padding:2.4rem 1.25rem 2rem;background:#0d0aa5e8}
  body[data-page-kind="home"] .editorial-hero h1{font-size:clamp(3.8rem,18vw,5.25rem);line-height:.84}
  body[data-page-kind="home"] .editorial-hero h1 span:nth-child(n+2){margin-left:0}
  body[data-page-kind="home"] .editorial-hero h1 span:first-child,body[data-page-kind="home"] .editorial-hero h1 span:last-child{margin-left:0;transform:none}
  body[data-page-kind="home"] .editorial-hero__lower{margin-left:0}
  body[data-page-kind="home"] .editorial-hero .actions{display:grid}
  body[data-page-kind="home"] .editorial-atlas{padding:0 1rem 2rem}
  body[data-page-kind="home"] .editorial-atlas>.editorial-atlas__grid{display:grid;grid-template-columns:1fr;gap:1rem;width:100%;height:auto}
  body[data-page-kind="home"] .editorial-story{height:auto}
  body[data-page-kind="home"] .editorial-story img{height:auto;object-fit:contain}
}
@media(max-width:420px){
  .brand strong{font-size:.9rem}.nav-menu{padding:.45rem .65rem}.editorial-hero h1{font-size:3.15rem}
  .section{padding-inline:1rem}.page-hero{padding-inline:1rem}.article{padding-inline:1rem}.footer-links{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){.editorial-story,.button,.nav-cta{transition:none}}
`;
await writeFile(stylesPath, styles);

const appPath = join(OUT, "app.js");
let app = await readFile(appPath, "utf8").catch(() => "");
if (!app.includes("const editorialMenuButton=")) app += String.raw`
const editorialMenuButton=document.querySelector('.nav-menu');
const editorialMenuDrawer=document.querySelector('#site-nav-drawer');
function setEditorialMenu(open){if(!editorialMenuButton||!editorialMenuDrawer)return;editorialMenuButton.setAttribute('aria-expanded',String(open));editorialMenuDrawer.hidden=!open}
editorialMenuButton?.addEventListener('click',()=>setEditorialMenu(editorialMenuButton.getAttribute('aria-expanded')!=='true'));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setEditorialMenu(false)});
document.addEventListener('click',event=>{if(editorialMenuDrawer&&!editorialMenuDrawer.hidden&&!event.target.closest('.site-nav'))setEditorialMenu(false)});
function syncEditorialCategories(){document.querySelectorAll('.category').forEach(category=>{const cards=[...category.querySelectorAll('[data-bias]')];category.hidden=cards.length>0&&!cards.some(card=>!card.hidden)})}
document.querySelector('[data-search]')?.addEventListener('input',()=>queueMicrotask(syncEditorialCategories));
document.querySelector('[data-category]')?.addEventListener('change',()=>queueMicrotask(syncEditorialCategories));
syncEditorialCategories();
`;
await writeFile(appPath, app);

const editorialArtMap = {
  version: 1,
  generatedAt: null,
  families: taxonomy.families,
  entries: [...biasBySlug.values()].map((record) => ({
    id: record.id,
    slug: record.slug,
    title: record.title,
    family: record.editorialFamily,
    asset: biasArtFor(record),
    unique: uniqueBiasAssets.has(`${record.slug}.webp`),
  })),
};
await writeFile(join(OUT, "data", "editorial-art-map.json"), `${JSON.stringify(editorialArtMap, null, 2)}\n`);

const uniqueArtCount = editorialArtMap.entries.filter((entry) => entry.unique).length;
console.log(`Electric Editorial Collage theme applied to ${files.length} pages; ${uniqueArtCount}/${editorialArtMap.entries.length} bias entries use unique art with ${Object.keys(editorialArtMap.families).length} semantic fallbacks available.`);
