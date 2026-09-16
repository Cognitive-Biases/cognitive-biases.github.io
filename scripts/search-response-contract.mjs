import assert from "node:assert/strict";

// Deterministic checks for this site's approved sitemap HTML, not Google indexing proof.
const decode = (value = "") => String(value).replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (whole, name) => {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  if (name[0] !== "#") return named[name.toLowerCase()] ?? whole;
  const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});

function attrs(tag) {
  const result = {};
  const body = tag.replace(/^<\/?[\w:-]+\s*/i, "").replace(/\/?\s*>$/, "");
  for (const match of body.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase();
    if (!(name in result)) result[name] = decode(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

const clean = (html) => String(html).replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<(script|style|title|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
const resolve = (value, base) => { try { return value ? new URL(value, base).href : null; } catch { return null; } };

export function httpCanonicals(value, base) {
  const links = [];
  let start = 0, quote = "", angled = false, escaped = false;
  const raw = String(value || "");
  for (let i = 0; i <= raw.length; i += 1) {
    const char = raw[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (angled) {
      if (char === ">") angled = false;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "<") angled = true;
    else if (char === "," || i === raw.length) { links.push(raw.slice(start, i)); start = i + 1; }
  }
  return links.flatMap((entry) => {
    const target = entry.match(/^\s*<([^>]*)>/);
    if (!target) return [];
    const parameters = entry.slice(target[0].length);
    const rel = parameters.match(/(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]+))/i);
    if (!rel || !(rel[1] ?? rel[2] ?? rel[3]).toLowerCase().split(/\s+/).includes("canonical")) return [];
    return [resolve(target[1], base)];
  });
}

export function searchRestrictions(value) {
  const raw = String(value || "").toLowerCase();
  const found = [];
  for (const signal of ["noindex", "none", "nofollow", "nosnippet", "noimageindex"]) {
    if (new RegExp(`(?:^|[,;\\s:])${signal}(?=$|[,;\\s])`).test(raw)) found.push(signal);
  }
  for (const [name, setting] of [["max-snippet", "0"], ["max-image-preview", "none"], ["max-video-preview", "0"]]) {
    if (new RegExp(`(?:^|[,;\\s])${name}\\s*:\\s*${setting}(?=$|[,;\\s])`).test(raw)) found.push(`${name}:${setting}`);
  }
  if (/\bunavailable_after\s*:/.test(raw)) found.push("unavailable_after");
  return found;
}

export function inspectSearchResponse({ requestedUrl, finalUrl = requestedUrl, status = 200, contentType = "text/html", html = "", link = "", xRobotsTag = "" }) {
  const issues = [];
  if (status !== 200) issues.push(`expected GET 200, received ${status}`);
  if (!/^text\/html(?:\s*;|$)/i.test(contentType)) issues.push(`expected HTML, received ${contentType || "missing content-type"}`);
  if (finalUrl !== requestedUrl) issues.push(`sitemap URL redirected to ${finalUrl}`);
  const markup = clean(html);
  const head = markup.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (head == null) issues.push("missing explicit HTML head");
  const baseTag = head?.match(/<base\b[^>]*>/i)?.[0];
  const base = baseTag ? resolve(attrs(baseTag).href, finalUrl) || finalUrl : finalUrl;
  const canonical = [...(head || "").matchAll(/<link\b[^>]*>/gi)].flatMap((match) => {
    const a = attrs(match[0]);
    return String(a.rel || "").toLowerCase().split(/\s+/).includes("canonical") ? [resolve(a.href, base)] : [];
  });
  if (canonical.length !== 1 || canonical[0] !== requestedUrl) issues.push(`expected one self HTML canonical, received ${JSON.stringify(canonical)}`);
  const http = httpCanonicals(link, finalUrl);
  if (http.some((url) => url !== requestedUrl)) issues.push(`HTTP Link canonical conflicts with sitemap owner: ${JSON.stringify(http)}`);
  for (const match of markup.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    const name = String(a.name || "").toLowerCase();
    if (!["robots", "googlebot", "bingbot"].includes(name)) continue;
    const restrictions = searchRestrictions(a.content);
    if (restrictions.length) issues.push(`${name} restrictions: ${restrictions.join(", ")}`);
  }
  const restrictions = searchRestrictions(xRobotsTag);
  if (restrictions.length) issues.push(`X-Robots-Tag restrictions require review: ${restrictions.join(", ")}`);
  return issues;
}

export function runSearchResponseFixtures() {
  const url = "https://example.test/guide/";
  const html = `<html><head><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"></head><body>Example</body></html>`;
  const good = { requestedUrl: url, html };
  assert.deepEqual(inspectSearchResponse(good), []);
  for (const rel of ['"canonical"', "'canonical'", "canonical", '"alternate canonical"']) {
    assert.deepEqual(httpCanonicals(`<${url}>; rel=${rel}`, url), [url]);
    assert(inspectSearchResponse({ ...good, link: `<https://example.test/wrong/>; rel=${rel}` }).some((x) => x.includes("HTTP Link")));
  }
  assert.deepEqual(httpCanonicals(`<${url}?a=1,2>; title="A, B"; rel="canonical", <${url}>; rel="alternate"`, url), [`${url}?a=1,2`]);
  for (const patch of [
    { xRobotsTag: "NoIndex, follow" }, { xRobotsTag: "googlebot: noindex" },
    { status: 403 }, { contentType: "application/json" }, { finalUrl: "https://example.test/" },
    { html: html.replace("</head>", '<meta name="googlebot" content="noindex"></head>') },
    { html: html.replace("</head>", '<meta name="bingbot" content="none"></head>') },
    { html: html.replace("</head>", `<link rel="canonical" href="https://example.test/wrong/"></head>`) },
    { html: html.replace(url, "https://wrong.example/") },
    { html: html.replace(/<link[^>]+>/, "") },
  ]) assert(inspectSearchResponse({ ...good, ...patch }).length > 0, JSON.stringify(patch));
  const inert = '<!-- <meta name="robots" content="noindex"> --><script>const example = \'<meta name="robots" content="noindex">\';</script><template><link rel="canonical" href="/wrong/"></template>';
  assert.deepEqual(inspectSearchResponse({ ...good, html: html.replace("</head>", `${inert}</head>`) }), []);
  assert.deepEqual(searchRestrictions("max-snippet:-1, max-image-preview:large, index,follow"), []);
  assert.deepEqual(inspectSearchResponse({ ...good, html: html.replace("Example", "A noindex example in prose") }), []);
  console.log("Search response fixtures passed: quoted HTTP canonical conflicts, live meta/header restrictions, duplicate/missing/wrong canonical, GET denial, representation and inert examples.");
}
