import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { normalizeVedokrokAnnouncement } from './vedokrok-announcement.mjs';

const source = await readFile('public/vedokrok-announcement.js', 'utf8');
const key = 'cognitive-biases:vedokrok-announcement:hidden';

// Exercise persistence, undo, early paint suppression and unavailable storage.
function browser(storage, unavailable = false) {
  const events = {};
  const dismiss = { hidden: true, focus() { doc.activeElement = this; } };
  const restore = { hidden: true, dataset: { hiddenMessage: 'Hidden', shownMessage: 'Shown' } };
  const next = { focus() { doc.activeElement = this; } };
  const banner = { hidden: false, closest: () => null, querySelector: () => dismiss };
  dismiss.closest = () => null;
  const status = { parentElement: { querySelector: () => restore } };
  const elements = { '[data-vedokrok-banner]': banner, '[data-vedokrok-dismiss]': dismiss, '[data-vedokrok-restore]': restore, '[data-vedokrok-status]': status };
  const doc = {
    documentElement: { dataset: {} }, readyState: 'loading', activeElement: null,
    querySelectorAll: selector => elements[selector] ? [elements[selector]] : [],
    querySelector: selector => elements[selector] || next,
    addEventListener: (name, callback) => { events[name] = callback; },
  };
  const localStorage = {
    getItem(name) { if (unavailable) throw new Error('Storage unavailable'); return storage.get(name) || null; },
    setItem(name, value) { if (unavailable) throw new Error('Storage unavailable'); storage.set(name, value); },
    removeItem(name) { if (unavailable) throw new Error('Storage unavailable'); storage.delete(name); },
  };
  vm.runInNewContext(source, { document: doc, localStorage, window: { addEventListener() {} } });
  const beforePaint = doc.documentElement.dataset.vedokrokAnnouncement;
  events.DOMContentLoaded();
  return { doc, banner, dismiss, restore, status, next, beforePaint, click(selector) { events.click({ target: { closest: candidate => candidate === selector ? elements[selector] : null } }); } };
}

const storage = new Map();
const first = browser(storage);
assert.equal(first.banner.hidden, false);
first.click('[data-vedokrok-dismiss]');
assert.equal(first.banner.hidden, true);
assert.equal(first.restore.hidden, false);
assert.equal(storage.get(key), 'true');
assert.equal(first.doc.activeElement, first.next);
assert.equal(first.status.textContent, 'Hidden');
const reload = browser(storage);
assert.equal(reload.beforePaint, 'hidden');
assert.equal(reload.banner.hidden, true);
reload.click('[data-vedokrok-restore]');
assert.equal(reload.banner.hidden, false);
assert.equal(reload.restore.hidden, true);
assert.equal(reload.doc.activeElement, reload.dismiss);
assert.equal(browser(storage).banner.hidden, false);
const blocked = browser(new Map(), true);
blocked.click('[data-vedokrok-dismiss]');
assert.equal(blocked.banner.hidden, true);
blocked.click('[data-vedokrok-restore]');
assert.equal(blocked.banner.hidden, false);

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}

let pages = 0;
for (const file of await htmlFiles('dist')) {
  const html = await readFile(file, 'utf8');
  assert.equal((html.match(/data-vedokrok-banner\b/g) || []).length, 1, `${file}: one announcement`);
  assert.equal((html.match(/data-vedokrok-script\b/g) || []).length, 1, `${file}: one script`);
  assert.equal((html.match(/data-vedokrok-restore\b/g) || []).length, 1, `${file}: one undo control`);
  assert.match(html.split('</head>')[0], /data-vedokrok-script/, `${file}: preference read before paint`);
  assert.equal(normalizeVedokrokAnnouncement(html), html, `${file}: idempotent markup`);
  assert.ok(!html.includes('Vedokrok goes further:'), `${file}: compact announcement copy`);
  pages += 1;
}
for (const image of ['mascot.webp', 'wordmark.webp']) assert.ok((await readFile(`dist/assets/vedokrok/${image}`)).length > 0);
console.log(`Vedokrok announcement passed: ${pages} pages, persistent dismissal, undo, early paint suppression and unavailable-storage fallback.`);
