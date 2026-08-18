import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const TODAY = new Date().toISOString().slice(0, 10);
const researchNotes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const paths = [
  "/research/",
  "/data/",
  "/partners/",
  ...(researchNotes.entries || []).map((note) => `/research/${note.slug}/`)
];

const sitemapPath = join(OUT, "sitemap.xml");
let sitemap = await readFile(sitemapPath, "utf8");

for (const path of paths) {
  const url = `${SITE}${path}`;
  if (sitemap.includes(`<loc>${url}</loc>`)) continue;
  sitemap = sitemap.replace(
    "</urlset>",
    `<url><loc>${url}</loc><lastmod>${TODAY}</lastmod></url></urlset>`
  );
}

await writeFile(sitemapPath, sitemap);
console.log(`Added ${paths.length} public resource URLs to sitemap.`);
