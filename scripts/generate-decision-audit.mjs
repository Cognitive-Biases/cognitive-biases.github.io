import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const bySlug = new Map(biases.map((bias) => [bias.slug, bias]));
const duplicates = JSON.parse(await readFile("data/duplicate-dispositions.json", "utf8"));
const duplicateIds = new Set((duplicates.groups || []).flatMap((group) => group.duplicateIds || []));
const evidenceFiles = (await readdir("data"))
  .filter((name) => /^evidence-reviews(?:-[a-z0-9-]+)?\.json$/i.test(name))
  .sort();
const evidenceDocs = await Promise.all(evidenceFiles.map(async (name) => JSON.parse(await readFile(join("data", name), "utf8"))));
const reviews = evidenceDocs.flatMap((document) => document.reviews || []);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const patterns = reviews.map((review) => {
  const bias = bySlug.get(review.slug);
  if (!bias) throw new Error(`${review.slug}: Decision Audit pattern has no published bias.`);
  if (duplicateIds.has(bias.id)) throw new Error(`${review.slug}: Decision Audit cannot consume a duplicate alias.`);
  return {
    slug: review.slug,
    title: bias.title,
    evidenceStatus: review.evidenceStatus,
    qualification: review.qualification,
    practical: review.practical,
    url: `/biases/${review.slug}/#evidence`,
  };
}).sort((a, b) => a.title.localeCompare(b.title));

const canonical = `${SITE}/tools/decision-audit/`;
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${canonical}#app`,
      name: "Cognitive Biases Decision Audit",
      url: canonical,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any modern web browser",
      browserRequirements: "JavaScript enabled",
      description: "A local-first worksheet for reviewing a decision through evidence, alternative hypotheses, and source-grounded cognitive-bias prompts.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      isPartOf: { "@id": `${SITE}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Decision Audit", item: canonical },
      ],
    },
  ],
};

