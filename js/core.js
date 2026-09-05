/* ===== js/utils.js ===== */
// --- Noyau Start Desk ---
(function initStartDeskCore(global) {
  const existing = global.StartDesk || {};
  const listeners = existing.__listeners instanceof Map ? existing.__listeners : new Map();

  const StartDesk = Object.assign(existing, {
    version: existing.version || '3.0.0',
    modules: existing.modules || {},
    state: existing.state || {},

    register(name, api = {}) {
      if (!name || typeof name !== 'string') {
        throw new TypeError('StartDesk.register attend un nom de module valide.');
      }
      this.modules[name] = Object.assign(this.modules[name] || {}, api);
      return this.modules[name];
    },

    on(eventName, handler) {
      if (typeof handler !== 'function') return () => {};
      const handlers = listeners.get(eventName) || new Set();
      handlers.add(handler);
      listeners.set(eventName, handlers);
      return () => handlers.delete(handler);
    },

    once(eventName, handler) {
      const unsubscribe = this.on(eventName, (...args) => {
        unsubscribe();
        handler(...args);
      });
      return unsubscribe;
    },

    off(eventName, handler) {
      const handlers = listeners.get(eventName);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) listeners.delete(eventName);
    },

    emit(eventName, detail) {
      const handlers = listeners.get(eventName);
      if (handlers) {
        [...handlers].forEach((handler) => {
          try { handler(detail); }
          catch (error) { console.error(`[StartDesk] événement ${eventName}:`, error); }
        });
      }
      global.dispatchEvent(new CustomEvent(`startdesk:${eventName}`, { detail }));
    }
  });

  Object.defineProperty(StartDesk, '__listeners', {
    value: listeners,
    configurable: false,
    enumerable: false,
    writable: false
  });

  global.StartDesk = StartDesk;
})(window);

// --- Utilitaires ---

