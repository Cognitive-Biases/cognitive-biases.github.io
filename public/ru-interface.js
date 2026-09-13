(() => {
  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();

  document.querySelectorAll('[data-ru-filter]').forEach((root) => {
    const input = root.querySelector('[data-ru-filter-input]');
    const items = [...root.querySelectorAll('[data-ru-filter-item]')];
    const count = root.querySelector('[data-ru-filter-count]');
    const empty = root.querySelector('[data-ru-filter-empty]');
    if (!input || !items.length) return;

    const update = () => {
      const query = normalize(input.value);
      let visible = 0;
      for (const item of items) {
        const haystack = normalize(item.dataset.search || item.textContent);
        const matches = !query || haystack.includes(query);
        item.hidden = !matches;
        if (matches) visible += 1;
      }
      if (count) count.textContent = query ? `Показано: ${visible} из ${items.length}` : `Всего: ${items.length}`;
      if (empty) empty.hidden = visible !== 0;
    };

    input.addEventListener('input', update);
    update();
  });
})();
