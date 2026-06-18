// Startpage Plus — Spotlight, profils et commandes rapides.
(function () {
  'use strict';

  const CONFIG = window.STARTPAGE_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const PROFILE_KEY = 'startpage_profile_v2';
  const FOCUS_KEY = 'startpage_focus_mode_v1';

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9+ ]/g, '')
      .trim();
  }

  function getBookmarks() {
    try {
      if (Array.isArray(window.bookmarks)) return window.bookmarks;
      // eslint-disable-next-line no-undef
      if (Array.isArray(bookmarks)) return bookmarks;
    } catch (_) {}
    return [];
  }

  function toast(message) {
    let el = $('.assistant-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'assistant-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('is-visible'), 1700);
  }

  function allBookmarkItems() {
    return getBookmarks().flatMap(group => (group.links || []).map(link => ({
      type: 'bookmark',
      label: link.name,
      group: group.title,
      url: link.url,
      haystack: normalize(`${link.name} ${group.title}`)
    })));
  }

  function resolveAlias(query) {
    const q = normalize(query);
    const bookmarkAliases = CONFIG.bookmarkAliases || {};
    if (bookmarkAliases[q]) return normalize(bookmarkAliases[q]);
    return q;
  }

  function getBookmarkMatches(query) {
    const q = resolveAlias(query);
    if (!q) return [];
    return allBookmarkItems()
      .map(item => {
        const n = normalize(item.label);
        let score = 0;
        if (n === q) score = 100;
        else if (n.startsWith(q) && q.length >= 2) score = 70;
        else if (item.haystack.includes(q) && q.length >= 3) score = 45;
        return score ? { ...item, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  }

  function getCommandMatches(query) {
    const q = normalize(query);
    if (!q) return [];
    return Object.entries(CONFIG.commandAliases || {})
      .map(([name, command]) => {
        // Les alias qui ouvrent simplement un favori sont volontairement exclus
        // de la palette "Commande" : le favori correspondant apparaît déjà
        // comme résultat unique, avec sa catégorie.
        if (command?.type === 'bookmark') return null;
        const n = normalize(name);
        let score = 0;
        if (n === q) score = 110;
        else if (n.startsWith(q) && q.length >= 2) score = 75;
        return score ? { type: 'command', key: name, label: command.label || name, command, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }


  function getPrefixMatches(query) {
    const raw = String(query || '').trim();
    if (!raw) return [];
    const recipes = [
      ['g ', 'Recherche Google'],
      ['ai ', 'Envoyer à ChatGPT'],
      ['ia ', 'Envoyer à ChatGPT'],
      ['cal ', 'Chercher dans Google Agenda'],
      ['drive ', 'Chercher dans Google Drive'],
      ['gh ', 'Chercher sur GitHub']
    ];
    return recipes
      .filter(([prefix]) => raw.toLowerCase().startsWith(prefix) && raw.length > prefix.length)
      .map(([prefix, label]) => ({
        type: 'prefix',
        key: prefix.trim(),
        label,
        meta: raw.slice(prefix.length),
        raw,
        score: 95
      }))
      .slice(0, 3);
  }

  function setDensity(value) {
    document.documentElement.setAttribute('data-density', value);
    try { localStorage.setItem('density', value); } catch (_) {}
    $$('#density-selector button').forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
  }

  function setWidgetVisible(widget, visible) {
    const key = widget === 'calendar' ? 'calendarHidden' : `show${widget[0].toUpperCase()}${widget.slice(1)}`;
    const toggle = widget === 'calendar' ? $('#calendar-toggle') : $(`#${widget}-toggle`);

    if (widget === 'calendar') {
      document.body.classList.toggle('calendar-hidden', !visible);
      try { localStorage.setItem(key, visible ? '0' : '1'); } catch (_) {}
    } else {
      document.body.classList.toggle(`${widget}-hidden`, !visible);
      try { localStorage.setItem(key, visible ? 'true' : 'false'); } catch (_) {}
    }
    if (toggle) toggle.checked = visible;
  }

  function executeCommand(command) {
    if (!command) return false;
    if (command.type === 'profile') {
      applyProfile(command.value, true);
      return true;
    }
    if (command.type === 'density') {
      setDensity(command.value);
      toast(`Densité ${command.value}`);
      return true;
    }
    if (command.type === 'toggleFocus') {
      toggleFocusMode();
      return true;
    }
    if (command.type === 'toggleWidget') {
      const currentlyHidden = document.body.classList.contains(`${command.widget}-hidden`);
      setWidgetVisible(command.widget, currentlyHidden);
      toast(currentlyHidden ? 'Module affiché' : 'Module masqué');
      return true;
    }
    if (command.type === 'bookmark') {
      const [match] = getBookmarkMatches(command.query || command.label || '');
      if (match) {
        window.location.href = match.url;
        return true;
      }
    }
    if (command.type === 'internal') {
      const action = String(command.value || '').toLowerCase();
      if (action === 'notes') {
        document.querySelector('.start-desk-dock [data-action="notes"]')?.click();
        return true;
      }
      if (action === 'stats') {
        document.querySelector('.start-desk-dock [data-action="stats"]')?.click();
        return true;
      }
    }
    return false;
  }


  function updateFocusUi(on) {
    $$('.startpage-focus-pill').forEach(btn => {
      btn.classList.toggle('active', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Focus : activé' : 'Focus';
    });
  }

  function setFocusMode(on, notify) {
    document.body.classList.toggle('focus-mode', !!on);
    try { localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); } catch (_) {}
    updateFocusUi(!!on);
    if (notify) toast(on ? 'Mode focus activé' : 'Mode focus désactivé');
  }

  function toggleFocusMode() {
    const on = !document.body.classList.contains('focus-mode');
    setFocusMode(on, true);
  }

  function applyProfile(profileId, notify) {
    const profiles = CONFIG.profiles || {};
    const profile = profiles[profileId] || profiles.full;
    if (!profile) return;

    document.body.dataset.startpageProfile = profileId;
    try { localStorage.setItem(PROFILE_KEY, profileId); } catch (_) {}

    const visible = Array.isArray(profile.visibleCategories) ? new Set(profile.visibleCategories) : null;
    $$('#bookmark-container .bookmark-set').forEach(tile => {
      const title = tile.getAttribute('data-tile-title') || '';
      tile.classList.toggle('profile-hidden', !!visible && !visible.has(title));
    });

    ['news', 'chat', 'calendar'].forEach(widget => {
      const shouldHide = Array.isArray(profile.hiddenWidgets) && profile.hiddenWidgets.includes(widget);
      const shouldShow = profileId === 'full' || (Array.isArray(profile.showWidgets) && profile.showWidgets.includes(widget));
      if (shouldHide) setWidgetVisible(widget, false);
      else if (shouldShow) setWidgetVisible(widget, true);
    });

    if (['silex', 'focus', 'code'].includes(profileId)) {
      setFocusMode(true, false);
    } else if (profileId === 'full') {
      setFocusMode(false, false);
    }

    updateProfileUi(profileId);
    if (notify) toast(`Profil ${profile.label || profileId} activé`);
  }

  function updateProfileUi(profileId) {
    $$('.profile-chip').forEach(btn => btn.classList.toggle('active', btn.dataset.profile === profileId));
    const pill = $('.startpage-profile-pill');
    const profile = (CONFIG.profiles || {})[profileId];
    if (pill && profile) pill.textContent = `Profil : ${profile.label}`;
  }

  function installProfileControls() {
    const panelContent = $('#control-panel .panel-content');
    if (!panelContent || $('.profile-chip')) return;
    const section = document.createElement('div');
    section.className = 'panel-section startpage-profile-section';
    section.innerHTML = `
      <label>Profil de page</label>
      <div class="segmented-control profile-selector" id="profile-selector">
        <button type="button" class="profile-chip" data-profile="silex">Silex</button>
        <button type="button" class="profile-chip" data-profile="focus">Focus</button>
        <button type="button" class="profile-chip" data-profile="code">Code</button>
        <button type="button" class="profile-chip" data-profile="personal">Perso</button>
        <button type="button" class="profile-chip" data-profile="full">Complet</button>
      </div>
    `;
    const density = $('#density-selector')?.closest('.panel-section');
    panelContent.insertBefore(section, density ? density.nextSibling : panelContent.firstChild);
    section.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-profile]');
      if (!btn) return;
      applyProfile(btn.dataset.profile, true);
    });
  }

  function ensureQuickControls() {
    const form = $('#search-form');
    if (!form) return null;
    let controls = $('.startpage-quick-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'startpage-quick-controls';
    }
    return controls;
  }

  function installProfilePill() {
    const controls = ensureQuickControls();
    if (!controls) return;
    let pill = $('.startpage-profile-pill');
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'startpage-profile-pill';
      pill.title = 'Basculer entre Complet, Travail et Perso';
      controls.appendChild(pill);
    }
    if (!pill.dataset.bound) {
      pill.addEventListener('click', () => {
        const order = ['silex', 'focus', 'code', 'personal', 'full'];
        const current = document.body.dataset.startpageProfile || 'full';
        const next = order[(order.indexOf(current) + 1) % order.length] || 'silex';
        applyProfile(next, true);
      });
      pill.dataset.bound = '1';
    }
  }

  function installFocusPill() {
    const controls = ensureQuickControls();
    if (!controls) return;
    let pill = $('.startpage-focus-pill');
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'startpage-focus-pill';
      pill.title = 'Afficher uniquement les éléments essentiels';
      pill.setAttribute('aria-pressed', 'false');
      controls.appendChild(pill);
    }
    if (!pill.dataset.bound) {
      pill.addEventListener('click', toggleFocusMode);
      pill.dataset.bound = '1';
    }
    updateFocusUi(document.body.classList.contains('focus-mode'));
  }

  function installCommandPalette() {
    const form = $('#search-form');
    const input = $('#search-input');
    if (!form || !input || $('.command-palette')) return;

    const palette = document.createElement('div');
    palette.className = 'command-palette glass';
    palette.hidden = true;
    palette.setAttribute('role', 'listbox');
    form.appendChild(palette);

    function render() {
      const query = input.value.trim();
      const entries = [...getPrefixMatches(query), ...getCommandMatches(query), ...getBookmarkMatches(query)].slice(0, 8);
      if (!query || !entries.length) {
        palette.hidden = true;
        palette.innerHTML = '';
        return;
      }
      palette.hidden = false;
      palette.innerHTML = entries.map((entry, index) => {
        const meta = entry.type === 'command' ? 'Commande' : (entry.type === 'prefix' ? entry.meta : entry.group);
        return `<button type="button" class="command-item${index === 0 ? ' is-active' : ''}" data-index="${index}" role="option">
          <span>${escapeHtml(entry.label)}</span>
          <small>${escapeHtml(meta)}</small>
        </button>`;
      }).join('');
      palette._entries = entries;
    }

    function executeEntry(entry) {
      if (!entry) return false;
      if (entry.type === 'command') return executeCommand(entry.command);
      if (entry.type === 'prefix') {
        input.value = entry.raw;
        form.requestSubmit();
        return true;
      }
      if (entry.type === 'bookmark') {
        toast(`Ouverture de ${entry.label}`);
        window.location.href = entry.url;
        return true;
      }
      return false;
    }

    function activeIndex() {
      return $$('.command-item', palette).findIndex(btn => btn.classList.contains('is-active'));
    }

    function setActive(index) {
      const items = $$('.command-item', palette);
      items.forEach((btn, i) => btn.classList.toggle('is-active', i === index));
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    document.addEventListener('click', (event) => {
      if (!form.contains(event.target)) palette.hidden = true;
    });

    input.addEventListener('keydown', (event) => {
      if (palette.hidden) return;
      const items = $$('.command-item', palette);
      if (!items.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((activeIndex() + 1 + items.length) % items.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((activeIndex() - 1 + items.length) % items.length);
      } else if (event.key === 'Tab') {
        const idx = Math.max(0, activeIndex());
        const entry = palette._entries?.[idx];
        if (entry) {
          event.preventDefault();
          input.value = entry.type === 'command' ? entry.key : (entry.type === 'prefix' ? entry.raw : entry.label);
          render();
        }
      }
    });

    palette.addEventListener('click', (event) => {
      const btn = event.target.closest('.command-item');
      if (!btn) return;
      executeEntry(palette._entries?.[Number(btn.dataset.index)]);
    });

    form.addEventListener('submit', (event) => {
      const query = input.value.trim();
      if (!query || /^[way] /i.test(query)) return;
      const [command] = getCommandMatches(query).filter(item => normalize(item.key) === normalize(query));
      const [bookmark] = getBookmarkMatches(query).filter(item => item.score >= 70);
      if (command && executeCommand(command.command)) {
        event.preventDefault();
        palette.hidden = true;
        return;
      }
      if (bookmark) {
        event.preventDefault();
        executeEntry(bookmark);
      }
    }, true);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function installHint() {
    const form = $('#search-form');
    if (!form || $('.quick-command-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'quick-command-hint';
    hint.innerHTML = 'Commandes : <kbd>silex</kbd>, <kbd>focus</kbd>, <kbd>code</kbd>, <kbd>perso</kbd> — recherche : <kbd>g</kbd>, <kbd>ai</kbd>, <kbd>drive</kbd>, <kbd>cal</kbd>, <kbd>gh</kbd>…';
    form.insertAdjacentElement('afterend', hint);
  }

  function placeQuickControls() {
    const form = $('#search-form');
    const controls = ensureQuickControls();
    if (!form || !controls) return;
    const hint = $('.quick-command-hint');
    if (hint) hint.insertAdjacentElement('afterend', controls);
    else form.insertAdjacentElement('afterend', controls);
  }

  function observeBookmarkRender() {
    const container = $('#bookmark-container');
    if (!container) return;
    const apply = () => applyProfile(localStorage.getItem(PROFILE_KEY) || 'silex', false);
    new MutationObserver(() => setTimeout(apply, 0)).observe(container, { childList: true });
  }

  window.StartpagePlus = { applyProfile, setDensity, getBookmarkMatches, setFocusMode, toggleFocusMode };

  window.addEventListener('DOMContentLoaded', () => {
    let focusOn = true;
    try {
      const savedFocus = localStorage.getItem(FOCUS_KEY);
      focusOn = savedFocus === null ? true : savedFocus === '1';
    } catch (_) {}
    setFocusMode(focusOn, false);
    installProfileControls();
    installHint();
    installProfilePill();
    installFocusPill();
    placeQuickControls();
    installCommandPalette();
    observeBookmarkRender();
    setTimeout(() => applyProfile(localStorage.getItem(PROFILE_KEY) || 'silex', false), 0);
  });
})();
