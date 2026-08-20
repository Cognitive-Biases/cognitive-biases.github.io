import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const path = join("dist", "index.html");
let html = await readFile(path, "utf8");

if (!html.includes('class="decision-workbench-home"')) {
  const block = `<section class="section decision-workbench-home"><p class="kicker">Decision workbench</p><h2>Use the library on a real decision.</h2><p class="lede">Review a career choice, build a reusable lens pack for a team, or follow AI-era research from an idea to a reproducible result.</p><div class="application-grid"><article class="application-card"><span>Interactive</span><strong>Career Decision Review</strong><p>Compare options, preserve an independent estimate, challenge the favourite and define a reversible test.</p><a href="/tools/career-decision-review/">Review a career decision →</a></article><article class="application-card"><span>Builder</span><strong>Lens Pack Builder</strong><p>Create a compact checklist from published lenses for a recurring work decision.</p><a href="/tools/lens-pack-builder/">Build a lens pack →</a></article><article class="application-card"><span>Open research</span><strong>AI-era Research Tracker</strong><p>See which human–AI ideas have only a hypothesis, which have a protocol and what would move them forward.</p><a href="/ai-era/tracker/">Track the research →</a></article></div></section>`;
  if (html.includes("</main>")) html = html.replace("</main>", `${block}</main>`);
  else if (html.includes('<footer class="site-footer">')) html = html.replace('<footer class="site-footer">', `${block}<footer class="site-footer">`);
  else throw new Error("Homepage has no safe insertion point for Decision Workbench discovery.");
  await writeFile(path, html);
}

if (!html.includes('class="decision-workbench-home"')) throw new Error("Decision Workbench discovery finalization failed.");
console.log("Decision Workbench homepage discovery finalized.");
