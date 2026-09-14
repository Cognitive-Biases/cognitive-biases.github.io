import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function inspectRenderedPage(page, { expectedLang, expectedCanonical = '', lightweight = false }) {
  try {
    const state = await page.evaluate(({ expectedLang, expectedCanonical }) => {
      const round = (value) => Math.round(value * 10) / 10;
      const root = document.documentElement;
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
      };
      const visuallyHidden = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const clipped = (style.clip && style.clip !== 'auto') || (style.clipPath && style.clipPath !== 'none');
        return clipped && rect.width <= 2 && rect.height <= 2;
      };
      const inlineTextLink = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline';
      const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const selector = (el) => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const data = [...el.attributes].find((attr) => attr.name.startsWith('data-') && /menu|search|filter|nav|card|dialog|modal|tab|chip|badge/.test(attr.name));
        if (data) return `${el.tagName.toLowerCase()}[${data.name}]`;
        return `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join('')}`;
      };
      const rectData = (rect) => ({ left: round(rect.left), right: round(rect.right), top: round(rect.top), bottom: round(rect.bottom), width: round(rect.width), height: round(rect.height) });
      const outsideInteractive = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter((el) => visible(el) && !el.closest('[hidden],[inert],[aria-hidden="true"]'))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
        .slice(0, 20)
        .map(({ el, rect }) => ({ selector: selector(el), text: text(el).slice(0, 120), rect: rectData(rect) }));
      const clippedText = [...document.querySelectorAll('button,a,label,p,li,h1,h2,h3,h4,span,td,th')]
        .filter((el) => visible(el) && !visuallyHidden(el) && text(el))
        .filter((el) => {
          const style = getComputedStyle(el);
          return ((['hidden', 'clip'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1)
            || (['hidden', 'clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1));
        })
        .slice(0, 25)
        .map((el) => ({ selector: selector(el), text: text(el).slice(0, 160), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }));
      const tinyTargets = [...document.querySelectorAll('a[href],button,input,select,[role="button"],[role="tab"]')]
        .filter((el) => visible(el) && !inlineTextLink(el))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width < 24 || rect.height < 24)
        .slice(0, 25)
        .map(({ el, rect }) => ({ selector: selector(el), text: text(el).slice(0, 100), rect: rectData(rect) }));
      const suspiciousAttrs = [];
      if (expectedLang !== 'en') {
        const englishUi = /\b(search|menu|close|open|next|previous|save|share|copy link|cite|filter|clear|reset|no results|skip to content|main navigation|language|show|hide|back|read more|current page)\b/i;
        for (const el of document.querySelectorAll('[aria-label],[aria-description],[title],[placeholder]')) {
          if (el.closest('[lang="en"]') || el.getAttribute('lang') === 'en') continue;
          for (const attr of ['aria-label', 'aria-description', 'title', 'placeholder']) {
            const value = el.getAttribute(attr) || '';
            if (value && englishUi.test(value)) suspiciousAttrs.push({ selector: selector(el), attr, value: value.slice(0, 160) });
          }
        }
      }
      const longStrings = [...document.querySelectorAll('button,a,label,h1,h2,h3,[class*="badge"],[class*="chip"],[class*="tab"],[class*="breadcrumb"],input[placeholder]')]
        .filter((el) => visible(el))
        .map((el) => {
          const value = el instanceof HTMLInputElement ? el.placeholder : text(el);
          if (!value || value.length < 8) return null;
          const rect = el.getBoundingClientRect();
          const words = value.split(/\s+/).filter(Boolean);
          const longestWord = [...words].sort((a, b) => b.length - a.length)[0] || '';
          const constrained = rect.width < innerWidth * 0.75;
          const riskScore = value.length + Math.max(0, longestWord.length - 12) * 4 + (constrained ? 20 : 0) + (el.scrollWidth > el.clientWidth + 1 ? 100 : 0);
          return { selector: selector(el), text: value.slice(0, 240), chars: value.length, longestWordChars: longestWord.length, width: round(rect.width), riskScore };
        }).filter(Boolean).sort((a, b) => b.riskScore - a.riskScore).slice(0, 30);
      const hiddenFocusable = [...document.querySelectorAll('[aria-hidden="true"] a[href],[aria-hidden="true"] button,[aria-hidden="true"] input,[aria-hidden="true"] select,[aria-hidden="true"] textarea,[aria-hidden="true"] [tabindex]')]
        .filter((el) => !el.hasAttribute('disabled') && Number(el.getAttribute('tabindex') || 0) >= 0)
        .slice(0, 20)
        .map((el) => ({ selector: selector(el), text: text(el).slice(0, 100) }));
      const inLanguages = [];
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (typeof value.inLanguage === 'string') inLanguages.push(value.inLanguage);
            for (const nested of Object.values(value)) if (nested && typeof nested === 'object') visit(nested);
          };
          visit(JSON.parse(script.textContent || '{}'));
        } catch {}
      }
      return {
        rootOverflow: Math.max(root.scrollWidth, document.body?.scrollWidth || 0) - innerWidth,
        outsideInteractive,
        clippedText,
        tinyTargets,
        lang: (root.getAttribute('lang') || '').toLowerCase(),
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        metaDescription: document.querySelector('meta[name="description"]')?.content || '',
        ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
        alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((el) => ({ hreflang: el.hreflang, href: el.href })),
        suspiciousAttrs,
        longStrings,
        hiddenFocusable,
        title: document.title,
        expectedLang,
        expectedCanonical,
        inLanguages,
      };
    }, { expectedLang, expectedCanonical });
    if (!lightweight) state.headings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
    return state;
  } catch (error) {
    throw new Error(`instrumentation:${String(error?.message || error)}`);
  }
}

