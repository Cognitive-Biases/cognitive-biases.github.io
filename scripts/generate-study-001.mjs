import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const STUDY = "research/studies/study-001";
const summary = JSON.parse(await readFile(`${STUDY}/result/summary.json`, "utf8"));
const tracker = JSON.parse(await readFile("data/ai-era-research-tracker.json", "utf8"));
const esc = (v = "") => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (v, digits = 1) => `${(Number(v) * 100).toFixed(digits)}%`;
const num = (v, digits = 3) => Number(v).toFixed(digits);

const pagePath = "/research/studies/study-001/";
const canonical = `${SITE}${pagePath}`;
const dataBase = "/data/studies/study-001";

const header = `<header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/lenses/">Lens packs</a><a href="/professional/">Professional</a><a href="/research/" aria-current="page">Research</a><a class="nav-cta" href="/data/">Data</a></nav></header>`;
const footer = `<footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>A public guide to cognitive biases, evidence and better decisions.</p></div><div class="footer-links"><a href="/research/">Research</a><a href="/ai-era/">AI-era Bias Lab</a><a href="/ai-era/tracker/">Research tracker</a><a href="${dataBase}/summary.json">Study data</a></div><p class="fine-print">Educational information, not medical, legal, financial or mental-health advice.</p></footer>`;

