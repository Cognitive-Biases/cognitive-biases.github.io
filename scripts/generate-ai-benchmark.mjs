import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const spec = JSON.parse(await readFile("data/ai-benchmark.json", "utf8"));
const experimentSource = JSON.parse(await readFile("data/experiments.json", "utf8"));
const experimentBySlug = new Map((experimentSource.entries || []).map((entry) => [entry.slug, entry]));
const schema = JSON.parse(await readFile("schemas/ai-benchmark-results.schema.json", "utf8"));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

const brand = (size, alt) => `<picture class="brand-picture"><source type="image/webp" srcset="/assets/brand.webp"><img src="/assets/biases_icon.png" width="${size}" height="${size}" alt="${escapeHtml(alt)}"></picture>`;
const header = () => `<header class="site-header"><a class="brand" href="/">${brand(48, "Cognitive Biases icon")}<span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/everyday/">Everyday life</a><a href="/explore/">Explore</a><a href="/experiments/">Experiments</a><a href="/practice/">Practice</a><a href="/research/">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footer = () => `<footer class="site-footer"><div><a class="brand brand--footer" href="/">${brand(40, "")}<span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/ai-benchmark/">AI Bias Benchmark</a><a href="/experiments/">Experiments Lab</a><a href="/everyday/">Everyday life</a><a href="/practice/">Practice Lab</a><a href="/research/">Research</a><a href="/data/">Data</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p></footer>`;

const promptRows = [];
for (const benchmark of spec.experiments || []) {
  const source = experimentBySlug.get(benchmark.experimentSlug);
  if (!source) throw new Error(`${benchmark.experimentSlug}: missing source experiment`);
  if (source.biasSlug !== benchmark.biasSlug) throw new Error(`${benchmark.experimentSlug}: bias link drift`);
  if ((benchmark.conditions || []).length !== 2) throw new Error(`${benchmark.experimentSlug}: benchmark requires two conditions`);
  benchmark.conditions.forEach((condition, conditionIndex) => {
    promptRows.push({
      benchmarkVersion: spec.version,
      caseId: `${benchmark.experimentSlug}:${conditionIndex}`,
      experimentSlug: benchmark.experimentSlug,
      biasSlug: benchmark.biasSlug,
      conditionIndex,
      conditionLabel: condition.label,
      systemPrompt: spec.protocol.systemPrompt,
      userPrompt: condition.prompt,
      metric: benchmark.metric,
      responseContract: source.responseType === "choice"
        ? spec.protocol.responseContract.choice
        : source.responseType === "rating"
          ? spec.protocol.responseContract.rating
          : spec.protocol.responseContract.number
    });
  });
}

