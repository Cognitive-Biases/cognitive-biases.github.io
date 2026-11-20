import { readFile, appendFile } from 'node:fs/promises';
import {
  inspectSearchLocalizationDebt,
  formatSearchLocalizationDebtSummary,
} from './lib/search-localization-debt.mjs';

const ledger = JSON.parse(await readFile('data/search-localization-debt.json', 'utf8'));
const result = inspectSearchLocalizationDebt(ledger);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, formatSearchLocalizationDebtSummary(result), 'utf8');
}
if (result.overdue.length) {
  for (const item of result.overdue) {
    console.error('::error file=data/search-localization-debt.json,title=Overdue manual review::' +
      item.id + ': review was due ' + item.reviewBy + ' and remains open');
  }
  console.error('search_localization_review: ' + result.overdue.length +
    ' overdue manual review(s); update only after evidence-backed review.');
  process.exitCode = 1;
} else {
  console.log('search_localization_review: no overdue deadlines; ' + result.count +
    ' open bounded verification obligation(s) remain tracked.');
}
