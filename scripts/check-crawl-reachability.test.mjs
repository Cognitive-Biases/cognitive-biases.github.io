import test from 'node:test';
import assert from 'node:assert/strict';
import { crawlTargets, crawlDepths } from './check-crawl-reachability.mjs';
const root = 'https://cognitive-biases.github.io/';
const page = root + 'explore/';
const leaf = root + 'biases/example/';
test('only actual followable anchors reach canonical pages', () => {
  const html = `<script>const x='<a href="${leaf}">fake</a>'</script><!-- <a href="${leaf}">fake</a> --><a href='/explore/#topic'>Catalog</a><a href='${leaf}' rel='NOFOLLOW'>Blocked</a><a href='${leaf}?filter=x'>Variant</a><a href='https://example.com/'>External</a>`;
  assert.deepEqual([...crawlTargets(html, root, new Set([root, page, leaf]))], [page]);
});
test('reachability handles cycles without treating inbound-only orphan clusters as reachable', () => {
  const orphan = root + 'orphan/';
  const edges = new Map([[root, new Set([page])], [page, new Set([leaf])], [leaf, new Set([root])], [orphan, new Set([leaf])]]);
  assert.deepEqual([...crawlDepths(edges, root)], [[root, 0], [page, 1], [leaf, 2]]);
});
