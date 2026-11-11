import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_ORIGIN, RELAY_ORIGIN, legacyRedirectIssues, livePageIssues,
  liveUrl, sitemapOriginIssues, httpLinkCanonical,
} from "./live-origin-policy.mjs";

const page = `${RELAY_ORIGIN}/explore/`;

test("legacy homepage must permanently redirect to the exact relay root", () => {
  assert.deepEqual(legacyRedirectIssues(301, `${RELAY_ORIGIN}/`), []);
  assert.deepEqual(legacyRedirectIssues(308, `${RELAY_ORIGIN}/`), []);
  assert.match(legacyRedirectIssues(302, `${RELAY_ORIGIN}/`).join(" "), /301\/308/);
  assert.match(legacyRedirectIssues(301, "https://other.example/").join(" "), /expected exact relay/);
  assert.match(legacyRedirectIssues(200, null).join(" "), /expected exact relay/);
});

test("only the reviewed source and relay origins are accepted", () => {
  assert.equal(liveUrl(`${LEGACY_ORIGIN}/explore/`), page);
  assert.equal(liveUrl(page), page);
  assert.throws(() => liveUrl("https://evil.example/explore/"), /Unapproved/);
});

test("live sitemap must be on the relay with relay-only clean URLs", () => {
  assert.deepEqual(sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, [page]), []);
  assert.match(sitemapOriginIssues(`${LEGACY_ORIGIN}/sitemap.xml`, [page]).join(" "), /expected relay/);
  assert.match(sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, [`${LEGACY_ORIGIN}/explore/`]).join(" "), /non-canonical/);
  assert.match(sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, ["https://evil.example/"]).join(" "), /unapproved/);
  assert.match(sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, [page + "?token=1"]).join(" "), /non-canonical/);
});

test("normal migrated pages require same path and self-canonical after routing", () => {
  assert.deepEqual(livePageIssues(`${LEGACY_ORIGIN}/`, `${RELAY_ORIGIN}/`, `${RELAY_ORIGIN}/`), []);
  assert.deepEqual(livePageIssues(page, page, page), []);
  assert.match(livePageIssues(page, "https://other.example/explore/", "https://other.example/explore/").join(" "), /unexpected redirect/);
  assert.match(livePageIssues(page, `${RELAY_ORIGIN}/wrong/`, `${RELAY_ORIGIN}/wrong/`).join(" "), /unexpected redirect/);
  assert.match(livePageIssues(page, page, `${LEGACY_ORIGIN}/explore/`).join(" "), /HTML canonical/);
  assert.match(livePageIssues(page, page, null).join(" "), /HTML canonical/);
});

test("HTTP Link rel=canonical is parsed with quoted, unquoted and multi-token relations", () => {
  for (const rel of ['rel="canonical"', "rel='canonical'", "rel=canonical", 'rel="alternate canonical"']) {
    assert.equal(httpLinkCanonical(`<${page}>; ${rel}`, page), page);
  }
  assert.equal(httpLinkCanonical(`<https://elsewhere.example/>; rel=alternate, <${page}>; rel="canonical"`, page), page);
  assert.equal(httpLinkCanonical(`<${page}>; rel="alternate"`, page), null);
  assert.equal(httpLinkCanonical(`</wrong/>; rel="canonical"`, page), `${RELAY_ORIGIN}/wrong/`);
});

test("reviewed 308-migrated pages must not remain in the relay sitemap", () => {
  for (const path of [
    "/biases/heuristic-bias-availability-bias/",
    "/biases/cognitive-rigidity-functional-fixedness/",
    "/biases/cognitive-bias-outcome-bias/",
    "/biases/prospect-theory-status-quo-bias/",
  ]) {
    const violations = sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, [`${RELAY_ORIGIN}${path}`]);
    assert.match(violations.join(" "), /redirecting page must not be listed/);
  }
  assert.deepEqual(sitemapOriginIssues(`${RELAY_ORIGIN}/sitemap.xml`, [page]), []);
});
