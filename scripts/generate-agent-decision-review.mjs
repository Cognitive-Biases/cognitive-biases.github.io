import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const examplesData = JSON.parse(await readFile("data/decision-review-examples.json", "utf8"));
const schema = JSON.parse(await readFile("schemas/decision-review.schema.json", "utf8"));

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);
const brand = `<picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="48" height="48" alt="Cognitive Biases icon"></picture>`;
const nav = `<header class="site-header"><a class="brand" href="/">${brand}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/decide/">Decide</a><a href="/explore/">Explore</a><a href="/compare/">Compare</a><a href="/contexts/">Contexts</a><a href="/skills/">Skills</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footerBrand = `<picture><source srcset="/assets/brand.webp" type="image/webp"><img src="/assets/biases_icon.png" width="40" height="40" alt=""></picture>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${footerBrand}<span>Cognitive Biases</span></a><p>Evidence-backed decision tools for people and AI.</p></div><div class="footer-links"><a href="/decide/">Decide</a><a href="/situations/">Situations</a><a href="/techniques/">Techniques</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;

function page(title, description, path, body) {
  const canonical = `${SITE}${path}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "TechArticle", headline: title, description, url: canonical, isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE } };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav}<main id="main">${body}</main>${footer}</body></html>`;
}

const fields = schema.required.map((field) => `<li><code>${esc(field)}</code></li>`).join("");
const cards = examplesData.examples.map((example) => {
  const review = example.review;
  return `<article class="application-card"><span>${esc(review.situation)}</span><strong>${esc(example.input)}</strong><p><b>Next move:</b> ${esc(review.nextAction)}</p><a href="/data/decision-review-examples.json">View structured example →</a></article>`;
}).join("");
const sample = JSON.stringify(examplesData.examples[0].review, null, 2);
const body = `<section class="page-hero"><p class="eyebrow">For AI assistants and agents</p><h1>A decision review should expose uncertainty, not invent a diagnosis.</h1><p class="lede">The Decision Review contract gives assistants a small structured output for a real decision: observed facts, possible reasoning risks, missing evidence, questions, practical techniques, the next action and canonical references.</p><p><a class="button" href="/data/schemas/decision-review.schema.json">JSON Schema</a> <a class="button button--dark" href="/data/decision-review-examples.json">8 worked examples</a></p></section><section class="section"><p class="kicker">Output contract</p><h2>Keep facts and inference separate.</h2><p>Required fields:</p><ul>${fields}</ul><p class="lede">Candidate lenses use only <code>low</code> or <code>medium</code> confidence. The format intentionally has no high-confidence psychological diagnosis.</p></section><section class="section section--ink"><p class="kicker">Agent rules</p><h2>What a useful review should do.</h2><ol><li>Restate the decision without choosing for the user.</li><li>Put only supplied or verified information under observed facts.</li><li>Describe cognitive-bias lenses as possible reasoning risks, not traits of a person.</li><li>Ask for evidence that could change the conclusion.</li><li>Recommend a concrete technique when it fits the situation.</li><li>Preserve uncertainty and cite canonical project records.</li><li>Return no lens when the evidence does not support one.</li></ol></section><section class="section"><p class="kicker">Worked cases</p><h2>Eight examples across real decisions.</h2><div class="application-grid">${cards}</div></section><section class="section"><p class="kicker">Example JSON</p><h2>Machine-readable and inspectable.</h2><pre>${esc(sample)}</pre></section><section class="section"><p><a class="button" href="/situations/">Browse situations</a> <a class="button button--dark" href="/techniques/">Browse techniques</a></p></section>`;

const target = join(OUT, "decide", "for-agents", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, page("AI Decision Review Contract | Cognitive Biases", "A public JSON contract and worked examples for AI assistants that review decisions without diagnosing people or hiding uncertainty.", "/decide/for-agents/", body));

await mkdir(join(OUT, "data", "schemas"), { recursive: true });
await copyFile("schemas/decision-review.schema.json", join(OUT, "data", "schemas", "decision-review.schema.json"));
await writeFile(join(OUT, "data", "decision-review-examples.json"), JSON.stringify(examplesData, null, 2) + "\n");

const decidePath = join(OUT, "decide", "index.html");
let decide = await readFile(decidePath, "utf8");
if (!decide.includes('class="agent-review-cta"')) {
  const block = `<section class="section agent-review-cta"><p class="kicker">For AI systems</p><h2>Use the same decision structure in an assistant or agent.</h2><p class="lede">A public JSON contract keeps observed facts, inferred risks, missing evidence and canonical references separate.</p><p><a class="button" href="/decide/for-agents/">Decision Review for agents</a></p></section>`;
  decide = decide.replace("</main>", `${block}</main>`);
  await writeFile(decidePath, decide);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
const loc = `${SITE}/decide/for-agents/`;
if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${examplesData.updatedAt}</lastmod></url></urlset>`);
await writeFile(sitemapPath, sitemap);

console.log(`Generated Decision Review agent contract with ${examplesData.examples.length} worked examples.`);
