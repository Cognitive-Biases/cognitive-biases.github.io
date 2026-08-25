import { readFile, writeFile } from "node:fs/promises";

const HOME = "dist/index.html";
const DECISION_LINK = '<a class="button button--dark" href="/decide/">Open the decision review</a>';

let html = await readFile(HOME, "utf8");

if (!html.includes('href="/decide/"')) {
  const sectionPattern = /(<section class="section decision-first-home">[\s\S]*?)(<\/section>)/;
  if (!sectionPattern.test(html)) {
    throw new Error("Cannot restore /decide/ discovery: decision-first homepage section is missing.");
  }
  html = html.replace(sectionPattern, `$1<p class="decision-first-home__hub">${DECISION_LINK}</p>$2`);
  await writeFile(HOME, html);
}

if (!html.includes('href="/decide/"')) {
  throw new Error("/decide/ is still not crawlable from the homepage.");
}

console.log("Decision hub discovery verified: /decide/ is linked from the homepage.");
