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
  });

  searchForm?.addEventListener("submit", () => {
    const query = (searchInput?.value || "").trim();
    const prefix = detectPrefixEngine(query);
    if (!prefix) return;
    searchInput.value = query.substring(prefix.length).trim();
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