export async function persistEvidence(page, { outDir, locale, archetype, path, viewport, onFinding, canonicalLocale }) {
  const base = safeName(`${locale}__${archetype}__${path}__${viewport.name}`);
  const screenshotPath = join(outDir, 'screenshots', `${base}.png`);
  const domPath = join(outDir, 'dom', `${base}.html`);
  const ariaPath = join(outDir, 'accessibility', `${base}.aria.yml`);
  const rawAxPath = join(outDir, 'accessibility', `${base}.ax.json`);
  await mkdir(dirname(screenshotPath), { recursive: true });
  await mkdir(dirname(domPath), { recursive: true });
  await mkdir(dirname(ariaPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });
  await writeFile(domPath, await page.content(), 'utf8');

  let aria = '';
  try { aria = await page.locator('body').ariaSnapshot({ timeout: 5000 }); }
  catch (error) {
    aria = `# ariaSnapshot failed: ${String(error?.message || error)}\n`;
    onFinding('medium', 'accessibility-snapshot-failed', locale, path, viewport.name, { message: String(error?.message || error) });
  }
  await writeFile(ariaPath, aria, 'utf8');

  let rawAx = { nodes: [] };
  try {
    const session = await page.context().newCDPSession(page);
    rawAx = await session.send('Accessibility.getFullAXTree');
    await session.detach();
  } catch (error) {
    onFinding('high', 'accessibility-tree-failed', locale, path, viewport.name, { message: String(error?.message || error) });
  }
  await writeFile(rawAxPath, `${JSON.stringify(rawAx, null, 2)}\n`, 'utf8');

  if (locale !== canonicalLocale) {
    const englishUi = /\b(Search|Menu|Close|Open|Next|Previous|Save|Share|Copy link|Cite|Filter|Clear|Reset|No results|Skip to content|Main navigation|Language|Show|Hide|Back|Read more|Current page)\b/;
    const allowed = /English|Cognitive Biases|GitHub|DOI|AI|LLM|OpenAI/;
    const hits = aria.split('\n').filter((line) => englishUi.test(line) && !allowed.test(line)).slice(0, 12);
    for (const line of hits) onFinding('high', 'accessible-name-english-leak', locale, path, viewport.name, { ariaSnapshotLine: line.trim().slice(0, 220) });
    const rawHits = [];
    for (const node of rawAx.nodes || []) {
      const values = [node?.name?.value, node?.description?.value].filter((value) => typeof value === 'string');
      for (const value of values) {
        if (englishUi.test(value) && !allowed.test(value)) rawHits.push({ role: node?.role?.value || '', value: value.slice(0, 220) });
      }
    }
    for (const hit of rawHits.slice(0, 12)) onFinding('high', 'accessible-name-english-leak', locale, path, viewport.name, { chromiumAx: hit });
  }
}

