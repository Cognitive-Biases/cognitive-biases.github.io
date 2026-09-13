(() => {
  const STORAGE_KEY = 'cognitive-biases:saved-pages:v1';
  const isRussian = document.documentElement.lang?.toLowerCase().startsWith('ru');
  const copy = isRussian ? {
    save: 'Сохранить',
    saved: 'Сохранено',
    copied: 'Ссылка скопирована.',
    citationCopied: 'Цитата скопирована.',
    shared: 'Отправлено.',
    shareFallback: 'Системное меню недоступно. Ссылка скопирована.',
    removed: 'Удалено из сохранённых страниц.',
    savedHere: 'Сохранено в этом браузере.',
    unavailable: 'Это действие недоступно в текущем браузере.'
  } : {
    save: 'Save',
    saved: 'Saved',
    copied: 'Canonical link copied.',
    citationCopied: 'Citation copied.',
    shared: 'Shared.',
    shareFallback: 'Sharing is unavailable here; canonical link copied instead.',
    removed: 'Removed from saved pages.',
    savedHere: 'Saved in this browser.',
    unavailable: 'This action is unavailable in the current browser.'
  };
  const canonical = () => document.querySelector('link[rel="canonical"]')?.href || location.href.split('#')[0];
  const pageTitle = () => document.querySelector('h1')?.textContent?.trim() || document.title.replace(/\s*\|\s*Cognitive Biases\s*$/i, '');
  const feedback = (bar, message) => {
    const node = bar?.querySelector('[data-page-utility-status]');
    if (!node) return;
    node.textContent = message;
    clearTimeout(node._clearTimer);
    node._clearTimer = setTimeout(() => { node.textContent = ''; }, 2200);
  };
  const copyText = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy unavailable');
  };
  const readSaved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    } catch { return []; }
  };
  const writeSaved = (items) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(items)])); return true; }
    catch { return false; }
  };
  const syncSaveButton = (bar) => {
    const button = bar.querySelector('[data-page-action="save"]');
    if (!button) return;
    const saved = readSaved().includes(canonical());
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? copy.saved : copy.save;
  };
  document.querySelectorAll('[data-page-utility]').forEach(syncSaveButton);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-page-action]');
    if (!button) return;
    const bar = button.closest('[data-page-utility]');
    const url = canonical();
    const title = pageTitle();
    const action = button.dataset.pageAction;
    try {
      if (action === 'copy') {
        await copyText(url);
        feedback(bar, copy.copied);
      } else if (action === 'cite') {
        await copyText(`[${title}](${url}) — Cognitive Biases`);
        feedback(bar, copy.citationCopied);
      } else if (action === 'share') {
        if (navigator.share) {
          await navigator.share({ title, url });
          feedback(bar, copy.shared);
        } else {
          await copyText(url);
          feedback(bar, copy.shareFallback);
        }
      } else if (action === 'save') {
        const saved = readSaved();
        const exists = saved.includes(url);
        const next = exists ? saved.filter((item) => item !== url) : [...saved, url];
        if (!writeSaved(next)) throw new Error('storage unavailable');
        syncSaveButton(bar);
        feedback(bar, exists ? copy.removed : copy.savedHere);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      feedback(bar, copy.unavailable);
    }
  });
})();
