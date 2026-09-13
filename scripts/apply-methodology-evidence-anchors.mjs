import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const pagePath = join(OUT, "methodology", "index.html");
const config = JSON.parse(await readFile("data/evidence-classes.json", "utf8"));

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

let html = await readFile(pagePath, "utf8");
const classes = Object.entries(config.classes || {});
if (!classes.length) throw new Error("No controlled evidence classes are configured.");

const section = `<section class="section" id="evidence-classes"><p class="kicker">Evidence classes</p><h2>How to read the evidence labels</h2><p>These labels are editorial reading aids, not numeric truth scores. The entry-specific evidence status and qualification remain primary: a class summarizes the broad strength and scope of the reviewed literature without erasing boundary conditions, mechanism debates, or uncertainty.</p><div class="methodology-evidence-grid">${classes.map(([slug, evidenceClass]) => `<article class="methodology-evidence-class" id="${escapeHtml(slug)}"><h3>${escapeHtml(evidenceClass.label)}</h3><p>${escapeHtml(evidenceClass.description)}</p></article>`).join("")}</div></section>`;

if (!html.includes('id="evidence-classes"')) {
  if (html.includes("</main>")) html = html.replace("</main>", `${section}</main>`);
  else if (html.includes("<footer")) html = html.replace("<footer", `${section}<footer`);
  else throw new Error("Methodology page does not expose a safe insertion point for evidence classes.");
}

for (const [slug] of classes) {
  if (!new RegExp(`id=["']${slug}["']`, "i").test(html)) throw new Error(`Methodology evidence anchor was not generated: ${slug}`);
}

await writeFile(pagePath, html);

const stylesPath = join(OUT, "styles.css");
let styles = await readFile(stylesPath, "utf8");
if (!styles.includes(".methodology-evidence-grid{")) {
  styles += `\n.methodology-evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem;margin-top:1.5rem}.methodology-evidence-class{border:2px solid var(--ink);background:#fff;padding:1rem}.methodology-evidence-class h3{margin-top:0}\n`;
  await writeFile(stylesPath, styles);
}

console.log(`Published ${classes.length} controlled evidence classes on /methodology/.`);
