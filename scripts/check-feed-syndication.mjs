import { readFile } from "node:fs/promises";

const SITE = "https://cognitive-biases.github.io";
const notes = JSON.parse(await readFile("data/research-notes.json", "utf8"));
const digests = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));
const rss = await readFile("dist/feed.xml", "utf8");
const atom = await readFile("dist/research/feed.xml", "utf8");
const home = await readFile("dist/index.html", "utf8");
const research = await readFile("dist/research/index.html", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");

if (!rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) throw new Error("RSS XML declaration is missing.");
if (!rss.includes('<rss version="2.0"')) throw new Error("Canonical feed is not RSS 2.0.");
if (!rss.includes(`<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>`)) throw new Error("RSS self link is missing or non-canonical.");
if (!rss.includes("<language>en</language>")) throw new Error("RSS language is missing.");
if (!atom.includes('xmlns="http://www.w3.org/2005/Atom"')) throw new Error("Existing Atom compatibility feed was lost.");
for (const html of [home, research]) {
  if (!html.includes('rel="alternate" type="application/rss+xml"') || !html.includes('href="/feed.xml"')) throw new Error("RSS autodiscovery is missing from a primary entry point.");
}

const expectedUrls = [
  ...(notes.entries || []).map((note) => `${SITE}/research/${note.slug}/`),
  ...(digests.digests || []).map((digest) => `${SITE}/research/digests/${digest.slug}/`)
];
for (const url of expectedUrls) {
  if (!rss.includes(`<guid isPermaLink="true">${url}</guid>`)) throw new Error(`RSS is missing stable GUID for ${url}.`);
}
const itemCount = (rss.match(/<item>/g) || []).length;
if (itemCount !== expectedUrls.length) throw new Error(`RSS item count ${itemCount} does not match canonical source count ${expectedUrls.length}.`);

for (const line of robots.split(/\r?\n/)) {
  if (/^Sitemap:/i.test(line) && /(?:feed|rss|atom)\.xml/i.test(line)) throw new Error(`robots.txt incorrectly declares a feed as a sitemap: ${line}`);
}

const dates = [...rss.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((match) => Date.parse(match[1]));
if (dates.some(Number.isNaN)) throw new Error("RSS contains an invalid pubDate.");
for (let index = 1; index < dates.length; index += 1) {
  if (dates[index] > dates[index - 1]) throw new Error("RSS items are not deterministically ordered newest first.");
}

console.log(`RSS feed check passed: ${itemCount} canonical update item(s), autodiscovery present, Atom preserved, robots sitemap separation valid.`);
