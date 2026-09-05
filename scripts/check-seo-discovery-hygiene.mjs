import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const digests = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));
const sitemap = await readFile(join(OUT, "sitemap.xml"), "utf8");
const robots = await readFile(join(OUT, "robots.txt"), "utf8");
const feed = await readFile(join(OUT, "research", "feed.xml"), "utf8");

const urlBlock = (path) => {
  const loc = `<loc>${SITE}${path}</loc>`;
  const start = sitemap.indexOf(loc);
  if (start < 0) throw new Error(`Sitemap is missing ${path}.`);
  const open = sitemap.lastIndexOf("<url>", start);
  const close = sitemap.indexOf("</url>", start);
  return sitemap.slice(open, close + 6);
};
const expectedDate = (value) => String(value).slice(0, 10);

const researchBlock = urlBlock("/research/");
if (!researchBlock.includes(`<lastmod>${expectedDate(notes.updatedAt)}</lastmod>`)) throw new Error("Research hub lastmod must use the maintained research-notes date.");
for (const note of notes.entries || []) {
  const block = urlBlock(`/research/${note.slug}/`);
  const date = expectedDate(note.updatedAt || note.publishedAt);
  if (!block.includes(`<lastmod>${date}</lastmod>`)) throw new Error(`${note.slug}: sitemap lastmod does not match the content date.`);
}

const digestHubBlock = urlBlock("/research/digests/");
if (!digestHubBlock.includes(`<lastmod>${expectedDate(digests.updatedAt)}</lastmod>`)) throw new Error("Monthly digest hub lastmod must use the maintained digest date.");
for (const digest of digests.digests || []) {
  const block = urlBlock(`/research/digests/${digest.slug}/`);
  const date = expectedDate(digest.publishedAt || digests.updatedAt);
  if (!block.includes(`<lastmod>${date}</lastmod>`)) throw new Error(`${digest.slug}: monthly digest sitemap lastmod does not match the content date.`);
}

for (const path of ["/data/", "/partners/"]) {
  const block = urlBlock(path);
  if (block.includes("<lastmod>")) throw new Error(`${path}: lastmod must be omitted until the page has a reliable maintained content date.`);
}

if (!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) throw new Error("Research feed is not valid Atom 1.0 markup.");
if (!feed.includes(`<link href="${SITE}/research/feed.xml" rel="self" type="application/atom+xml"/>`)) throw new Error("Research feed is missing its self link.");
const feedEntries = (feed.match(/<entry>/g) || []).length;
const expectedFeedEntries = (notes.entries || []).length + (digests.digests || []).length;
if (feedEntries !== expectedFeedEntries) throw new Error(`Research feed has ${feedEntries} entries for ${expectedFeedEntries} expected research publications.`);

for (const note of notes.entries || []) {
  const url = `${SITE}/research/${note.slug}/`;
  if (!feed.includes(`<id>${url}</id>`)) throw new Error(`${note.slug}: research feed entry is missing.`);
  const html = await readFile(join(OUT, "research", note.slug, "index.html"), "utf8");
  if (!html.includes('rel="alternate" type="application/atom+xml"')) throw new Error(`${note.slug}: page does not advertise the research feed.`);
}
for (const digest of digests.digests || []) {
  const url = `${SITE}/research/digests/${digest.slug}/`;
  if (!feed.includes(`<id>${url}</id>`)) throw new Error(`${digest.slug}: monthly digest feed entry is missing.`);
  const html = await readFile(join(OUT, "research", "digests", digest.slug, "index.html"), "utf8");
  if (!html.includes('rel="alternate" type="application/atom+xml"')) throw new Error(`${digest.slug}: monthly digest page does not advertise the research feed.`);
}

const researchHtml = await readFile(join(OUT, "research", "index.html"), "utf8");
if (!researchHtml.includes('rel="alternate" type="application/atom+xml"')) throw new Error("Research hub does not advertise the Atom feed.");
const digestHubHtml = await readFile(join(OUT, "research", "digests", "index.html"), "utf8");
if (!digestHubHtml.includes('rel="alternate" type="application/atom+xml"')) throw new Error("Monthly digest hub does not advertise the Atom feed.");
const dataHtml = await readFile(join(OUT, "data", "index.html"), "utf8");
if (!dataHtml.includes('href="/data/monthly-research-digests.json"')) throw new Error("Data page does not expose monthly research digest JSON.");
if (!dataHtml.includes('href="/schemas/monthly-research-digests.schema.json"')) throw new Error("Data page does not expose the monthly research digest schema.");
const digestSchema = JSON.parse(await readFile(join(OUT, "schemas", "monthly-research-digests.schema.json"), "utf8"));
if (digestSchema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error("Monthly digest schema dialect is incorrect.");
if (digestSchema.$id !== `${SITE}/schemas/monthly-research-digests.schema.json`) throw new Error("Monthly digest schema ID is incorrect.");

if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) throw new Error("robots.txt is missing the XML sitemap.");
if (!robots.includes(`Sitemap: ${SITE}/research/feed.xml`)) throw new Error("robots.txt is missing the research Atom feed sitemap.");

console.log(`SEO discovery hygiene passed: ${feedEntries} feed entries (${(digests.digests || []).length} monthly digest(s)), truthful Research lastmod values, public digest data + schema, and no fabricated lastmod for undated resource pages.`);
