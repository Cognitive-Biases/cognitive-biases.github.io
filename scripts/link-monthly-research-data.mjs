import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataPath = join("dist", "data", "index.html");
const schemaDir = join("dist", "schemas");
const schemaSource = join("schemas", "monthly-research-digests.schema.json");
const schemaTarget = join(schemaDir, "monthly-research-digests.schema.json");

await mkdir(schemaDir, { recursive: true });
await writeFile(schemaTarget, await readFile(schemaSource, "utf8"));

let html = await readFile(dataPath, "utf8");

if (!html.includes('href="/data/monthly-research-digests.json"')) {
  const researchNotesLink = '<a href="/data/research-notes.json">Research notes</a><br>';
  if (!html.includes(researchNotesLink)) throw new Error("Data page research-notes link was not found.");
  html = html.replace(
    researchNotesLink,
    `${researchNotesLink}<a href="/data/monthly-research-digests.json">Monthly research digests</a><br>`
  );
}

if (!html.includes('href="/schemas/monthly-research-digests.schema.json"')) {
  const digestLink = '<a href="/data/monthly-research-digests.json">Monthly research digests</a><br>';
  if (!html.includes(digestLink)) throw new Error("Data page monthly digest link was not found.");
  html = html.replace(
    digestLink,
    `${digestLink}<a href="/schemas/monthly-research-digests.schema.json">Monthly research digest schema</a><br>`
  );
}

await writeFile(dataPath, html);
console.log("Published monthly research digest schema and linked data + schema from the public Data page.");
