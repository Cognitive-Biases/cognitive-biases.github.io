#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = new URL(process.env.BASE_URL || 'https://cognitive-biases.github.io/');
const TARGET = process.env.AUDIT_TARGET || (BASE_URL.hostname === 'cognitive-biases.github.io' ? 'live' : 'built');
const OUT = process.env.AUDIT_OUT || join('artifacts', 'browser-localization-audit', TARGET);
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
const interactiveRoles = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'menuitem', 'tab']);
const report = {
  version: '1.0',
  generatedAt: new Date().toISOString(),
  target: TARGET,
  baseUrl: BASE_URL.href,
  browser: null,
  viewports,
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
    const localeResult = { code: locale.code, route: locale.route, states: [], representativeContentUrl: null };
    report.locales.push(localeResult);

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
        locale: locale.code === 'pt-BR' ? 'pt-BR' : locale.code,
        colorScheme: 'light'
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12_000);
      const stateDir = join(localeDir, viewport.name);
      await mkdir(stateDir, { recursive: true });

      const home = await auditPage({ page, context, locale, viewport, route: locale.route, label: 'home', stateDir });
      localeResult.states.push(home);
      if (!localeResult.representativeContentUrl && home.representativeContentUrl) {
        localeResult.representativeContentUrl = home.representativeContentUrl;
      }

      if (viewport.name === 'mobile') {
        const searchState = await exerciseSearch({ page, locale, stateDir });
        if (searchState) localeResult.states.push(searchState);
        const stressState = await stressLongStrings({ page, locale, viewport, stateDir });
        localeResult.states.push(stressState);
      }

      if (localeResult.representativeContentUrl) {
        const contentUrl = new URL(localeResult.representativeContentUrl, BASE_URL);
        if (contentUrl.origin === BASE_URL.origin) {
          const content = await auditPage({
            page,
            context,
            locale,
            viewport,
            absoluteUrl: contentUrl.href,
            label: 'representative-content',
            stateDir
          });
          localeResult.states.push(content);
        }
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

async function auditPage({ page, context, locale, viewport, route, absoluteUrl, label, stateDir }) {
  const url = absoluteUrl || new URL(route, BASE_URL).href;
  const stem = `${label}-${viewport.name}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.waitForTimeout(500);
  const status = response?.status() ?? 0;
  if (status < 200 || status >= 400) finding('blocker', locale.code, viewport.name, label, `HTTP ${status} for ${url}`);

  const metadata = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
    forms: [...document.forms].map((form) => ({
      action: form.action || null,
      method: form.method || 'get',
      fields: [...form.elements].map((el) => ({
        tag: el.tagName?.toLowerCase(),
        type: el.type || null,
        name: el.name || null,
        required: Boolean(el.required),
        ariaLabel: el.getAttribute?.('aria-label') || null,
        id: el.id || null,
        hasLabel: Boolean(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || Boolean(el.closest?.('label'))
      }))
    }))
  }));

  if (normalizeLocale(metadata.lang) !== normalizeLocale(locale.code)) {
    finding('blocker', locale.code, viewport.name, label, `html lang is ${metadata.lang || 'missing'}, expected ${locale.code}`);
  }

  const layout = await scanLayout(page);
  if (layout.documentOverflowPx > 2) {
    finding('blocker', locale.code, viewport.name, label, `horizontal document overflow ${layout.documentOverflowPx}px`, layout.offscreen.slice(0, 8));
  }
  if (layout.offscreen.length) {
    finding('warning', locale.code, viewport.name, label, `${layout.offscreen.length} visible element(s) extend outside viewport`, layout.offscreen.slice(0, 8));
  }

  const switcher = label === 'home' ? await inspectLocaleSwitcher(page) : null;
  if (label === 'home') {
    const expected = locales.filter((item) => item.code !== locale.code).length;
    if (!switcher.found) finding('blocker', locale.code, viewport.name, label, 'visible locale switcher not found');
    else if (switcher.visibleLinks < expected) finding('blocker', locale.code, viewport.name, label, `locale switcher exposes ${switcher.visibleLinks} visible link(s), expected at least ${expected}`);
  }

  const focus = await keyboardFocusAudit(page, { maxSteps: 40 });
  if (focus.sequence.length === 0) finding('blocker', locale.code, viewport.name, label, 'Tab navigation produced no focusable target');
  for (const item of focus.sequence) {
    if (!item.visible || item.offscreen || item.obscured) {
      finding('blocker', locale.code, viewport.name, label, `keyboard focus target is not safely perceivable at step ${item.step}`, item);
      break;
    }
  }
  const weakFocus = focus.sequence.filter((item) => item.focusVisible && !item.styleDeltaVisible);
  if (weakFocus.length) finding('warning', locale.code, viewport.name, label, `${weakFocus.length} focus-visible target(s) have no detected visual-style delta`, weakFocus.slice(0, 5));

  await page.screenshot({ path: join(stateDir, `${stem}.webp`), fullPage: true, type: 'webp', quality: 72, animations: 'disabled' });
  if (focus.sequence.length) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(stateDir, `${stem}-focus.webp`), fullPage: false, type: 'webp', quality: 78, animations: 'disabled' });
  }

  const dom = await page.content();
  await writeFile(join(stateDir, `${stem}.html`), dom);
  const aria = await page.ariaSnapshot({ boxes: true, mode: 'ai' });
  await writeFile(join(stateDir, `${stem}.aria.yml`), aria);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const axTree = await cdp.send('Accessibility.getFullAXTree');
  await writeFile(join(stateDir, `${stem}.ax.json`), `${JSON.stringify(axTree, null, 2)}\n`);
  await cdp.detach();

  const unnamed = (axTree.nodes || [])
    .filter((node) => !node.ignored && interactiveRoles.has(node.role?.value) && !String(node.name?.value || '').trim())
    .map((node) => ({ nodeId: node.nodeId, backendDOMNodeId: node.backendDOMNodeId, role: node.role?.value }))
    .slice(0, 30);
  if (unnamed.length) finding('blocker', locale.code, viewport.name, label, `${unnamed.length} interactive accessibility-tree node(s) have no accessible name`, unnamed);

  const pageErrors = (await page.pageErrors()).map((error) => String(error.message || error)).slice(-20);
  const consoleErrors = (await page.consoleMessages())
    .filter((msg) => msg.type() === 'error')
    .map((msg) => msg.text())
    .slice(-20);
  if (pageErrors.length) finding('warning', locale.code, viewport.name, label, `${pageErrors.length} page error(s)`, pageErrors);
  if (consoleErrors.length) finding('warning', locale.code, viewport.name, label, `${consoleErrors.length} console error(s)`, consoleErrors);

  const representativeContentUrl = label === 'home' ? await pickRepresentativeContentUrl(page) : null;
  await writeFile(join(stateDir, `${stem}-focus.json`), `${JSON.stringify(focus, null, 2)}\n`);
  await writeFile(join(stateDir, `${stem}-layout.json`), `${JSON.stringify(layout, null, 2)}\n`);

  return {
    type: label,
    viewport: viewport.name,
    url: page.url(),
    status,
    metadata,
    layout,
    switcher,
    focusSummary: { steps: focus.sequence.length, weakVisualFocus: weakFocus.length },
    unnamedAxNodes: unnamed.length,
    pageErrors,
    consoleErrors,
    representativeContentUrl
  };
}

async function inspectLocaleSwitcher(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-localization-graph-switcher="true"], .locale-switch-bar');
    if (!root) return { found: false, visibleLinks: 0, links: [] };
    const links = [...root.querySelectorAll('a[href]')].map((a) => {
      const rect = a.getBoundingClientRect();
      const style = getComputedStyle(a);
      return {
        text: (a.textContent || '').trim(),
        href: a.href,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      };
    });
    return { found: true, visibleLinks: links.filter((item) => item.visible).length, links };
  });
}

async function scanLayout(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const offscreen = [];
    for (const el of document.querySelectorAll('body *')) {
      if (offscreen.length >= 50) break;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right > vw + 2 || rect.left < -2) {
        offscreen.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: typeof el.className === 'string' ? el.className.slice(0, 160) : null,
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
          rect: { left: round(rect.left), right: round(rect.right), width: round(rect.width) },
          overflowX: style.overflowX
        });
      }
    }
    return { viewportWidth: vw, scrollWidth: sw, documentOverflowPx: Math.max(0, sw - vw), offscreen };
    function round(n) { return Math.round(n * 10) / 10; }
  });
}

async function keyboardFocusAudit(page, { maxSteps }) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const sequence = [];
  const seen = new Set();
  for (let step = 1; step <= maxSteps; step += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(35);
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
        type: el.getAttribute('type'),
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 180),
        ariaLabel: el.getAttribute('aria-label'),
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        offscreen: rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight,
        obscured: Boolean(hit && hit !== el && !el.contains(hit) && !hit.contains(el)),
        focusVisible: el.matches(':focus-visible'),
        styleDeltaVisible: delta || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
        style: focusedFingerprint,
        rect: { left: round(rect.left), top: round(rect.top), right: round(rect.right), bottom: round(rect.bottom), width: round(rect.width), height: round(rect.height) }
      };
      function fingerprint(s) {
        return {
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
          outlineColor: s.outlineColor,
          boxShadow: s.boxShadow,
          borderColor: s.borderColor,
          backgroundColor: s.backgroundColor,
          color: s.color,
          textDecorationLine: s.textDecorationLine
        };
      }
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

async function exerciseSearch({ page, locale, stateDir }) {
  await page.goto(new URL(locales.find((item) => item.code === locale.code).route, BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.waitForTimeout(350);
  const search = page.locator('input[type="search"], [role="search"] input').filter({ visible: true }).first();
  if (await search.count() === 0) {
    finding('info', locale.code, 'mobile', 'search', 'no visible search input on locale home; state not applicable');
    return { type: 'search', viewport: 'mobile', applicable: false };
  }
  const candidate = await page.locator('main h2, main h3, article').first().innerText().catch(() => 'bias');
  const query = candidate.trim().split(/\s+/)[0].replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 12) || 'bias';
  const before = await visibleResultCount(page);
  await search.fill(query);
  await page.waitForTimeout(300);
  const after = await visibleResultCount(page);
  const layout = await scanLayout(page);
  await page.screenshot({ path: join(stateDir, 'search-mobile.webp'), fullPage: true, type: 'webp', quality: 72, animations: 'disabled' });
  await writeFile(join(stateDir, 'search-mobile.html'), await page.content());
  await writeFile(join(stateDir, 'search-mobile.aria.yml'), await page.ariaSnapshot({ boxes: true, mode: 'ai' }));
  if (layout.documentOverflowPx > 2) finding('blocker', locale.code, 'mobile', 'search', `search state creates ${layout.documentOverflowPx}px horizontal overflow`, layout.offscreen.slice(0, 8));
  return { type: 'search', viewport: 'mobile', applicable: true, query, visibleResultCountBefore: before, visibleResultCountAfter: after, layout };
}

async function visibleResultCount(page) {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll('main article, main [data-search-item], main .card, main li')];
    return candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length;
  });
}

async function stressLongStrings({ page, locale, viewport, stateDir }) {
  await page.goto(new URL(locales.find((item) => item.code === locale.code).route, BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await page.waitForTimeout(300);
  const touched = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('header a, nav a, .locale-switch-bar a, button, [role="button"], label, th')];
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
  await page.waitForTimeout(100);
  const layout = await scanLayout(page);
  const clipped = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[data-audit-expansion]')) {
      const parent = el.parentElement;
      if (!parent) continue;
      const style = getComputedStyle(parent);
      if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && parent.scrollWidth > parent.clientWidth + 2) {
        out.push({ tag: parent.tagName.toLowerCase(), text: (parent.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180), clientWidth: parent.clientWidth, scrollWidth: parent.scrollWidth });
      }
    }
    return out.slice(0, 30);
  });
  await page.screenshot({ path: join(stateDir, 'long-string-stress-mobile.webp'), fullPage: true, type: 'webp', quality: 72, animations: 'disabled' });
  await writeFile(join(stateDir, 'long-string-stress-mobile.html'), await page.content());
  if (layout.documentOverflowPx > 2) finding('warning', locale.code, viewport.name, 'long-string-stress', `expanded labels create ${layout.documentOverflowPx}px horizontal overflow`, layout.offscreen.slice(0, 10));
  if (clipped.length) finding('warning', locale.code, viewport.name, 'long-string-stress', `${clipped.length} expanded label(s) are clipped by overflow rules`, clipped.slice(0, 10));
  return { type: 'long-string-stress', viewport: viewport.name, touched, layout, clipped };
}

async function pickRepresentativeContentUrl(page) {
  return page.evaluate(() => {
    const current = location.pathname;
    const all = [...document.querySelectorAll('main article a[href], main .card a[href], main a[href]')]
      .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter((item) => {
        try {
          const u = new URL(item.href, location.href);
          return u.origin === location.origin && u.pathname !== current && !u.pathname.endsWith('.json') && !u.pathname.endsWith('.xml') && !u.pathname.endsWith('.txt') && !u.hash;
        } catch { return false; }
      });
    const preferred = all.find((item) => /\/bias(?:es)?\//i.test(new URL(item.href).pathname));
    return preferred?.href || all[0]?.href || null;
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
    '| Locale | Representative content | States |',
    '| --- | --- | ---: |',
    ...data.locales.map((locale) => `| ${locale.code} | ${locale.representativeContentUrl || 'not discovered'} | ${locale.states.length} |`),
    '',
    '## Findings',
    ''
  ];
  if (!data.findings.length) lines.push('No findings.');
  for (const item of data.findings) {
    lines.push(`- **${item.severity.toUpperCase()}** \`${item.locale}\` / \`${item.viewport}\` / \`${item.state}\`: ${item.message}`);
  }
  lines.push('', '## Evidence contract', '', 'Each audited page stores a browser screenshot, serialized DOM, Playwright ARIA snapshot with boxes, Chromium full accessibility tree, focus sequence, and layout scan. Mobile locale homes additionally store search/filter state where available and an ephemeral long-string expansion stress state.');
  return `${lines.join('\n')}\n`;
}
