import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const identity = JSON.parse(await readFile("config/site-identity.json", "utf8"));
const SITE = identity.siteUrl;
const ORIGIN = new URL(SITE).origin;
const hardIssues = [];
const watches = [];

function attrs(tag) {
  const out = {};
  const body = String(tag).replace(/^<\/?[\w:-]+\s*/i, "").replace(/\/?\s*>$/, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return out;
}

function htmlCanonical(html, baseUrl) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (!String(a.rel || "").toLowerCase().split(/\s+/).includes("canonical") || !a.href) continue;
    try { return new URL(a.href, baseUrl).href; } catch { return null; }
  }
  return null;
}

function httpCanonical(linkHeader, baseUrl) {
  if (!linkHeader) return null;
  const matches = [...String(linkHeader).matchAll(/<([^>]+)>\s*;([^,]*)/g)];
  for (const match of matches) {
    if (!/\brel\s*=\s*(?:"[^"]*\bcanonical\b[^"]*"|'[^']*\bcanonical\b[^']*'|canonical)\b/i.test(match[2])) continue;
    try { return new URL(match[1], baseUrl).href; } catch { return null; }
  }
  return null;
}

function negativeHeaderDirectives(value) {
  const raw = String(value || "").toLowerCase().replace(/\s+/g, "");
  const found = [];
  for (const signal of ["noindex", "none", "nofollow", "nosnippet", "noimageindex", "max-snippet:0", "max-image-preview:none", "max-video-preview:0"]) {
    if (raw.includes(signal)) found.push(signal);
  }
  if (/unavailable_after:/i.test(raw)) found.push("unavailable_after");
  return [...new Set(found)];
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", ...options });
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
  throw lastError || new Error(`Unable to fetch ${url}`);
}

const sitemapResponse = await fetchWithRetry(`${SITE}sitemap.xml`);
if (!sitemapResponse.ok) throw new Error(`Live Technical SEO Critic: sitemap HTTP ${sitemapResponse.status}`);
const sitemap = await sitemapResponse.text();
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim()).filter(Boolean);
if (!sitemapUrls.length) throw new Error("Live Technical SEO Critic: sitemap has no URLs");

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
for (const requestedUrl of sample) {
  const response = await fetchWithRetry(requestedUrl, { headers: { "user-agent": "cognitive-biases-technical-seo-critic/0.1" } });
  const finalUrl = response.url || requestedUrl;
  if (!response.ok) {
    hardIssues.push(`${requestedUrl}: live HTTP ${response.status}`);
    await response.body?.cancel?.();
    continue;
  }
  if (new URL(finalUrl).origin !== ORIGIN) hardIssues.push(`${requestedUrl}: redirected off canonical origin to ${finalUrl}`);
  const html = await response.text();
  const htmlCan = htmlCanonical(html, finalUrl);
  const linkCan = httpCanonical(response.headers.get("link"), finalUrl);
  if (!htmlCan) hardIssues.push(`${requestedUrl}: live HTML canonical missing`);
  if (linkCan && htmlCan && linkCan !== htmlCan) hardIssues.push(`${requestedUrl}: HTTP Link canonical ${linkCan} conflicts with HTML canonical ${htmlCan}`);
  const restrictions = negativeHeaderDirectives(response.headers.get("x-robots-tag"));
  if (restrictions.length) hardIssues.push(`${requestedUrl}: live X-Robots-Tag restricts a sitemap URL: ${restrictions.join(", ")}`);

  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  if (etag || lastModified) {
    validatorCount += 1;
    const headers = { "user-agent": "cognitive-biases-technical-seo-critic/0.1" };
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
if (hardIssues.length) {
  console.error(`Live Technical SEO Critic found ${hardIssues.length} hard issue(s):`);
  for (const issue of hardIssues) console.error(`- ${issue}`);
  throw new Error("Live Technical SEO Critic failed");
}

console.log(`Live Technical SEO Critic passed ${sample.length} bounded sitemap URLs: no HTTP/HTML canonical conflict, no negative X-Robots-Tag restriction, and ${validated304}/${validatorCount} validator-bearing responses revalidated with 304. Core Web Vitals remain provider/field owner data.`);
