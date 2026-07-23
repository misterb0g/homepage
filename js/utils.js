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
}

function initTileSortable() {
  const container = $("#bookmark-container");
  if (!container) return;

  if (window.__tileSortable) {
    window.__tileSortable.destroy();
    window.__tileSortable = null;
  }

  if (typeof Sortable === "undefined") {
    console.warn("SortableJS non chargé : drag & drop désactivé.");
    return;
  }

  window.__tileSortable = new Sortable(container, {
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

  const isEdit = document.body.classList.contains("edit-mode");
  window.__tileSortable.option("disabled", !isEdit);
}

function setTileSortableEnabled(enabled) {
  if (!window.__tileSortable) return;
  window.__tileSortable.option("disabled", !enabled);
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
  setTileSortableEnabled
});