export async function exerciseKeyboard(page, { outDir, locale, archetype, path, viewport, onFinding }) {
  const focusDir = join(outDir, 'focus');
  await mkdir(focusDir, { recursive: true });
  let previous = '';
  let stuck = 0;
  for (let i = 0; i < 32; i += 1) {
    await page.keyboard.press('Tab');
    const state = await readFocusedState(page);
    if (!state) continue;
    const signature = focusSignature(state);
    stuck = signature === previous ? stuck + 1 : 0;
    previous = signature;
    if (state.rect.right < 0 || state.rect.left > viewport.width || state.rect.bottom < 0 || state.rect.top > viewport.height) onFinding('high', 'focus-hidden', locale, path, viewport.name, state);
    if (state.obscured) onFinding('high', 'focus-obscured', locale, path, viewport.name, state);
    if (!state.visibleFocus) onFinding('medium', 'focus-indicator-weak', locale, path, viewport.name, state);
    if (i < 2) {
      const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__focus-${i + 1}`);
      await page.screenshot({ path: join(focusDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    }
    if (stuck >= 2) { onFinding('high', 'focus-trap', locale, path, viewport.name, { signature }); break; }
  }

  const reverseProbe = await page.evaluate(() => {
    const selector = 'a[href],button,input,select,textarea,[tabindex]';
    const candidates = [...document.querySelectorAll(selector)].filter((el) => {
      if (el.hasAttribute('disabled') || Number(el.getAttribute('tabindex') || 0) < 0 || el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0
        && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
    });
    if (candidates.length < 2) return null;
    const preferred = candidates.find((el) => el.hasAttribute('data-browser-reverse-probe'));
    const neutral = candidates.filter((el) => !el.closest('[role="dialog"]'));
    const target = preferred || neutral[1] || candidates[1];
    if (!target) return null;
    target.setAttribute('data-browser-reverse-probe-active', 'true');
    target.focus();
    const label = (target.getAttribute('aria-label') || target.textContent || target.getAttribute('placeholder') || target.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    return { signature: `${target.tagName.toLowerCase()}|${target.id || ''}|${target.getAttribute('href') || ''}|${label.slice(0, 120)}` };
  });
  if (reverseProbe) {
    await page.keyboard.press('Shift+Tab');
    const reverse = await page.evaluate(() => {
      const target = document.querySelector('[data-browser-reverse-probe-active="true"]');
      if (!target) return { same: false };
      const same = document.activeElement === target;
      target.removeAttribute('data-browser-reverse-probe-active');
      return { same };
    });
    if (reverse.same) onFinding('medium', 'reverse-focus-static', locale, path, viewport.name, { signature: reverseProbe.signature });
  }

  const toggles = page.locator('button[aria-expanded][aria-controls]:visible');
  if (await toggles.count().catch(() => 0)) {
    const toggle = toggles.first();
    await toggle.focus();
    const before = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const after = await toggle.getAttribute('aria-expanded');
    if (before === after || after !== 'true') onFinding('high', 'menu-focus-state', locale, path, viewport.name, { input: 'Enter', before, after });
    if (after === 'true') {
      const expandedAx = await page.locator('body').ariaSnapshot().catch(() => '');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const closed = await toggle.getAttribute('aria-expanded');
      const activeIsToggle = await toggle.evaluate((el) => document.activeElement === el).catch(() => false);
      if (closed !== 'false') onFinding('high', 'menu-focus-state', locale, path, viewport.name, { input: 'Escape', closed });
      if (!activeIsToggle) onFinding('medium', 'menu-focus-return', locale, path, viewport.name, {});
      const closedAx = await page.locator('body').ariaSnapshot().catch(() => '');
      if (expandedAx && closedAx && expandedAx === closedAx) onFinding('medium', 'menu-accessibility-state-static', locale, path, viewport.name, {});
    }

    await toggle.focus();
    const beforeSpace = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    const afterSpace = await toggle.getAttribute('aria-expanded');
    if (beforeSpace === afterSpace) onFinding('medium', 'space-activation-static', locale, path, viewport.name, { before: beforeSpace, after: afterSpace });
    if (afterSpace === 'true') await page.keyboard.press('Escape').catch(() => {});
  }

  const tabs = page.locator('[role="tab"]:visible');
  if (await tabs.count().catch(() => 0) > 1) {
    const first = tabs.first();
    await first.focus();
    const beforeArrow = focusSignature(await readFocusedState(page));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    const afterArrow = focusSignature(await readFocusedState(page));
    if (beforeArrow && afterArrow === beforeArrow) onFinding('medium', 'tab-arrow-navigation-static', locale, path, viewport.name, {});
  }

  const listboxOptions = page.locator('[role="listbox"] [role="option"]:visible');
  if (await listboxOptions.count().catch(() => 0) > 1) {
    await listboxOptions.first().focus();
    const beforeArrow = focusSignature(await readFocusedState(page));
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);
    const afterArrow = focusSignature(await readFocusedState(page));
    if (beforeArrow && afterArrow === beforeArrow) onFinding('medium', 'listbox-arrow-navigation-static', locale, path, viewport.name, {});
  }
}

export async function exerciseSecondaryStates(page, { outDir, locale, archetype, path, viewport, onFinding }) {
  const search = page.locator('input[type="search"]:visible').first();
  if (await search.count().catch(() => 0)) {
    const stateDir = join(outDir, 'states');
    await mkdir(stateDir, { recursive: true });
    const original = await search.inputValue().catch(() => '');
    const before = await readLiveRegions(page);
    await search.fill('zzzzzz-browser-localization-no-result');
    await page.waitForTimeout(250);
    const after = await readLiveRegions(page);
    if (!after.some((item) => item.text && !before.some((prev) => prev.selector === item.selector && prev.text === item.text))) {
      onFinding('medium', 'search-no-live-status', locale, path, viewport.name, {});
    }
    const name = safeName(`${locale}__${archetype}__${path}__${viewport.name}__search-no-results`);
    await page.screenshot({ path: join(stateDir, `${name}.png`), fullPage: false, animations: 'disabled' });
    await writeFile(join(stateDir, `${name}.aria.yml`), await page.locator('body').ariaSnapshot().catch(() => ''), 'utf8');
    await search.fill(original);
  }
  const disclosure = page.locator('[aria-expanded][aria-controls]:visible').first();
  if (await disclosure.count().catch(() => 0)) {
    const before = await disclosure.getAttribute('aria-expanded');
    if (before === 'false') {
      await disclosure.click().catch(() => {});
      await page.waitForTimeout(100);
      const after = await disclosure.getAttribute('aria-expanded');
      if (before === after) onFinding('medium', 'interaction-state-static', locale, path, viewport.name, { archetype });
      if (after === 'true') await page.keyboard.press('Escape').catch(() => {});
    }
  }
}

export async function runPseudoStress(page, { expansion = 0.45 }) {
  return page.evaluate(({ expansion }) => {
    const candidates = [...document.querySelectorAll('button,label,[role="tab"],nav a,[class*="badge"],[class*="chip"],[class*="breadcrumb"] a,[class*="breadcrumb"] span')]
      .filter((el) => el.children.length === 0 && (el.textContent || '').trim().length >= 4)
      .slice(0, 80);
    const originals = candidates.map((el) => el.textContent);
    for (let i = 0; i < candidates.length; i += 1) {
      const original = originals[i].trim();
      const words = original.split(/\s+/);
      let suffix = '';
      while (suffix.length < Math.max(4, original.length * expansion)) suffix += ` ${words[suffix.length % words.length] || original}`;
      candidates[i].textContent = `${original}${suffix}`;
    }
    const rootOverflow = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - innerWidth;
    const clipped = candidates.filter((el) => {
      const style = getComputedStyle(el);
      return ((['hidden', 'clip'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1)
        || (['hidden', 'clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 1));
    }).length;
    const outside = candidates.filter((el) => { const rect = el.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }).length;
    for (let i = 0; i < candidates.length; i += 1) candidates[i].textContent = originals[i];
    return { tested: candidates.length, rootOverflow, clipped, outside };
  }, { expansion });
}

export function attachRuntimeCollectors(page, { baseUrl, locale, path, viewport, onFinding, runtime }) {
  const seen = [];
  const onConsole = (message) => { if (message.type() === 'error') seen.push({ type: 'runtime-error', message: message.text().slice(0, 500) }); };
  const onPageError = (error) => seen.push({ type: 'runtime-error', message: String(error?.message || error).slice(0, 500) });
  const onResponse = (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (url.startsWith(baseUrl) && !(url === new URL(path, `${baseUrl}/`).href && response.status() === 404)) seen.push({ type: 'resource-error', status: response.status(), url: url.slice(0, 500) });
  };
  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResponse);
  return () => {
    for (const entry of uniqueBy(seen, (item) => JSON.stringify(item))) {
      runtime.push({ locale, path, viewport, ...entry });
      onFinding('high', entry.type, locale, path, viewport, entry);
    }
    page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResponse);
  };
}

async function readFocusedState(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const visibleFocus = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 8)));
    const y = Math.min(innerHeight - 1, Math.max(0, rect.top + Math.min(rect.height / 2, 8)));
    const top = document.elementFromPoint(x, y);
    const obscured = rect.width > 0 && rect.height > 0 && top && top !== el && !el.contains(top) && !top.contains(el);
    return { tag: el.tagName.toLowerCase(), id: el.id || '', label: label.slice(0, 120), href: el.getAttribute('href') || '', rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, visibleFocus, obscured };
  });
}

function focusSignature(state) {
  return state ? `${state.tag}|${state.id}|${state.href}|${state.label}` : '';
}

async function readLiveRegions(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role="status"],[aria-live]')].map((el, index) => ({
    selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}:live-${index}`,
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
  })));
}

export function safeName(value) {
  return value.replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 180) || 'page';
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) if (!map.has(keyFn(item))) map.set(keyFn(item), item);
  return [...map.values()];
}