await mkdir(join(OUT, "data"), { recursive: true });
await mkdir(join(OUT, "schemas"), { recursive: true });
await writeFile(join(OUT, "data", "ai-benchmark.json"), `${JSON.stringify({
  ...spec,
  canonicalUrl: `${SITE}/ai-benchmark/`,
  promptPackUrl: `${SITE}/data/ai-benchmark-prompts.ndjson`,
  resultSchemaUrl: `${SITE}/schemas/ai-benchmark-results.schema.json`
}, null, 2)}\n`);
await writeFile(join(OUT, "data", "ai-benchmark-prompts.ndjson"), `${promptRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
await writeFile(join(OUT, "schemas", "ai-benchmark-results.schema.json"), `${JSON.stringify(schema, null, 2)}\n`);

const benchmarkRows = (spec.experiments || []).map((benchmark) => {
  const source = experimentBySlug.get(benchmark.experimentSlug);
  return `<article class="benchmark-card"><p class="kicker">${escapeHtml(source.category)}</p><h2>${escapeHtml(source.title)}</h2><p>${escapeHtml(source.researchQuestion)}</p><dl><div><dt>Metric</dt><dd>${escapeHtml(benchmark.metric.label)}</dd></div><div><dt>Output</dt><dd>${escapeHtml(benchmark.metric.unit)}</dd></div></dl><p><a href="/experiments/${escapeHtml(benchmark.experimentSlug)}/">Try the human demo →</a></p></article>`;
}).join("");

const pageCanonical = `${SITE}/ai-benchmark/`;
const pageSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${pageCanonical}#page`,
      url: pageCanonical,
      name: "AI Cognitive Bias Benchmark",
      description: spec.description,
      inLanguage: "en"
    },
    {
      "@type": "Dataset",
      "@id": `${pageCanonical}#dataset`,
      name: "Cognitive Biases AI Bias Benchmark Specification",
      description: spec.description,
      url: pageCanonical,
      dateModified: spec.updatedAt,
      version: String(spec.version),
      creator: { "@type": "Organization", name: "Cognitive Biases", url: SITE },
      distribution: [
        { "@type": "DataDownload", contentUrl: `${SITE}/data/ai-benchmark.json`, encodingFormat: "application/json" },
        { "@type": "DataDownload", contentUrl: `${SITE}/data/ai-benchmark-prompts.ndjson`, encodingFormat: "application/x-ndjson" }
      ]
    }
  ]
};

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><title>AI Cognitive Bias Benchmark | LLM Decision Sensitivity</title><meta name="description" content="A reproducible, provider-neutral benchmark for testing how AI model answers change across paired anchoring, framing, decoy, escalation, outcome and planning conditions."><link rel="canonical" href="${pageCanonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="AI Cognitive Bias Benchmark"><meta property="og:description" content="Paired prompts, transparent metrics and reproducible result files for testing model sensitivity to cognitive-bias conditions."><meta property="og:url" content="${pageCanonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(pageSchema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header()}<main id="main"><section class="page-hero benchmark-hero"><p class="eyebrow">AI Bias Benchmark · specification v${escapeHtml(spec.version)}</p><h1>Test the change, not the label.</h1><p class="lede">This benchmark asks a simple question: when one controlled part of a prompt changes, does an AI model's judgment move with it? The same paired scenarios also exist in the human Experiments Lab.</p></section><section class="section benchmark-status"><p class="kicker">Current status</p><h2>Specification published. Results pending.</h2><p class="lede">We do not publish model scores until the runs are reproducible and include model version, settings, date and enough repeated samples for the task. A blank leaderboard is less exciting than invented precision, but considerably more useful.</p></section><section class="section"><p class="kicker">What is measured</p><h2>Six paired decision tests.</h2><p class="lede">Each track changes one decision condition while keeping the rest of the task as stable as possible. The benchmark reports the direction and size of each response shift. It does not collapse unlike effects into one universal “bias score”.</p><div class="benchmark-grid">${benchmarkRows}</div></section><section class="section section--ink benchmark-protocol"><p class="kicker">Reproducible protocol</p><h2>Run each condition as a fresh case.</h2><ol><li>Use the published system prompt and user prompt without adding the bias name.</li><li>Run paired conditions in separate fresh contexts.</li><li>Record provider, model name, model version, temperature, top-p and run date.</li><li>For stochastic choice tasks, use at least ${escapeHtml(spec.protocol.minimumSamplesPerCondition)} samples per condition before interpreting choice-share differences.</li><li>Keep the per-experiment results visible. Do not turn six different measurements into one magic number.</li></ol></section><section class="section"><p class="kicker">Machine-readable</p><h2>Designed for agents as well as people.</h2><div class="benchmark-files"><article><h3>Benchmark specification</h3><p>Test definitions, metrics, protocol and response contracts.</p><p><a href="/data/ai-benchmark.json">Open JSON →</a></p></article><article><h3>Prompt pack</h3><p>Twelve condition cases ready for a provider-specific runner.</p><p><a href="/data/ai-benchmark-prompts.ndjson">Open NDJSON →</a></p></article><article><h3>Result schema</h3><p>A versioned format for model metadata and raw benchmark responses.</p><p><a href="/schemas/ai-benchmark-results.schema.json">Open schema →</a></p></article></div><p class="lede">Repository users can score a completed result file with <code>npm run benchmark:ai:score -- --input results.ndjson</code>.</p></section><section class="section"><p class="kicker">Interpretation</p><h2>Sensitivity is a measurement, not a diagnosis.</h2><p class="lede">A response shift can be useful evidence that a model is sensitive to the manipulated condition. It does not show that the model “thinks like a human”, and a zero shift does not prove the model is generally free from that bias. Prompt wording, model version and decoding settings can all matter.</p><p><a class="button" href="/experiments/">Compare with the human demos</a></p></section></main>${footer()}</body></html>`;

await mkdir(join(OUT, "ai-benchmark"), { recursive: true });
await writeFile(join(OUT, "ai-benchmark", "index.html"), page);

for (const targetPath of [join(OUT, "index.html"), join(OUT, "research", "index.html"), join(OUT, "experiments", "index.html")]) {
  let html = await readFile(targetPath, "utf8");
  if (html.includes('href="/ai-benchmark/"')) continue;
  const block = `<section class="section benchmark-teaser"><p class="kicker">AI Bias Benchmark</p><h2>Run the same paired decision tests on AI models.</h2><p>Use the public prompt pack and result format to measure how model answers change across controlled conditions.</p><p><a class="button" href="/ai-benchmark/">Open the benchmark</a></p></section>`;
  html = html.replace("</main>", `${block}</main>`);
  await writeFile(targetPath, html);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${pageCanonical}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `<url><loc>${pageCanonical}</loc><lastmod>${spec.updatedAt}</lastmod></url></urlset>`);
  await writeFile(sitemapPath, sitemap);
}

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".benchmark-grid{")) {
  styles += `
.benchmark-grid,.benchmark-files{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:var(--line);border-top:var(--line);margin-top:2rem}
.benchmark-card,.benchmark-files article{padding:1.4rem;border-right:var(--line);border-bottom:var(--line);background:#fff;color:var(--ink)}
.benchmark-card h2,.benchmark-files h3{font:1.25rem/1.15 Archivo Black,sans-serif;letter-spacing:-.04em;margin:.45rem 0 .8rem}
.benchmark-card dl{margin:1rem 0}
.benchmark-card dl div{display:grid;grid-template-columns:90px 1fr;gap:.8rem;padding:.45rem 0;border-top:1px solid rgba(16,22,34,.18)}
.benchmark-card dt{font-weight:900}
.benchmark-status{border-bottom:var(--line)}
.benchmark-protocol ol{max-width:850px}
.benchmark-protocol li{margin:.8rem 0}
.benchmark-files{grid-template-columns:repeat(3,minmax(0,1fr))}
.benchmark-teaser{border-top:var(--line)}
@media(max-width:760px){.benchmark-grid,.benchmark-files{grid-template-columns:1fr}}
`;
  await writeFile(stylesPath, styles);
}

console.log(`Generated AI Bias Benchmark v${spec.version}: ${spec.experiments.length} paired experiments and ${promptRows.length} prompt cases.`);
