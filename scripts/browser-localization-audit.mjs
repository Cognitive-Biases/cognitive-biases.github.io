#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = new URL(process.env.BASE_URL || 'https://cognitive-biases.github.io/');
const TARGET = process.env.AUDIT_TARGET || (BASE_URL.hostname === 'cognitive-biases.github.io' ? 'live' : 'built');
const OUT = process.env.AUDIT_OUT || join('artifacts', 'browser-localization-audit', TARGET);
const CONSENT_KEY = 'portfolio_analytics_consent';
const manifest = JSON.parse(await readFile('data/locales.json', 'utf8'));
const canonicalLocale = manifest.canonicalLocale || 'en';
const locales = (manifest.locales || []).map((locale) => ({
  ...locale,
  route: locale.code === canonicalLocale ? '/' : locale.urlBase || `/${locale.code.toLowerCase()}/`
}));
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 }
];
const consentExpected = {
  en: { label: 'Analytics settings', allow: 'Allow', decline: 'Decline' },
  de: { label: 'Analyse-Einstellungen', allow: 'Erlauben', decline: 'Ablehnen' },
  ru: { label: 'Настройки аналитики', allow: 'Разрешить', decline: 'Отклонить' },
  fr: { label: 'Paramètres d’analyse', allow: 'Autoriser', decline: 'Refuser' },
  'pt-BR': { label: 'Configurações de análise', allow: 'Permitir', decline: 'Recusar' },
  es: { label: 'Configuración de analítica', allow: 'Permitir', decline: 'Rechazar' },
  it: { label: 'Impostazioni di analisi', allow: 'Consenti', decline: 'Rifiuta' }
};
const interactiveRoles = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'menuitem', 'tab']);
const report = {
  version: '1.2',
  generatedAt: new Date().toISOString(),
  target: TARGET,
  baseUrl: BASE_URL.href,
  browser: null,
  locales: [],
  findings: [],
  totals: { blockers: 0, warnings: 0, info: 0 }
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
report.browser = await browser.version();

try {
  for (const locale of locales) {
    const localeDir = join(OUT, safe(locale.code));
    await mkdir(localeDir, { recursive: true });
    const localeResult = { code: locale.code, route: locale.route, consent: null, states: [], representativeContentUrl: null };
    report.locales.push(localeResult);

    localeResult.consent = await auditConsentState(locale, localeDir);

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
        locale: locale.code,
        colorScheme: 'light'
      });
      await context.addInitScript((key) => {
        try { localStorage.setItem(key, 'no'); } catch {}
      }, CONSENT_KEY);
      const page = await context.newPage();
      page.setDefaultTimeout(12_000);
      const stateDir = join(localeDir, viewport.name);
      await mkdir(stateDir, { recursive: true });

      const home = await auditPage({ page, context, locale, viewport, url: new URL(locale.route, BASE_URL).href, label: 'home', stateDir, requireSwitcher: true });
      localeResult.states.push(home);
      if (!localeResult.representativeContentUrl && home.representativeContentUrl) localeResult.representativeContentUrl = home.representativeContentUrl;

      if (viewport.name === 'mobile') localeResult.states.push(await stressLongStrings({ page, locale, stateDir }));

      if (localeResult.representativeContentUrl) {
        const content = await auditPage({ page, context, locale, viewport, url: localeResult.representativeContentUrl, label: 'representative-content', stateDir, requireSwitcher: false });
        localeResult.states.push(content);
        if (viewport.name === 'mobile') localeResult.states.push(await exerciseControls({ page, context, locale, stateDir }));
      }

      await context.close();
    }
  }
} finally {
  await browser.close();
}

report.totals.blockers = report.findings.filter((item) => item.severity === 'blocker').length;
report.totals.warnings = report.findings.filter((item) => item.severity === 'warning').length;
report.totals.info = report.findings.filter((item) => item.severity === 'info').length;
await writeFile(join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(OUT, 'REPORT.md'), renderMarkdown(report));
console.log(`Browser localization audit: ${report.totals.blockers} blocker(s), ${report.totals.warnings} warning(s), ${report.totals.info} info; evidence: ${OUT}`);
if (report.totals.blockers) process.exitCode = 1;

