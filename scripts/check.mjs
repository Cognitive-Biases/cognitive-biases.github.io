import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["index.html", "explore/index.html", "sitemap.xml", "robots.txt", "llms.txt", "assets/icon2.png"];
for (const file of required) await access(resolve("dist", file));

const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const explore = await readFile("dist/explore/index.html", "utf8");
const categorySlug = (value = "") => String(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "other";

const missingUrls = biases.filter((bias) => !sitemap.includes(`/biases/${bias.slug}/`));
if (missingUrls.length) throw new Error(`Sitemap is missing ${missingUrls.length} published bias URLs.`);

const missingDates = biases.filter((bias) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(bias.updatedAt || "")) return false;
  return !sitemap.includes(`<loc>https://cognitive-biases.github.io/biases/${bias.slug}/</loc><lastmod>${bias.updatedAt.slice(0, 10)}</lastmod>`);
});
if (missingDates.length) throw new Error(`Sitemap has incorrect lastmod metadata for ${missingDates.length} bias URLs.`);

if (!explore.includes('"@type":"DefinedTermSet"') || !explore.includes("/explore/#bias-library")) {
  throw new Error("Explore page is missing the DefinedTermSet structured-data node.");
}

const categories = [...new Set(biases.map((bias) => bias.typeOfBias))];
const missingAnchors = categories.filter((category) => !explore.includes(`id="${categorySlug(category)}"`));
if (missingAnchors.length) throw new Error(`Explore page is missing ${missingAnchors.length} category anchors.`);

for (const bias of biases) {
  const path = resolve("dist", "biases", bias.slug, "index.html");
  await access(path);
  const html = await readFile(path, "utf8");
  const expected = `href="/explore/#${categorySlug(bias.typeOfBias)}"`;
  if (!html.includes(expected)) throw new Error(`${bias.slug}: category breadcrumb is not linked to its stable anchor.`);
}

console.log(`Static site check passed: ${biases.length} bias pages, ${categories.length} category anchors, structured data, and sitemap metadata verified.`);
