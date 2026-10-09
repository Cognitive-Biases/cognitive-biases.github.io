(() => {
  const input = document.querySelector('body[data-reader-catalogue] input[data-search]');
  if (!input) return;
  const select = document.querySelector('select[data-category]');
  const count = document.querySelector('[data-reader-count]');
  const empty = document.querySelector('[data-reader-empty]');
  const language = (document.documentElement.lang || 'en').toLowerCase();
  const messages = {
    en: ['Entries found: ', 'No entries found. Try another word or choose All categories.'],
    de: ['Gefundene Einträge: ', 'Keine Einträge gefunden. Versuche ein anderes Wort oder alle Kategorien.'],
    ru: ['Найдено: ', 'Ничего не найдено. Попробуйте другое слово или выберите все категории.'],
  };
  const copy = messages[language] || messages.en;
  function refresh() {
    const visible = [...document.querySelectorAll('[data-bias]')].filter(card => !card.hidden).length;
    count.textContent = copy[0] + visible;
    empty.textContent = visible ? '' : copy[1];
    empty.hidden = visible > 0;
  }
  const update = () => queueMicrotask(refresh);
  input.addEventListener('input', update);
  select?.addEventListener('change', update);
  window.addEventListener('pageshow', () => input.dispatchEvent(new Event('input', { bubbles: true })));
  update();
})();
