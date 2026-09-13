(() => {
  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('de-DE')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();

  document.querySelectorAll('[data-de-filter]').forEach((root) => {
    const input = root.querySelector('[data-de-filter-input]');
    const items = [...root.querySelectorAll('[data-de-filter-item]')];
    const count = root.querySelector('[data-de-filter-count]');
    const empty = root.querySelector('[data-de-filter-empty]');
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
      if (count) count.textContent = query ? `Angezeigt: ${visible} von ${items.length}` : `Insgesamt: ${items.length}`;
      if (empty) empty.hidden = visible !== 0;
    };

    input.addEventListener('input', update);
    update();
  });
})();
