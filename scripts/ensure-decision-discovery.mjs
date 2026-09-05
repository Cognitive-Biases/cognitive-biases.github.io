import { readFile, writeFile } from "node:fs/promises";

const HOME = "dist/index.html";
const STYLES = "dist/styles.css";
const LLMS = "dist/llms.txt";
const DIGESTS = "data/monthly-research-digests.json";
const DECISION_LINK = '<a class="button button--dark" href="/decide/">Open the decision review</a>';
const escape = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

let html = await readFile(HOME, "utf8");

if (!html.includes('href="/decide/"')) {
  const sectionPattern = /(<section class="section decision-first-home">[\s\S]*?)(<\/section>)/;
  if (!sectionPattern.test(html)) {
    throw new Error("Cannot restore /decide/ discovery: decision-first homepage section is missing.");
  }
  html = html.replace(sectionPattern, `$1<p class="decision-first-home__hub">${DECISION_LINK}</p>$2`);
}

if (!html.includes('href="/decide/"')) {
  throw new Error("/decide/ is still not crawlable from the homepage.");
}

const digestData = JSON.parse(await readFile(DIGESTS, "utf8"));
const latestDigest = [...(digestData.digests || [])].sort((a, b) => String(b.slug).localeCompare(String(a.slug)))[0];
if (latestDigest && !html.includes(`href="/research/digests/${latestDigest.slug}/"`)) {
  const signals = latestDigest.signals || [];
  const labels = signals.slice(0, 3).map((signal) => `<li><span>${escape(signal.delta)}</span>${escape(signal.title)}</li>`).join("");
  const section = `<section class="section research-digest-home" aria-labelledby="latest-research-digest"><div class="research-digest-home__copy"><p class="kicker">Latest research · ${escape(latestDigest.month)}</p><h2 id="latest-research-digest">What changed in the evidence?</h2><p>${escape(latestDigest.summary)}</p><p>We do not publish a paper list. Each monthly update says what strengthened, what narrowed, what opened a new context, and what is still only worth watching.</p><div class="actions"><a class="button" href="/research/digests/${escape(latestDigest.slug)}/">Read the ${escape(latestDigest.month)} digest</a><a href="/research/digests/">All monthly digests →</a></div></div><div class="research-digest-home__signals"><p class="kicker">This month</p><ul>${labels}</ul><p class="fine-print">${signals.length} reviewed signals. Preprints stay provisional; null results and evidence gaps stay visible.</p></div></section>`;
  if (!html.includes("</main>")) throw new Error("Cannot add latest research digest: homepage main element is missing.");
  html = html.replace("</main>", `${section}</main>`);
}

if (latestDigest && !html.includes(`href="/research/digests/${latestDigest.slug}/"`)) {
  throw new Error("Latest monthly research digest is not crawlable from the homepage.");
}

await writeFile(HOME, html);

let styles = await readFile(STYLES, "utf8");
if (!styles.includes(".research-digest-home{")) {
  styles += `\n.research-digest-home{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:1.5rem;align-items:start}.research-digest-home__copy,.research-digest-home__signals{border:var(--line);background:#fff;padding:1.35rem}.research-digest-home__copy{box-shadow:8px 8px 0 var(--yellow)}.research-digest-home__signals{box-shadow:8px 8px 0 var(--cyan)}.research-digest-home__signals ul{list-style:none;margin:1rem 0;padding:0;display:grid;gap:.8rem}.research-digest-home__signals li{display:grid;gap:.2rem;padding-top:.8rem;border-top:2px solid var(--ink);font-weight:850}.research-digest-home__signals li span{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#5a6475}.research-digest-home .actions{align-items:center;gap:1rem;flex-wrap:wrap}.research-digest-home .actions>a:not(.button){font-weight:900}@media(max-width:760px){.research-digest-home{grid-template-columns:1fr}}\n`;
  await writeFile(STYLES, styles);
}

let llms = await readFile(LLMS, "utf8");
if (!llms.includes("Monthly research digests:")) {
  const researchLine = "- Research: https://cognitive-biases.github.io/research/";
  if (!llms.includes(researchLine)) throw new Error("Cannot add monthly digest to llms.txt: Research line is missing.");
  const discovery = `${researchLine}\n- Monthly research digests: https://cognitive-biases.github.io/research/digests/ — evidence-delta updates that label new findings as strengthening, narrowing, new context or watch-only instead of treating every new paper as settled evidence.\n- Research Atom feed: https://cognitive-biases.github.io/research/feed.xml — research notes and monthly digests in one update feed.`;
  llms = llms.replace(researchLine, discovery);
}
if (!llms.includes("Monthly research digest data:")) {
  const notesLine = "- Research notes: https://cognitive-biases.github.io/data/research-notes.json";
  if (!llms.includes(notesLine)) throw new Error("Cannot add monthly digest data to llms.txt: Research notes line is missing.");
  llms = llms.replace(notesLine, `${notesLine}\n- Monthly research digest data: https://cognitive-biases.github.io/data/monthly-research-digests.json`);
}
if (!llms.includes("Treat `watch only` monthly research signals as provisional")) {
  const rule = "Important interpretation rule: older library entries are not automatically evidence-reviewed. Prefer entries with an explicit evidence review when making claims about scientific support. Preserve the evidence class, descriptive status, qualification and review date when summarising reviewed material.";
  if (!llms.includes(rule)) throw new Error("Cannot add monthly digest interpretation rule to llms.txt.");
  llms = llms.replace(rule, `${rule}\n\nTreat \`watch only\` monthly research signals as provisional discovery, not canonical evidence. A monthly \`strengthens\`, \`narrows\` or \`new context\` label describes how the project interpreted a reviewed source; when making a scientific claim, prefer the resulting canonical evidence page and its sources when one exists.`);
}
await writeFile(LLMS, llms);

if (!llms.includes("https://cognitive-biases.github.io/data/monthly-research-digests.json") || !llms.includes("https://cognitive-biases.github.io/research/feed.xml")) {
  throw new Error("Monthly research discovery is incomplete in generated llms.txt.");
}

console.log(`Decision and research discovery verified: /decide/${latestDigest ? `, /research/digests/${latestDigest.slug}/, research feed and monthly digest data` : ""} are discoverable.`);
