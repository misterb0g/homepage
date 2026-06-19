// Start Desk v3.1 — contexte du jour, commandes internes, fond temporel, polish mobile et statistiques locales.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const NOTES_KEY = 'startdesk_notes_v1';
  const USAGE_KEY = 'startdesk_usage_stats_v1';
  const PROFILE_LABELS = { silex: 'Silex', focus: 'Focus', personal: 'Perso', code: 'Code', full: 'Complet', work: 'Silex' };

  function openUrl(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function bookmarkId(category, name) {
    return `${String(category || 'Favoris').trim()}::${String(name || 'Sans nom').trim()}`;
  }

  function getUsageStats() {
    try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function saveUsageStats(stats) {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(stats)); } catch (_) {}
  }

  function currentProfileId() {
    return document.body.dataset.startpageProfile || 'silex';
  }

  function findBookmarkLink(name) {
    const q = String(name || '').toLowerCase();
    const groups = Array.isArray(window.bookmarks) ? window.bookmarks : [];
    for (const group of groups) {
      for (const link of (group.links || [])) {
        if (String(link.name || '').toLowerCase() === q) {
          return { ...link, category: group.title || 'Favoris', id: bookmarkId(group.title, link.name) };
        }
      }
    }
    return null;
  }

  function findBookmark(name) {
    return findBookmarkLink(name)?.url || null;
  }

  function allBookmarkLinks() {
    const groups = Array.isArray(window.bookmarks) ? window.bookmarks : [];
    return groups.flatMap(group => (group.links || []).map(link => ({
      ...link,
      category: group.title || 'Favoris',
      id: bookmarkId(group.title, link.name)
    })));
  }

  function recordFavoriteUse(meta) {
    if (!meta || !meta.name) return;
    const now = new Date().toISOString();
    const id = meta.id || bookmarkId(meta.category, meta.name);
    const stats = getUsageStats();
    const previous = stats[id] || {};
    const profile = currentProfileId();
    const byProfile = { ...(previous.byProfile || {}) };
    byProfile[profile] = (byProfile[profile] || 0) + 1;
    stats[id] = {
      id,
      name: meta.name,
      category: meta.category || previous.category || 'Favoris',
      url: meta.url || previous.url || '',
      count: (previous.count || 0) + 1,
      firstUsedAt: previous.firstUsedAt || now,
      lastUsedAt: now,
      lastProfile: profile,
      byProfile
    };
    saveUsageStats(stats);
  }

  function resetUsageStats() {
    try { localStorage.removeItem(USAGE_KEY); } catch (_) {}
    renderStatsPanel();
  }

  function getTimePeriod(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 18) return 'day';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  function getGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 11) return 'Bonjour Gilles';
    if (hour >= 11 && hour < 18) return 'Bonne journée Gilles';
    if (hour >= 18 && hour < 22) return 'Bonsoir Gilles';
    return 'Mode nuit';
  }

  function applyTimeBackground() {
    const period = getTimePeriod();
    document.documentElement.dataset.startDeskPeriod = period;
    document.body.dataset.startDeskPeriod = period;
  }

  function currentProfileLabel() {
    const profile = document.body.dataset.startpageProfile || 'silex';
    return PROFILE_LABELS[profile] || profile;
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
      const profile = currentProfileLabel();
      el.innerHTML = `<strong>${getGreeting(now)}</strong><span class="muted">•</span><span>${fmtDate.format(now)}</span><span class="muted">•</span><span>${time}</span><span class="muted">•</span><span class="muted">${profile}</span>${weather ? `<span class="muted">•</span><span class="muted">${weather}</span>` : ''}`;
      applyTimeBackground();
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
    if (next) {
      toggleStats(false);
      setTimeout(() => $('textarea', panel)?.focus(), 80);
    }
  }

  function formatLastUsed(iso) {
    if (!iso) return 'jamais';
    try {
      return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (_) {
      return '—';
    }
  }

  function renderStatsPanel() {
    const panel = $('.start-desk-stats-panel');
    if (!panel) return;
    const stats = getUsageStats();
    const all = allBookmarkLinks();
    const enriched = all.map(link => ({ ...link, ...(stats[link.id] || {}), count: stats[link.id]?.count || 0 }));
    const used = enriched.filter(item => item.count > 0).sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
    const top = used.slice(0, 8);
    const low = used.filter(item => item.count <= 2).slice(0, 8);
    const never = enriched.filter(item => item.count === 0).slice(0, 12);
    const totalClicks = used.reduce((sum, item) => sum + item.count, 0);

    const row = (item, showLast = true) => `
      <li>
        <span><strong>${escapeHtmlLocal(item.name)}</strong><em>${escapeHtmlLocal(item.category || 'Favoris')}</em></span>
        <b>${item.count || 0}</b>
        ${showLast ? `<small>${formatLastUsed(item.lastUsedAt)}</small>` : ''}
      </li>`;

    panel.querySelector('.stats-body').innerHTML = `
      <div class="stats-summary">
        <div><strong>${totalClicks}</strong><span>clics suivis</span></div>
        <div><strong>${used.length}</strong><span>favoris utilisés</span></div>
        <div><strong>${never.length}</strong><span>jamais utilisés*</span></div>
      </div>
      <p class="stats-note">*Depuis l’activation de cette version sur ce navigateur uniquement.</p>
      <section>
        <h4>Très utilisés</h4>
        <ol class="stats-list">${top.length ? top.map(item => row(item)).join('') : '<li class="empty">Aucune donnée pour l’instant.</li>'}</ol>
      </section>
      <section>
        <h4>Peu utilisés</h4>
        <ol class="stats-list">${low.length ? low.map(item => row(item)).join('') : '<li class="empty">Aucune donnée pour l’instant.</li>'}</ol>
      </section>
      <section>
        <h4>Jamais utilisés</h4>
        <ol class="stats-list stats-list-never">${never.length ? never.map(item => row(item, false)).join('') : '<li class="empty">Tous les favoris visibles ont déjà été utilisés.</li>'}</ol>
      </section>
    `;
  }

  function createStatsPanel() {
    if ($('.start-desk-stats-panel')) return $('.start-desk-stats-panel');
    const panel = document.createElement('section');
    panel.className = 'start-desk-panel start-desk-stats-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <header>
        <h3>Stats favoris</h3>
        <div class="stats-actions">
          <button class="reset-stats" type="button">Réinitialiser</button>
          <button class="close-panel" type="button" aria-label="Fermer">×</button>
        </div>
      </header>
      <div class="stats-body"></div>
    `;
    document.body.appendChild(panel);
    $('.close-panel', panel).addEventListener('click', () => toggleStats(false));
    $('.reset-stats', panel).addEventListener('click', () => {
      if (window.confirm('Réinitialiser les statistiques locales des favoris ?')) resetUsageStats();
    });
    renderStatsPanel();
    return panel;
  }

  function toggleStats(force) {
    const panel = createStatsPanel();
    renderStatsPanel();
    const next = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', next);
    panel.setAttribute('aria-hidden', next ? 'false' : 'true');
    $('.start-desk-dock [data-action="stats"]')?.classList.toggle('is-active', next);
    if (next) toggleNotes(false);
  }

  function escapeHtmlLocal(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function installUsageTracking() {
    const container = $('#bookmark-container');
    if (!container || container.dataset.startDeskUsageTracking) return;
    container.dataset.startDeskUsageTracking = '1';
    container.addEventListener('click', (event) => {
      const link = event.target.closest('a.bookmark');
      if (!link) return;
      const tile = link.closest('.bookmark-set');
      const category = tile?.dataset.tileTitle || tile?.querySelector('.bookmark-title')?.textContent || 'Favoris';
      const name = link.textContent.trim();
      recordFavoriteUse({
        id: bookmarkId(category, name),
        name,
        category,
        url: link.href
      });
    }, true);
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
      <button type="button" data-action="stats">Stats</button>
    `;
    document.body.appendChild(dock);
    dock.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action !== 'notes') toggleNotes(false);
      if (action !== 'stats') toggleStats(false);
      if (action === 'focus') { applyProfile('focus'); setFocus(true); }
      if (action === 'silex') { applyProfile('silex'); setFocus(true); }
      if (action === 'personal') { applyProfile('personal'); setFocus(true); }
      if (action === 'code') { applyProfile('code'); setFocus(true); }
      if (action === 'apps') { applyProfile('full'); setFocus(false); }
      if (action === 'agenda') showWidget('calendar');
      if (action === 'notes') toggleNotes();
      if (action === 'stats') toggleStats();
    });
  }

  function appendNote(text) {
    const clean = String(text || '').trim();
    if (!clean) return false;
    const stamp = new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });
    let current = '';
    try { current = localStorage.getItem(NOTES_KEY) || ''; } catch (_) {}
    const next = `${current ? `${current.trim()}\n` : ''}- ${clean} (${stamp})`;
    try { localStorage.setItem(NOTES_KEY, next); } catch (_) {}
    const textarea = $('.start-desk-panel textarea');
    if (textarea) textarea.value = next;
    toggleNotes(true);
    return true;
  }

  function clearNotes() {
    try { localStorage.removeItem(NOTES_KEY); } catch (_) {}
    const textarea = $('.start-desk-panel textarea');
    if (textarea) textarea.value = '';
    toggleNotes(true);
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
        const bookmark = findBookmarkLink(label);
        if (bookmark?.url) {
          event.preventDefault();
          recordFavoriteUse(bookmark);
          openUrl(bookmark.url);
          return true;
        }
        return false;
      };

      const internal = () => {
        if (lower === 'focus') { applyProfile('focus'); setFocus(true); return true; }
        if (lower === 'silex' || lower === 'travail' || lower === 'pro') { applyProfile('silex'); setFocus(true); return true; }
        if (lower === 'perso' || lower === 'personal') { applyProfile('personal'); setFocus(true); return true; }
        if (lower === 'code' || lower === 'dev') { applyProfile('code'); setFocus(true); return true; }
        if (lower === 'apps' || lower === 'complet' || lower === 'full') { applyProfile('full'); setFocus(false); return true; }
        if (lower === 'notes') { toggleNotes(true); return true; }
        if (lower === 'stats' || lower === 'statistiques' || lower === 'usage') { toggleStats(true); return true; }
        if (lower === 'reset stats' || lower === 'réinitialiser stats' || lower === 'vider stats') { resetUsageStats(); toggleStats(true); return true; }
        if (lower === 'clear notes' || lower === 'vider notes') { clearNotes(); return true; }
        const noteMatch = raw.match(/^(note|notes)\s+(.+)$/i);
        if (noteMatch) return appendNote(noteMatch[2]);
        return false;
      };

      if (internal()) {
        event.preventDefault();
        input.value = '';
        return;
      }

      if (lower === 'cal' || lower === 'agenda') return openBookmark('Agenda');
      if (lower === 'drive') return openBookmark('Drive');
      if (lower === 'gh' || lower === 'git') return openBookmark('Github');
      if (lower === 'mail' || lower === 'gmail') return openBookmark('Mail');
      if (lower === 'ai' || lower === 'ia') return openBookmark('ChatGPT');

      const match = raw.match(/^(g|ai|ia|cal|drive|gh|note)\s+(.+)$/i);
      if (!match) return;
      event.preventDefault();
      const prefix = match[1].toLowerCase();
      const q = encodeURIComponent(match[2].trim());
      if (prefix === 'g') return openUrl(`https://www.google.com/search?q=${q}`);
      if (prefix === 'ai' || prefix === 'ia') return openUrl(`https://chatgpt.com/?q=${q}`);
      if (prefix === 'cal') return openUrl(`https://calendar.google.com/calendar/u/0/r/search?q=${q}`);
      if (prefix === 'drive') return openUrl(`https://drive.google.com/drive/search?q=${q}`);
      if (prefix === 'gh') return openUrl(`https://github.com/search?q=${q}`);
      if (prefix === 'note') return appendNote(decodeURIComponent(q));
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
        toggleStats(false);
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
      if (key === 'u') { toggleStats(); return; }
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
    applyTimeBackground();
    createStatus();
    createDock();
    createNotesPanel();
    createStatsPanel();
    installUsageTracking();
    installPrefixCommands();
    installKeyboardShortcuts();
    setInterval(syncDockState, 700);
    setInterval(applyTimeBackground, 60 * 1000);
    setTimeout(syncDockState, 300);
  });
})();
