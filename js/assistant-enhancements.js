// Assistant enhancements — ajout non destructif
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function showToast(message) {
    let toast = $('.assistant-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'assistant-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 1700);
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function getBookmarkMatches(query) {
    const q = normalize(query);
    if (!q || !Array.isArray(window.bookmarks || bookmarks)) return [];
    const source = window.bookmarks || bookmarks;
    const matches = [];

    source.forEach(group => {
      if (normalize(group.title) === q && group.links?.[0]) {
        matches.push({ label: group.title, url: group.links[0].url, weight: 3 });
      }
      (group.links || []).forEach(link => {
        const name = normalize(link.name);
        if (name === q) matches.push({ label: link.name, url: link.url, weight: 4 });
        else if (name.startsWith(q) && q.length >= 3) matches.push({ label: link.name, url: link.url, weight: 2 });
      });
    });
    return matches.sort((a, b) => b.weight - a.weight);
  }

  function wireSmartBookmarkLaunch() {
    const form = $('#search-form');
    const input = $('#search-input');
    if (!form || !input) return;

    form.addEventListener('submit', function (event) {
      const query = input.value.trim();
      if (!query || /^[way] /i.test(query)) return;
      const [best] = getBookmarkMatches(query);
      if (!best) return;
      event.preventDefault();
      showToast(`Ouverture de ${best.label}`);
      openExternal(best.url);
    }, true);

    const hint = document.createElement('div');
    hint.className = 'quick-command-hint';
    hint.innerHTML = 'Astuce : tape directement <kbd>drive</kbd>, <kbd>mail</kbd>, <kbd>dolibarr</kbd>, <kbd>strava</kbd>… pour ouvrir un favori.';
    form.insertAdjacentElement('afterend', hint);
  }

  function wireFocusMode() {
    const KEY = 'startpage_focus_mode_v1';
    const apply = (on) => {
      document.body.classList.toggle('focus-mode', on);
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
      showToast(on ? 'Mode focus activé' : 'Mode focus désactivé');
    };

    try {
      const savedFocus = localStorage.getItem(KEY);
      document.body.classList.toggle('focus-mode', savedFocus === null ? true : savedFocus === '1');
    } catch (_) {}

    window.addEventListener('keydown', (event) => {
      const active = document.activeElement;
      const isTyping = active && ['INPUT', 'TEXTAREA'].includes(active.tagName);
      if (isTyping) return;
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        apply(!document.body.classList.contains('focus-mode'));
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    wireSmartBookmarkLaunch();
    wireFocusMode();
  });
})();
