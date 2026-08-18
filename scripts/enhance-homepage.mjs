import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const PLAY = "https://play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const canonicalBiases = biases.filter((bias) => !duplicateIds.has(bias.id));
const taxonomy = JSON.parse(await readFile("data/taxonomy-v2.json", "utf8"));
const contexts = JSON.parse(await readFile("data/contexts.json", "utf8"));
const comparisons = JSON.parse(await readFile("data/comparisons.json", "utf8"));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);
const auditEligible = reviews.filter((review) => review.auditEligible !== false);
const familyFor = (bias) => taxonomy.recordFamilyOverrides?.[String(bias.id)] || taxonomy.directCategoryFamily?.[bias.typeOfBias] || null;
const familyCounts = new Map();
for (const bias of canonicalBiases) {
  const family = familyFor(bias);
  if (!family) continue;
  familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
}
const familyHubCount = [...familyCounts.values()].filter((count) => count >= taxonomy.hubMinimumRecords).length;

const homePath = join(OUT, "index.html");
let html = await readFile(homePath, "utf8");

const hero = `<section class="hero home-hero"><div class="hero-copy"><div class="eyebrow">Decision tools + evidence-reviewed reference</div><h1>Notice the pattern.<br>Test the decision.</h1><p>Start from a real situation, check what the evidence supports, compare similar thinking patterns, and turn the result into an explicit next move.</p><div class="actions"><a class="button" href="/tools/decision-audit/">Audit a decision</a><a class="button button--dark" href="/contexts/">Start from a context</a></div><p class="home-app-link">Prefer lightweight practice? <a href="${PLAY}">Use the mobile app <span aria-hidden="true">↗</span></a></p></div><div class="hero-art"><img src="/assets/1152.png" width="1152" height="1152" alt="Cognitive Biases cat artwork"></div></section>`;

const system = `<section class="section home-system"><p class="kicker">From glossary to decision system</p><h2>Recognize → Test → Counter → Decide.</h2><p class="lede">The library still explains cognitive biases, effects, heuristics, and related phenomena. The newer layers help you use that knowledge without pretending a label is a diagnosis.</p><div class="home-system-grid"><article><span>Decision Audit</span><strong>${auditEligible.length} reviewed lenses</strong><p>Write the decision, counterevidence, alternative hypothesis, failure condition, and next action. Drafts stay in your browser.</p><a href="/tools/decision-audit/">Audit a real decision →</a></article><article><span>Contexts</span><strong>${contexts.entries.length} curated starting points</strong><p>Start from work, forecasting, or AI-assisted decisions when you do not already know the name of the relevant pattern.</p><a href="/contexts/">Browse decision contexts →</a></article><article><span>Evidence</span><strong>${reviews.length} source-grounded reviews</strong><p>See boundary conditions, contested findings, reviewed sources, and where the quick definition needs qualification.</p><a href="/evidence/">Check the evidence layer →</a></article><article><span>Compare</span><strong>${comparisons.entries.length} reviewed comparisons</strong><p>Separate patterns that are easy to confuse, such as hindsight versus outcome bias or outcome bias versus moral luck.</p><a href="/compare/">Compare nearby concepts →</a></article></div><div class="home-stats" aria-label="Current knowledge-base coverage"><div><strong>${canonicalBiases.length}</strong><span>canonical entries</span></div><div><strong>${reviews.length}</strong><span>evidence-reviewed</span></div><div><strong>${familyHubCount}</strong><span>mechanism families</span></div><div><strong>Local</strong><span>Decision Audit drafts</span></div></div></section>`;

const oldHero = /<section class="hero">[\s\S]*?<\/section>/;
if (!oldHero.test(html)) throw new Error("Homepage legacy hero was not found for decision-system repositioning.");
html = html.replace(oldHero, `${hero}${system}`);
html = html.replace(/<title>[^<]*<\/title>/, "<title>Cognitive Biases | Decision tools, evidence & bias reference</title>");
html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Use Cognitive Biases to explore 212 canonical entries, check evidence, compare similar concepts, start from real decision contexts, and run a local-first Decision Audit.">');
html = html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Cognitive Biases | Decision tools, evidence & bias reference">');
html = html.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Recognize a thinking pattern, test it against evidence and alternatives, then make the next decision explicit.">');
html = html.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="Cognitive Biases | Decision tools, evidence & bias reference">');
html = html.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="Recognize a thinking pattern, test it against evidence and alternatives, then make the next decision explicit.">');
html = html.replace(/<div class="footer-links">[\s\S]*?<\/div>/, '<div class="footer-links"><a href="/tools/decision-audit/">Decision Audit</a><a href="/contexts/">Decision contexts</a><a href="/evidence/">Evidence reviews</a><a href="/compare/">Compare concepts</a><a href="/explore/">Explore library</a><a href="/kinds/">Entry types</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div>');
await writeFile(homePath, html);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".home-system-grid{")) {
  styles += `\n.home-app-link{margin-top:1.2rem!important;font-size:.9rem!important}.home-app-link a{font-weight:900}.home-system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}.home-system-grid article{display:flex;flex-direction:column;gap:.65rem;min-height:270px;padding:1.25rem;border-right:var(--line);border-bottom:var(--line);background:#fff}.home-system-grid article>span{font-size:.76rem;font-weight:900;text-transform:uppercase;color:#5a6475}.home-system-grid article>strong{font:1.35rem/1.08 Archivo Black,sans-serif;letter-spacing:-.04em}.home-system-grid article>p{margin:.15rem 0}.home-system-grid article>a{margin-top:auto;font-weight:900}.home-system-grid article:nth-child(1){box-shadow:inset 0 5px 0 var(--yellow)}.home-system-grid article:nth-child(2){box-shadow:inset 0 5px 0 var(--cyan)}.home-system-grid article:nth-child(3){box-shadow:inset 0 5px 0 var(--pink)}.home-system-grid article:nth-child(4){box-shadow:inset 0 5px 0 var(--ink)}.home-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:1.5rem;border:var(--line);background:var(--ink);color:#fff}.home-stats div{padding:1rem;border-right:2px solid #fff}.home-stats div:last-child{border-right:0}.home-stats strong{display:block;font:clamp(1.5rem,3vw,2.5rem)/1 Archivo Black,sans-serif}.home-stats span{font-size:.78rem;font-weight:800;text-transform:uppercase;color:#d9dde4}@media(max-width:760px){.home-system-grid{grid-template-columns:1fr}.home-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.home-stats div:nth-child(2){border-right:0}.home-stats div:nth-child(-n+2){border-bottom:2px solid #fff}}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Homepage repositioned: ${canonicalBiases.length} canonical entries, ${reviews.length} evidence reviews, ${auditEligible.length} audit lenses, ${contexts.entries.length} contexts, ${comparisons.entries.length} comparisons, ${familyHubCount} family hubs.`);
