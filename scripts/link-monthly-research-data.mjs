import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataPath = join("dist", "data", "index.html");
let html = await readFile(dataPath, "utf8");

if (!html.includes('href="/data/monthly-research-digests.json"')) {
  const researchNotesLink = '<a href="/data/research-notes.json">Research notes</a><br>';
  if (!html.includes(researchNotesLink)) throw new Error("Data page research-notes link was not found.");
  html = html.replace(
    researchNotesLink,
    `${researchNotesLink}<a href="/data/monthly-research-digests.json">Monthly research digests</a><br>`
  );
  await writeFile(dataPath, html);
}

console.log("Linked monthly research digest data from the public Data page.");
