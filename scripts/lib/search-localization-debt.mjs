// Review deadlines describe manual verification debt, not generated-site correctness.
// Keep overdue items visible without silently treating them as completed.
export const REQUIRED_SEARCH_LOCALIZATION_DEBT_IDS = Object.freeze([
  'search-console-generative-ai-owner-data',
  'browser-accessibility-tree-locales',
]);

const STATES = new Set(['blocked-owner-data', 'bounded-manual-verification']);

function fail(message) {
  throw new Error('search_localization_policy:' + message);
}

function dateStamp(value, label) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    fail(label + ': invalid review date');
  }
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    fail(label + ': invalid calendar date');
  }
  return timestamp;
}

export function inspectSearchLocalizationDebt(ledger, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const now = dateStamp(today, 'current date');
  if (!ledger || !Array.isArray(ledger.entries)) fail('missing debt entries');

  const ids = new Set();
  const overdue = [];
  for (const item of ledger.entries) {
    if (!item || typeof item !== 'object') fail('malformed debt entry');
    const id = item.id;
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) {
      fail('duplicate or missing debt id ' + (id || '(missing)'));
    }
    ids.add(id);
    if (!STATES.has(item.state)) fail(id + ': unsupported debt state ' + item.state);
    for (const field of ['reason', 'scope', 'affectedSurface', 'nextAction', 'reviewCondition']) {
      if (typeof item[field] !== 'string' || !item[field].trim()) fail(id + ': missing ' + field);
    }
    if (!Array.isArray(item.affectedLocales) || !item.affectedLocales.length ||
        item.affectedLocales.some((locale) => typeof locale !== 'string' || !locale.trim())) {
      fail(id + ': invalid affectedLocales');
    }
    const due = dateStamp(item.reviewBy, id);
    if (due < now) overdue.push({
      id,
      reviewBy: item.reviewBy,
      state: item.state,
      nextAction: item.nextAction,
    });
  }
  for (const id of REQUIRED_SEARCH_LOCALIZATION_DEBT_IDS) {
    if (!ids.has(id)) fail('missing bounded verification debt ' + id);
  }
  return { count: ids.size, overdue };
}

export function formatSearchLocalizationDebtSummary(result) {
  const lines = [
    '## Search/localization manual review debt',
    '',
    'Repository/site checks are separate from owner-only and browser manual review.',
    'An overdue entry remains open; a successful build does not close it.',
    '',
  ];
  if (!result.overdue.length) {
    lines.push('No review deadline is overdue. Open debt entries are still tracked in data/search-localization-debt.json.');
  } else {
    lines.push('**' + result.overdue.length + ' manual review(s) overdue.** No deadlines were changed.');
    lines.push('');
    for (const item of result.overdue) {
      lines.push('- **' + item.id + '**: due ' + item.reviewBy + '; still open.');
      lines.push('  - Next: ' + item.nextAction.replaceAll('\n', ' ').replaceAll('\r', ' '));
    }
  }
  return lines.join('\n') + '\n';
}
