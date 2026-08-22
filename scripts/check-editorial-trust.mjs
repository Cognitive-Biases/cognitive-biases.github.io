import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const trust = JSON.parse(await readFile("data/project-trust.json", "utf8"));
const citation = await readFile("CITATION.cff", "utf8");
const errors = [];

if (!trust.maintainer?.name || trust.maintainer.name !== "Dzmitryi Kharlanau") errors.push("trust data: maintainer name missing or unexpected");
if (!citation.includes('family-names: "Kharlanau"') || !citation.includes('given-names: "Dzmitryi"')) errors.push("CITATION.cff and trust maintainer are not aligned");
if (!Array.isArray(trust.workflow) || trust.workflow.length < 5) errors.push("trust data: editorial workflow is incomplete");
if (!Array.isArray(trust.automation?.notAllowed) || !trust.automation.notAllowed.some((item) => item.includes("Automatically promote"))) errors.push("trust data: automation boundary is missing");

for (const path of ["about/editorial/index.html", "data/project-trust.json"]) {
  try { await access(join(OUT, path)); }
  catch { errors.push(`missing generated trust artifact: ${path}`); }
}

try {
  const page = await readFile(join(OUT, "about", "editorial", "index.html"), "utf8");
  for (const required of [trust.maintainer.name, "Evidence-reviewed", "Legacy / generated", "Automation and AI", "/methodology/", "/quality/", "/assets/brand.webp"]) if (!page.includes(required)) errors.push(`editorial page missing ${required}`);
  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  if (!sitemap.includes(`${SITE}/about/editorial/`)) errors.push("sitemap missing editorial page");
} catch (error) {
  errors.push(`editorial page validation failed: ${error.message}`);
}

let footerPages = 0;
let trustLinkedPages = 0;
let oldBrandingPages = 0;
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      if (html.includes("</footer>")) {
        footerPages += 1;
        if (html.includes('href="/about/editorial/"')) trustLinkedPages += 1;
      }
      if (html.includes("Made by") && html.includes("MetalHatsCats")) oldBrandingPages += 1;
    }
  }
}
await inspect(OUT);
if (!footerPages) errors.push("no footer pages found");
if (footerPages !== trustLinkedPages) errors.push(`editorial trust link missing from ${footerPages - trustLinkedPages} footer page(s)`);
if (oldBrandingPages) errors.push(`legacy Made by MetalHatsCats credit remains on ${oldBrandingPages} page(s)`);

if (errors.length) {
  console.error("Editorial trust check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Editorial trust OK: ${trustLinkedPages}/${footerPages} footer pages link to the public review process.`);
