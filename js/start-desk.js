// Start Desk v2 — dock, statut discret, notes et raccourcis de recherche.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const NOTES_KEY = 'startdesk_notes_v1';

  function openUrl(url) {
    window.location.href = url;
  }

  function findBookmark(name) {
    const q = String(name || '').toLowerCase();
    const groups = Array.isArray(window.bookmarks) ? window.bookmarks : [];
    for (const group of groups) {
      for (const link of (group.links || [])) {
        if (String(link.name || '').toLowerCase() === q) return link.url;
      }
    }
    return null;
  }

  function createStatus() {
    if ($('.start-desk-status')) return;
    const el = document.createElement('div');
    el.className = 'start-desk-status';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);

    const fmtDate = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });
    function tick() {
      const now = new Date();
      const time = now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
      const weather = $('#weather')?.innerText?.replace(/\s+/g, ' ').trim();
      el.innerHTML = `<span>${fmtDate.format(now)}</span><span class="muted">•</span><span>${time}</span>${weather ? `<span class="muted">•</span><span class="muted">${weather}</span>` : ''}`;
    }
    tick();
    setInterval(tick, 30 * 1000);
  }

  function setFocus(on) {
    if (window.StartpagePlus && typeof window.StartpagePlus.setFocusMode === 'function') {
      window.StartpagePlus.setFocusMode(on, true);
    } else {
      document.body.classList.toggle('focus-mode', !!on);
      try { localStorage.setItem('startpage_focus_mode_v1', on ? '1' : '0'); } catch (_) {}
    }
  }

  function applyProfile(id) {
    if (window.StartpagePlus && typeof window.StartpagePlus.applyProfile === 'function') {
      window.StartpagePlus.applyProfile(id, true);
    }
  }

  function showWidget(widgetId) {
    setFocus(false);
    if (widgetId === 'calendar') {
      document.body.classList.remove('calendar-hidden');
      try { localStorage.setItem('calendarHidden', '0'); } catch (_) {}
    } else {
      document.body.classList.remove(`${widgetId}-hidden`);
      try { localStorage.setItem(`show${widgetId[0].toUpperCase()}${widgetId.slice(1)}`, 'true'); } catch (_) {}
    }
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widget) {
      widget.style.display = '';
      widget.hidden = false;
      widget.classList.remove('is-collapsed');
      setTimeout(() => widget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
    const toggle = document.getElementById(`${widgetId}-toggle`);
    if (toggle) toggle.checked = true;
  }

  function createNotesPanel() {
    if ($('.start-desk-panel')) return $('.start-desk-panel');
    const panel = document.createElement('section');
    panel.className = 'start-desk-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <header>
        <h3>Notes rapides</h3>
        <button class="close-panel" type="button" aria-label="Fermer">×</button>
      </header>
      <textarea spellcheck="true" placeholder="À ne pas oublier…"></textarea>
      <div class="panel-hint">Les notes restent dans ce navigateur via localStorage.</div>
    `;
    document.body.appendChild(panel);
    const textarea = $('textarea', panel);
    try { textarea.value = localStorage.getItem(NOTES_KEY) || ''; } catch (_) {}
    textarea.addEventListener('input', () => {
      try { localStorage.setItem(NOTES_KEY, textarea.value); } catch (_) {}
    });
    $('.close-panel', panel).addEventListener('click', () => toggleNotes(false));
    return panel;
  }

  function toggleNotes(force) {
    const panel = createNotesPanel();
    const next = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', next);
    panel.setAttribute('aria-hidden', next ? 'false' : 'true');
    $('.start-desk-dock [data-action="notes"]')?.classList.toggle('is-active', next);
    if (next) setTimeout(() => $('textarea', panel)?.focus(), 80);
  }

  function createDock() {
    if ($('.start-desk-dock')) return;
    const dock = document.createElement('nav');
    dock.className = 'start-desk-dock';
    dock.setAttribute('aria-label', 'Start Desk');
    dock.innerHTML = `
      <button type="button" data-action="focus">Focus</button>
      <button type="button" data-action="silex">Silex</button>
      <button type="button" data-action="personal">Perso</button>
      <button type="button" data-action="code">Code</button>
      <button type="button" data-action="apps">Apps</button>
      <button type="button" data-action="agenda">Agenda</button>
      <button type="button" data-action="notes">Notes</button>
    `;
    document.body.appendChild(dock);
    dock.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action !== 'notes') toggleNotes(false);
      if (action === 'focus') { applyProfile('focus'); setFocus(true); }
      if (action === 'silex') { applyProfile('silex'); setFocus(true); }
      if (action === 'personal') { applyProfile('personal'); setFocus(true); }
      if (action === 'code') { applyProfile('code'); setFocus(true); }
      if (action === 'apps') { applyProfile('full'); setFocus(false); }
      if (action === 'agenda') showWidget('calendar');
      if (action === 'notes') toggleNotes();
    });
  }

  function installPrefixCommands() {
    const form = $('#search-form');
    const input = $('#search-input');
    if (!form || !input || form.dataset.startDeskCommands) return;
    form.dataset.startDeskCommands = '1';

    form.addEventListener('submit', (event) => {
      const raw = String(input.value || '').trim();
      const lower = raw.toLowerCase();
      const openBookmark = (label) => {
        const url = findBookmark(label);
        if (url) {
          event.preventDefault();
          openUrl(url);
          return true;
        }
        return false;
      };

      if (lower === 'cal' || lower === 'agenda') return openBookmark('Agenda');
      if (lower === 'drive') return openBookmark('Drive');
      if (lower === 'gh' || lower === 'git') return openBookmark('Github');
      if (lower === 'mail' || lower === 'gmail') return openBookmark('Mail');
      if (lower === 'ai' || lower === 'ia') return openBookmark('ChatGPT');

      const match = raw.match(/^(g|ai|ia|cal|drive|gh)\s+(.+)$/i);
      if (!match) return;
      event.preventDefault();
      const prefix = match[1].toLowerCase();
      const q = encodeURIComponent(match[2].trim());
      if (prefix === 'g') return openUrl(`https://www.google.com/search?q=${q}`);
      if (prefix === 'ai' || prefix === 'ia') return openUrl(`https://chatgpt.com/?q=${q}`);
      if (prefix === 'cal') return openUrl(`https://calendar.google.com/calendar/u/0/r/search?q=${q}`);
      if (prefix === 'drive') return openUrl(`https://drive.google.com/drive/search?q=${q}`);
      if (prefix === 'gh') return openUrl(`https://github.com/search?q=${q}`);
    }, true);
  }

  function installKeyboardShortcuts() {
    if (document.body.dataset.startDeskShortcuts) return;
    document.body.dataset.startDeskShortcuts = '1';

    document.addEventListener('keydown', (event) => {
      const input = $('#search-input');
      const active = document.activeElement;
      const isTyping = active && ['INPUT', 'TEXTAREA'].includes(active.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input?.focus();
        input?.select();
        return;
      }

      if (event.key === 'Escape') {
        toggleNotes(false);
        if (isTyping && active === input) input.blur();
        return;
      }

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === '/') { event.preventDefault(); input?.focus(); return; }
      if (key === 'f') { applyProfile('focus'); setFocus(true); return; }
      if (key === 's') { applyProfile('silex'); setFocus(true); return; }
      if (key === 'p') { applyProfile('personal'); setFocus(true); return; }
      if (key === 'c') { applyProfile('code'); setFocus(true); return; }
      if (key === 'a') { applyProfile('full'); setFocus(false); return; }
      if (key === 'n') { toggleNotes(); return; }
    });
  }

  function syncDockState() {
    const dock = $('.start-desk-dock');
    if (!dock) return;
    const profile = document.body.dataset.startpageProfile || '';
    dock.querySelector('[data-action="focus"]')?.classList.toggle('is-active', document.body.classList.contains('focus-mode') && profile === 'focus');
    dock.querySelector('[data-action="silex"]')?.classList.toggle('is-active', document.body.classList.contains('focus-mode') && profile === 'silex');
    dock.querySelector('[data-action="personal"]')?.classList.toggle('is-active', document.body.classList.contains('focus-mode') && profile === 'personal');
    dock.querySelector('[data-action="code"]')?.classList.toggle('is-active', document.body.classList.contains('focus-mode') && profile === 'code');
    dock.querySelector('[data-action="apps"]')?.classList.toggle('is-active', !document.body.classList.contains('focus-mode') && profile === 'full');
  }

  window.addEventListener('DOMContentLoaded', () => {
    createStatus();
    createDock();
    createNotesPanel();
    installPrefixCommands();
    installKeyboardShortcuts();
    setInterval(syncDockState, 700);
    setTimeout(syncDockState, 300);
  });
})();
