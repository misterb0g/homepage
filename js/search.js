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
  google:     { iconId: "i-google",     name: "Google",       url: "https://www.google.com/search", queryParam: "q" },
  duckduckgo: { iconId: "i-duckduckgo", name: "DuckDuckGo",    url: "https://duckduckgo.com/",      queryParam: "q" },
  bing:       { iconId: "i-bing",       name: "Bing",         url: "https://www.bing.com/search",  queryParam: "q" },
  brave:      { iconId: "i-brave",      name: "Brave",        url: "https://search.brave.com/search", queryParam: "q" },

  // Raccourcis (aussi accessibles via préfixe dans la barre)
  wikipedia:  { iconId: "i-wikipedia",  name: "Wikipedia",    url: "https://fr.wikipedia.org/w/index.php", queryParam: "search" },
  amazon:     { iconId: "i-amazon",     name: "Amazon",       url: "https://www.amazon.com.be/s",      queryParam: "k" },
  youtube:    { iconId: "i-youtube",    name: "YouTube",      url: "https://www.youtube.com/results", queryParam: "search_query" }
};

        const searchForm   = $("#search-form");
        const searchInput  = $("#search-input");
        const engineBtn    = $("#engine-button");
        const engineIconUse = $("#engine-icon-use");
                const engineMenu   = $("#engine-menu");

        /* Engine menu focus keeper */
        function keepSpotlightFocused(){
          // Safari: conserve le mode Spotlight (focus-within) quand on ouvre le menu
          try { searchInput && searchInput.focus({ preventScroll: true }); } catch(e) { try { searchInput && searchInput.focus(); } catch(_){} }
        }

        const engineOptions = $$(".engine-option", engineMenu);

        function getDefaultEngineId() {
          const saved = localStorage.getItem(SEARCH_DEFAULT_ENGINE_KEY);
          return (saved && ENGINES[saved]) ? saved : "google";
        }

        function setDefaultEngineId(engineId) {
          if (!ENGINES[engineId]) return;
          localStorage.setItem(SEARCH_DEFAULT_ENGINE_KEY, engineId);
          applyDefaultEngine(engineId);
        }

        function setEngineIcon(iconId) {
  const href = "#" + (iconId || "i-google");
  // Safari: on met href ET xlink:href
  engineIconUse.setAttribute("href", href);
  engineIconUse.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
}

function applyDefaultEngine(engineId) {
          const engine = ENGINES[engineId] || ENGINES.google;
          searchForm.action = engine.url;
          searchInput.name  = engine.queryParam;
          setEngineIcon(engine.iconId);
          engineBtn.title = engine.name;
          // On garde ton hint "w / a" dans le placeholder (mais on adapte le début)
          const suffix = ", ou 'w ' Wikipedia, 'a ' Amazon, 'y ' YouTube…";
searchInput.placeholder = BASE_PLACEHOLDER;
          engineOptions.forEach((btn) => {
            const active = btn.dataset.engine === engineId;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
          });
        }

        function openEngineMenu() {
          engineMenu.hidden = false;
          engineBtn.setAttribute("aria-expanded", "true");
          document.body.classList.add("engine-open");
          // focus sur l'option active (comportement "menu" propre)
          const current = getDefaultEngineId();
          const activeBtn = engineOptions.find(b => b.dataset.engine === current) || engineOptions[0];
          activeBtn?.focus();
        }

        function closeEngineMenu({ focusButton = false } = {}) {
          engineMenu.hidden = true;
          engineBtn.setAttribute("aria-expanded", "false");
          document.body.classList.remove("engine-open");
          if (focusButton) engineBtn.focus();
        }

        function toggleEngineMenu() {
          if (engineMenu.hidden) openEngineMenu();
          else closeEngineMenu({ focusButton: true });
        }

        // init
        applyDefaultEngine(getDefaultEngineId());

        engineBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleEngineMenu();
        });

        engineOptions.forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            const id = btn.dataset.engine;
            setDefaultEngineId(id);
            closeEngineMenu({ focusButton: true });
            searchInput.focus();
          });
        });

        // click dehors / ESC
        document.addEventListener("click", (e) => {
          if (engineMenu.hidden) return;
          const target = e.target;
          if (engineMenu.contains(target) || engineBtn.contains(target)) return;
          closeEngineMenu();
        });
        window.addEventListener("keydown", (e) => {
          if (engineMenu.hidden) return;
          if (e.key === "Escape") {
            e.preventDefault();
            closeEngineMenu({ focusButton: true });
          }
        });

        // Détection des préfixes (w / a / y) : override ponctuel sans changer ton moteur par défaut
        function detectPrefixEngine(query) {
          const keys = Object.keys(PREFIX_ENGINES);
          return keys.find((p) => query.startsWith(p)) || null;
        }

        searchInput.addEventListener("input", () => {
          const q = searchInput.value || "";
          const prefix = detectPrefixEngine(q);
          if (prefix) {
            const engine = PREFIX_ENGINES[prefix];
            searchForm.action = engine.url;
            searchInput.name = engine.queryParam;
            // Placeholder contextuel (sans écraser l'entrée)
            searchInput.placeholder = BASE_PLACEHOLDER;
          } else {
            applyDefaultEngine(getDefaultEngineId());
          }
        });

        searchForm.addEventListener("submit", (e) => {
          const q = (searchInput.value || "").trim();
          const prefix = detectPrefixEngine(q);
          if (!prefix) return; // moteur par défaut déjà appliqué
          // Nettoyage de la requête : on retire le préfixe
          searchInput.value = q.substring(prefix.length).trim();
        });
// Raccourcis clavier
        window.addEventListener("keydown", (e) => { 
            const activeTag = document.activeElement.tagName.toLowerCase(), isInputFocused = activeTag === "input" || activeTag === "textarea"; 
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchInput.focus(); } 
            if (isInputFocused) return; 
            if (e.key === "/") { e.preventDefault(); searchInput.focus(); } 
            if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); const input = $('.chat-panel:not([hidden]) .chat-form input'); if (input) input.focus(); } 
        });
    })();


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
