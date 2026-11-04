/**
 * Deployment-only contract for the staged Cognitive Biases relay.
 * The build still uses the legacy source identity; these are live HTTP checks.
 * Keep this explicit rather than trusting a redirect or sitemap to choose its own origin.
 */
export const LEGACY_ORIGIN = "https://cognitive-biases.github.io";
export const RELAY_ORIGIN = "https://cognitive-biases-move.vedokrok.com";

export function liveUrl(value) {
  const parsed = new URL(value);
  if (parsed.origin !== LEGACY_ORIGIN && parsed.origin !== RELAY_ORIGIN) {
    throw new Error(`Unapproved Cognitive Biases source URL: ${value}`);
  }
  return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, `${RELAY_ORIGIN}/`).href;
}

export function legacyRedirectIssues(status, location) {
  const issues = [];
  if (status !== 301 && status !== 308) {
    issues.push(`legacy homepage: expected permanent HTTP 301/308 to relay, got ${status}`);
  }
  let target;
  try { target = new URL(location, `${LEGACY_ORIGIN}/`).href; } catch { /* Invalid location is an error. */ }
  if (target !== `${RELAY_ORIGIN}/`) {
    issues.push(`legacy homepage: expected exact relay destination, got ${target || location || "(missing)"}`);
  }
  return issues;
}

// Reviewed, live 308 mappings in Vedokrok Worker PR #292.
// These URLs may redirect, but should not be submitted as canonical sitemap entries.
export const MOVED_BIAS_PATHS = new Set([
  "/biases/heuristic-bias-availability-bias/",
  "/biases/cognitive-rigidity-functional-fixedness/",
  "/biases/cognitive-bias-outcome-bias/",
  "/biases/prospect-theory-status-quo-bias/",
]);

export function sitemapOriginIssues(sitemapUrl, sitemapUrls) {
  const issues = [];
  if (sitemapUrl !== `${RELAY_ORIGIN}/sitemap.xml`) {
    issues.push(`live sitemap: expected relay URL, got ${sitemapUrl}`);
  }
  if (!sitemapUrls.length) issues.push("live sitemap: no canonical URLs");
  for (const value of sitemapUrls) {
    try {
      const url = new URL(value);
      if (url.origin !== RELAY_ORIGIN || url.username || url.password || url.search || url.hash) {
        issues.push(`live sitemap: non-canonical or unapproved URL ${value}`);
      }
      if (url.origin === RELAY_ORIGIN && MOVED_BIAS_PATHS.has(url.pathname)) {
        issues.push(`live sitemap: redirecting page must not be listed as canonical URL ${value}`);
      }
    } catch { issues.push(`live sitemap: invalid URL ${value}`); }
  }
  return issues;
}

export function livePageIssues(requestedUrl, finalUrl, htmlCanonical) {
  const issues = [];
  let expected;
  try { expected = liveUrl(requestedUrl); }
  catch (error) { return [String(error.message || error)]; }
  if (finalUrl !== expected) {
    issues.push(`${requestedUrl}: unexpected redirect ${finalUrl} (expected ${expected})`);
  }
  if (htmlCanonical !== finalUrl) {
    issues.push(`${requestedUrl}: HTML canonical ${htmlCanonical || "missing"} does not equal live URL ${finalUrl}`);
  }
  return issues;
}

/**
 * Parse a canonical HTTP Link target even when rel is quoted (the common case).
 * Distinct Link entries are comma-delimited; relation tokens are whitespace-delimited.
 */
export function httpLinkCanonical(linkHeader, baseUrl) {
  if (!linkHeader) return null;
  for (const entry of String(linkHeader).split(/,(?=\s*<)/)) {
    const target = entry.match(/^\s*<([^>]+)>/);
    if (!target) continue;
    const rel = entry.match(/(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s;,]+))/i);
    if (!rel || !(rel[1] ?? rel[2] ?? rel[3]).toLowerCase().split(/\s+/).includes("canonical")) continue;
    try { return new URL(target[1], baseUrl).href; } catch { return null; }
  }
  return null;
}
