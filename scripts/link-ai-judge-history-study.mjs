import { readFile, writeFile } from "node:fs/promises";

const researchPath = "dist/research/index.html";
const dataPath = "dist/data/index.html";
const marker = "<!-- ai-judge-history-v1 -->";

async function inject(path, section) {
  let html = await readFile(path, "utf8");
  if (html.includes(marker)) return;
  const target = "</article>";
  if (!html.includes(target)) throw new Error(`Could not find article boundary in ${path}`);
  html = html.replace(target, `${section}${target}`);
  await writeFile(path, html);
}

await inject(researchPath, `${marker}<section class="research-lab-callout"><p class="kicker">Project research lab</p><h2>We publish protocols before results.</h2><p>Two project studies now have public methods before outcome claims: a human AI-advice-order pilot and a provider-neutral benchmark testing whether previous scores change later AI-judge evaluations.</p><p><a class="button" href="/research/ai-judge-history-v1/">AI Judge History protocol</a> <a class="button button--secondary" href="/research/ai-advice-order-v1/">AI Advice Order pilot</a></p></section>`);

await inject(dataPath, `${marker}<section class="research-lab-callout"><h2>Research protocols and reproducible artifacts</h2><p>The research layer is machine-readable too. Protocols, prompt packs and result schemas are public before project findings are promoted.</p><p><a href="/data/studies/ai-judge-history-v1.json">AI Judge History protocol JSON</a><br><a href="/data/studies/ai-judge-history-prompt-pack-v1.json">AI Judge History prompt pack</a><br><a href="/schemas/ai-judge-history-results.schema.json">AI Judge History result schema</a><br><a href="/data/studies/ai-advice-order-v1.json">AI Advice Order preregistration JSON</a></p></section>`);

console.log("Linked AI Judge History v1 from Research and Data pages.");
