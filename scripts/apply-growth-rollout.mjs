import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "dist";
const SITE = "https://cognitive-biases.github.io";
const ORG_PROFILE = "https://github.com/Cognitive-Biases";
const BRAND_IMAGE = `${SITE}/assets/brand.webp`;
const PLAY = "https://play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology";
const APP_STORE = "https://apps.apple.com/us/app/biases-cognitive-biases/id6741084128";
const POLICY_MARKER = "third-party-content-policy";

const projectTrust = JSON.parse(await readFile("data/project-trust.json", "utf8"));

async function walkHtml(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

const asTypes = (node) => Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]].filter(Boolean);
const mergeUrls = (current, additions) => [...new Set([...(Array.isArray(current) ? current : current ? [current] : []), ...additions])];
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function patchJsonLd(html) {
  let organizationNodes = 0;
  let applicationNodes = 0;
  const next = html.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return match; }
    const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
    let changed = false;
    for (const node of nodes) {
      const types = asTypes(node);
      if (types.includes("Organization") && node?.["@id"] === `${SITE}/#organization`) {
        organizationNodes += 1;
        node.sameAs = mergeUrls(node.sameAs, [ORG_PROFILE]);
        if (!node.logo) node.logo = { "@type": "ImageObject", url: BRAND_IMAGE };
        else if (typeof node.logo === "string") node.logo = { "@type": "ImageObject", url: node.logo };
        else if (!node.logo.url) node.logo.url = BRAND_IMAGE;
        changed = true;
      }
      if ((types.includes("SoftwareApplication") || types.includes("MobileApplication")) && node?.["@id"] === `${SITE}/#app`) {
        applicationNodes += 1;
        node.sameAs = mergeUrls(node.sameAs, [PLAY, APP_STORE]);
        node.publisher = node.publisher || { "@id": `${SITE}/#organization` };
        changed = true;
      }
    }
    return changed ? `<script${attrs}>${JSON.stringify(data)}</script>` : match;
  });
  return { html: next, organizationNodes, applicationNodes };
}

let identityFilesChanged = 0;
let organizationNodes = 0;
let applicationNodes = 0;
for (const path of await walkHtml(OUT)) {
  const html = await readFile(path, "utf8");
  const patched = patchJsonLd(html);
  organizationNodes += patched.organizationNodes;
  applicationNodes += patched.applicationNodes;
  if (patched.html !== html) {
    await writeFile(path, patched.html);
    identityFilesChanged += 1;
  }
}
if (!organizationNodes) throw new Error("Growth rollout could not find the canonical Organization JSON-LD node.");

const policy = projectTrust.thirdPartyContent;
if (!policy?.rules?.length) throw new Error("project-trust.json is missing thirdPartyContent governance rules.");
const editorialPath = join(OUT, "about", "editorial", "index.html");
let editorial = await readFile(editorialPath, "utf8");
if (!editorial.includes(`id="${POLICY_MARKER}"`)) {
  const rules = policy.rules.map((rule) => `<li>${esc(rule)}</li>`).join("");
  const section = `<section class="section" id="${POLICY_MARKER}"><p class="kicker">Third-party content policy</p><h2>Editorial purpose comes before borrowed reputation.</h2><p class="lede">${esc(policy.currentState)}</p><ul>${rules}</ul></section>`;
  const corrections = '<section class="section section--ink"><p class="kicker">Corrections</p>';
  if (!editorial.includes(corrections)) throw new Error("Could not locate the editorial corrections section for governance insertion.");
  editorial = editorial.replace(corrections, `${section}${corrections}`);
  await writeFile(editorialPath, editorial);
}

console.log(`Growth rollout applied: canonical identity enriched on ${identityFilesChanged} HTML file(s) across ${organizationNodes} Organization node(s) and ${applicationNodes} app node(s); third-party editorial governance published.`);