const patternOptions = patterns.map((pattern) => `<option value="${escapeHtml(pattern.slug)}">${escapeHtml(pattern.title)}</option>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101622"><title>Decision Audit | Cognitive Biases</title><meta name="description" content="Review a decision using evidence, alternative hypotheses, source-grounded cognitive-bias prompts, and an explicit next action. Your draft stays in this browser."><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Cognitive Biases"><meta property="og:title" content="Decision Audit | Cognitive Biases"><meta property="og:description" content="A local-first worksheet for reviewing a decision without opaque bias scoring."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/icon2.png"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/"><img src="/assets/icon2.png" width="48" height="48" alt="Cognitive Biases cat icon"><span>Cognitive<br>Biases</span></a><nav aria-label="Primary"><a href="/explore/">Explore</a><a href="/compare/">Compare</a><a href="/evidence/">Evidence</a><a href="/tools/decision-audit/" aria-current="page">Audit</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a></nav></header><main id="main"><section class="page-hero audit-hero"><p class="eyebrow">Recognize → Test → Counter → Decide</p><h1>Audit the decision, not your personality.</h1><p class="lede">This worksheet does not detect a bias or score how rational you are. It helps you record what you believe, test alternatives, use one evidence-reviewed pattern as a lens, and write the next action explicitly.</p><div class="audit-privacy"><strong>Local-first</strong><span>Your draft is stored only in this browser using local storage. Nothing is sent to a Cognitive Biases server.</span></div></section><form class="audit-form" id="decision-audit" novalidate><section class="audit-step" aria-labelledby="audit-step-1"><div class="audit-step__number">1</div><div class="audit-step__body"><p class="kicker">Recognize</p><h2 id="audit-step-1">Write the decision before explaining it.</h2><label for="decision">Decision, belief, or forecast under review</label><textarea id="decision" name="decision" rows="4" placeholder="Example: We should launch the feature this month because the latest test looks strong."></textarea><div class="audit-fields"><div><label for="confidence">Current confidence <span class="field-help">0–100%</span></label><input id="confidence" name="confidence" type="number" inputmode="numeric" min="0" max="100" placeholder="70"></div><div><label for="stakes">Stakes</label><select id="stakes" name="stakes"><option value="">Choose…</option><option>Low</option><option>Medium</option><option>High</option></select></div></div></div></section><section class="audit-step" aria-labelledby="audit-step-2"><div class="audit-step__number">2</div><div class="audit-step__body"><p class="kicker">Choose a lens</p><h2 id="audit-step-2">Pick a reviewed pattern only if it helps test the decision.</h2><label for="pattern">Evidence-reviewed pattern</label><select id="pattern" name="pattern"><option value="">No specific pattern yet</option>${patternOptions}</select><p class="field-help">Selecting a pattern does not mean you have that bias. It only changes the countermeasure shown below.</p><aside class="audit-lens" id="audit-lens" hidden><div class="audit-lens__meta"><span id="lens-status"></span><a id="lens-link" href="/evidence/">Open evidence review</a></div><h3 id="lens-title"></h3><p id="lens-qualification"></p><div class="audit-counter"><strong>Countermeasure from the reviewed entry</strong><p id="lens-practical"></p></div></aside></div></section><section class="audit-step" aria-labelledby="audit-step-3"><div class="audit-step__number">3</div><div class="audit-step__body"><p class="kicker">Test</p><h2 id="audit-step-3">Make the decision falsifiable.</h2><label for="change-evidence">What evidence would meaningfully change your mind?</label><textarea id="change-evidence" name="changeEvidence" rows="3" placeholder="Name an observable result, not just 'more information'."></textarea><label for="counter-evidence">What evidence currently points the other way?</label><textarea id="counter-evidence" name="counterEvidence" rows="3"></textarea><label for="alternative">What is the strongest competing explanation or alternative hypothesis?</label><textarea id="alternative" name="alternative" rows="3"></textarea><label for="outside-view">What does the outside view or reference class suggest?</label><textarea id="outside-view" name="outsideView" rows="3" placeholder="Comparable launches, incidents, hires, forecasts, projects…"></textarea></div></section><section class="audit-step" aria-labelledby="audit-step-4"><div class="audit-step__number">4</div><div class="audit-step__body"><p class="kicker">Counter</p><h2 id="audit-step-4">Pre-commit to a failure condition.</h2><label for="failure-condition">What would make continuing with the current plan a mistake?</label><textarea id="failure-condition" name="failureCondition" rows="3"></textarea><label for="missing-information">What important information is missing, expensive to obtain, or easy to ignore?</label><textarea id="missing-information" name="missingInformation" rows="3"></textarea><label for="countermeasure-note">How will you apply the countermeasure in this specific case?</label><textarea id="countermeasure-note" name="countermeasureNote" rows="3"></textarea></div></section><section class="audit-step" aria-labelledby="audit-step-5"><div class="audit-step__number">5</div><div class="audit-step__body"><p class="kicker">Decide</p><h2 id="audit-step-5">Write the next move and the trigger to review it.</h2><label for="next-action">Next decision or action</label><textarea id="next-action" name="nextAction" rows="3" placeholder="What will you actually do next?"></textarea><div class="audit-fields"><div><label for="review-date">Review date</label><input id="review-date" name="reviewDate" type="date"></div><div><label for="review-trigger">Or review trigger</label><input id="review-trigger" name="reviewTrigger" type="text" placeholder="Example: after 100 users"></div></div><label for="final-confidence">Confidence after the audit <span class="field-help">0–100%</span></label><input id="final-confidence" name="finalConfidence" type="number" inputmode="numeric" min="0" max="100" placeholder="60"></div></section><section class="audit-output" aria-labelledby="audit-summary-heading"><div class="audit-output__head"><div><p class="kicker">Audit record</p><h2 id="audit-summary-heading">A compact decision snapshot.</h2></div><div class="audit-actions"><button class="button button--secondary" type="button" id="copy-audit">Copy summary</button><button class="button button--secondary" type="button" id="reset-audit">Reset</button></div></div><pre id="audit-summary" tabindex="0" aria-live="polite">Start with the decision above. Your summary will update as you type.</pre><p class="fine-print" id="save-status">Draft not yet saved.</p></section></form><section class="section audit-boundary"><p class="kicker">Boundary</p><h2>This is a thinking aid, not a diagnosis.</h2><p>The tool does not infer hidden motives, declare that a person “has” a cognitive bias, or tell you which decision is correct. Its job is smaller and more useful: preserve the reasoning trail, surface counterevidence, and make the next test explicit.</p></section></main><footer class="site-footer"><div><a class="brand brand--footer" href="/"><img src="/assets/icon2.png" width="40" height="40" alt=""><span>Cognitive Biases</span></a><p>An educational reference for noticing the patterns that shape judgment.</p></div><div class="footer-links"><a href="/explore/">Explore biases</a><a href="/compare/">Compare biases</a><a href="/evidence/">Evidence reviews</a><a href="/tools/decision-audit/">Decision Audit</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/support/">Support</a></div><p class="fine-print">Educational information, not medical, legal, financial, or mental-health advice.</p><p class="fine-print">Made by <a href="https://metalhatscats.com/">MetalHatsCats</a></p></footer><script type="application/json" id="audit-pattern-data">${JSON.stringify(patterns).replaceAll("<", "\\u003c")}</script><script src="/assets/decision-audit.js" defer></script></body></html>`;

const target = join(OUT, "tools", "decision-audit", "index.html");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html);

