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

  // Déjà initialisé ?
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
    forceFallback: false, // fallback seulement si nécessaire
    swapThreshold: 0.65,
    onEnd: (evt) => {
      // Petit rebond façon Finder au drop
      const item = evt.item;
      item.classList.add("tile-bounce");
      setTimeout(() => item.classList.remove("tile-bounce"), 180);
      saveTileOrderFromDOM();
    }
  });

  // Respect du Mode édition : par défaut désactivé tant que le toggle n’est pas ON
  const isEdit = document.body.classList.contains("edit-mode");
  window.__tileSortable.option("disabled", !isEdit);
}

function setTileSortableEnabled(enabled) {
  if (!window.__tileSortable) return;
  window.__tileSortable.option("disabled", !enabled);
}