// --- Chat : valeur par défaut (masqué par défaut) ---
if (localStorage.getItem('showChat') === null) {
  localStorage.setItem('showChat', 'false');
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);
function getTime() { const d = new Date(), pad = (n) => (n < 10 ? "0" + n : n); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function updateGreeting() { const h = new Date().getHours(); $('#greeting').textContent = (h >= 5 && h < 12) ? "Bonjour" : (h >= 12 && h < 18) ? "Bon après-midi" : "Bonsoir"; }

// --- Ré-ordonnancement des tuiles (Drag & Drop style macOS) ---
const TILE_ORDER_KEY = "startpage_tile_order_v1";
const defaultTileTitles = typeof bookmarks === 'undefined' ? [] : bookmarks.map(item => item.title);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function loadTileOrder() {
  try {
    const raw = localStorage.getItem(TILE_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveTileOrderFromDOM() {
  const titles = Array.from($$("#bookmark-container .bookmark-set"))
    .map(el => el.getAttribute("data-tile-title"))
    .filter(Boolean);
  try { localStorage.setItem(TILE_ORDER_KEY, JSON.stringify(titles)); } catch {}
}

function resetTileOrder() {
  try { localStorage.removeItem(TILE_ORDER_KEY); } catch {}
  if (typeof bookmarks !== 'undefined') {
    bookmarks.sort((a, b) => defaultTileTitles.indexOf(a.title) - defaultTileTitles.indexOf(b.title));
  }
}

let sortableLoadPromise = null;

function ensureSortableLoaded() {
  if (window.Sortable) return Promise.resolve(window.Sortable);
  if (sortableLoadPromise) return sortableLoadPromise;

  sortableLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
    script.dataset.startdeskSortable = '1';
    script.addEventListener('load', () => resolve(window.Sortable), { once: true });
    script.addEventListener('error', () => reject(new Error('SortableJS indisponible')), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    sortableLoadPromise = null;
    console.error(error);
    throw error;
  });

  return sortableLoadPromise;
}

function initTileSortable() {
  const container = $("#bookmark-container");
  if (!container) return;

  if (window.__tileSortable) {
    window.__tileSortable.destroy();
    window.__tileSortable = null;
  }

  const isEdit = document.body.classList.contains("edit-mode");
  if (!isEdit) return;

  if (!window.Sortable) {
    ensureSortableLoaded().then(initTileSortable).catch(() => {});
    return;
  }

  window.__tileSortable = new window.Sortable(container, {
    animation: 150,
    easing: "cubic-bezier(.2,.9,.2,1)",
    handle: ".tile-handle",
    draggable: ".bookmark-set",
    ghostClass: "tile-ghost",
    chosenClass: "tile-chosen",
    dragClass: "tile-dragging",
    forceFallback: false,
    swapThreshold: 0.65,
    onEnd: (evt) => {
      const item = evt.item;
      item.classList.add("tile-bounce");
      setTimeout(() => item.classList.remove("tile-bounce"), 180);
      saveTileOrderFromDOM();
    }
  });
}

function setTileSortableEnabled(enabled) {
  if (!enabled) {
    window.__tileSortable?.option("disabled", true);
    return;
  }

  if (window.__tileSortable) {
    window.__tileSortable.option("disabled", false);
    return;
  }

  ensureSortableLoaded().then(initTileSortable).catch(() => {});
}

StartDesk.register('utils', {
  $,
  $$,
  getTime,
  updateGreeting,
  escapeHtml,
  loadTileOrder,
  saveTileOrderFromDOM,
  resetTileOrder,
  initTileSortable,
  ensureSortableLoaded,
  setTileSortableEnabled
});

/* ===== js/bookmarks-ui.js ===== */
// --- Favoris ---
function setupBookmarks() {
  if (typeof bookmarks === 'undefined') return;

  // Tri A→Z des liens dans chaque tuile
  bookmarks.forEach(category => {
    category.links.sort((a, b) => a.name.localeCompare(b.name));
  });

  // Applique l’ordre mémorisé (si présent)
  const order = loadTileOrder();
  if (order && order.length) {
    const byTitle = new Map(bookmarks.map(b => [b.title, b]));
    const ordered = [];

    order.forEach(title => {
      if (byTitle.has(title)) ordered.push(byTitle.get(title));
    });

    // Ajoute ce qui n’est pas encore dans l’ordre (nouvelles tuiles)
    bookmarks.forEach(bookmark => {
      if (!order.includes(bookmark.title)) ordered.push(bookmark);
    });

    // Remplace en place pour préserver les références utilisées ailleurs
    bookmarks.length = 0;
    ordered.forEach(bookmark => bookmarks.push(bookmark));
  }

  const container = $('#bookmark-container');
  if (!container) return;

  container.innerHTML = bookmarks.map((bookmark, index) => `
    <section class="bookmark-set card glass" data-tile-title="${escapeHtml(bookmark.title)}" style="animation-delay: ${200 + (index * 100)}ms">
      <div class="bookmark-header">
        <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
        <button class="tile-handle" type="button" aria-label="Déplacer la tuile" title="Déplacer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5.5A1.5 1.5 0 1 1 7.5 4 1.5 1.5 0 0 1 9 5.5Zm0 6A1.5 1.5 0 1 1 7.5 10 1.5 1.5 0 0 1 9 11.5Zm0 6A1.5 1.5 0 1 1 7.5 16 1.5 1.5 0 0 1 9 17.5ZM16.5 7A1.5 1.5 0 1 1 18 5.5 1.5 1.5 0 0 1 16.5 7Zm0 6A1.5 1.5 0 1 1 18 11.5 1.5 1.5 0 0 1 16.5 13Zm0 6A1.5 1.5 0 1 1 18 17.5 1.5 1.5 0 0 1 16.5 19Z"></path>
          </svg>
        </button>
      </div>
      <div class="bookmark-inner-container">
        ${bookmark.links.map(link => `<a class="bookmark" href="${link.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.name)}</a>`).join('')}
      </div>
    </section>`).join('');

  initTileSortable();

  if (window.StartDesk) {
    StartDesk.emit('bookmarks:rendered', {
      categories: bookmarks.length,
      links: bookmarks.reduce((total, category) => total + category.links.length, 0)
    });
  }
}

function saveBookmarksOrder() {
  saveTileOrderFromDOM();
  if (window.StartDesk) StartDesk.emit('bookmarks:order-saved');
}

function resetBookmarksOrder() {
  resetTileOrder();
  setupBookmarks();
  if (window.StartDesk) StartDesk.emit('bookmarks:order-reset');
}

if (window.StartDesk) {
  StartDesk.register('bookmarks', {
    init: setupBookmarks,
    render: setupBookmarks,
    refresh: setupBookmarks,
    saveOrder: saveBookmarksOrder,
    resetOrder: resetBookmarksOrder
  });
}

/* ===== js/search.js ===== */
// --- Barre de recherche intelligente ---
(function() {
  // --- Recherche (moteur sélectionnable via clic sur le "G") ---
  const SEARCH_DEFAULT_ENGINE_KEY = "startpage_search_default_engine_v1";
  const GOOGLE_DEFAULT_MIGRATION_KEY = "startdesk_google_default_v1";

  // Placeholder "Spotlight-like" (stable, quel que soit le moteur)
  const BASE_PLACEHOLDER = "Rechercher, lancer un outil, poser une question…";
  const MOBILE_PLACEHOLDER = "Rechercher…";
  const mobileSearchQuery = window.matchMedia("(max-width: 560px)");

  const PREFIX_ENGINES = {
    "w ": { url: "https://fr.wikipedia.org/w/index.php", queryParam: "search", placeholder: "Rechercher sur Wikipédia..." },
    "a ": { url: "https://www.amazon.fr/s", queryParam: "k", placeholder: "Rechercher sur Amazon..." },
    "y ": { url: "https://www.youtube.com/results", queryParam: "search_query", placeholder: "Rechercher sur YouTube..." }
  };

  const ENGINES = {
    startpage:  { iconId: "i-startpage",  name: "Startpage",  url: "https://www.startpage.com/sp/search", queryParam: "query" },
    google:     { iconId: "i-google",     name: "Google",     url: "https://www.google.com/search", queryParam: "q" },
    duckduckgo: { iconId: "i-duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/", queryParam: "q" },
    bing:       { iconId: "i-bing",       name: "Bing",       url: "https://www.bing.com/search", queryParam: "q" },
    brave:      { iconId: "i-brave",      name: "Brave",      url: "https://search.brave.com/search", queryParam: "q" },

    // Raccourcis (aussi accessibles via préfixe dans la barre)
    wikipedia:  { iconId: "i-wikipedia", name: "Wikipedia", url: "https://fr.wikipedia.org/w/index.php", queryParam: "search" },
    amazon:     { iconId: "i-amazon",    name: "Amazon",    url: "https://www.amazon.com.be/s", queryParam: "k" },
    youtube:    { iconId: "i-youtube",   name: "YouTube",   url: "https://www.youtube.com/results", queryParam: "search_query" }
  };

  const searchForm = $("#search-form");
  const searchInput = $("#search-input");
  const engineBtn = $("#engine-button");
  const engineIconUse = $("#engine-icon-use");
  const engineMenu = $("#engine-menu");
  const engineOptions = engineMenu ? Array.from($$(".engine-option", engineMenu)) : [];
  let clearButton = null;
  let ignoreSyntheticEngineClickUntil = 0;

  function keepSpotlightFocused() {
    try { searchInput && searchInput.focus({ preventScroll: true }); }
    catch (error) {
      try { searchInput && searchInput.focus(); } catch (_) {}
    }
  }

  function getDefaultEngineId() {
    try {
      // Migration unique : remet Google par défaut sur les installations existantes.
      // Une fois appliquée, les changements manuels restent prioritaires.
      if (localStorage.getItem(GOOGLE_DEFAULT_MIGRATION_KEY) !== "1") {
        localStorage.setItem(SEARCH_DEFAULT_ENGINE_KEY, "google");
        localStorage.setItem(GOOGLE_DEFAULT_MIGRATION_KEY, "1");
        return "google";
      }

      const saved = localStorage.getItem(SEARCH_DEFAULT_ENGINE_KEY);
      return (saved && ENGINES[saved]) ? saved : "google";
    } catch (_) {
      return "google";
    }
  }

  function setDefaultEngineId(engineId) {
    if (!ENGINES[engineId]) return;
    localStorage.setItem(SEARCH_DEFAULT_ENGINE_KEY, engineId);
    applyDefaultEngine(engineId);
    window.StartDesk?.emit?.("search:engine-changed", { engineId });
  }

  function setEngineIcon(iconId) {
    if (!engineIconUse) return;
    const href = "#" + (iconId || "i-startpage");
    engineIconUse.setAttribute("href", href);
    engineIconUse.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
  }

  function applyDefaultEngine(engineId) {
    if (!searchForm || !searchInput || !engineBtn) return;
    const engine = ENGINES[engineId] || ENGINES.startpage;
    searchForm.action = engine.url;
    searchInput.name = engine.queryParam;
    setEngineIcon(engine.iconId);
    engineBtn.title = engine.name;
    searchInput.placeholder = mobileSearchQuery.matches ? MOBILE_PLACEHOLDER : BASE_PLACEHOLDER;

    engineOptions.forEach((btn) => {
      const active = btn.dataset.engine === engineId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  mobileSearchQuery.addEventListener?.("change", () => {
    applyDefaultEngine(getDefaultEngineId());
  });

  function updateClearButton() {
    if (!clearButton || !searchInput) return;
    const visible = searchInput.value.length > 0;
    clearButton.classList.toggle("is-visible", visible);
    clearButton.tabIndex = visible ? 0 : -1;
    clearButton.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function clearSearch() {
    if (!searchInput) return;
    searchInput.value = "";
    applyDefaultEngine(getDefaultEngineId());
    updateClearButton();
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    keepSpotlightFocused();
    window.StartDesk?.emit?.("search:cleared");
  }

  function installClearButton() {
    if (!searchForm || !searchInput || searchForm.querySelector(".search-clear-button")) return;

    clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "search-clear-button";
    clearButton.setAttribute("aria-label", "Effacer la recherche");
    clearButton.setAttribute("title", "Effacer");
    clearButton.setAttribute("aria-hidden", "true");
    clearButton.tabIndex = -1;
    clearButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.35 6.35a.9.9 0 0 1 1.27 0L10 8.73l2.38-2.38a.9.9 0 1 1 1.27 1.27L11.27 10l2.38 2.38a.9.9 0 1 1-1.27 1.27L10 11.27l-2.38 2.38a.9.9 0 1 1-1.27-1.27L8.73 10 6.35 7.62a.9.9 0 0 1 0-1.27Z"/></svg>';

    const submitButton = searchForm.querySelector('button[type="submit"]');
    searchForm.insertBefore(clearButton, submitButton || null);

    // Évite le petit saut de focus au pointer-down : le champ reste le centre de Spotlight.
    clearButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });

    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
    });

    const style = document.createElement("style");
    style.id = "start-desk-search-clear-style";
    style.textContent = `
      html.start-desk #search-form.spotlight #search-input {
        flex: 1 1 auto;
        width: auto;
        min-width: 0;
        -webkit-appearance: none;
        appearance: none;
      }
      html.start-desk #search-form.spotlight #search-input::-webkit-search-cancel-button,
      html.start-desk #search-form.spotlight #search-input::-webkit-search-decoration,
      html.start-desk #search-form.spotlight #search-input::-webkit-search-results-button,
      html.start-desk #search-form.spotlight #search-input::-webkit-search-results-decoration {
        -webkit-appearance: none;
        appearance: none;
        display: none;
      }
      html.start-desk #search-form.spotlight .search-clear-button {
        flex: 0 0 28px;
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        margin: 0 2px 0 10px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fg) 8%, transparent);
        color: var(--secondaryFg);
        opacity: 0;
        transform: scale(.86);
        pointer-events: none;
        cursor: pointer;
        transition: opacity 120ms ease, transform 160ms cubic-bezier(.22,1,.36,1), background-color 120ms ease, color 120ms ease;
      }
      html.start-desk #search-form.spotlight .search-clear-button.is-visible {
        opacity: 1;
        transform: scale(1);
        pointer-events: auto;
      }
      html.start-desk #search-form.spotlight .search-clear-button:hover {
        background: color-mix(in srgb, var(--fg) 13%, transparent);
        color: var(--fg);
      }
      html.start-desk #search-form.spotlight .search-clear-button:active {
        transform: scale(.94);
      }
      html.start-desk #search-form.spotlight .search-clear-button:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--start-accent) 70%, transparent);
        outline-offset: 2px;
      }
      html.start-desk #search-form.spotlight .search-clear-button svg {
        display: block;
        width: 15px;
        height: 15px;
        fill: currentColor;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        html.start-desk #search-form.spotlight .search-clear-button { transition: none !important; }
      }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);
    updateClearButton();
  }

  function openEngineMenu() {
    if (!engineMenu || !engineBtn) return;
    engineMenu.hidden = false;
    engineBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("engine-open");
    const current = getDefaultEngineId();
    const activeBtn = engineOptions.find((button) => button.dataset.engine === current) || engineOptions[0];
    activeBtn?.focus();
  }

  function closeEngineMenu({ focusButton = false } = {}) {
    if (!engineMenu || !engineBtn) return;
    engineMenu.hidden = true;
    engineBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("engine-open");
    if (focusButton) engineBtn.focus();
  }

  function toggleEngineMenu() {
    if (!engineMenu) return;
    if (engineMenu.hidden) openEngineMenu();
    else closeEngineMenu({ focusButton: true });
  }

  function detectPrefixEngine(query) {
    return Object.keys(PREFIX_ENGINES).find((prefix) => query.startsWith(prefix)) || null;
  }

  function focus() {
    keepSpotlightFocused();
  }

  function init() {
    applyDefaultEngine(getDefaultEngineId());
    installClearButton();
  }

  init();

  function markTouchInteractionHandled() {
    // Safari iOS may emit a synthetic click after touchend. Ignore it so the
    // menu is not immediately toggled again and an option is not selected twice.
    ignoreSyntheticEngineClickUntil = Date.now() + 700;
  }

  function selectEngine(button, { restoreSearchFocus = true } = {}) {
    const id = button?.dataset.engine;
    setDefaultEngineId(id);
    window.StartDeskHaptics?.trigger?.(button);
    closeEngineMenu({ focusButton: restoreSearchFocus });
    if (restoreSearchFocus) keepSpotlightFocused();
  }

  engineBtn?.addEventListener("touchend", (event) => {
    event.preventDefault();
    event.stopPropagation();
    markTouchInteractionHandled();
    toggleEngineMenu();
  }, { passive: false });

  engineBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() < ignoreSyntheticEngineClickUntil) return;
    toggleEngineMenu();
  });

  engineOptions.forEach((button) => {
    button.addEventListener("touchend", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markTouchInteractionHandled();
      selectEngine(button, { restoreSearchFocus: false });
    }, { passive: false });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (Date.now() < ignoreSyntheticEngineClickUntil) return;
      selectEngine(button);
    });
  });

  document.addEventListener("click", (event) => {
    if (!engineMenu || engineMenu.hidden) return;
    const target = event.target;
    if (engineMenu.contains(target) || engineBtn?.contains(target)) return;
    closeEngineMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (!engineMenu || engineMenu.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeEngineMenu({ focusButton: true });
    }
  });

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value || "";
    const prefix = detectPrefixEngine(query);
    if (prefix) {
      const engine = PREFIX_ENGINES[prefix];
      searchForm.action = engine.url;
      searchInput.name = engine.queryParam;
      searchInput.placeholder = BASE_PLACEHOLDER;
    } else {
      applyDefaultEngine(getDefaultEngineId());
    }
    updateClearButton();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchInput.value) {
      event.preventDefault();
      clearSearch();
    }
  });

  searchForm?.addEventListener("submit", () => {
    const query = (searchInput?.value || "").trim();
    const prefix = detectPrefixEngine(query);
    if (!prefix) return;
    searchInput.value = query.substring(prefix.length).trim();
    updateClearButton();
  });

  // Raccourcis clavier
  window.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase() || "";
    const isInputFocused = activeTag === "input" || activeTag === "textarea";

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      focus();
    }

    if (isInputFocused) return;

    if (event.key === "/") {
      event.preventDefault();
      focus();
    }

    if (event.altKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      const input = $(".chat-panel:not([hidden]) .chat-form input");
      if (input) input.focus();
    }
  });

  window.StartDesk?.register?.("search", {
    init,
    focus,
    clear: clearSearch,
    getDefaultEngine: getDefaultEngineId,
    setDefaultEngine: setDefaultEngineId,
    applyDefaultEngine,
    openMenu: openEngineMenu,
    closeMenu: closeEngineMenu,
    toggleMenu: toggleEngineMenu,
    detectPrefix: detectPrefixEngine,
    engines: ENGINES,
    prefixEngines: PREFIX_ENGINES
  });
})();

