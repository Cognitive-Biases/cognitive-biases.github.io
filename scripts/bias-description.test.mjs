import test from "node:test";
import assert from "node:assert/strict";
import { renderDescription, descriptionSnippet } from "./bias-description.mjs";

test("legacy and reviewed sections preserve claims, lists and limits", () => {
  const html = renderDescription("Definition.\n\n🔍 Where’s the trap?\n- A < B\n- Second case\n\nA better check\n- Record the evidence.\n\nThis does not prove causation.");
  assert.match(html, /<h2>Examples and situations<\/h2><ul><li>A &lt; B<\/li><li>Second case<\/li><\/ul>/);
  assert.match(html, /<h2>Questions to check<\/h2><ul>/);
  assert.match(html, /<p>This does not prove causation\.<\/p>/);
  assert.doesNotMatch(html, /countermeasure|avoid it/);
});
test("unrecognised prose remains visible without manufactured headings", () => {
  assert.match(renderDescription("Definition.\n\nA finding that is uncertain."), /<p>A finding that is uncertain\.<\/p>/);
  assert.equal(descriptionSnippet("An estimate – even a careful one – can change.\n\nMore."), "An estimate – even a careful one – can change.");
  const snippet = descriptionSnippet("A long phrase ".repeat(30), 80);
  assert.ok(snippet.length <= 80);
  assert.ok(snippet.endsWith("…"));
});
