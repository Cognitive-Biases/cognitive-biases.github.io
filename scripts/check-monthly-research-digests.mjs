import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data/monthly-research-digests.json", "utf8"));
const allowedDelta = new Set(["strengthens", "narrows", "new context", "watch only"]);
const allowedConfidence = new Set(["strong", "moderate", "provisional"]);
const slugs = new Set();
const signalIds = new Set();

assert.equal(data.version, 1, "monthly digest schema version must be 1");
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt || ""), "updatedAt must be YYYY-MM-DD");
assert.ok(Array.isArray(data.digests) && data.digests.length > 0, "at least one digest is required");

for (const digest of data.digests) {
  assert.ok(/^\d{4}-\d{2}$/.test(digest.slug || ""), `invalid digest slug: ${digest.slug}`);
  assert.ok(!slugs.has(digest.slug), `duplicate digest slug: ${digest.slug}`);
  slugs.add(digest.slug);
  for (const field of ["month", "title", "publishedAt", "summary", "editorialNote"]) {
    assert.ok(String(digest[field] || "").trim(), `${digest.slug}: missing ${field}`);
  }
  assert.ok(Array.isArray(digest.takeaways) && digest.takeaways.length >= 3, `${digest.slug}: needs at least three takeaways`);
  assert.ok(Array.isArray(digest.signals) && digest.signals.length >= 3, `${digest.slug}: needs at least three research signals`);
  assert.ok(Array.isArray(digest.whatChanged) && digest.whatChanged.length > 0, `${digest.slug}: needs project changes`);
  assert.ok(Array.isArray(digest.nextQuestions) && digest.nextQuestions.length > 0, `${digest.slug}: needs follow-up questions`);

  for (const signal of digest.signals) {
    assert.ok(signal.id && !signalIds.has(signal.id), `${digest.slug}: duplicate or missing signal id ${signal.id}`);
    signalIds.add(signal.id);
    assert.ok(allowedDelta.has(signal.delta), `${signal.id}: unsupported delta ${signal.delta}`);
    assert.ok(allowedConfidence.has(signal.confidence), `${signal.id}: unsupported confidence ${signal.confidence}`);
    for (const field of ["title", "finding", "whyItMatters", "practicalCheck", "siteAction", "sourceStatus"]) {
      assert.ok(String(signal[field] || "").trim(), `${signal.id}: missing ${field}`);
    }
    assert.ok(signal.source?.title && signal.source?.url, `${signal.id}: source title and URL are required`);
    assert.ok(/^https:\/\//.test(signal.source.url), `${signal.id}: source must use HTTPS`);
    if (signal.delta === "watch only") assert.equal(signal.confidence, "provisional", `${signal.id}: watch-only items must stay provisional`);
  }
}

console.log(`Validated ${data.digests.length} monthly research digest(s) and ${signalIds.size} research signals.`);
