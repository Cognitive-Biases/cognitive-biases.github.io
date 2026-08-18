import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const contexts = await json("data/contexts.json");
const config = await json("data/context-groups.json");
const allSlugs = new Set((contexts.entries || []).map((entry) => entry.slug));
const grouped = (config.groups || []).flatMap((group) => group.contexts || []);
if (grouped.length !== allSlugs.size || new Set(grouped).size !== allSlugs.size) throw new Error("Decision-guide groups must cover every context exactly once.");
for (const slug of grouped) if (!allSlugs.has(slug)) throw new Error(`Decision-guide group references unknown context ${slug}.`);
if ((config.homepageFeatured || []).length !== 4 || new Set(config.homepageFeatured).size !== 4) throw new Error("Homepage must feature four distinct decision guides.");

const hub = await readFile(resolve("dist", "contexts", "index.html"), "utf8");
if (!hub.includes("<title>Decision guides for real choices | Cognitive Biases</title>")) throw new Error("Decision Guides hub title is missing.");
if (!hub.includes("<h1>Start with the decision, not the bias name.</h1>")) throw new Error("Decision Guides hub H1 is missing.");
if (!hub.includes('class="guide-jumps"')) throw new Error("Decision Guides hub is missing topic jump links.");
for (const group of config.groups || []) {
  if (!hub.includes(`id="${group.slug}"`)) throw new Error(`Decision Guides hub is missing group ${group.slug}.`);
  if (!hub.includes(`>${group.title}</h2>`)) throw new Error(`Decision Guides hub is missing visible heading ${group.title}.`);
  for (const slug of group.contexts) {
    if (!hub.includes(`href="/contexts/${slug}/"`)) throw new Error(`Decision Guides hub does not link context ${slug}.`);
  }
}

const schemas = [...hub.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
const graphSchema = schemas.find((schema) => Array.isArray(schema?.["@graph"]) && schema["@graph"].some((node) => node?.["@id"] === `${SITE}/contexts/#page`));
if (!graphSchema) throw new Error("Decision Guides hub structured data graph is missing.");
const graph = graphSchema["@graph"];
const page = graph.find((node) => node?.["@id"] === `${SITE}/contexts/#page`);
const list = graph.find((node) => node?.["@id"] === `${SITE}/contexts/#contexts`);
const breadcrumb = graph.find((node) => node?.["@id"] === `${SITE}/contexts/#breadcrumb`);
if (page?.name !== "Decision guides for real choices | Cognitive Biases") throw new Error("Decision Guides CollectionPage name is stale.");
if (page?.mainEntity?.["@id"] !== `${SITE}/contexts/#contexts`) throw new Error("Decision Guides CollectionPage does not identify its ItemList.");
if (list?.numberOfItems !== allSlugs.size) throw new Error("Decision Guides ItemList count does not match context data.");
if (!breadcrumb || breadcrumb["@type"] !== "BreadcrumbList") throw new Error("Decision Guides hub BreadcrumbList is missing.");

const home = await readFile(resolve("dist", "index.html"), "utf8");
if (!home.includes('class="section home-guides"')) throw new Error("Homepage is missing Decision Guides discovery section.");
if (!home.includes("Decision guides for the questions people actually have.")) throw new Error("Homepage Decision Guides heading is missing.");
for (const slug of config.homepageFeatured || []) {
  if (!home.includes(`href="/contexts/${slug}/"`)) throw new Error(`Homepage is missing featured guide ${slug}.`);
}
if (!home.includes('href="/contexts/">Browse all decision guides</a>')) throw new Error("Homepage is missing Decision Guides hub CTA.");

const llms = await readFile("llms.txt", "utf8");
if (!/Decision guides: https:\/\/cognitive-biases\.github\.io\/contexts\//.test(llms)) throw new Error("llms.txt does not describe /contexts/ as Decision guides.");
if (!/start here when the situation is known but the bias name is not/i.test(llms)) throw new Error("llms.txt is missing Decision Guides usage guidance.");

console.log(`Decision Guides discovery check passed: ${allSlugs.size} contexts grouped once, structured hub verified, and ${config.homepageFeatured.length} high-value guides linked from homepage.`);
