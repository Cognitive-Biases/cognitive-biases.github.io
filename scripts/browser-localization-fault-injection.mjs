import { chromium } from 'playwright';
import { inspectRenderedPage, exerciseKeyboard, runPseudoStress } from './browser-localization-support.mjs';

const browser = await chromium.launch({ headless: true });
const findings = [];
const required = new Set([
  'english-accessible-name',
  'hidden-focusable',
  '320-overflow',
  'focus-indicator',
  'expanded-text-fragility',
]);
const observed = new Set();
const outDir = '.artifacts/localization-browser/fault-injection';

try {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.setContent(`<!doctype html>
<html lang="de"><head><style>
body{margin:0}.overflow-probe{width:420px;height:1px}.no-focus:focus{outline:none;box-shadow:none}
.stress-shell{width:110px;overflow:hidden;white-space:nowrap}.stress-shell button{max-width:100%;overflow:hidden;white-space:nowrap}
</style></head><body>
<div class="overflow-probe"></div>
<button class="no-focus" aria-label="Search">Suchen</button>
<div aria-hidden="true"><button>Versteckt</button></div>
<nav class="stress-shell"><button>Entscheidungsprüfung</button></nav>
</body></html>`);

  const state = await inspectRenderedPage(page, { expectedLang: 'de', lightweight: false });
  if (state.suspiciousAttrs.some((item) => item.attr === 'aria-label' && item.value === 'Search')) observed.add('english-accessible-name');
  if (state.hiddenFocusable.length > 0) observed.add('hidden-focusable');
  if (state.rootOverflow > 1) observed.add('320-overflow');

  await exerciseKeyboard(page, {
    outDir,
    locale: 'de',
    archetype: 'fault-injection',
    path: '/fault-injection/',
    viewport: { name: 'small-mobile', width: 320, height: 568 },
    onFinding: (_severity, type, _locale, _path, _viewport, details) => {
      findings.push({ type, details });
      if (type === 'focus-indicator-weak') observed.add('focus-indicator');
    },
  });

  const stress = await runPseudoStress(page, { expansion: 0.45 });
  if (stress.clipped > 0 || stress.outside > 0 || stress.rootOverflow > 1) observed.add('expanded-text-fragility');

  await context.close();
} finally {
  await browser.close();
}

const missing = [...required].filter((name) => !observed.has(name));
if (missing.length) {
  console.error(`browser_fault_injection: detector missed ${missing.join(', ')}`);
  console.error(JSON.stringify({ observed: [...observed], findings }, null, 2));
  process.exit(1);
}
console.log(`browser_fault_injection: OK (${[...observed].join(', ')})`);