const overall = summary.overall;
const sensitivity = summary.sensitivity_unambiguous_anchors;
const modelRows = summary.models.map((m) => `<tr><td><code>${esc(m.model)}</code></td><td>${m.questions_analysed}</td><td>${m.direction_aligned}</td><td><strong>${pct(m.direction_alignment_rate)}</strong></td><td>${pct(m.direction_alignment_wilson_95[0])}–${pct(m.direction_alignment_wilson_95[1])}</td><td>${num(m.median_relative_response_shift)}</td></tr>`).join("");
const comparisonRows = summary.paired_family_comparisons.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.common_questions}</td><td>${pct(c.baseline_alignment_rate)}</td><td>${pct(c.comparison_alignment_rate)}</td><td>${c.difference_percentage_points > 0 ? "+" : ""}${c.difference_percentage_points.toFixed(1)} pp</td><td>${c.mcnemar_exact_p.toFixed(3)}</td></tr>`).join("");
const limitations = summary.limitations.map((x) => `<li>${esc(x)}</li>`).join("");
const sourceFiles = summary.source.files.map((f) => `<li><code>${esc(f.name)}</code>: ${f.rows.toLocaleString("en-US")} rows, ${pct(f.parse_rate)} parsed.</li>`).join("");

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${canonical}#report`,
      headline: "Study 001: Does the answer move with the anchor?",
      description: "An independent re-analysis of released Claude and Gemini outputs from an anchoring experiment.",
      url: canonical,
      datePublished: "2026-08-20",
      isPartOf: { "@type": "WebSite", name: "Cognitive Biases", url: SITE },
      about: ["anchoring effect", "large language models", "AI-assisted decision making"],
      citation: `https://doi.org/${summary.source.paper_doi}`
    },
    {
      "@type": "Dataset",
      "@id": `${canonical}#dataset`,
      name: summary.title,
      description: "Question-level derived statistics and summary for Study 001. Source model outputs remain in the cited external repository.",
      url: `${SITE}${dataBase}/summary.json`,
      distribution: [
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}${dataBase}/summary.json` },
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}${dataBase}/question-level.csv` }
      ],
      isBasedOn: `https://doi.org/${summary.source.paper_doi}`
    }
  ]
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Study 001: AI Anchoring Re-analysis | Cognitive Biases</title><meta name="description" content="Independent re-analysis of 248 Claude and Gemini question-model pairs: 74.6% of responses moved in the same direction as the numerical anchor."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:title" content="Study 001: Does the answer move with the anchor?"><meta property="og:description" content="A reproducible re-analysis of public Claude and Gemini outputs from an anchoring experiment."><meta property="og:url" content="${canonical}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a>${header}<main id="main">
<section class="page-hero"><p class="eyebrow">Study 001 · Independent re-analysis</p><h1>Does the answer move with the anchor?</h1><p class="lede">We re-analysed public Claude and Gemini outputs from a published anchoring experiment. The source experiment is not ours. Our contribution is a preregistered, question-level check of one simple pattern: when the numerical anchor changes direction, does the model answer tend to move with it?</p><p><a class="button" href="${dataBase}/summary.json">Download summary JSON</a> <a class="button button--dark" href="${dataBase}/question-level.csv">Question-level CSV</a></p></section>
<section class="section"><p class="kicker">Primary result</p><h2>${pct(overall.direction_alignment_rate)} moved with the anchor.</h2><div class="feature-list"><article><strong>${overall.direction_aligned} / ${overall.question_model_pairs}</strong><p>Question-model pairs where the trimmed mean response moved in the same direction as the anchor.</p></article><article><strong>${pct(overall.direction_alignment_wilson_95[0])}–${pct(overall.direction_alignment_wilson_95[1])}</strong><p>Wilson 95% interval for the descriptive alignment rate.</p></article><article><strong>${num(overall.median_relative_response_shift)}</strong><p>Median scale-free relative response shift across the analysed pairs.</p></article></div><p class="lede">This is evidence of model-side sensitivity in these released outputs. It is not evidence that a person is biased, and it does not yet test the full human → AI → human loop.</p></section>
<section class="section section--ink"><p class="kicker">Sensitivity check</p><h2>The pattern survives a stricter anchor parser.</h2><p class="lede">Some source hints contain more than one number, which makes rule-based anchor extraction less certain. We therefore repeated the descriptive check only for hints with one numeric token in each anchor condition.</p><div class="feature-list"><article><strong>${pct(sensitivity.direction_alignment_rate)}</strong><p>Alignment among ${sensitivity.question_model_pairs} unambiguous question-model pairs.</p></article><article><strong>${sensitivity.direction_aligned} / ${sensitivity.question_model_pairs}</strong><p>Aligned pairs in the sensitivity subset.</p></article><article><strong>${pct(sensitivity.direction_alignment_wilson_95[0])}–${pct(sensitivity.direction_alignment_wilson_95[1])}</strong><p>Wilson 95% interval.</p></article></div></section>
<section class="section"><p class="kicker">By model</p><h2>The direction effect appears across all four released model sets.</h2><div class="table-wrap"><table><thead><tr><th>Model</th><th>Questions</th><th>Aligned</th><th>Rate</th><th>95% interval</th><th>Median relative shift</th></tr></thead><tbody>${modelRows}</tbody></table></div><p class="fine-print">These rates are descriptive. The study was not designed to rank models.</p></section>
<section class="section"><p class="kicker">Secondary check</p><h2>Newer does not simply mean less anchor-sensitive.</h2><div class="table-wrap"><table><thead><tr><th>Comparison</th><th>Common questions</th><th>Baseline</th><th>Comparison</th><th>Difference</th><th>McNemar p</th></tr></thead><tbody>${comparisonRows}</tbody></table></div><p>The paired family checks are secondary. Neither difference is strong enough here to support a simple model-generation story.</p></section>
<section class="section section--ink"><p class="kicker">Method</p><h2>Preregister first, calculate second.</h2><p>Before calculating the result, we fixed the primary outcome: the sign of the anchor difference between Group B and Group A was compared with the sign of the trimmed mean response difference. One minimum and one maximum parsed response were removed from each group when possible, matching the source repository's analysis approach.</p><p><strong>Unit of analysis:</strong> ${esc(summary.method.unit_of_analysis)}.</p><p><strong>Source data:</strong> pinned to <code>JiaxuLou/LLM_Bias@${esc(summary.source.source_commit)}</code>.</p><ul>${sourceFiles}</ul></section>
<section class="section"><p class="kicker">What this result can and cannot say</p><h2>A narrow result is more useful than a dramatic one.</h2><div class="application-grid"><article class="application-card"><span>Supported</span><strong>Anchor-direction sensitivity</strong><p>Across these released outputs, model answers moved with the anchor more often than not, and the stricter sensitivity subset shows the same pattern.</p></article><article class="application-card"><span>Not established</span><strong>A new cognitive bias</strong><p>We do not claim that “AI Anchoring Loop” is a newly validated psychological bias. Anchoring is already an established concept; the human–AI feedback loop still needs direct study.</p></article><article class="application-card"><span>Not tested</span><strong>Human reliance</strong><p>This re-analysis does not measure whether a person changes an estimate after seeing AI advice.</p></article><article class="application-card"><span>Next protocol</span><strong>AI Advice Order Test</strong><p>Our published protocol compares independent-estimate-first with AI-advice-first conditions to test the human–AI interaction directly.</p><a href="/ai-era/protocol/#ai-advice-order">Open protocol →</a></article></div></section>
<section class="section"><p class="kicker">Limitations</p><h2>Where not to over-read the number.</h2><ul>${limitations}</ul></section>
<section class="section"><p class="kicker">Reproduce</p><h2>Keep the source experiment and our analysis separate.</h2><p>The original outputs and experimental design belong to the source authors. Our repository contains the re-analysis code and derived question-level statistics, not a copy of their raw output corpus.</p><p><a class="button" href="https://doi.org/${esc(summary.source.paper_doi)}" rel="noopener">Source paper</a> <a class="button button--dark" href="${esc(summary.source.repository)}" rel="noopener">Source data repository</a></p><p class="fine-print">Preregistration: <a href="https://github.com/Cognitive-Biases/cognitive-biases.github.io/blob/main/research/studies/study-001/README.md">Study 001 README</a>. Re-analysis code: <a href="https://github.com/Cognitive-Biases/cognitive-biases.github.io/blob/main/scripts/reanalyse-study-001.py">script</a>.</p></section>
</main>${footer}</body></html>`;

const target = join(OUT, "research", "studies", "study-001", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html);

const dataDir = join(OUT, "data", "studies", "study-001");
await mkdir(dataDir, { recursive: true });
await copyFile(`${STUDY}/result/summary.json`, join(dataDir, "summary.json"));
await copyFile(`${STUDY}/result/question-level.csv`, join(dataDir, "question-level.csv"));

let sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${canonical}</loc><lastmod>2026-08-20</lastmod></url></urlset>`);
await writeFile(join(OUT, "sitemap.xml"), sitemap);

