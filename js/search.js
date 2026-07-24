// --- Barre de recherche intelligente ---
(function() {
  // --- Recherche (moteur sélectionnable via clic sur le "G") ---
  const SEARCH_DEFAULT_ENGINE_KEY = "startpage_search_default_engine_v1";

  // Placeholder "Spotlight-like" (stable, quel que soit le moteur)
  const BASE_PLACEHOLDER = "Rechercher, lancer un outil, poser une question…";

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

  function keepSpotlightFocused() {
    try { searchInput && searchInput.focus({ preventScroll: true }); }
    catch (error) {
      try { searchInput && searchInput.focus(); } catch (_) {}
    }
  }

  function getDefaultEngineId() {
    const saved = localStorage.getItem(SEARCH_DEFAULT_ENGINE_KEY);
    return (saved && ENGINES[saved]) ? saved : "startpage";
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
    searchInput.placeholder = BASE_PLACEHOLDER;

    engineOptions.forEach((btn) => {
      const active = btn.dataset.engine === engineId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

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

  engineBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleEngineMenu();
  });

  engineOptions.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const id = button.dataset.engine;
      setDefaultEngineId(id);
      closeEngineMenu({ focusButton: true });
      searchInput?.focus();
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