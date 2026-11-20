import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectSearchLocalizationDebt,
  formatSearchLocalizationDebtSummary,
} from './lib/search-localization-debt.mjs';

const today = '2026-11-07';
function ledger() {
  return {
    entries: [
      {
        id: 'search-console-generative-ai-owner-data',
        state: 'bounded-manual-verification',
        reason: 'Owner UI was checked on October 28; actual data is private.',
        scope: 'owner data',
        affectedSurface: 'search-console-owner-data',
        affectedLocales: ['en', 'de'],
        nextAction: 'Repeat owner-only UI and export review.',
        reviewCondition: 'At next review.',
        reviewBy: '2026-11-04',
      },
      {
        id: 'browser-accessibility-tree-locales',
        state: 'bounded-manual-verification',
        reason: 'Limited browser coverage.',
        scope: 'browser evidence',
        affectedSurface: 'browser-agent-accessibility',
        affectedLocales: ['en', 'de'],
        nextAction: 'Review real Chromium artifacts and 390px behavior.',
        reviewCondition: 'After browser review.',
        reviewBy: '2026-11-04',
      },
    ],
  };
}

test('expired deadlines remain open, visible, and unchanged', () => {
  const data = ledger();
  const original = structuredClone(data);
  const result = inspectSearchLocalizationDebt(data, { today });
  assert.equal(result.count, 2);
  assert.deepEqual(result.overdue.map((item) => item.id), [
    'search-console-generative-ai-owner-data',
    'browser-accessibility-tree-locales',
  ]);
  assert.deepEqual(data, original);
  const summary = formatSearchLocalizationDebtSummary(result);
  assert.match(summary, /2 manual review\(s\) overdue/);
  assert.match(summary, /2026-11-04/);
  assert.match(summary, /Repeat owner-only UI/);
  assert.match(summary, /No deadlines were changed/);
});

test('review deadline is inclusive, without claiming closure', () => {
  const result = inspectSearchLocalizationDebt(ledger(), { today: '2026-11-04' });
  assert.deepEqual(result.overdue, []);
  assert.match(formatSearchLocalizationDebtSummary(result), /still tracked/);
});

test('owner-data blocked state remains an explicit supported obligation', () => {
  const data = ledger();
  data.entries[0].state = 'blocked-owner-data';
  assert.equal(inspectSearchLocalizationDebt(data, { today }).overdue.length, 2);
});

test('missing mandatory debt is not silently accepted', () => {
  const data = ledger();
  data.entries.pop();
  assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /missing bounded verification debt/);
});

test('closed or unsupported debt state cannot fake completion', () => {
  const data = ledger();
  data.entries[0].state = 'completed';
  assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /unsupported debt state/);
});

test('duplicate debt IDs fail deterministically', () => {
  const data = ledger();
  data.entries[1].id = data.entries[0].id;
  assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /duplicate or missing debt id/);
});

test('missing reason or next action remains blocking', () => {
  for (const field of ['reason', 'nextAction', 'reviewCondition']) {
    const data = ledger();
    data.entries[0][field] = ' ';
    assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /missing/);
  }
});

test('invalid calendar dates and malformed entries fail', () => {
  for (const invalidDate of ['2026-02-30', '2026-13-01', '2026-11-4', '']) {
    const data = ledger();
    data.entries[0].reviewBy = invalidDate;
    assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /invalid.*date/);
  }
  assert.throws(() => inspectSearchLocalizationDebt({ entries: null }, { today }), /missing debt entries/);
});

test('invalid locale scope does not become an apparent reviewed state', () => {
  const data = ledger();
  data.entries[0].affectedLocales = [];
  assert.throws(() => inspectSearchLocalizationDebt(data, { today }), /invalid affectedLocales/);
});
