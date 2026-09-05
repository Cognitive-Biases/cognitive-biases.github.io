import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = "https://cognitive-biases.github.io";
const OUT = "dist";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const digests = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));

const escapeXml = (value = "") => String(value).replace(/[<>&"']/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;"
})[character]);
const isoDate = (value) => `${String(value).slice(0, 10)}T00:00:00Z`;

const entries = [
  ...(notes.entries || []).map((note) => ({
    kind: "note",
    slug: note.slug,
    title: note.title,
    summary: note.summary,
    publishedAt: note.publishedAt,
    updatedAt: note.updatedAt || note.publishedAt,
    url: `${SITE}/research/${note.slug}/`,
    path: join(OUT, "research", note.slug, "index.html")
  })),
  ...(digests.digests || []).map((digest) => ({
    kind: "digest",
    slug: digest.slug,
    title: digest.title,
    summary: digest.summary,
    publishedAt: digest.publishedAt,
    updatedAt: digest.publishedAt,
    url: `${SITE}/research/digests/${digest.slug}/`,
    path: join(OUT, "research", "digests", digest.slug, "index.html")
  }))
].sort((a, b) => String(b.updatedAt || b.publishedAt || "").localeCompare(String(a.updatedAt || a.publishedAt || "")) || a.url.localeCompare(b.url));

const latestDate = [notes.updatedAt, digests.updatedAt, entries[0]?.updatedAt, entries[0]?.publishedAt].filter(Boolean).sort().at(-1) || "1970-01-01";
const feedUpdated = isoDate(latestDate);

const items = entries.map((entry) => {
  const updated = isoDate(entry.updatedAt || entry.publishedAt);
  const published = isoDate(entry.publishedAt || entry.updatedAt);
  const category = entry.kind === "digest" ? '<category term="monthly-digest" label="Monthly research digest"/>' : '<category term="research-note" label="Research note"/>';
  return `<entry><title>${escapeXml(entry.title)}</title><link href="${entry.url}" rel="alternate" type="text/html"/><id>${entry.url}</id><published>${published}</published><updated>${updated}</updated>${category}<summary type="text">${escapeXml(entry.summary)}</summary></entry>`;
}).join("");

const feed = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>Cognitive Biases Research</title><subtitle>Reviewed research notes and monthly evidence updates on cognitive biases, decision making and decisions made with AI.</subtitle><link href="${SITE}/research/feed.xml" rel="self" type="application/atom+xml"/><link href="${SITE}/research/" rel="alternate" type="text/html"/><id>${SITE}/research/</id><updated>${feedUpdated}</updated>${items}</feed>\n`;
await writeFile(join(OUT, "research", "feed.xml"), feed);

const targets = [
  join(OUT, "research", "index.html"),
  join(OUT, "research", "digests", "index.html"),
  ...entries.map((entry) => entry.path)
];
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

const digestCount = entries.filter((entry) => entry.kind === "digest").length;
console.log(`Generated Atom research feed with ${entries.length} entries (${digestCount} monthly digest(s)) and advertised it in robots.txt.`);
