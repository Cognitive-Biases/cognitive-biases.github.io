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
const rfc822Date = (value) => new Date(isoDate(value)).toUTCString();

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

const atomItems = entries.map((entry) => {
  const updated = isoDate(entry.updatedAt || entry.publishedAt);
  const published = isoDate(entry.publishedAt || entry.updatedAt);
  const category = entry.kind === "digest" ? '<category term="monthly-digest" label="Monthly research digest"/>' : '<category term="research-note" label="Research note"/>';
  return `<entry><title>${escapeXml(entry.title)}</title><link href="${entry.url}" rel="alternate" type="text/html"/><id>${entry.url}</id><published>${published}</published><updated>${updated}</updated>${category}<summary type="text">${escapeXml(entry.summary)}</summary></entry>`;
}).join("");

const atomFeed = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>Cognitive Biases Research</title><subtitle>Reviewed research notes and monthly evidence updates on cognitive biases, decision making and decisions made with AI.</subtitle><link href="${SITE}/research/feed.xml" rel="self" type="application/atom+xml"/><link href="${SITE}/research/" rel="alternate" type="text/html"/><id>${SITE}/research/</id><updated>${feedUpdated}</updated>${atomItems}</feed>\n`;
await writeFile(join(OUT, "research", "feed.xml"), atomFeed);

const rssItems = entries.map((entry) => {
  const category = entry.kind === "digest" ? "Monthly research digest" : "Research note";
  return `<item><title>${escapeXml(entry.title)}</title><link>${entry.url}</link><guid isPermaLink="true">${entry.url}</guid><pubDate>${rfc822Date(entry.publishedAt || entry.updatedAt)}</pubDate><category>${category}</category><description>${escapeXml(entry.summary)}</description></item>`;
}).join("");

const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Cognitive Biases updates</title><link>${SITE}/</link><description>Reviewed research notes and monthly evidence updates on cognitive biases, decision making and decisions made with AI.</description><language>en</language><lastBuildDate>${rfc822Date(latestDate)}</lastBuildDate><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>${rssItems}</channel></rss>\n`;
await writeFile(join(OUT, "feed.xml"), rssFeed);

const targets = [
  join(OUT, "index.html"),
  join(OUT, "research", "index.html"),
  join(OUT, "research", "digests", "index.html"),
  ...entries.map((entry) => entry.path)
];
for (const path of targets) {
  let html = await readFile(path, "utf8");
  let changed = false;
  if (!html.includes('type="application/rss+xml"')) {
    html = html.replace("</head>", `<link rel="alternate" type="application/rss+xml" title="Cognitive Biases updates" href="/feed.xml"></head>`);
    changed = true;
  }
  if (!html.includes('type="application/atom+xml"')) {
    html = html.replace("</head>", `<link rel="alternate" type="application/atom+xml" title="Cognitive Biases Research" href="/research/feed.xml"></head>`);
    changed = true;
  }
  if (changed) await writeFile(path, html);
}

const robotsPath = join(OUT, "robots.txt");
let robots = await readFile(robotsPath, "utf8");
const cleanedRobots = robots
  .split(/\r?\n/)
  .filter((line) => !/^Sitemap:\s+\S*(?:feed|rss|atom)\.xml\s*$/i.test(line.trim()))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trimEnd() + "\n";
if (cleanedRobots !== robots) await writeFile(robotsPath, cleanedRobots);

const digestCount = entries.filter((entry) => entry.kind === "digest").length;
console.log(`Generated RSS 2.0 feed with ${entries.length} entries at /feed.xml and preserved Atom research feed (${digestCount} monthly digest(s)); feed URLs are not advertised as sitemaps.`);