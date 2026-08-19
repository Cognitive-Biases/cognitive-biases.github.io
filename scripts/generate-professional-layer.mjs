import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const professional = JSON.parse(await readFile("data/professional-lens-packs.json", "utf8"));
const protocols = JSON.parse(await readFile("data/ai-era-experiment-protocols.json", "utf8"));
const esc = (v = "") => String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const nav = (current = "") => `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary">${[["Explore","/explore/"],["Everyday life","/everyday/"],["Lens packs","/lenses/"],["AI-era Lab","/ai-era/"],["Research","/research/"]].map(([t,u]) => `<a href="${u}"${current === u ? ' aria-current="page"' : ""}>${t}</a>`).join("")}<a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/lenses/">Lens packs</a><a href="/professional/">Professional packs</a><a href="/ai-era/">AI-era Bias Lab</a><a href="/ai-era/protocol/">Research protocol</a><a href="/partners/">Partnerships</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;

function page(title, description, path, body, current = "") {
  const canonical = `${SITE}${path}`;
  const schema = {"@context":"https://schema.org","@type":"WebPage",name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Cognitive Biases",url:SITE}};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${nav(current)}<main id="main">${body}</main>${footer}</body></html>`;
}
async function emit(path, html) {
  const target = join(OUT, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
const card = (label, title, text, href) => `<article class="application-card"><span>${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p><a href="${href}">Open →</a></article>`;

const packCards = professional.packs.map((p) => card("Professional lens pack", p.title, p.summary, `/professional/${p.slug}/`)).join("");
await emit("/professional/", page(
  "Professional Cognitive Bias Lens Packs | Work & Decisions",
  "Practical cognitive-bias packs for hiring, negotiation, leadership and performance decisions, with reusable workflows and AI review prompts.",
  "/professional/",
  `<section class="page-hero"><p class="eyebrow">Professional decision kits</p><h1>Use cognitive bias research inside real work.</h1><p class="lede">These packs are built around recurring professional decisions, not around memorising bias names. Each one combines a few relevant lenses, a short workflow and an AI prompt that challenges the frame instead of decorating the conclusion.</p></section><section class="section"><p class="kicker">Current packs</p><h2>Reusable reviews for decisions that repeat.</h2><div class="application-grid">${packCards}</div></section><section class="section section--ink"><p class="kicker">From free reference to applied product</p><h2>The public library is the core. Domain packs are the product layer.</h2><p class="lede">A company can adapt the same structure to claims, procurement, product discovery, incident review, consulting, investment committees or other repeated decisions. A useful custom pack defines the decision, evidence signals, failure modes, review questions, AI instructions and an audit trail.</p><p><a class="button" href="/partners/">Partnership ideas</a> <a class="button button--dark" href="/data/professional-lens-packs.json">Use the dataset</a></p></section>`,
  "/lenses/"
));

for (const p of professional.packs) {
  const uses = p.useWhen.map((x) => `<li>${esc(x)}</li>`).join("");
  const lenses = p.lenses.map((l) => card("Decision lens", l.name, l.question, l.url)).join("");
  const steps = p.workflow.map((x, i) => `<article><strong>${i + 1}. ${esc(x)}</strong></article>`).join("");
  await emit(`/professional/${p.slug}/`, page(
    `${p.title} | Cognitive Biases`,
    `${p.summary} Includes five decision lenses, a practical workflow and an AI review prompt.`,
    `/professional/${p.slug}/`,
    `<section class="page-hero"><p class="eyebrow">Professional lens pack</p><h1>${esc(p.title)}</h1><p class="lede">${esc(p.summary)}</p></section><section class="section"><p class="kicker">Use it when</p><h2>Bring structure in before the conclusion hardens.</h2><ul>${uses}</ul></section><section class="section"><p class="kicker">Five lenses</p><h2>Questions that challenge the decision, not the person.</h2><div class="application-grid">${lenses}</div></section><section class="section section--ink"><p class="kicker">Workflow</p><h2>A short repeatable review.</h2><div class="feature-list">${steps}</div></section><section class="section"><p class="kicker">Use with AI</p><h2>Make the model a reviewer, not an authority.</h2><p><strong>Prompt:</strong> “${esc(p.aiPrompt)}”</p><p>Keep the final decision, evidence standard and accountability with the human team.</p></section><section class="section"><p><a class="button" href="/professional/">All professional packs</a> <a class="button button--dark" href="/tools/decision-audit/">Open Decision Audit</a></p></section>`,
    "/lenses/"
  ));
}

const protocolCards = protocols.protocols.map((p) => `<article class="ai-track" id="${p.slug}"><p class="kicker">${esc(p.track)}</p><h2>${esc(p.title)}</h2><p>${esc(p.question)}</p><p><strong>Conditions:</strong></p><ul>${p.conditions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p><strong>Primary measure:</strong> ${esc(p.primaryMeasure)}</p><p><strong>Secondary measures:</strong> ${esc(p.secondaryMeasures.join(", "))}.</p><p><strong>Minimum report:</strong> ${esc(p.minimumReport)}</p></article>`).join("");
const sources = protocols.startingEvidence.map((s) => `<li><a href="${s.url}" rel="noopener">${esc(s.title)} (${s.year})</a></li>`).join("");
await emit("/ai-era/protocol/", page(
  "How to Test a New AI-Era Cognitive Bias Hypothesis",
  "A reproducible protocol for testing human-AI decision patterns, with controls, measures, reporting rules and starter experiments.",
  "/ai-era/protocol/",
  `<section class="page-hero"><p class="eyebrow">AI-era research protocol</p><h1>Do not invent a bias. Design a test.</h1><p class="lede">A useful new label should survive comparison with established concepts and produce a prediction that can fail. This protocol turns an observation into a small reproducible human-AI experiment.</p></section><section class="section"><p class="kicker">Research rules</p><h2>Make the claim smaller before making it stronger.</h2><div class="feature-list">${protocols.rules.map((x, i) => `<article><strong>${i + 1}. ${esc(x)}</strong></article>`).join("")}</div></section><section class="section section--ink"><p class="kicker">Core design</p><h2>Human → AI → Human is the unit of study.</h2><p class="lede">Record what the person believed before AI input, what the model produced, and what changed afterward. That separation helps distinguish a model failure from a human reliance effect or a feedback loop between both.</p></section><section class="section"><p class="kicker">Starter experiments</p><h2>Four tests you can reproduce or extend.</h2>${protocolCards}</section><section class="section"><p class="kicker">Starting evidence</p><h2>Use research as a constraint, not decoration.</h2><ul>${sources}</ul><p>These sources support parts of the research space. They do not validate every working label in the AI-era Bias Lab.</p></section><section class="section"><p><a class="button" href="/data/ai-era-experiment-protocols.json">Download protocol data</a> <a class="button button--dark" href="/ai-era/">Back to AI-era Bias Lab</a></p></section>`,
  "/ai-era/"
));

await mkdir(join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "data", "professional-lens-packs.json"), JSON.stringify(professional, null, 2) + "\n");
await writeFile(join(OUT, "data", "ai-era-experiment-protocols.json"), JSON.stringify(protocols, null, 2) + "\n");

const lensesPath = join(OUT, "lenses", "index.html");
let lensesHub = await readFile(lensesPath, "utf8");
if (!lensesHub.includes('class="professional-pack-teaser"')) {
  const teaser = `<section class="section professional-pack-teaser"><p class="kicker">Professional packs</p><h2>Hiring, negotiation and leadership need more than awareness.</h2><p class="lede">Use structured lens packs for recurring people and commercial decisions, with workflows that teams can reuse and audit.</p><div class="application-grid">${packCards}</div><p><a class="button" href="/professional/">Browse professional packs</a></p></section>`;
  lensesHub = lensesHub.replace("</main>", teaser + "</main>");
  await writeFile(lensesPath, lensesHub);
}

const aiPath = join(OUT, "ai-era", "index.html");
let aiHub = await readFile(aiPath, "utf8");
if (!aiHub.includes('class="research-protocol-teaser"')) {
  const teaser = `<section class="section section--ink research-protocol-teaser"><p class="kicker">Research protocol</p><h2>Turn a working label into a falsifiable test.</h2><p class="lede">Use control conditions, separate model behaviour from human response, preserve model metadata and report null results instead of quietly burying them.</p><p><a class="button" href="/ai-era/protocol/">Open the experiment protocol</a></p></section>`;
  aiHub = aiHub.replace("</main>", teaser + "</main>");
  await writeFile(aiPath, aiHub);
}

let sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
for (const x of [
  { path: "/professional/", date: professional.updatedAt },
  ...professional.packs.map((p) => ({ path: `/professional/${p.slug}/`, date: professional.updatedAt })),
  { path: "/ai-era/protocol/", date: protocols.updatedAt }
]) {
  const loc = SITE + x.path;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${x.date}</lastmod></url></urlset>`);
}
await writeFile(join(OUT, "sitemap.xml"), sitemap);

console.log(`Generated ${professional.packs.length} professional packs and ${protocols.protocols.length} AI-era experiment protocols.`);