/* ===== js/settings.js ===== */
// --- Réglages Start Desk ---
(function initSettingsModule(global) {
  const StartDesk = global.StartDesk;
  const $ = (selector, root = document) => root.querySelector(selector);

  const EDIT_MODE_KEY = 'startpage_edit_mode_v1';
  const COLLAPSE_KEY = 'startpage_widget_collapsed_v4';
  const HIDDEN_KEY = 'startpage_widget_hidden_v4';

  let initialized = false;
  let panelCloseTimer = null;
  let panelPinnedByClick = false;


  function emit(eventName, detail) {
    StartDesk?.emit?.(eventName, detail);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  }

  function applySetting(key, value, action) {
    try { localStorage.setItem(key, String(value)); }
    catch (_) {}
    action(value);
    emit('settings:changed', { key, value });
  }

  function openPanel(options = {}) {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    if (!panel || !overlay) return;
    panel.setAttribute('aria-hidden', 'false');
    panel.removeAttribute('inert');
    overlay.hidden = false;
    document.body.classList.add('panel-open');
    if (options.pinned) panelPinnedByClick = true;
    $('#settings-toggle-btn')?.setAttribute('aria-expanded', 'true');
    $('#panel-close-btn')?.focus();
    emit('settings:panel-opened', { pinned: !!options.pinned });
  }

  function closePanel() {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    if (!panel || !overlay) return;
    if (panel.contains(document.activeElement)) $('#settings-toggle-btn')?.focus();
    $('#settings-toggle-btn')?.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
    overlay.hidden = true;
    document.body.classList.remove('panel-open');
    panelPinnedByClick = false;
    emit('settings:panel-closed');
  }

  function setupPanel() {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    const toggleBtn = $('#settings-toggle-btn');
    const closeBtn = $('#panel-close-btn');
    if (!panel || !overlay || !toggleBtn || !closeBtn) return;
    panel.setAttribute('inert', '');
    toggleBtn.setAttribute('aria-controls', 'control-panel');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.addEventListener('click', () => {
      if (document.body.classList.contains('panel-open')) closePanel();
      else openPanel({ pinned: true });
    });
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    global.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('panel-open')) closePanel();
    });
  }

  function setupWeatherLocation() {
    const input = $('#weather-location-input');
    const saveBtn = $('#weather-location-save');
    if (!input || !saveBtn) return;
    input.value = localStorage.getItem('weatherLocation') || '';

    const save = () => {
      const location = input.value.trim();
      if (!location) return;
      localStorage.setItem('weatherLocation', location);
      if (typeof global.getWeather === 'function') global.getWeather();
      else StartDesk?.modules?.weather?.refresh?.();
      emit('settings:weather-location-changed', { location });
      closePanel();
    };

    saveBtn.addEventListener('click', save);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
  }

  function setupSelector(selectorId, storageKey, action, defaultValue) {
    const selector = $(selectorId);
    if (!selector) return;
    const buttons = Array.from(selector.querySelectorAll('button'));
    const savedValue = localStorage.getItem(storageKey) || defaultValue;
    action(savedValue);
    buttons.forEach((button) => button.classList.toggle('active', button.dataset.value === savedValue));

    selector.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target?.dataset.value) return;
      applySetting(storageKey, target.dataset.value, action);
      buttons.forEach((button) => button.classList.remove('active'));
      target.classList.add('active');
    });
  }

  function setupAppearance() {
    const root = document.documentElement;
    const colorScheme = global.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (preference) => {
      let effective = preference;
      if (preference === 'system') effective = colorScheme.matches ? 'dark' : 'light';
      if (preference === 'mac') effective = colorScheme.matches ? 'macos-dark' : 'macos-light';
      root.setAttribute('data-theme', effective);
      root.setAttribute('data-theme-pref', preference);
      root.style.colorScheme = effective.includes('dark') ? 'dark' : 'light';
    };

    const refreshSystemTheme = () => {
      const saved = localStorage.getItem('theme') || 'system';
      if (saved === 'system' || saved === 'mac') applyTheme(saved);
    };

    try { colorScheme.addEventListener('change', refreshSystemTheme); }
    catch (_) { try { colorScheme.addListener(refreshSystemTheme); } catch (_) {} }

    setupSelector('#theme-selector', 'theme', applyTheme, 'system');
    setupSelector('#density-selector', 'density', (value) => root.setAttribute('data-density', value), 'cozy');
  }

  function applyEditMode(enabled) {
    document.body.classList.toggle('edit-mode', !!enabled);
    if (typeof global.setTileSortableEnabled === 'function') global.setTileSortableEnabled(!!enabled);
    try { localStorage.setItem(EDIT_MODE_KEY, enabled ? '1' : '0'); }
    catch (_) {}
    emit('settings:edit-mode-changed', { enabled: !!enabled });
  }

  function setupEditMode() {
    const toggle = $('#edit-mode-toggle');
    if (!toggle) {
      applyEditMode(false);
      return;
    }
    const initial = localStorage.getItem(EDIT_MODE_KEY) === '1';
    toggle.checked = initial;
    applyEditMode(initial);
    toggle.addEventListener('change', () => applyEditMode(toggle.checked));
  }

  function setupTileReset() {
    const toggle = $('#tiles-reset-toggle');
    if (!toggle) return;
    let previousOrder;
    const undo = $('#tiles-reset-undo');
    toggle.addEventListener('click', () => {
      if (undo.hidden) previousOrder = localStorage.getItem('startpage_tile_order_v1');
      global.resetTileOrder?.();
      global.setupBookmarks?.();
      undo.hidden = false;
      $('#tiles-reset-status').textContent = 'Ordre initial rétabli.';
      emit('settings:tile-order-reset');
    });
    undo.addEventListener('click', () => {
      if (previousOrder === null) global.resetTileOrder?.();
      else localStorage.setItem('startpage_tile_order_v1', previousOrder);
      global.setupBookmarks?.();
      toggle.focus();
      undo.hidden = true;
      $('#tiles-reset-status').textContent = 'Votre ordre a été restauré.';
    });
  }

  function getPanelToggle(widgetId) {
    return document.getElementById(`${widgetId}-toggle`);
  }

  function persistWidgetVisibility(widgetId, hidden, hiddenState) {
    hiddenState[widgetId] = !!hidden;
    writeJson(HIDDEN_KEY, hiddenState);
    if (widgetId === 'news') localStorage.setItem('showNews', hidden ? 'false' : 'true');
    if (widgetId === 'chat') localStorage.setItem('showChat', hidden ? 'false' : 'true');
    if (widgetId === 'calendar') localStorage.setItem('calendarHidden', hidden ? '1' : '0');
  }

  function applyHiddenState(widgetId, hidden) {
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widget) {
      widget.style.removeProperty('display');
      widget.hidden = !!hidden;
    }
    document.body.classList.toggle(`${widgetId}-hidden`, !!hidden);
    const toggle = getPanelToggle(widgetId);
    if (toggle) toggle.checked = !hidden;

    if (widgetId === 'news') localStorage.setItem('showNews', hidden ? 'false' : 'true');
    if (widgetId === 'chat') localStorage.setItem('showChat', hidden ? 'false' : 'true');
    if (widgetId === 'calendar') localStorage.setItem('calendarHidden', hidden ? '1' : '0');
  }

  function setupWidgets() {
    const collapsedState = readJson(COLLAPSE_KEY);
    const hiddenState = readJson(HIDDEN_KEY);

    ['news', 'chat', 'calendar'].forEach((widgetId) => {
      if (typeof hiddenState[widgetId] !== 'boolean') {
        if (widgetId === 'news') hiddenState.news = localStorage.getItem('showNews') === 'false';
        if (widgetId === 'chat') hiddenState.chat = localStorage.getItem('showChat') === 'false';
        if (widgetId === 'calendar') hiddenState.calendar = localStorage.getItem('calendarHidden') === '1';
      }
    });
    writeJson(HIDDEN_KEY, hiddenState);

    document.querySelectorAll('.widget-shell[data-widget-id]').forEach((widget) => {
      const widgetId = widget.dataset.widgetId;
      const toolbar = widget.querySelector('.widget-toolbar');
      const closeBtn = widget.querySelector('[data-widget-close]');

      widget.classList.toggle('is-collapsed', !!collapsedState[widgetId]);
      applyHiddenState(widgetId, !!hiddenState[widgetId]);

      toolbar?.addEventListener('click', (event) => {
        if (event.target.closest('button') || hiddenState[widgetId]) return;
        const wasCollapsed = widget.classList.contains('is-collapsed');
        const collapsed = !wasCollapsed;
        widget.classList.toggle('is-collapsed', collapsed);
        if (wasCollapsed && !collapsed) {
          widget.classList.remove('is-expanding');
          requestAnimationFrame(() => {
            widget.classList.add('is-expanding');
            setTimeout(() => widget.classList.remove('is-expanding'), 420);
          });
        }
        collapsedState[widgetId] = collapsed;
        writeJson(COLLAPSE_KEY, collapsedState);
        emit('settings:widget-collapsed', { widgetId, collapsed });
      });

      closeBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        persistWidgetVisibility(widgetId, true, hiddenState);
        applyHiddenState(widgetId, true);
        emit('settings:widget-visibility-changed', { widgetId, visible: false });
      });
    });

    ['news', 'chat', 'calendar'].forEach((widgetId) => {
      const toggle = getPanelToggle(widgetId);
      if (!toggle) return;
      toggle.checked = !hiddenState[widgetId];
      toggle.addEventListener('change', () => {
        const hidden = !toggle.checked;
        persistWidgetVisibility(widgetId, hidden, hiddenState);
        applyHiddenState(widgetId, hidden);
        if (toggle.checked && typeof global.StartDeskLoadSecondary === 'function') {
          global.StartDeskLoadSecondary();
        }
        emit('settings:widget-visibility-changed', { widgetId, visible: toggle.checked });
      });
    });

    const syncFromBodyClasses = () => {
      ['news', 'chat', 'calendar'].forEach((widgetId) => {
        const hidden = document.body.classList.contains(`${widgetId}-hidden`);
        if (hiddenState[widgetId] === hidden) return;
        persistWidgetVisibility(widgetId, hidden, hiddenState);
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (widget) {
          widget.style.removeProperty('display');
          widget.hidden = hidden;
        }
        const toggle = getPanelToggle(widgetId);
        if (toggle) toggle.checked = !hidden;
      });
    };

    new MutationObserver(syncFromBodyClasses).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    setupPanel();
    setupWeatherLocation();
    setupAppearance();
    setupEditMode();
    setupTileReset();
    setupWidgets();
    emit('settings:ready');
  }

  const api = {
    init,
    openPanel,
    closePanel,
    applyEditMode,
    applyHiddenState
  };

  if (StartDesk?.register) StartDesk.register('settings', api);
  else global.StartDeskSettings = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);

