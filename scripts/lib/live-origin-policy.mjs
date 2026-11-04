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
