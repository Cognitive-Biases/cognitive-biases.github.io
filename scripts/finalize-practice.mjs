import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_OUT, SITE, readJson, writeJson } from "./lib/knowledge.mjs";

const catalogPath = join(DATA_OUT, "catalog.json");
const catalogue = await readJson(catalogPath);
if (!catalogue.distributions.some((item) => item.id === "practice")) {
  catalogue.distributions.push({
    id: "practice",
    format: "application/json",
    url: `${SITE}/data/practice-sets.json`,
    schema: `${SITE}/schemas/practice-set.schema.json`
  });
  await writeJson(catalogPath, catalogue);
}

const dataPagePath = join("dist", "data", "index.html");
let html = await readFile(dataPagePath, "utf8");
html = html.replace(/<script type="application\/ld\+json">([^<]+)<\/script>/g, (full, raw) => {
  try {
    const schema = JSON.parse(raw);
    const graph = schema?.["@graph"] || [];
    const dataset = graph.find((item) => item?.["@type"] === "Dataset");
    if (!dataset) return full;
    dataset.distribution ||= [];
    if (!dataset.distribution.some((item) => item.contentUrl === `${SITE}/data/practice-sets.json`)) {
      dataset.distribution.push({ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/practice-sets.json` });
    }
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  } catch {
    return full;
  }
});
if (!html.includes("Practice Lab distribution")) {
  html = html.replace("</article>", `<h2>Practice data</h2><p>The <a href="/data/practice-sets.json">Practice Lab distribution</a> exposes the same evidence-linked exercises used on the public practice pages.</p></article>`);
}
await writeFile(dataPagePath, html);

const metrics = await readJson(join(DATA_OUT, "metrics.json"));
const qualityPath = join("dist", "quality", "index.html");
let quality = await readFile(qualityPath, "utf8");
if (!quality.includes("Practice Lab coverage")) {
  quality = quality.replace("<h2>Why publish these numbers?</h2>", `<h2>Practice Lab coverage</h2><p>${metrics.practiceSets} practice sets · ${metrics.practiceScenarios} evidence-linked exercises.</p><h2>Why publish these numbers?</h2>`);
  await writeFile(qualityPath, quality);
}
console.log("Practice distribution added to the public data catalogue and quality page.");