const js = `(() => {
  const STORAGE_KEY = "cognitive-biases-decision-audit-v1";
  const form = document.getElementById("decision-audit");
  if (!form) return;
  const patterns = JSON.parse(document.getElementById("audit-pattern-data")?.textContent || "[]");
  const bySlug = new Map(patterns.map((pattern) => [pattern.slug, pattern]));
  const lens = document.getElementById("audit-lens");
  const patternSelect = document.getElementById("pattern");
  const summary = document.getElementById("audit-summary");
  const saveStatus = document.getElementById("save-status");
  const fields = [...form.elements].filter((element) => element.name);

  const readState = () => Object.fromEntries(fields.map((field) => [field.name, field.value]));
  const writeState = (state = {}) => fields.forEach((field) => { if (Object.hasOwn(state, field.name)) field.value = state[field.name] ?? ""; });
  const clean = (value) => String(value || "").trim();
  const line = (label, value) => clean(value) ? label + ": " + clean(value) : label + ": —";

  function renderLens() {
    const pattern = bySlug.get(patternSelect.value);
    if (!pattern) { lens.hidden = true; return; }
    lens.hidden = false;
    document.getElementById("lens-status").textContent = pattern.evidenceStatus;
    document.getElementById("lens-link").href = pattern.url;
    document.getElementById("lens-title").textContent = pattern.title;
    document.getElementById("lens-qualification").textContent = pattern.qualification;
    document.getElementById("lens-practical").textContent = pattern.practical;
  }

  function renderSummary() {
    const state = readState();
    const pattern = bySlug.get(state.pattern);
    const confidence = clean(state.confidence);
    const finalConfidence = clean(state.finalConfidence);
    const delta = confidence && finalConfidence && !Number.isNaN(Number(confidence)) && !Number.isNaN(Number(finalConfidence))
      ? Number(finalConfidence) - Number(confidence)
      : null;
    const lines = [
      "DECISION AUDIT",
      "",
      line("Decision / belief", state.decision),
      line("Stakes", state.stakes),
      line("Starting confidence", confidence ? confidence + "%" : ""),
      line("Pattern used as a lens", pattern ? pattern.title : "No specific pattern"),
      pattern ? line("Evidence status", pattern.evidenceStatus) : null,
      "",
      "TEST",
      line("Evidence that would change my mind", state.changeEvidence),
      line("Evidence pointing the other way", state.counterEvidence),
      line("Strongest alternative explanation", state.alternative),
      line("Outside view / reference class", state.outsideView),
      "",
      "COUNTER",
      line("Failure condition", state.failureCondition),
      line("Missing / ignored information", state.missingInformation),
      pattern ? line("Reviewed countermeasure", pattern.practical) : null,
      line("How I will apply it", state.countermeasureNote),
      "",
      "DECIDE",
      line("Next action", state.nextAction),
      line("Review date", state.reviewDate),
      line("Review trigger", state.reviewTrigger),
      line("Confidence after audit", finalConfidence ? finalConfidence + "%" : ""),
      delta === null ? null : "Confidence change: " + (delta > 0 ? "+" : "") + delta + " points",
      "",
      "This record is a decision aid, not a bias diagnosis."
    ].filter((item) => item !== null);
    summary.textContent = lines.join("\\n");
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readState()));
      saveStatus.textContent = "Draft saved locally in this browser.";
    } catch {
      saveStatus.textContent = "Local saving is unavailable in this browser session.";
    }
  }

  function update() { renderLens(); renderSummary(); persist(); }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") writeState(saved);
  } catch { /* keep an empty audit if saved data is invalid */ }

  const requested = new URLSearchParams(location.search).get("bias");
  if (requested && bySlug.has(requested)) patternSelect.value = requested;
  fields.forEach((field) => field.addEventListener("input", update));
  fields.forEach((field) => field.addEventListener("change", update));

  document.getElementById("copy-audit")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary.textContent || "");
      saveStatus.textContent = "Audit summary copied. Draft remains stored locally.";
    } catch {
      summary.focus();
      saveStatus.textContent = "Clipboard access is unavailable. Select the summary and copy it manually.";
    }
  });

  document.getElementById("reset-audit")?.addEventListener("click", () => {
    form.reset();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
    renderLens();
    renderSummary();
    saveStatus.textContent = "Local draft cleared.";
    document.getElementById("decision")?.focus();
  });

  renderLens();
  renderSummary();
})();\n`;
const jsTarget = join(OUT, "assets", "decision-audit.js");
await mkdir(dirname(jsTarget), { recursive: true });
await writeFile(jsTarget, js);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".audit-form{")) {
  styles += `\n.audit-hero{padding-bottom:2.2rem}.audit-privacy{display:flex;gap:.7rem;align-items:flex-start;max-width:780px;margin-top:1.2rem;padding:.8rem 1rem;border:2px solid var(--ink);background:#fff}.audit-privacy strong{font-weight:900;text-transform:uppercase}.audit-form{max-width:1120px;margin:0 auto;padding:2rem 6vw 4rem}.audit-step{display:grid;grid-template-columns:58px minmax(0,1fr);gap:1rem;margin-bottom:1rem;border:var(--line);background:#fff;box-shadow:6px 6px 0 var(--ink)}.audit-step__number{display:grid;place-items:center;align-self:stretch;border-right:var(--line);background:var(--yellow);font:1.5rem Archivo Black,sans-serif}.audit-step__body{padding:1.35rem}.audit-step__body h2{font:clamp(1.35rem,2.5vw,2.2rem)/1.08 Archivo Black,sans-serif;letter-spacing:-.045em;margin:.35rem 0 1.2rem}.audit-step label{display:block;font-weight:900;margin:.9rem 0 .35rem}.audit-step textarea,.audit-step input,.audit-step select{width:100%;box-sizing:border-box;border:2px solid var(--ink);background:var(--paper);padding:.75rem;font:inherit;color:var(--ink);border-radius:0}.audit-step textarea:focus,.audit-step input:focus,.audit-step select:focus{outline:3px solid var(--cyan);outline-offset:2px}.audit-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.field-help{font-size:.82rem;font-weight:700;color:#5a6475}.audit-lens{margin-top:1rem;padding:1rem;border:var(--line);background:var(--paper);box-shadow:5px 5px 0 var(--cyan)}.audit-lens__meta{display:flex;justify-content:space-between;gap:.8rem;flex-wrap:wrap;font-size:.78rem;font-weight:900;text-transform:uppercase}.audit-lens__meta span{background:var(--yellow);border:2px solid var(--ink);padding:.25rem .45rem}.audit-lens h3{font:1.1rem Archivo Black,sans-serif;margin:1rem 0 .5rem}.audit-counter{margin-top:1rem;padding-top:1rem;border-top:2px solid var(--ink)}.audit-counter strong{font-weight:900}.audit-output{max-width:1120px;margin:0 auto 2rem;padding:1.4rem;border:var(--line);background:var(--ink);color:#fff;box-shadow:8px 8px 0 var(--pink)}.audit-output__head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-end;flex-wrap:wrap}.audit-output h2{margin:.3rem 0;font:clamp(1.35rem,2.5vw,2.1rem)/1 Archivo Black,sans-serif}.audit-actions{display:flex;gap:.6rem;flex-wrap:wrap}.audit-output .button--secondary{cursor:pointer;background:#fff;color:var(--ink)}.audit-output pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:1rem 0 0;padding:1rem;border:2px solid #fff;background:#070b12;color:#fff;font:0.9rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:220px}.audit-output .fine-print{color:#cbd2dc}.audit-boundary{border-top:var(--line)}.audit-cta{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin:2rem 0;padding:1rem;border:var(--line);background:var(--yellow);box-shadow:5px 5px 0 var(--ink)}.audit-cta strong{font:1rem Archivo Black,sans-serif}.audit-cta a{font-weight:900}@media(max-width:700px){.audit-step{grid-template-columns:44px minmax(0,1fr)}.audit-step__body{padding:1rem}.audit-fields{grid-template-columns:1fr}.audit-privacy{flex-direction:column}.audit-output{margin-left:4vw;margin-right:4vw}}\n`;
  await writeFile(stylesPath, styles);
}

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");
if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
  sitemap = sitemap.replace("</urlset>", `  <url><loc>${canonical}</loc></url>\n</urlset>`);
  await writeFile(sitemapPath, sitemap);
}

