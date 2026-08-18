import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));

const escapeXml = (value = "") => String(value).replace(/[<>&"']/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;"
})[character]);
const isoDate = (value) => `${String(value).slice(0, 10)}T00:00:00Z`;
const entries = [...(notes.entries || [])]
  .sort((a, b) => String(b.updatedAt || b.publishedAt || "").localeCompare(String(a.updatedAt || a.publishedAt || "")) || a.slug.localeCompare(b.slug));
const feedUpdated = isoDate(notes.updatedAt || entries[0]?.updatedAt || entries[0]?.publishedAt || "1970-01-01");

const items = entries.map((note) => {
  const url = `${SITE}/research/${note.slug}/`;
  const updated = isoDate(note.updatedAt || note.publishedAt);
  const published = isoDate(note.publishedAt || note.updatedAt);
  return `<entry><title>${escapeXml(note.title)}</title><link href="${url}" rel="alternate" type="text/html"/><id>${url}</id><published>${published}</published><updated>${updated}</updated><summary type="text">${escapeXml(note.summary)}</summary></entry>`;
}).join("");

const feed = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>Cognitive Biases Research</title><subtitle>Reviewed research notes on cognitive biases, decision making and decisions made with AI.</subtitle><link href="${SITE}/research/feed.xml" rel="self" type="application/atom+xml"/><link href="${SITE}/research/" rel="alternate" type="text/html"/><id>${SITE}/research/</id><updated>${feedUpdated}</updated>${items}</feed>\n`;
await writeFile(join(OUT, "research", "feed.xml"), feed);

const targets = [join(OUT, "research", "index.html"), ...entries.map((note) => join(OUT, "research", note.slug, "index.html"))];
for (const path of targets) {
  let html = await readFile(path, "utf8");
  if (!html.includes('type="application/atom+xml"')) {
    html = html.replace("</head>", `<link rel="alternate" type="application/atom+xml" title="Cognitive Biases Research" href="/research/feed.xml"></head>`);
    await writeFile(path, html);
  }
}

const robotsPath = join(OUT, "robots.txt");
let robots = await readFile(robotsPath, "utf8");
const feedSitemap = `Sitemap: ${SITE}/research/feed.xml`;
if (!robots.includes(feedSitemap)) {
  robots = `${robots.trimEnd()}\n${feedSitemap}\n`;
  await writeFile(robotsPath, robots);
}

console.log(`Generated Atom research feed with ${entries.length} entries and advertised it in robots.txt.`);
