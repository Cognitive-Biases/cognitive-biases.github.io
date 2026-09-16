import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { inspectSearchResponse, runSearchResponseFixtures } from "./search-response-contract.mjs";

runSearchResponseFixtures();
const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const SITE = identity.siteUrl;
const ORIGIN = new URL(SITE).origin;
const hardIssues = [];
const watches = [];

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), ...options });
      if (response.status >= 500 && attempt < attempts) {
        await response.body?.cancel?.();
        await sleep(1500 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(1500 * attempt);
    }
  }
  throw new Error(`Live retrieval unresolved for ${url}; no indexing conclusion`, { cause: lastError });
}

const sitemapResponse = await fetchWithRetry(`${SITE}sitemap.xml`);
if (!sitemapResponse.ok) throw new Error(`Live Technical SEO Critic: sitemap HTTP ${sitemapResponse.status}`);
const sitemap = await sitemapResponse.text();
// This repository emits one flat sitemap. Fail explicitly rather than sampling child XML as HTML.
if (/<sitemapindex\b/i.test(sitemap)) throw new Error("Live Technical SEO Critic: sitemap index needs an explicit cohort expansion; coverage unresolved");
const sitemapUrls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim().replaceAll("&amp;", "&")).filter(Boolean))];
if (!sitemapUrls.length) throw new Error("Live Technical SEO Critic: sitemap has no URLs");
for (const url of sitemapUrls) {
  if (new URL(url).origin !== ORIGIN) throw new Error(`Unexpected sitemap origin: ${url}`);
}

const preferredPrefixes = ["/biases/", "/explore/", "/evidence/", "/research/", "/compare/", "/contexts/"];
const sample = [SITE];
for (const prefix of preferredPrefixes) {
  const hit = sitemapUrls.find((value) => new URL(value).pathname.startsWith(prefix));
  if (hit && !sample.includes(hit)) sample.push(hit);
}
for (const value of sitemapUrls) {
  if (sample.length >= 12) break;
  if (!sample.includes(value)) sample.push(value);
}

let validatorCount = 0;
let validated304 = 0;
const observedAt = new Date().toISOString();
for (const requestedUrl of sample) {
  const response = await fetchWithRetry(requestedUrl, { headers: { "user-agent": "cognitive-biases-technical-seo-critic/0.2" } });
  const finalUrl = response.url || requestedUrl;
  console.log(`PROBE ${observedAt} GET ${requestedUrl} -> ${response.status} ${finalUrl} client=cognitive-biases-technical-seo-critic/0.2`);
  if (!response.ok) {
    hardIssues.push(`${requestedUrl}: live GET HTTP ${response.status} for this audit client; not verified Googlebot evidence`);
    await response.body?.cancel?.();
    continue;
  }
  const html = await response.text();
  for (const issue of inspectSearchResponse({
    requestedUrl, finalUrl, status: response.status,
    contentType: response.headers.get("content-type") || "", html,
    link: response.headers.get("link"), xRobotsTag: response.headers.get("x-robots-tag"),
  })) hardIssues.push(`${requestedUrl}: ${issue}`);

  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  if (etag || lastModified) {
    validatorCount += 1;
    const headers = { "user-agent": "cognitive-biases-technical-seo-critic/0.2" };
    if (etag) headers["if-none-match"] = etag;
    else headers["if-modified-since"] = lastModified;
    const revalidation = await fetchWithRetry(requestedUrl, { headers }, 2);
    if (revalidation.status === 304) validated304 += 1;
    else watches.push(`${requestedUrl}: validator present but conditional request returned ${revalidation.status}, not 304`);
    await revalidation.body?.cancel?.();
  }
}

if (validatorCount === 0) watches.push("TSC-05: sampled GitHub Pages responses expose no ETag/Last-Modified validator; treat as hosting/runtime evidence, not a ranking failure.");
else if (validated304 < validatorCount) watches.push(`TSC-05: ${validated304}/${validatorCount} sampled validator-bearing responses returned 304 on conditional revalidation.`);

for (const watch of watches) console.log(`WATCH: ${watch}`);
console.log(`COVERAGE: ${sample.filter((url) => sitemapUrls.includes(url)).length}/${sitemapUrls.length} sitemap URLs sampled plus homepage when absent; full generated cohort is covered by the separate final-artifact gate.`);
if (hardIssues.length) {
  console.error(`Live Technical SEO Critic found ${hardIssues.length} hard issue(s):`);
  for (const issue of hardIssues) console.error(`- ${issue}`);
  throw new Error("Live Technical SEO Critic failed");
}

console.log(`Live Technical SEO Critic passed ${sample.length} bounded GET probes: HTML representation, one self canonical, HTTP/HTML canonical parity, effective meta/header restrictions, and ${validated304}/${validatorCount} validator-bearing responses revalidated with 304. This is public response evidence for the named client, not a whole-site live audit, deployed-SHA proof, Google indexing, ranking or field Core Web Vitals.`);
