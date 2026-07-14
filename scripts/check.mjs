import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["index.html", "explore/index.html", "sitemap.xml", "robots.txt", "llms.txt", "assets/icon2.png"];
for (const file of required) await access(resolve("dist", file));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const biases = JSON.parse(await readFile("data/biases.json", "utf8")).filter((bias) => bias.published);
const missing = biases.filter((bias) => !sitemap.includes(`/biases/${bias.slug}/`));
if (missing.length) throw new Error(`Sitemap is missing ${missing.length} published bias URLs.`);
console.log(`Static site check passed: ${biases.length} bias pages and required discovery files found.`);
