import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

await import("./generate-editorial-trust.mjs");

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const EXPECTED_MAINTAINER = "MetalHatsCats Team";
const trust = JSON.parse(await readFile("data/project-trust.json", "utf8"));
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const citation = await readFile("CITATION.cff", "utf8");
const zenodo = JSON.parse(await readFile(".zenodo.json", "utf8"));
const errors = [];

if (!trust.maintainer?.name || trust.maintainer.name !== EXPECTED_MAINTAINER) errors.push("trust data: maintainer name missing or unexpected");
if (!identity.publisher?.url || identity.publisher.url !== "https://metalhatscats.com/") errors.push("site identity: canonical publisher URL missing or unexpected");
if (!identity.publisher?.description) errors.push("site identity: publisher description is missing");
if (!citation.includes(`name: "${EXPECTED_MAINTAINER}"`)) errors.push("CITATION.cff and trust maintainer are not aligned");
if (!Array.isArray(zenodo.creators) || !zenodo.creators.some((creator) => creator?.name === EXPECTED_MAINTAINER)) errors.push(".zenodo.json and trust maintainer are not aligned");
if (!Array.isArray(trust.workflow) || trust.workflow.length < 5) errors.push("trust data: editorial workflow is incomplete");
if (!Array.isArray(trust.automation?.notAllowed) || !trust.automation.notAllowed.some((item) => item.includes("Automatically promote"))) errors.push("trust data: automation boundary is missing");

for (const path of ["about/editorial/index.html", "about/publisher/index.html", "data/project-trust.json"]) {
  try { await access(join(OUT, path)); }
  catch { errors.push(`missing generated trust artifact: ${path}`); }
}

try {
  const page = await readFile(join(OUT, "about", "editorial", "index.html"), "utf8");
  for (const required of [trust.maintainer.name, "Evidence-reviewed", "Legacy / generated", "Automation and AI", "/about/publisher/", "/methodology/", "/assets/brand.webp"]) if (!page.includes(required)) errors.push(`editorial page missing ${required}`);
  if (!page.includes('"@type":"Organization"')) errors.push("editorial structured data must model the maintainer team as an Organization");
  if (page.includes('"@type":"Person","name":"MetalHatsCats Team"')) errors.push("editorial structured data incorrectly models the maintainer team as a Person");

  const publisherPage = await readFile(join(OUT, "about", "publisher", "index.html"), "utf8");
  for (const required of ["Publisher & developer", "GitHub Pages", "Next.js", "Data products", "Knowledge graphs", "AI / ML", "https://metalhatscats.com/build", "https://metalhatscats.com/projects"]) if (!publisherPage.includes(required)) errors.push(`publisher page missing ${required}`);
  if (!publisherPage.includes('"@type":"Organization"')) errors.push("publisher structured data must expose MetalHatsCats as an Organization");
  if (!publisherPage.includes('"@type":"ProfilePage"')) errors.push("publisher page must be exposed as a ProfilePage");

  const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
  if (!sitemap.includes(`${SITE}/about/editorial/`)) errors.push("sitemap missing editorial page");
  if (!sitemap.includes(`${SITE}/about/publisher/`)) errors.push("sitemap missing publisher page");
} catch (error) {
  errors.push(`editorial/publisher page validation failed: ${error.message}`);
}

let footerPages = 0;
let editorialLinkedPages = 0;
let publisherLinkedPages = 0;
let externalPublisherPages = 0;
let oldBrandingPages = 0;
let staleMaintainerPages = 0;
let personalMaintainerLeakPages = 0;
const personalMaintainerVariants = ["Dzmitryi Kharlanau", "Dmitry Kharlanau", "Дмитрий Харланов", "Дмитрий Ухарланов"];
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      if (html.includes("</footer>")) {
        footerPages += 1;
        if (html.includes('href="/about/editorial/"')) editorialLinkedPages += 1;
        if (html.includes('href="/about/publisher/"')) publisherLinkedPages += 1;
        if (html.includes(`href="${identity.publisher.url}"`) && html.includes(EXPECTED_MAINTAINER)) externalPublisherPages += 1;
      }
      if (html.includes("Made by") && html.includes("MetalHatsCats")) oldBrandingPages += 1;
      if (/Maintained by\s*<a[^>]*>MetalHatsCats<\/a>/.test(html)) staleMaintainerPages += 1;
      if (personalMaintainerVariants.some((name) => html.includes(name))) personalMaintainerLeakPages += 1;
    }
  }
}
await inspect(OUT);
if (!footerPages) errors.push("no footer pages found");
if (footerPages !== editorialLinkedPages) errors.push(`editorial process link missing from ${footerPages - editorialLinkedPages} footer page(s)`);
if (footerPages !== publisherLinkedPages) errors.push(`publisher profile link missing from ${footerPages - publisherLinkedPages} footer page(s)`);
if (footerPages !== externalPublisherPages) errors.push(`external MetalHatsCats attribution missing from ${footerPages - externalPublisherPages} footer page(s)`);
if (oldBrandingPages) errors.push(`legacy Made by MetalHatsCats credit remains on ${oldBrandingPages} page(s)`);
if (staleMaintainerPages) errors.push(`stale Maintained by MetalHatsCats credit remains on ${staleMaintainerPages} page(s)`);
if (personalMaintainerLeakPages) errors.push(`personal maintainer identity leaked into ${personalMaintainerLeakPages} public page(s)`);

if (errors.length) {
  console.error("Editorial trust check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Editorial trust OK: ${publisherLinkedPages}/${footerPages} footer pages expose the publisher profile, external MetalHatsCats attribution and editorial process for ${EXPECTED_MAINTAINER}.`);