async function auditConsentState(locale, localeDir) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: locale.code, colorScheme: 'light' });
  const page = await context.newPage();
  const dir = join(localeDir, 'consent-mobile');
  await mkdir(dir, { recursive: true });
  let result;
  try {
    await page.goto(new URL(locale.route, BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    const box = page.locator('[data-analytics-consent], [role="dialog"][aria-label]').first();
    try { await box.waitFor({ state: 'visible', timeout: 4_000 }); } catch {}
    if (await box.count() === 0 || !(await box.isVisible().catch(() => false))) {
      finding('blocker', locale.code, 'mobile', 'consent', 'analytics consent dialog did not appear for a fresh browser context');
      return { found: false };
    }
    const observed = await box.evaluate((el) => ({
      ariaLabel: el.getAttribute('aria-label') || '',
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      buttons: [...el.querySelectorAll('button')].map((button) => (button.textContent || '').trim())
    }));
    const expected = consentExpected[locale.code] || consentExpected.en;
    if (observed.ariaLabel !== expected.label) finding('blocker', locale.code, 'mobile', 'consent', `consent accessible label is ${JSON.stringify(observed.ariaLabel)}, expected ${JSON.stringify(expected.label)}`);
    if (!observed.buttons.includes(expected.allow) || !observed.buttons.includes(expected.decline)) {
      finding('blocker', locale.code, 'mobile', 'consent', 'consent actions are not localized as expected', { observed: observed.buttons, expected: [expected.allow, expected.decline] });
    }
    if (locale.code !== 'en' && /We use optional analytics|Analytics settings|\bAllow\b|\bDecline\b/.test(`${observed.ariaLabel} ${observed.text}`)) {
      finding('blocker', locale.code, 'mobile', 'consent', 'English analytics consent fallback is visible on a localized page', observed);
    }
    await saveEvidence({ page, context, dir, stem: 'consent-mobile', preferFullPage: false });
    result = { found: true, ...observed };
  } finally {
    await context.close();
  }
  return result;
}

async function auditPage({ page, context, locale, viewport, url, label, stateDir, requireSwitcher }) {
  const stem = `${label}-${viewport.name}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.waitForTimeout(350);
  const status = response?.status() ?? 0;
  if (status < 200 || status >= 400) finding('blocker', locale.code, viewport.name, label, `HTTP ${status} for ${url}`);

  const metadata = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  if (normalizeLocale(metadata.lang) !== normalizeLocale(locale.code)) finding('blocker', locale.code, viewport.name, label, `html lang is ${metadata.lang || 'missing'}, expected ${locale.code}`);

  const layout = await scanLayout(page);
  if (layout.documentOverflowPx > 2) finding('blocker', locale.code, viewport.name, label, `horizontal document overflow ${layout.documentOverflowPx}px`, layout.actionableOffscreen.slice(0, 8));
  if (layout.actionableOffscreen.length) finding('warning', locale.code, viewport.name, label, `${layout.actionableOffscreen.length} visible interactive/text element(s) extend outside the viewport`, layout.actionableOffscreen.slice(0, 8));

  const switcher = requireSwitcher ? await inspectLocaleSwitcher(page, locale) : null;
  if (requireSwitcher && !switcher.found) finding('blocker', locale.code, viewport.name, label, 'visible locale switcher not found');
  if (requireSwitcher && switcher.found && switcher.visibleLinks !== locales.length - 1) finding('blocker', locale.code, viewport.name, label, `locale switcher exposes ${switcher.visibleLinks} visible links, expected ${locales.length - 1}`);
  if (requireSwitcher && switcher.found && switcher.activeLang !== normalizeLocale(locale.code)) finding('blocker', locale.code, viewport.name, label, `locale switcher active language is ${switcher.activeLang || 'missing'}, expected ${locale.code}`);

  const focus = await keyboardFocusAudit(page, 45, join(stateDir, `${stem}-first-focus.webp`));
  if (!focus.sequence.length) finding('blocker', locale.code, viewport.name, label, 'Tab navigation produced no focusable target');
  const unsafe = focus.sequence.find((item) => !item.visible || item.offscreen || item.obscured);
  if (unsafe) finding('blocker', locale.code, viewport.name, label, `keyboard focus target is not safely perceivable at step ${unsafe.step}`, unsafe);
  const weak = focus.sequence.filter((item) => item.focusVisible && !item.styleDeltaVisible);
  if (weak.length) finding('warning', locale.code, viewport.name, label, `${weak.length} focus-visible target(s) have no detected visual-style delta`, weak.slice(0, 5));

  await saveEvidence({ page, context, dir: stateDir, stem, preferFullPage: true });
  await writeFile(join(stateDir, `${stem}-focus.json`), `${JSON.stringify(focus, null, 2)}\n`);
  await writeFile(join(stateDir, `${stem}-layout.json`), `${JSON.stringify(layout, null, 2)}\n`);

  const axTree = await fullAxTree(context, page);
  const unnamed = (axTree.nodes || [])
    .filter((node) => !node.ignored && interactiveRoles.has(node.role?.value) && !String(node.name?.value || '').trim())
    .map((node) => ({ nodeId: node.nodeId, backendDOMNodeId: node.backendDOMNodeId, role: node.role?.value }))
    .slice(0, 30);
  if (unnamed.length) finding('blocker', locale.code, viewport.name, label, `${unnamed.length} interactive accessibility-tree node(s) have no accessible name`, unnamed);

  const representativeContentUrl = label === 'home' ? await pickRepresentativeContentUrl(page) : null;
  return { type: label, viewport: viewport.name, url: page.url(), status, metadata, layout, switcher, focusSummary: { steps: focus.sequence.length, weakVisualFocus: weak.length }, unnamedAxNodes: unnamed.length, representativeContentUrl };
}

async function inspectLocaleSwitcher(page, locale) {
  return page.evaluate(({ currentCode }) => {
    const root = document.querySelector('[data-localization-graph-switcher="true"], .locale-switch-bar');
    if (!root) return { found: false, visibleLinks: 0, activeLang: null, links: [] };
    const links = [...root.querySelectorAll('a[href]')].map((a) => {
      const rect = a.getBoundingClientRect();
      const style = getComputedStyle(a);
      return { text: (a.textContent || '').trim(), href: a.href, lang: a.lang || null, visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' };
    });
    const active = root.querySelector('[aria-current="page"]');
    return { found: true, visibleLinks: links.filter((item) => item.visible).length, activeLang: (active?.getAttribute('lang') || '').toLowerCase(), currentCode, ariaLabel: root.getAttribute('aria-label'), links };
  }, { currentCode: locale.code });
}

async function scanLayout(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const actionableOffscreen = [];
    for (const el of document.querySelectorAll('body *')) {
      if (actionableOffscreen.length >= 50) break;
      if (el.matches('.skip:not(:focus)')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const outside = rect.right > vw + 2 || rect.left < -2;
      if (!outside) continue;
      const interactive = el.matches('a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])');
      const meaningfulText = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      if (!interactive && !meaningfulText) continue;
      actionableOffscreen.push({ tag: el.tagName.toLowerCase(), id: el.id || null, className: typeof el.className === 'string' ? el.className.slice(0, 140) : null, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160), rect: { left: round(rect.left), right: round(rect.right), width: round(rect.width) } });
    }
    return { viewportWidth: vw, scrollWidth: sw, documentOverflowPx: Math.max(0, sw - vw), actionableOffscreen };
    function round(n) { return Math.round(n * 10) / 10; }
  });
}

async function keyboardFocusAudit(page, maxSteps, firstFocusPath) {
  await resetFocus(page);
  const sequence = [];
  const seen = new Set();
  for (let step = 1; step <= maxSteps; step += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(35);
    if (step === 1 && firstFocusPath) await page.screenshot({ path: firstFocusPath, fullPage: false, type: 'webp', quality: 78, animations: 'disabled' });
    const item = await page.evaluate((stepNumber) => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || el === document.body || el === document.documentElement) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const centerX = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
      const centerY = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
      const hit = rect.width > 0 && rect.height > 0 ? document.elementFromPoint(centerX, centerY) : null;
      const focusedFingerprint = fingerprint(style);
      let baseFingerprint = null;
      if (el.parentElement) {
        const clone = el.cloneNode(true);
        clone.removeAttribute('id');
        clone.setAttribute('tabindex', '-1');
        clone.setAttribute('aria-hidden', 'true');
        clone.style.position = 'fixed';
        clone.style.left = '-10000px';
        clone.style.top = '0';
        el.parentElement.appendChild(clone);
        baseFingerprint = fingerprint(getComputedStyle(clone));
        clone.remove();
      }
      const delta = baseFingerprint ? Object.keys(focusedFingerprint).some((key) => focusedFingerprint[key] !== baseFingerprint[key]) : true;
      return {
        step: stepNumber,
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        role: el.getAttribute('role'),
        href: el instanceof HTMLAnchorElement ? el.href : null,
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 180),
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        offscreen: rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight,
        obscured: Boolean(hit && hit !== el && !el.contains(hit) && !hit.contains(el)),
        hitTarget: hit ? { tag: hit.tagName?.toLowerCase() || null, id: hit.id || null, className: typeof hit.className === 'string' ? hit.className.slice(0, 120) : null } : null,
        focusVisible: el.matches(':focus-visible'),
        styleDeltaVisible: delta || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
        rect: { left: round(rect.left), top: round(rect.top), right: round(rect.right), bottom: round(rect.bottom) }
      };
      function fingerprint(s) { return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, boxShadow: s.boxShadow, borderColor: s.borderColor, backgroundColor: s.backgroundColor, color: s.color, textDecorationLine: s.textDecorationLine }; }
      function round(n) { return Math.round(n * 10) / 10; }
    }, step);
    if (!item) continue;
    const key = `${item.tag}|${item.id || ''}|${item.href || ''}|${item.text}`;
    if (seen.has(key) && sequence.length >= 3) break;
    seen.add(key);
    sequence.push(item);
  }
  return { sequence };
}

async function resetFocus(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(30);
}

async function exerciseControls({ page, context, locale, stateDir }) {
  const result = { type: 'controls', viewport: 'mobile', search: false, select: false };
  const search = page.locator('input[type="search"], [role="search"] input').filter({ visible: true }).first();
  if (await search.count()) {
    const query = await page.evaluate(() => {
      const candidate = document.querySelector('main article, main .card, main [data-bias], main li');
      const word = (candidate?.textContent || 'bias').trim().split(/\s+/)[0].replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 14);
      return word || 'bias';
    });
    await search.fill(query);
    await page.waitForTimeout(250);
    const layout = await scanLayout(page);
    if (layout.documentOverflowPx > 2) finding('blocker', locale.code, 'mobile', 'search-control', `search state creates ${layout.documentOverflowPx}px horizontal overflow`, layout.actionableOffscreen.slice(0, 8));
    await saveEvidence({ page, context, dir: stateDir, stem: 'controls-search-mobile', preferFullPage: true });
    result.search = true;
    result.searchQuery = query;
  }

  const select = page.locator('select').filter({ visible: true }).first();
  if (await select.count()) {
    const options = await select.locator('option').evaluateAll((items) => items.map((item) => ({ value: item.value, disabled: item.disabled })).filter((item) => item.value && !item.disabled));
    if (options.length) {
      await select.selectOption(options[0].value);
      await page.waitForTimeout(200);
      const layout = await scanLayout(page);
      if (layout.documentOverflowPx > 2) finding('blocker', locale.code, 'mobile', 'filter-control', `filter state creates ${layout.documentOverflowPx}px horizontal overflow`, layout.actionableOffscreen.slice(0, 8));
      await saveEvidence({ page, context, dir: stateDir, stem: 'controls-filter-mobile', preferFullPage: true });
      result.select = true;
      result.selectedValue = options[0].value;
    }
  }

  if (!result.search && !result.select) finding('info', locale.code, 'mobile', 'controls', 'representative localized route has no visible search/filter control; state not applicable');
  return result;
}

async function stressLongStrings({ page, locale, stateDir }) {
  await page.goto(new URL(locale.route, BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.waitForTimeout(250);
  const touched = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('header a, nav a, .locale-switch-bar a, .locale-switch-bar [aria-current="page"], button, [role="button"], label, th')];
    let count = 0;
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > 100 || rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') continue;
      const span = document.createElement('span');
      span.dataset.auditExpansion = 'true';
      span.textContent = ` — ${text} ${text.slice(0, Math.min(text.length, 32))}`;
      el.appendChild(span);
      count += 1;
    }
    return count;
  });
  await page.waitForTimeout(80);
  const layout = await scanLayout(page);
  const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-audit-expansion]')].flatMap((el) => {
    const parent = el.parentElement;
    if (!parent) return [];
    const style = getComputedStyle(parent);
    if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && parent.scrollWidth > parent.clientWidth + 2) return [{ tag: parent.tagName.toLowerCase(), text: (parent.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180), clientWidth: parent.clientWidth, scrollWidth: parent.scrollWidth }];
    return [];
  }).slice(0, 30));
  await captureScreenshots(page, stateDir, 'long-string-stress-mobile', true);
  await writeFile(join(stateDir, 'long-string-stress-mobile.html'), await page.content());
  if (layout.documentOverflowPx > 2) finding('warning', locale.code, 'mobile', 'long-string-stress', `expanded labels create ${layout.documentOverflowPx}px horizontal overflow`, layout.actionableOffscreen.slice(0, 10));
  if (clipped.length) finding('warning', locale.code, 'mobile', 'long-string-stress', `${clipped.length} expanded label(s) are clipped by overflow rules`, clipped.slice(0, 10));
  return { type: 'long-string-stress', viewport: 'mobile', touched, layout, clipped };
}

async function saveEvidence({ page, context, dir, stem, preferFullPage }) {
  await captureScreenshots(page, dir, stem, preferFullPage);
  await writeFile(join(dir, `${stem}.html`), await page.content());
  await writeFile(join(dir, `${stem}.aria.yml`), await page.ariaSnapshot({ boxes: true, mode: 'ai' }));
  const axTree = await fullAxTree(context, page);
  await writeFile(join(dir, `${stem}.ax.json`), `${JSON.stringify(axTree, null, 2)}\n`);
}

async function captureScreenshots(page, dir, stem, preferFullPage) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(30);
  await page.screenshot({ path: join(dir, `${stem}.webp`), fullPage: false, type: 'webp', quality: 76, animations: 'disabled' });
  if (!preferFullPage) return;
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
  if (height <= 14000) {
    await page.screenshot({ path: join(dir, `${stem}-full.webp`), fullPage: true, type: 'webp', quality: 70, animations: 'disabled' });
  } else {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(60);
    await page.screenshot({ path: join(dir, `${stem}-bottom.webp`), fullPage: false, type: 'webp', quality: 76, animations: 'disabled' });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

async function fullAxTree(context, page) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Accessibility.enable');
    return await cdp.send('Accessibility.getFullAXTree');
  } finally {
    await cdp.detach();
  }
}

async function pickRepresentativeContentUrl(page) {
  return page.evaluate(() => {
    const current = location.pathname;
    const candidates = [...document.querySelectorAll('main a[href]')]
      .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter((item) => {
        try {
          const url = new URL(item.href, location.href);
          return url.origin === location.origin && url.pathname !== current && !/\.(json|xml|txt)$/i.test(url.pathname) && !url.hash;
        } catch { return false; }
      });
    const listing = candidates.find((item) => /\/(explor|biases\/?$)/i.test(new URL(item.href).pathname));
    const bias = candidates.find((item) => /\/bias(?:es)?\//i.test(new URL(item.href).pathname));
    return listing?.href || bias?.href || candidates[0]?.href || null;
  });
}

function finding(severity, locale, viewport, state, message, evidence = null) {
  report.findings.push({ severity, locale, viewport, state, message, evidence });
}

function normalizeLocale(value) {
  try { return new Intl.Locale(String(value || '')).toString().toLowerCase(); } catch { return String(value || '').toLowerCase(); }
}

function safe(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
}

function renderMarkdown(data) {
  const lines = [
    '# Browser localization audit',
    '',
    `- Target: \`${data.target}\``,
    `- Base URL: ${data.baseUrl}`,
    `- Browser: Chromium ${data.browser}`,
    `- Generated: ${data.generatedAt}`,
    `- Result: **${data.totals.blockers} blocker(s), ${data.totals.warnings} warning(s), ${data.totals.info} info**`,
    '',
    '## Locale evidence',
    '',
    '| Locale | Consent | Representative content | States |',
    '| --- | --- | --- | ---: |',
    ...data.locales.map((locale) => `| ${locale.code} | ${locale.consent?.found ? 'captured' : 'missing'} | ${locale.representativeContentUrl || 'not discovered'} | ${locale.states.length} |`),
    '',
    '## Findings',
    ''
  ];
  if (!data.findings.length) lines.push('No findings.');
  for (const item of data.findings) lines.push(`- **${item.severity.toUpperCase()}** \`${item.locale}\` / \`${item.viewport}\` / \`${item.state}\`: ${item.message}`);
  lines.push('', '## Evidence contract', '', 'Each locale captures the fresh consent state separately, then audits normal navigation with consent dismissed. Home and representative pages store viewport screenshots (plus bounded full-page or bottom screenshots), serialized DOM, Playwright ARIA snapshots, Chromium accessibility trees, keyboard focus sequences and layout scans. Mobile evidence also includes long-string expansion stress and search/filter states when present.');
  return `${lines.join('\n')}\n`;
}