/* ===== js/app.js ===== */
// --- Init ---
    const SECONDARY_SCRIPTS = [
      'js/weather.js',
      'js/news.js',
      'js/chat.js',
      'js/calendar.js',
      'js/dashboard.js'
    ];
    let secondaryModulesPromise = null;
    let initialWeatherLoaded = false;

    function loadScriptOnce(src) {
      const existing = document.querySelector(`script[data-startdesk-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return Promise.resolve();
        return new Promise((resolve, reject) => {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        });
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.dataset.startdeskSrc = src;
        script.addEventListener('load', () => {
          script.dataset.loaded = '1';
          resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Impossible de charger ${src}`)), { once: true });
        document.body.appendChild(script);
      });
    }

    function loadSecondaryModules() {
      if (!secondaryModulesPromise) {
        secondaryModulesPromise = Promise.all(SECONDARY_SCRIPTS.map(loadScriptOnce))
          .catch((error) => {
            secondaryModulesPromise = null;
            console.error('Modules secondaires:', error);
            throw error;
          });
      }
      return secondaryModulesPromise;
    }

    async function loadSecondaryData() {
      if (document.body.classList.contains('focus-mode')) return;

      await loadSecondaryModules();

      if (!initialWeatherLoaded && typeof getWeather === 'function') {
        initialWeatherLoaded = true;
        getWeather();
      }

      const showNews = localStorage.getItem('showNews') !== 'false';
      if (showNews && typeof loadNews === 'function' && !window.__newsLoaded) loadNews();

      const showCalendar = localStorage.getItem('calendarHidden') !== '1';
      if (showCalendar && typeof window.loadCalendarEvents === 'function') {
        window.loadCalendarEvents();
      }
    }

    window.StartDeskLoadSecondary = loadSecondaryData;
    window.addEventListener('startdesk:focus-changed', (event) => {
      if (!event.detail?.focus) loadSecondaryData();
    });

    window.addEventListener("load", () => {
      updateGreeting(); $("#clock").textContent = getTime();
      setInterval(() => { $("#clock").textContent = getTime(); if (new Date().getSeconds() === 0) updateGreeting(); }, 1000);
      setupBookmarks();
      loadSecondaryData();
    });


    // --- Spotlight: garder le focus sur l'input quand on clique le sélecteur moteur ---
    (function focusKeeperEngineMenu(){
      const searchInput = document.getElementById("search-input");
      const engineButton = document.getElementById("engine-button");
      const engineMenu = document.getElementById("engine-menu");
      if (!searchInput || !engineButton || !engineMenu) return;

      const refocus = () => {
        try { searchInput.focus({ preventScroll: true }); }
        catch (e) { try { searchInput.focus(); } catch(_){} }
      };

      const preventFocus = (el) => {
        if (!el) return;
        const handler = (e) => { e.preventDefault(); refocus(); };
        el.addEventListener("pointerdown", handler, { passive: false, capture: true });
        el.addEventListener("mousedown", handler, { passive: false, capture: true });
        el.addEventListener("touchstart", handler, { passive: false, capture: true });
      };

      preventFocus(engineButton);

      const wireOptions = () => engineMenu.querySelectorAll(".engine-option").forEach(preventFocus);
      wireOptions();

      // Si le menu est mis à jour dynamiquement, on rebranche
      const mo = new MutationObserver(wireOptions);
      mo.observe(engineMenu, { childList: true, subtree: true });

      // Après click (toggle / selection), on refocus aussi (au cas où)
      engineButton.addEventListener("click", () => setTimeout(refocus, 0), true);
      engineMenu.addEventListener("click", (e) => {
        if (e.target && e.target.closest(".engine-option")) setTimeout(refocus, 0);
      }, true);
    })();


    // --- Mode automatique Matin / Journée / Soir ---
    (function startpageContextMode(){
      const AUTO_KEY = 'startpage_auto_context_v1';
      const LAST_BUCKET_KEY = 'startpage_auto_context_last_bucket_v1';
      const $ = (sel, root = document) => root.querySelector(sel);
      const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

      function getBucket(date = new Date()) {
        const hour = date.getHours();
        if (hour >= 5 && hour < 10) {
          return {
            id: 'morning',
            label: 'Matin',
            profile: 'work',
            density: 'dashboard',
            focus: false,
            widgets: { calendar: true, news: false, chat: false }
          };
        }
        if (hour >= 10 && hour < 18) {
          return {
            id: 'day',
            label: 'Journée',
            profile: 'work',
            density: 'cozy',
            focus: false,
            widgets: { calendar: true, news: false, chat: false }
          };
        }
        return {
          id: 'evening',
          label: 'Soir',
          profile: 'personal',
          density: 'cozy',
          focus: false,
          widgets: { calendar: true, news: true, chat: false }
        };
      }

      function isAutoEnabled() {
        return localStorage.getItem(AUTO_KEY) === '1';
      }

      function setWidgetVisible(widget, visible) {
        const toggle = widget === 'calendar' ? $('#calendar-toggle') : $(`#${widget}-toggle`);
        if (widget === 'calendar') {
          document.body.classList.toggle('calendar-hidden', !visible);
          localStorage.setItem('calendarHidden', visible ? '0' : '1');
        } else {
          document.body.classList.toggle(`${widget}-hidden`, !visible);
          localStorage.setItem(`show${widget[0].toUpperCase()}${widget.slice(1)}`, visible ? 'true' : 'false');
        }
        if (toggle) toggle.checked = visible;

        if (visible && !document.body.classList.contains('focus-mode')) {
          if (widget === 'news' && typeof loadNews === 'function' && !window.__newsLoaded) loadNews();
          if (widget === 'calendar' && typeof window.loadCalendarEvents === 'function') {
            window.loadCalendarEvents();
          }
        }
      }

      function setDensityNormal() {
        const plus = window.StartpagePlus;
        if (plus && typeof plus.setDensity === 'function') plus.setDensity('cozy');
        document.documentElement.setAttribute('data-density', 'cozy');
        $$('#density-selector button[data-value]').forEach(btn => btn.classList.toggle('active', btn.dataset.value === 'cozy'));
        try {
          localStorage.setItem('density', 'cozy');
          localStorage.setItem('startpage_density_v2', 'cozy');
        } catch (_) {}
      }

      function applyCompleteMode(notify = false) {
        const plus = window.StartpagePlus;
        if (plus && typeof plus.applyProfile === 'function') plus.applyProfile('full', false);
        else document.body.dataset.startpageProfile = 'full';

        if (plus && typeof plus.setFocusMode === 'function') plus.setFocusMode(false, false);
        else document.body.classList.remove('focus-mode');

        setDensityNormal();
        ['calendar', 'news', 'chat'].forEach(widget => setWidgetVisible(widget, true));
        localStorage.setItem(LAST_BUCKET_KEY, 'manual-full');
        updateAutoUi(getBucket());
        if (notify) toast('Mode auto coupé · page complète');
      }

      function disableAuto(resetToComplete = true) {
        localStorage.setItem(AUTO_KEY, '0');
        if (resetToComplete) applyCompleteMode(true);
        else { updateAutoUi(); toast('Mode automatique coupé'); }
      }

      function applyMobileMode(notify = true) {
        localStorage.setItem(AUTO_KEY, '0');
        const plus = window.StartpagePlus;
        if (plus && typeof plus.applyProfile === 'function') plus.applyProfile('silex', false);
        else document.body.dataset.startpageProfile = 'silex';

        if (plus && typeof plus.setFocusMode === 'function') plus.setFocusMode(true, false);
        else document.body.classList.add('focus-mode');

        setDensityNormal();
        setWidgetVisible('news', false);
        setWidgetVisible('chat', false);
        localStorage.setItem(LAST_BUCKET_KEY, 'manual-mobile');
        updateAutoUi(getBucket());
        if (notify) toast('Mode mobile rétabli · Silex + Focus');
        window.dispatchEvent(new CustomEvent('startdesk:mobile-mode'));
      }

      window.StartDeskAutoContext = Object.assign(window.StartDeskAutoContext || {}, {
        applyMobileMode,
        isEnabled: isAutoEnabled
      });

      function applyBucket(bucket, notify = false) {
        const plus = window.StartpagePlus;
        if (plus && typeof plus.applyProfile === 'function') plus.applyProfile(bucket.profile, false);
        if (plus && typeof plus.setDensity === 'function') plus.setDensity(bucket.density);
        if (plus && typeof plus.setFocusMode === 'function') plus.setFocusMode(bucket.focus, false);
        Object.entries(bucket.widgets).forEach(([widget, visible]) => setWidgetVisible(widget, visible));
        localStorage.setItem(LAST_BUCKET_KEY, bucket.id);
        updateAutoUi(bucket);
        if (notify) toast(`Mode automatique : ${bucket.label}`);
      }

      function updateAutoUi(bucket = getBucket()) {
        const enabled = isAutoEnabled();
        $$('.startpage-auto-pill').forEach(btn => {
          btn.classList.toggle('active', enabled);
          btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
          btn.textContent = enabled ? `Auto : ON · ${bucket.label}` : 'Auto : OFF';
          btn.title = enabled
            ? 'Mode automatique actif — cliquer pour le couper'
            : 'Mode automatique coupé — cliquer pour le réactiver';
        });
        const toggle = $('#auto-context-toggle');
        if (toggle) toggle.checked = enabled;
      }

      function installAutoPanelControl() {
        const panelContent = $('#control-panel .panel-content');
        if (!panelContent || $('#auto-context-toggle')) return;
        const section = document.createElement('div');
        section.className = 'panel-section startpage-auto-section';
        section.innerHTML = `
          <div>
            <label for="auto-context-toggle">Mode automatique</label>
            <small class="muted" style="display:block;margin-top:.18rem;line-height:1.25;">Quand il est coupé, la page revient en mode Complet.</small>
          </div>
          <label class="toggle-switch" title="Activer ou désactiver l’adaptation selon l’heure">
            <input type="checkbox" id="auto-context-toggle">
            <span class="slider"></span>
          </label>
        `;
        const profileSection = $('.startpage-profile-section');
        panelContent.insertBefore(section, profileSection ? profileSection.nextSibling : panelContent.firstChild);
        $('#auto-context-toggle').addEventListener('change', (event) => {
          localStorage.setItem(AUTO_KEY, event.target.checked ? '1' : '0');
          if (event.target.checked) applyBucket(getBucket(), true);
          else disableAuto(true);
        });
      }

      function installAutoPill() {
        const controls = $('.startpage-quick-controls');
        if (!controls) return;
        let pill = $('.startpage-auto-pill');
        if (!pill) {
          pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'startpage-auto-pill';
          pill.title = 'Adapter automatiquement la page selon le moment de la journée';
          controls.appendChild(pill);
        }
        if (!pill.dataset.bound) {
          pill.addEventListener('click', () => {
            const next = !isAutoEnabled();
            localStorage.setItem(AUTO_KEY, next ? '1' : '0');
            if (next) applyBucket(getBucket(), true);
            else disableAuto(true);
          });
          pill.dataset.bound = '1';
        }
      }

      function installSearchCommand() {
        const form = $('#search-form');
        const input = $('#search-input');
        if (!form || !input || form.dataset.autoContextBound) return;
        form.dataset.autoContextBound = '1';
        form.addEventListener('submit', (event) => {
          const query = String(input.value || '').trim().toLowerCase();
          if (!['auto', 'automatique', 'auto on', 'auto off', 'matin', 'journee', 'journée', 'soir'].includes(query)) return;
          event.preventDefault();
          if (query === 'auto' || query === 'automatique') {
            const next = !isAutoEnabled();
            localStorage.setItem(AUTO_KEY, next ? '1' : '0');
            if (next) applyBucket(getBucket(), true);
            else disableAuto(true);
            return;
          }
          if (query === 'auto on') {
            localStorage.setItem(AUTO_KEY, '1');
            applyBucket(getBucket(), true);
            return;
          }
          if (query === 'auto off') {
            disableAuto(true);
            return;
          }
          localStorage.setItem(AUTO_KEY, '1');
          const forced = query === 'matin' ? getBucket(new Date(new Date().setHours(7))) :
            (query === 'soir' ? getBucket(new Date(new Date().setHours(20))) : getBucket(new Date(new Date().setHours(12))));
          applyBucket(forced, true);
        }, true);
      }

      function init() {
        installAutoPill();
        installAutoPanelControl();
        installSearchCommand();
        const bucket = getBucket();
        updateAutoUi(bucket);
        if (isAutoEnabled()) setTimeout(() => applyBucket(bucket, false), 80);
        setInterval(() => {
          if (!isAutoEnabled()) { updateAutoUi(getBucket()); return; }
          const current = getBucket();
          if (localStorage.getItem(LAST_BUCKET_KEY) !== current.id) applyBucket(current, true);
          else updateAutoUi(current);
        }, 5 * 60 * 1000);
      }

      window.addEventListener('DOMContentLoaded', init);
    })();