for (const pattern of patterns) {
  const pagePath = join(OUT, "biases", pattern.slug, "index.html");
  let page = await readFile(pagePath, "utf8");
  if (!page.includes(`/tools/decision-audit/?bias=${pattern.slug}`)) {
    const cta = `<aside class="audit-cta"><div><span class="kicker">Use the pattern</span><strong>Audit a real decision with this entry as a lens.</strong></div><a href="/tools/decision-audit/?bias=${pattern.slug}">Open Decision Audit <span aria-hidden="true">→</span></a></aside>`;
    const marker = '<section class="related">';
    if (!page.includes(marker)) throw new Error(`${pattern.slug}: cannot insert Decision Audit CTA.`);
    page = page.replace(marker, `${cta}${marker}`);
    await writeFile(pagePath, page);
  }
}

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

for (const file of await htmlFiles(OUT)) {
  let page = await readFile(file, "utf8");
  const before = page;
  page = page.replace(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/, (nav) => {
    if (nav.includes('href="/tools/decision-audit/"')) return nav;
    if (nav.includes('href="/evidence/"')) return nav.replace(/(<a href="\/evidence\/"[^>]*>Evidence<\/a>)/, '$1<a href="/tools/decision-audit/">Audit</a>');
    return nav.replace(/(<a href="\/explore\/"[^>]*>Explore<\/a>)/, '$1<a href="/tools/decision-audit/">Audit</a>');
  });
  if (page !== before) await writeFile(file, page);
}

console.log(`Generated local-first Decision Audit with ${patterns.length} evidence-reviewed optional lenses and reciprocal CTAs.`);
