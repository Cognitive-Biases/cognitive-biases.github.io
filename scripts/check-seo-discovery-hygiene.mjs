import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
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
for (const path of ["/data/", "/partners/"]) {
  const block = urlBlock(path);
  if (block.includes("<lastmod>")) throw new Error(`${path}: lastmod must be omitted until the page has a reliable maintained content date.`);
}

if (!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) throw new Error("Research feed is not valid Atom 1.0 markup.");
if (!feed.includes(`<link href="${SITE}/research/feed.xml" rel="self" type="application/atom+xml"/>`)) throw new Error("Research feed is missing its self link.");
const feedEntries = (feed.match(/<entry>/g) || []).length;
if (feedEntries !== (notes.entries || []).length) throw new Error(`Research feed has ${feedEntries} entries for ${(notes.entries || []).length} research notes.`);
for (const note of notes.entries || []) {
  const url = `${SITE}/research/${note.slug}/`;
  if (!feed.includes(`<id>${url}</id>`)) throw new Error(`${note.slug}: research feed entry is missing.`);
  const html = await readFile(join(OUT, "research", note.slug, "index.html"), "utf8");
  if (!html.includes('rel="alternate" type="application/atom+xml"')) throw new Error(`${note.slug}: page does not advertise the research feed.`);
}
const researchHtml = await readFile(join(OUT, "research", "index.html"), "utf8");
if (!researchHtml.includes('rel="alternate" type="application/atom+xml"')) throw new Error("Research hub does not advertise the Atom feed.");

if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) throw new Error("robots.txt is missing the XML sitemap.");
if (!robots.includes(`Sitemap: ${SITE}/research/feed.xml`)) throw new Error("robots.txt is missing the research Atom feed sitemap.");

console.log(`SEO discovery hygiene passed: ${feedEntries} feed entries, truthful Research lastmod values, and no fabricated lastmod for undated resource pages.`);
