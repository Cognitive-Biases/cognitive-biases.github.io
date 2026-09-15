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
  'visible-clipped-text',
  'small-control-target',
  'sr-only-exempt',
  'inline-text-link-exempt',
  'reverse-focus-navigation',
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
.visible-clip{display:block;width:40px;overflow:hidden;white-space:nowrap}.tiny-control{width:12px;height:12px;padding:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style></head><body>
<div class="overflow-probe"></div>
<button class="no-focus" aria-label="Search">Suchen</button>
<div aria-hidden="true"><button>Versteckt</button></div>
<nav class="stress-shell"><button>Entscheidungsprüfung</button></nav>
<span class="visible-clip">Absichtlich sichtbar abgeschnittener Text</span>
<button class="tiny-control" aria-label="Klein"></button>
<p>Dies ist ein <a href="#inline">Inline-Link</a> im Satz.</p>
<h2 class="sr-only">Nur für Hilfstechnologien</h2>
<a href="#reverse-before">Vorheriger Fokus</a>
<button data-browser-reverse-probe>Rückwärtsfalle</button>
<script>document.querySelector('[data-browser-reverse-probe]').addEventListener('keydown',function(event){if(event.key==='Tab'&&event.shiftKey)event.preventDefault()})</script>
</body></html>`);

  const state = await inspectRenderedPage(page, { expectedLang: 'de', lightweight: false });
  if (state.suspiciousAttrs.some((item) => item.attr === 'aria-label' && item.value === 'Search')) observed.add('english-accessible-name');
  if (state.hiddenFocusable.length > 0) observed.add('hidden-focusable');
  if (state.rootOverflow > 1) observed.add('320-overflow');
  if (state.clippedText.some((item) => item.selector.includes('visible-clip'))) observed.add('visible-clipped-text');
  if (state.tinyTargets.some((item) => item.selector.includes('tiny-control'))) observed.add('small-control-target');
  if (!state.clippedText.some((item) => item.selector.includes('sr-only'))) observed.add('sr-only-exempt');
  if (!state.tinyTargets.some((item) => item.text === 'Inline-Link')) observed.add('inline-text-link-exempt');

  await exerciseKeyboard(page, {
    outDir,
    locale: 'de',
    archetype: 'fault-injection',
    path: '/fault-injection/',
    viewport: { name: 'small-mobile', width: 320, height: 568 },
    onFinding: (_severity, type, _locale, _path, _viewport, details) => {
      findings.push({ type, details });
      if (type === 'focus-indicator-weak') observed.add('focus-indicator');
      if (type === 'reverse-focus-static') observed.add('reverse-focus-navigation');
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