const researchPath = join(OUT, "research", "index.html");
try {
  let research = await readFile(researchPath, "utf8");
  if (!research.includes("study-001-home-card")) {
    const block = `<section class="section study-001-home-card"><p class="kicker">New · Study 001</p><h2>Does the answer move with the anchor?</h2><p class="lede">Our first public re-analysis checks 248 Claude and Gemini question-model pairs from a published anchoring experiment. The primary direction-alignment rate is <strong>${pct(overall.direction_alignment_rate)}</strong>; a stricter sensitivity subset is <strong>${pct(sensitivity.direction_alignment_rate)}</strong>.</p><p><a class="button" href="${pagePath}">Read Study 001</a></p></section>`;
    research = research.replace("</main>", `${block}</main>`);
    await writeFile(researchPath, research);
  }
} catch {}

const trackerPath = join(OUT, "ai-era", "tracker", "index.html");
try {
  let trackerHtml = await readFile(trackerPath, "utf8");
  if (!trackerHtml.includes("study-001-supporting-result")) {
    const marker = `<h2><a href="/ai-era/#ai-anchoring-loop">AI Anchoring Loop</a></h2>`;
    const addition = `${marker}<p class="study-001-supporting-result"><strong>Supporting re-analysis:</strong> <a href="${pagePath}">Study 001</a> finds ${pct(overall.direction_alignment_rate)} direction alignment in released model outputs. This does not advance the project stage beyond protocol because it does not run the human–AI protocol.</p>`;
    trackerHtml = trackerHtml.replace(marker, addition);
    await writeFile(trackerPath, trackerHtml);
  }
} catch {}

const llmsPath = join(OUT, "llms.txt");
try {
  let llms = await readFile(llmsPath, "utf8");
  if (!llms.includes("Study 001 anchoring re-analysis:")) {
    llms += `\nStudy 001 anchoring re-analysis: ${canonical} — independent re-analysis of public model outputs; primary direction alignment ${pct(overall.direction_alignment_rate)} across ${overall.question_model_pairs} question-model pairs, sensitivity ${pct(sensitivity.direction_alignment_rate)} across ${sensitivity.question_model_pairs} unambiguous pairs. This is supporting model-side evidence, not a fresh model run and not evidence of a human effect.\nStudy 001 summary data: ${SITE}${dataBase}/summary.json\nStudy 001 question-level derived data: ${SITE}${dataBase}/question-level.csv\n`;
    await writeFile(llmsPath, llms);
  }
} catch {}

console.log(`Generated Study 001 page: ${pct(overall.direction_alignment_rate)} alignment across ${overall.question_model_pairs} pairs.`);
