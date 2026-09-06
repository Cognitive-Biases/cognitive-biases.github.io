import { readFile } from "node:fs/promises";

const SITE = "https://cognitive-biases.github.io";
const ORG_PROFILE = "https://github.com/Cognitive-Biases";
const PLAY = "https://play.google.com/store/apps/details?id=cognitivebiases.thinking.psychology";
const APP_STORE = "https://apps.apple.com/us/app/biases-cognitive-biases/id6741084128";
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } })
    .filter(Boolean);
}
function nodes(values) {
  return values.flatMap((value) => Array.isArray(value?.["@graph"]) ? value["@graph"] : [value]);
}
const types = (node) => Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]].filter(Boolean);
const urls = (value) => Array.isArray(value) ? value : value ? [value] : [];

const home = await readFile("dist/index.html", "utf8");
const homeNodes = nodes(jsonLd(home));
const organization = homeNodes.find((node) => types(node).includes("Organization") && node?.["@id"] === `${SITE}/#organization`);
assert(organization, "homepage canonical Organization node is missing");
assert(urls(organization.sameAs).includes(ORG_PROFILE), "homepage Organization sameAs must include the canonical GitHub organization profile");
assert(typeof organization.logo === "object" && /^https:\/\//.test(organization.logo.url || ""), "homepage Organization must expose an absolute logo ImageObject");

const app = homeNodes.find((node) => (types(node).includes("SoftwareApplication") || types(node).includes("MobileApplication")) && node?.["@id"] === `${SITE}/#app`);
if (app) {
  assert(urls(app.sameAs).includes(PLAY) && urls(app.sameAs).includes(APP_STORE), "published app identity must link both authoritative store profiles");
}

const projectTrust = JSON.parse(await readFile("data/project-trust.json", "utf8"));
assert(projectTrust.thirdPartyContent?.policy === "editorial-purpose-first", "project trust must define editorial-purpose-first third-party governance");
assert(projectTrust.thirdPartyContent?.rules?.length >= 4, "third-party governance rules are incomplete");
const machineTrust = JSON.parse(await readFile("ai/trust.json", "utf8"));
assert(machineTrust.governance?.thirdPartyContent?.policy === "editorial-purpose-first", "machine-readable trust surface must expose third-party governance");

const editorial = await readFile("dist/about/editorial/index.html", "utf8");
assert(editorial.includes('id="third-party-content-policy"'), "editorial page is missing the third-party content policy section");
assert(editorial.includes("borrowed reputation"), "editorial page must state the site-reputation boundary in human-readable form");

const review = await readFile("growth/content-quality-review-2026-09-06.md", "utf8");
assert(review.includes("Decision: `keep`"), "manual content-quality review decision is missing");
assert(review.includes("/research/") && review.includes("/evidence/") && review.includes("/contexts/"), "manual content-quality review must cover priority evidence and decision surfaces");

console.log(`Growth rollout checks passed: canonical Organization identity, editorial-purpose governance and manual non-commodity review are recorded and published${app ? "; published app identity is store-linked" : "; no canonical app JSON-LD is currently published, so no synthetic app node was required"}.`);