/* ===== js/start-desk.js ===== */
// Start Desk v3.1 — contexte du jour, commandes internes, fond temporel, polish mobile et statistiques locales.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const NOTES_KEY = 'startdesk_notes_v1';
  const USAGE_KEY = 'startdesk_usage_stats_v1';
  const PROFILE_LABELS = { silex: 'Travail', personal: 'Perso', full: 'Complet', work: 'Travail' };

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
    panel.setAttribute('inert', '');
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
    if (next) panel.removeAttribute('inert');
    else panel.setAttribute('inert', '');
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
    panel.setAttribute('inert', '');
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
    if (next) panel.removeAttribute('inert');
    else panel.setAttribute('inert', '');
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
      <button type="button" data-action="mobile" title="Revenir au mode mobile par défaut" aria-label="Revenir au mode mobile par défaut">Mobile</button>
      <button type="button" data-action="focus">Focus</button>
      <button type="button" data-action="silex">Travail</button>
      <button type="button" data-action="personal">Perso</button>
      <button type="button" data-action="apps">Complet</button>
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
      if (action === 'mobile') {
        const autoContext = window.StartDeskAutoContext;
        if (autoContext && typeof autoContext.applyMobileMode === 'function') autoContext.applyMobileMode(true);
        else {
          try { localStorage.setItem('startpage_auto_context_v1', '0'); } catch (_) {}
          applyProfile('silex');
          setFocus(true);
        }
      }
      if (action === 'focus') { setFocus(!document.body.classList.contains('focus-mode')); }
      if (action === 'silex') applyProfile('silex');
      if (action === 'personal') applyProfile('personal');
      if (action === 'apps') applyProfile('full');
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
        if (lower === 'focus') { setFocus(!document.body.classList.contains('focus-mode')); return true; }
        if (lower === 'silex' || lower === 'travail' || lower === 'pro') { applyProfile('silex'); setFocus(true); return true; }
        if (lower === 'perso' || lower === 'personal') { applyProfile('personal'); setFocus(true); return true; }
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

  function installSpotlightFallback() {
    const form = $('#search-form');
    if (!form || form.dataset.startDeskFocusFallback) return;
    form.dataset.startDeskFocusFallback = '1';

    const sync = () => {
      document.body.classList.toggle('spotlight-active', form.contains(document.activeElement));
    };

    form.addEventListener('focusin', sync);
    form.addEventListener('focusout', () => requestAnimationFrame(sync));
    window.addEventListener('blur', () => document.body.classList.remove('spotlight-active'));
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
      if (key === 'f') { setFocus(!document.body.classList.contains('focus-mode')); return; }
      if (key === 's') { applyProfile('silex'); setFocus(true); return; }
      if (key === 'p') { applyProfile('personal'); setFocus(true); return; }
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
    installSpotlightFallback();
    installKeyboardShortcuts();
    setInterval(syncDockState, 700);
    setInterval(applyTimeBackground, 60 * 1000);
    setTimeout(syncDockState, 300);
  });
})();
