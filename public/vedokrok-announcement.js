(() => {
  const key = 'cognitive-biases:vedokrok-announcement:hidden';
  const root = document.documentElement;
  let hidden = false;
  try { hidden = localStorage.getItem(key) === 'true'; } catch {}
  // This small head script reads the preference before the banner is painted.
  root.dataset.vedokrokAnnouncement = hidden ? 'hidden' : 'visible';

  function sync() {
    root.dataset.vedokrokAnnouncement = hidden ? 'hidden' : 'visible';
    document.querySelectorAll('[data-vedokrok-banner]').forEach(banner => { banner.hidden = hidden; });
    document.querySelectorAll('[data-vedokrok-dismiss]').forEach(button => { button.hidden = false; });
    document.querySelectorAll('[data-vedokrok-restore]').forEach(button => { button.hidden = !hidden; });
  }

  function update(value) {
    hidden = value;
    try {
      if (hidden) localStorage.setItem(key, 'true');
      else localStorage.removeItem(key);
    } catch {} // Dismissal still works when browser storage is unavailable.
    sync();
    document.querySelectorAll('[data-vedokrok-status]').forEach(status => {
      const control = status.parentElement.querySelector('[data-vedokrok-restore]');
      status.textContent = hidden ? control?.dataset.hiddenMessage : control?.dataset.shownMessage;
    });
  }

  function ready() {
    sync();
    document.addEventListener('click', event => {
      const dismiss = event.target.closest('[data-vedokrok-dismiss]');
      if (dismiss) {
        const next = dismiss.closest('details')?.querySelector('summary') || document.querySelector('header a[href], main a[href]');
        update(true);
        next?.focus({ preventScroll: true });
      }
      if (event.target.closest('[data-vedokrok-restore]')) {
        update(false);
        const banner = document.querySelector('[data-vedokrok-banner]');
        const details = banner?.closest('details');
        if (details) details.open = true;
        banner?.querySelector('[data-vedokrok-dismiss]')?.focus();
      }
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      try { hidden = localStorage.getItem(key) === 'true'; } catch { return; }
      sync();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
