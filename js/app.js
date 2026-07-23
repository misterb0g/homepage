
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

// --- Météo ---
    async function getWeather() {
        const locationName = localStorage.getItem('weatherLocation') || 'Brussels';
        const weatherEl = $('#weather');
        weatherEl.innerHTML = `<div class="skeleton skeleton-text"></div>`;
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`);
            if (!geoRes.ok) throw new Error('Erreur Geocoding');
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) throw new Error(`Ville '${locationName}' non trouvée`);
            
            const { latitude, longitude, name } = geoData.results[0];
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`);
            if (!weatherRes.ok) throw new Error('Erreur Météo');
            
            const data = await weatherRes.json();
            let t = data?.current?.temperature_2m, wcode = data?.current?.weather_code;
            
            weatherEl.innerHTML = `<div class="row"><div id="weather-location" class="inline">${name}</div><div class="inline">•</div><div class="inline">${weatherCodeToFr(wcode)}</div><div class="inline">•</div><div class="inline">${Math.round(t)} °C</div></div>`;
        } catch (err) { console.error("Météo:", err); weatherEl.innerHTML = `<div class="inline">${err.message}</div>`; }
    }
    function weatherCodeToFr(code) { const map={0:"Ciel dégagé",1:"Plutôt dégagé",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine",61:"Pluie",63:"Pluie forte",71:"Neige",73:"Neige forte",80:"Averses",81:"Averses fortes",95:"Orages"}; return map[code] ?? "Météo"; }
    
    // --- Météo détaillée (5 jours) ---
    (function () {
      const weatherCard = $("#weather"), details = $("#weather-details"); let loaded = false; 
      const WEATHER_CACHE_KEY = 'weather5d_cache_v1', WEATHER_TTL_MS = 3600000;

      async function getWeather5dCached() {
        try { const raw = localStorage.getItem(WEATHER_CACHE_KEY); if (raw) { const { ts, data, location } = JSON.parse(raw); const currentLocation = localStorage.getItem('weatherLocation') || 'Brussels'; if (data && (Date.now() - ts < WEATHER_TTL_MS) && location === currentLocation) return data; } } catch {}
        
        const locationName = localStorage.getItem('weatherLocation') || 'Brussels';
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`);
        const geoData = await geoRes.json();
        const { latitude, longitude } = geoData.results[0];
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
        const data = await weatherRes.json();
        try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data, location: locationName })); } catch {}
        return data;
      }

      function renderWeather5d(data) { 
        const days = data.daily.time.map((d, i) => ({ date: d, code: data.daily.weather_code[i], tmax: Math.round(data.daily.temperature_2m_max[i]), tmin: Math.round(data.daily.temperature_2m_min[i]) })); 
        const df = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'short' }); 
        details.innerHTML = `<div class='weather5d'>${days.map(day => `<div class="weather-day"><div class="wd-date">${df.format(new Date(day.date))}</div><div class="wd-desc">${weatherCodeToFr(day.code)}</div><div class="wd-temps"><span class="max">${day.tmax}°</span> / <span class="min">${day.tmin}°</span></div></div>`).join("")}</div>`; 
      }

      async function toggleDetails() { 
        const isHidden = details.hasAttribute("hidden"); 
        if (isHidden && !loaded) { 
            try { details.innerHTML = "Chargement…"; const data = await getWeather5dCached(); renderWeather5d(data); loaded = true; } 
            catch (e) { details.innerHTML = `<div class='wd-error'>Prévisions indisponibles</div>`; } 
        } 
        details.toggleAttribute("hidden"); weatherCard.setAttribute("aria-expanded", String(!details.hasAttribute("hidden"))); 
      }
      weatherCard.addEventListener("click", toggleDetails);
      weatherCard.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDetails(); } });
    })();

    // --- Favoris ---
    function setupBookmarks() {
      if (typeof bookmarks === 'undefined') return;

      // Tri A→Z des liens dans chaque tuile
      bookmarks.forEach(category => { category.links.sort((a, b) => a.name.localeCompare(b.name)); });

      // Applique l’ordre mémorisé (si présent)
      const order = loadTileOrder();
      if (order && order.length) {
        const byTitle = new Map(bookmarks.map(b => [b.title, b]));
        const ordered = [];
        order.forEach(t => { if (byTitle.has(t)) ordered.push(byTitle.get(t)); });
        // Ajoute ce qui n’est pas encore dans l’ordre (nouvelles tuiles)
        bookmarks.forEach(b => { if (!order.includes(b.title)) ordered.push(b); });
        // Remplace en place (pour éviter de casser les refs ailleurs)
        bookmarks.length = 0;
        ordered.forEach(b => bookmarks.push(b));
      }

      const el = $("#bookmark-container");
      el.innerHTML = bookmarks.map((b, index) => `
        <section class="bookmark-set card glass" data-tile-title="${escapeHtml(b.title)}" style="animation-delay: ${200 + (index * 100)}ms">
          <div class="bookmark-header">
            <div class="bookmark-title">${escapeHtml(b.title)}</div>
            <button class="tile-handle" type="button" aria-label="Déplacer la tuile" title="Déplacer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5.5A1.5 1.5 0 1 1 7.5 4 1.5 1.5 0 0 1 9 5.5Zm0 6A1.5 1.5 0 1 1 7.5 10 1.5 1.5 0 0 1 9 11.5Zm0 6A1.5 1.5 0 1 1 7.5 16 1.5 1.5 0 0 1 9 17.5ZM16.5 7A1.5 1.5 0 1 1 18 5.5 1.5 1.5 0 0 1 16.5 7Zm0 6A1.5 1.5 0 1 1 18 11.5 1.5 1.5 0 0 1 16.5 13Zm0 6A1.5 1.5 0 1 1 18 17.5 1.5 1.5 0 0 1 16.5 19Z"></path>
              </svg>
            </button>
          </div>
          <div class="bookmark-inner-container">
            ${b.links.map(l => `<a class="bookmark" href="${l.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.name)}</a>`).join("")}
          </div>
        </section>`).join("");

      initTileSortable();
    }

    // --- NEWS: Fonction générique pour charger un flux ---
    async function fetchAndRenderNews(apiUrl, listId) {
        const list = $(listId);
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
            
            const xmlText = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            // Récupération et tri des items (plus récent en haut)
            let items = Array.from(xmlDoc.querySelectorAll("item"));
            items.sort((a, b) => {
                const dateA = new Date(a.querySelector("pubDate")?.textContent);
                const dateB = new Date(b.querySelector("pubDate")?.textContent);
                return dateB - dateA; // Décroissant
            });

            // On garde les 5 premiers pour chaque colonne
            items = items.slice(0, 5);

            if (items.length > 0) {
                list.innerHTML = items.map(item => {
                    const title = item.querySelector("title")?.textContent || "Sans titre";
                    const link = item.querySelector("link")?.textContent || "#";
                    const pubDateRaw = item.querySelector("pubDate")?.textContent;
                    
                    let dateStr = "";
                    if (pubDateRaw) {
                        dateStr = new Date(pubDateRaw).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
                    }

                    return `
                    <a href="${link}" target="_blank" rel="noopener" style="text-decoration: none; color: inherit; display: block;">
                        <article class="bookmark" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.3rem; line-height: 1.4;">${title}</div>
                            <div style="font-size: 0.75rem; color: var(--secondaryFg); text-align: right;">${dateStr}</div>
                        </article>
                    </a>`;
                }).join('');
            } else {
                list.innerHTML = `<div style="font-size:0.8rem; opacity:0.7">Aucun article.</div>`;
            }
        } catch (e) {
            console.error(`Erreur chargement news (${apiUrl}):`, e);
            list.innerHTML = `<div style="font-size:0.8rem; color:var(--errorFg)">Erreur chargement.</div>`;
        }
    }

    // --- Chargement global des news ---
    let __newsLoaded = false;
    async function loadNews() {
        const container = $('#news-container');
        
        // On lance les deux requêtes en parallèle pour la rapidité
        await Promise.all([
            fetchAndRenderNews('/api/news', '#macg-list'),    // MacGeneration
            fetchAndRenderNews('/api/lesoir', '#lesoir-list') // Le Soir
        ]);
        
        // Affichage du bloc si l'option est activée
        if (localStorage.getItem('showNews') !== 'false') {
            container.style.display = 'block';
        }
        __newsLoaded = true;
    }

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
  startpage:  { iconId: "i-startpage",  name: "Startpage",    url: "https://www.startpage.com/sp/search", queryParam: "query" },
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
          return (saved && ENGINES[saved]) ? saved : "startpage";
        }

        function setDefaultEngineId(engineId) {
          if (!ENGINES[engineId]) return;
          localStorage.setItem(SEARCH_DEFAULT_ENGINE_KEY, engineId);
          applyDefaultEngine(engineId);
        }

        function setEngineIcon(iconId) {
  const href = "#" + (iconId || "i-startpage");
  // Safari: on met href ET xlink:href
  engineIconUse.setAttribute("href", href);
  engineIconUse.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
}

function applyDefaultEngine(engineId) {
          const engine = ENGINES[engineId] || ENGINES.startpage;
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

    // --- Chat Logic ---
    (function() {
      let gptHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }], geminiHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }];
      function addBubble(container, text, who) { const bubble = document.createElement('div'); bubble.className = `msg ${who}`; bubble.textContent = text; container.appendChild(bubble); container.scrollTop = container.scrollHeight; return bubble; }
      
      const tabs = $$('.chat-tab'), panels = $$('.chat-panel');
      const CHAT_TAB_KEY = "startpage_chat_tab_v1";
      const savedTab = localStorage.getItem(CHAT_TAB_KEY) || "gpt";

      function activateTab(targetId) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
        panels.forEach(p => p.hidden = (p.id !== `chat-panel-${targetId}`));
        try { localStorage.setItem(CHAT_TAB_KEY, targetId); } catch {}
      }

      // Init : restaure l’onglet utilisé la dernière fois
      activateTab(savedTab);

      tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.dataset.target));
      });
      
      async function handleChatSubmit(e, history, messagesContainer, apiEndpoint) { 
          e.preventDefault(); const form = e.target, input = form.querySelector('input'), prompt = input.value.trim(); 
          if (!prompt) return; 
          addBubble(messagesContainer, prompt, 'you'); history.push({ role: 'user', content: prompt }); input.value = ''; 
          const botBubble = addBubble(messagesContainer, '…', 'bot'); botBubble.classList.add('pending'); 
          try { 
              // Payload : OpenAI attend { messages }, Gemini attend { prompt }
              const payload = (apiEndpoint === '/api/gemini')
                ? { prompt }
                : { messages: history };

              const res = await fetch(apiEndpoint, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(payload) 
              }); 
              if (!res.ok) { const errText = await res.text(); throw new Error(JSON.parse(errText).error || errText); } 
              const data = await res.json(); 
              botBubble.textContent = data.text; history.push({ role: 'assistant', content: data.text }); 
          } catch(err) { botBubble.textContent = `Erreur: ${err.message}`; } 
          finally { botBubble.classList.remove('pending'); } 
      }
      $('#gpt-form').addEventListener('submit', (e) => handleChatSubmit(e, gptHistory, $("#chat-panel-gpt .chat-messages"), '/api/chat'));
      $('#gemini-form').addEventListener('submit', (e) => handleChatSubmit(e, geminiHistory, $("#chat-panel-gemini .chat-messages"), '/api/gemini'));
    })();
    
    // --- Panneau de configuration ---
    (function() {
        const panel = $('#control-panel'), overlay = $('#overlay'); const toggleBtn = $('#settings-toggle-btn'), closeBtn = $('#panel-close-btn');
        const hoverPanelQuery = window.matchMedia('(hover: hover) and (min-width: 768px)');
        let panelCloseTimer = null;
        let panelPinnedByClick = false;

        function openPanel(options = {}) {
          if (!panel || !overlay) return;
          panel.setAttribute('aria-hidden', 'false');
          overlay.hidden = false;
          document.body.classList.add('panel-open');
          if (options.pinned) panelPinnedByClick = true;
        }

        function closePanel() {
          if (!panel || !overlay) return;
          panel.setAttribute('aria-hidden', 'true');
          overlay.hidden = true;
          document.body.classList.remove('panel-open');
          panelPinnedByClick = false;
        }

        function scheduleHoverClose() {
          if (!hoverPanelQuery.matches || panelPinnedByClick) return;
          clearTimeout(panelCloseTimer);
          panelCloseTimer = setTimeout(() => {
            const cursorOnButton = toggleBtn && toggleBtn.matches(':hover');
            const cursorOnPanel = panel && panel.matches(':hover');
            if (!cursorOnButton && !cursorOnPanel) closePanel();
          }, 180);
        }

        if (toggleBtn && panel && overlay && closeBtn) {
          toggleBtn.addEventListener('mouseenter', () => {
            if (hoverPanelQuery.matches) {
              clearTimeout(panelCloseTimer);
              openPanel({ pinned: false });
            }
          });

          toggleBtn.addEventListener('mouseleave', scheduleHoverClose);
          panel.addEventListener('mouseenter', () => clearTimeout(panelCloseTimer));
          panel.addEventListener('mouseleave', scheduleHoverClose);

          toggleBtn.addEventListener('click', () => {
            if (document.body.classList.contains('panel-open')) closePanel();
            else openPanel({ pinned: true });
          });

          closeBtn.addEventListener('click', closePanel);
          overlay.addEventListener('click', closePanel);
          hoverPanelQuery.addEventListener?.('change', () => closePanel());
        }

        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('panel-open')) closePanel(); });
        
        // Météo Localisation
        const locationInput = $('#weather-location-input'), saveBtn = $('#weather-location-save'); locationInput.value = localStorage.getItem('weatherLocation') || '';
        const saveLocation = () => { const newLocation = locationInput.value.trim(); if (newLocation) { localStorage.setItem('weatherLocation', newLocation); getWeather(); closePanel(); } };
        saveBtn.addEventListener('click', saveLocation); locationInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveLocation(); });
        
        // Paramètres Génériques
        const root = document.documentElement; function applySetting(key, value, action) { localStorage.setItem(key, value); action(value); }
        function setupSelector(selectorId, storageKey, action, defaultValue) { 
            const selector = $(selectorId), buttons = selector.querySelectorAll('button'); 
            const savedValue = localStorage.getItem(storageKey) || defaultValue; action(savedValue); 
            buttons.forEach(b => b.classList.toggle('active', b.dataset.value === savedValue)); 
            selector.addEventListener('click', (e) => { const target = e.target.closest('button'); if (target?.dataset.value) { applySetting(storageKey, target.dataset.value, action); buttons.forEach(b => b.classList.remove('active')); target.classList.add('active'); } }); 
        }
        // Thème : 'system' suit macOS (prefers-color-scheme)
        const colorSchemeMQ = window.matchMedia("(prefers-color-scheme: dark)");
        function resolveSystemTheme(){ return colorSchemeMQ.matches ? "dark" : "light"; }
        function applyTheme(pref){
          let effective;
          if (pref === "system") {
            effective = resolveSystemTheme();
          } else if (pref === "mac") {
            effective = colorSchemeMQ.matches ? "macos-dark" : "macos-light";
          } else {
            effective = pref;
          }
          root.setAttribute("data-theme", effective);
          root.setAttribute("data-theme-pref", pref);
        }
        try {
          colorSchemeMQ.addEventListener("change", () => {
            const savedTheme = (localStorage.getItem("theme") || "system");
            if (savedTheme === "system" || savedTheme === "mac") applyTheme(savedTheme);
          });
        } catch(e) {
          try { colorSchemeMQ.addListener(() => {
            const savedTheme = (localStorage.getItem("theme") || "system");
            if (savedTheme === "system" || savedTheme === "mac") applyTheme(savedTheme);
          }); } catch(_){}
        }
        setupSelector('#theme-selector', 'theme', applyTheme, 'system');

        setupSelector('#density-selector', 'density', (val) => root.setAttribute('data-density', val), 'cozy');


        // Mode édition (affiche/masque les poignées de drag, et bloque tout déplacement hors édition)
        const EDIT_MODE_KEY = "startpage_edit_mode_v1";
        function applyEditMode(on) {
          document.body.classList.toggle("edit-mode", !!on);
          setTileSortableEnabled(!!on);
          try { localStorage.setItem(EDIT_MODE_KEY, on ? "1" : "0"); } catch {}
        }
        const editModeToggle = $('#edit-mode-toggle');
        if (editModeToggle) {
          const saved = (() => { try { return localStorage.getItem(EDIT_MODE_KEY); } catch { return null; } })();
          const initial = saved === "1";
          editModeToggle.checked = initial;
          applyEditMode(initial);
          editModeToggle.addEventListener('change', () => applyEditMode(editModeToggle.checked));
        } else {
          applyEditMode(false);
        }

        // Action : rétablir l’ordre des tuiles
        const tilesResetToggle = $('#tiles-reset-toggle');
        if (tilesResetToggle) {
          tilesResetToggle.checked = false;
          tilesResetToggle.addEventListener('change', () => {
            if (!tilesResetToggle.checked) return;
            // Reset + re-render
            resetTileOrder();
            setupBookmarks();
            // On remet le toggle à OFF (c’est une action, pas une préférence)
            setTimeout(() => { tilesResetToggle.checked = false; }, 150);
            closePanel();
          });
        }
        
        // Toggle News
        const newsToggle = $('#news-toggle');
        const showNews = localStorage.getItem('showNews') !== 'false';
        newsToggle.checked = showNews;
        document.body.classList.toggle('news-hidden', !showNews);
        newsToggle.addEventListener('change', () => { 
            applySetting('showNews', newsToggle.checked, (val) => document.body.classList.toggle('news-hidden', !val)); 
            // Si on active les news après coup, on déclenche le chargement une fois
            if (newsToggle.checked && typeof loadNews === 'function' && !__newsLoaded) {
              loadNews();
            }
        });

        // Toggle Chat
        const chatToggle = $('#chat-toggle'); const showChat = localStorage.getItem('showChat') !== 'false'; chatToggle.checked = showChat; document.body.classList.toggle('chat-hidden', !showChat);
        chatToggle.addEventListener('change', () => { applySetting('showChat', chatToggle.checked, (val) => document.body.classList.toggle('chat-hidden', !val)); });
    })();


    // --- Widgets macOS consolidés : clic barre = replier / déplier ; pastille droite = masquer ---
    (function () {
      const COLLAPSE_KEY = 'startpage_widget_collapsed_v4';
      const HIDDEN_KEY = 'startpage_widget_hidden_v4';

      function readState(key) {
        try { return JSON.parse(localStorage.getItem(key) || '{}'); }
        catch { return {}; }
      }

      function writeState(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
      }

      const collapsedState = readState(COLLAPSE_KEY);
      const hiddenState = readState(HIDDEN_KEY);

      function getPanelToggle(widgetId) {
        if (widgetId === 'news') return document.getElementById('news-toggle');
        if (widgetId === 'chat') return document.getElementById('chat-toggle');
        if (widgetId === 'calendar') return document.getElementById('calendar-toggle');
        return null;
      }

      function applyHiddenState(widgetId, hidden) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widget) return;
        widget.style.display = hidden ? 'none' : '';
        const toggle = getPanelToggle(widgetId);
        if (toggle) toggle.checked = !hidden;
      }

      function applyCollapsedState(widgetId, collapsed) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widget) return;
        widget.classList.toggle('is-collapsed', !!collapsed);
      }

      document.querySelectorAll('.widget-shell[data-widget-id]').forEach((widget) => {
        const widgetId = widget.dataset.widgetId;
        const toolbar = widget.querySelector('.widget-toolbar');
        const closeBtn = widget.querySelector('[data-widget-close]');

        applyCollapsedState(widgetId, !!collapsedState[widgetId]);
        applyHiddenState(widgetId, !!hiddenState[widgetId]);

        if (toolbar) {
          toolbar.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            if (hiddenState[widgetId]) return;
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
            writeState(COLLAPSE_KEY, collapsedState);
          });
        }

        if (closeBtn) {
          closeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            hiddenState[widgetId] = true;
            writeState(HIDDEN_KEY, hiddenState);
            applyHiddenState(widgetId, true);
          });
        }
      });

      const newsToggle = document.getElementById('news-toggle');
      const chatToggle = document.getElementById('chat-toggle');
      const calendarToggle = document.getElementById('calendar-toggle');

      if (newsToggle) {
        newsToggle.checked = !hiddenState.news;
        newsToggle.addEventListener('change', () => {
          hiddenState.news = !newsToggle.checked;
          writeState(HIDDEN_KEY, hiddenState);
          applyHiddenState('news', hiddenState.news);
        });
      }

      if (chatToggle) {
        chatToggle.checked = !hiddenState.chat;
        chatToggle.addEventListener('change', () => {
          hiddenState.chat = !chatToggle.checked;
          writeState(HIDDEN_KEY, hiddenState);
          applyHiddenState('chat', hiddenState.chat);
        });
      }

      if (calendarToggle) {
        calendarToggle.checked = !hiddenState.calendar;
        calendarToggle.addEventListener('change', () => {
          hiddenState.calendar = !calendarToggle.checked;
          writeState(HIDDEN_KEY, hiddenState);
          applyHiddenState('calendar', hiddenState.calendar);
        });
      }
    })();



    // --- Dashboard mode support ---
    (function () {
      const densitySelector = document.getElementById('density-selector');
      if (!densitySelector) return;

      const buttons = densitySelector.querySelectorAll('button[data-value]');
      const STORAGE_KEY = 'startpage_density_v2';

      function setActiveDensity(value) {
        document.documentElement.setAttribute('data-density', value);
        buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.value === value));
        try { localStorage.setItem(STORAGE_KEY, value); } catch {}
      }

      const savedDensity = localStorage.getItem(STORAGE_KEY) || document.documentElement.getAttribute('data-density') || 'cozy';
      setActiveDensity(savedDensity);

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          setActiveDensity(btn.dataset.value);

          // En dashboard, on replie automatiquement le chat seulement s'il est visible et non replié.
          if (btn.dataset.value === 'dashboard') {
            try {
              const chat = document.querySelector('[data-widget-id="chat"]');
              const collapsedState = JSON.parse(localStorage.getItem('startpage_widget_collapsed_v4') || '{}');
              if (chat && !chat.classList.contains('is-collapsed')) {
                chat.classList.add('is-collapsed');
                collapsedState.chat = true;
                localStorage.setItem('startpage_widget_collapsed_v4', JSON.stringify(collapsedState));
              }
            } catch {}
          }
        });
      });
    })();



    // --- Widgets redimensionnables (News + Chat uniquement, en mode édition) ---
    (function () {
      const SIZE_KEY = 'startpage_widget_sizes_v1';

      function readSizes() {
        try { return JSON.parse(localStorage.getItem(SIZE_KEY) || '{}'); }
        catch { return {}; }
      }

      function writeSizes(state) {
        try { localStorage.setItem(SIZE_KEY, JSON.stringify(state)); } catch {}
      }

      const sizes = readSizes();

      function applySavedSize(widgetId) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widget || !sizes[widgetId]) return;

        const saved = sizes[widgetId];
        if (saved.width) widget.style.width = saved.width + 'px';
        if (saved.height) widget.style.setProperty('--widget-custom-height', saved.height + 'px');
      }

      function initWidgetResize(widgetId, minWidth, minHeight) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        const resizer = document.querySelector(`[data-widget-resizer="${widgetId}"]`);
        if (!widget || !resizer) return;

        applySavedSize(widgetId);

        let active = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        resizer.addEventListener('pointerdown', (event) => {
          if (!document.body.classList.contains('edit-mode')) return;
          if (widget.classList.contains('is-collapsed')) return;

          active = true;
          startX = event.clientX;
          startY = event.clientY;
          startWidth = widget.getBoundingClientRect().width;
          startHeight = widget.getBoundingClientRect().height;

          widget.classList.add('is-resizing');
          resizer.setPointerCapture(event.pointerId);
          event.preventDefault();
        });

        resizer.addEventListener('pointermove', (event) => {
          if (!active) return;

          const width = Math.max(minWidth, Math.round(startWidth + (event.clientX - startX)));
          const height = Math.max(minHeight, Math.round(startHeight + (event.clientY - startY)));

          widget.style.width = width + 'px';
          widget.style.setProperty('--widget-custom-height', height + 'px');
        });

        function stopResize() {
          if (!active) return;
          active = false;
          widget.classList.remove('is-resizing');

          const width = Math.round(widget.getBoundingClientRect().width);
          const height = parseInt(getComputedStyle(widget).getPropertyValue('--widget-custom-height')) || Math.round(widget.getBoundingClientRect().height);

          sizes[widgetId] = { width, height };
          writeSizes(sizes);
        }

        resizer.addEventListener('pointerup', stopResize);
        resizer.addEventListener('pointercancel', stopResize);
      }

      initWidgetResize('news', 680, 240);
      initWidgetResize('chat', 680, 220);
    })();



            // --- Mini calendrier intégré + événements Google Calendar via /api/calendar ---
    (function () {
      const grid = document.getElementById('calendar-grid');
      const label = document.getElementById('calendar-month-label');
      const prev = document.getElementById('calendar-prev');
      const next = document.getElementById('calendar-next');
      const eventsList = document.getElementById('calendar-events');
      const selectedLabel = document.getElementById('calendar-selected-label');
      const resetSelectionBtn = document.getElementById('calendar-reset-selection');
      if (!grid || !label || !prev || !next || !eventsList) return;

      let current = new Date();
      current.setDate(1);

      let loadedEvents = [];
      let selectedDateKey = null;

      const monthFmt = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' });
      const dateFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
      const fullDateFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeFmt = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

      function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }

      function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      }

      function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function getEventDateKey(event) {
        const start = new Date(event.start);
        return toDateKey(start);
      }

      function hasEventsOnDate(dateKey) {
        return loadedEvents.some(event => getEventDateKey(event) === dateKey);
      }

      function updateSelectionUi() {
        grid.querySelectorAll('.calendar-day').forEach((btn) => {
          btn.classList.toggle('is-selected', btn.dataset.dateKey === selectedDateKey);
        });

        if (selectedDateKey) {
          const selectedDate = new Date(selectedDateKey + 'T12:00:00');
          selectedLabel.hidden = false;
          selectedLabel.textContent = fullDateFmt.format(selectedDate);
          resetSelectionBtn.hidden = false;
        } else {
          selectedLabel.hidden = true;
          selectedLabel.textContent = '';
          resetSelectionBtn.hidden = true;
        }
      }

      function renderCalendar() {
        const year = current.getFullYear();
        const month = current.getMonth();

        const firstDay = new Date(year, month, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        label.textContent = monthFmt.format(firstDay);

        const today = new Date();
        const cells = [];

        for (let i = 0; i < startOffset; i++) {
          const day = daysInPrevMonth - startOffset + i + 1;
          const date = new Date(year, month - 1, day);
          cells.push({
            day,
            outside: true,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date))
          });
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          cells.push({
            day: d,
            outside: false,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date)),
            today:
              d === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear()
          });
        }

        while (cells.length % 7 !== 0) {
          const overflowDay = cells.length - (startOffset + daysInMonth) + 1;
          const date = new Date(year, month + 1, overflowDay);
          cells.push({
            day: overflowDay,
            outside: true,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date))
          });
        }

        grid.innerHTML = cells.map(cell => `
          <button
            type="button"
            class="calendar-day${cell.outside ? ' is-outside' : ''}${cell.today ? ' is-today' : ''}${cell.hasEvents ? ' has-events' : ''}"
            data-date-key="${cell.dateKey}"
            aria-pressed="${selectedDateKey === cell.dateKey ? 'true' : 'false'}"
          >
            <span>${cell.day}</span>
            ${cell.hasEvents ? '<i class="calendar-day-dot" aria-hidden="true"></i>' : ''}
          </button>
        `).join('');

        grid.querySelectorAll('.calendar-day').forEach((btn) => {
          btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const clickedKey = btn.dataset.dateKey;
            selectedDateKey = (selectedDateKey === clickedKey) ? null : clickedKey;
            updateSelectionUi();
            renderEvents();
          });
        });

        updateSelectionUi();
      }

      function getEventIcon(event) {
        const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
        if (event.allDay) return '○';
        if (text.includes('meet') || text.includes('réunion') || text.includes('meeting') || text.includes('teams') || text.includes('zoom')) return '●';
        if (text.includes('trajet') || text.includes('déplacement') || text.includes('train') || text.includes('vol')) return '◆';
        return '•';
      }

      function formatEvent(event) {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        const allDay = !!event.allDay;

        const dateLabel = dateFmt.format(start);
        const timeLabel = allDay
          ? 'Toute la journée'
          : `${timeFmt.format(start)}${end ? ` – ${timeFmt.format(end)}` : ''}`;

        const wrapperTag = event.url ? 'a' : 'article';
        const wrapperAttrs = event.url
          ? `href="${event.url}" target="_blank" rel="noopener noreferrer" class="calendar-event-item is-link"`
          : `class="calendar-event-item"`;

        return `
          <${wrapperTag} ${wrapperAttrs}>
            <div class="calendar-event-icon" aria-hidden="true">${getEventIcon(event)}</div>
            <div class="calendar-event-main">
              <div class="calendar-event-name">${event.title || 'Événement'}</div>
              <div class="calendar-event-meta">${dateLabel} · ${timeLabel}</div>
            </div>
          </${wrapperTag}>
        `;
      }

      function renderSelectedDateEvents() {
        const selectedEvents = loadedEvents.filter(event => getEventDateKey(event) === selectedDateKey);
        if (!selectedEvents.length) {
          eventsList.innerHTML = '<div class="calendar-event-empty">Aucun événement ce jour-là.</div>';
          return;
        }

        eventsList.innerHTML = `
          <section class="calendar-event-group">
            <div class="calendar-event-group-title">Événements du jour</div>
            <div class="calendar-event-group-list">
              ${selectedEvents.map(formatEvent).join('')}
            </div>
          </section>
        `;
      }

      function renderGroupedEvents() {
        if (!Array.isArray(loadedEvents) || loadedEvents.length === 0) {
          eventsList.innerHTML = '<div class="calendar-event-empty">Aucun événement à venir.</div>';
          return;
        }

        const today = startOfDay(new Date());
        const tomorrow = addDays(today, 1);

        const buckets = {
          today: [],
          tomorrow: [],
          later: []
        };

        loadedEvents.forEach((event) => {
          const start = new Date(event.start);
          const eventDay = startOfDay(start);
          if (eventDay.getTime() === today.getTime()) buckets.today.push(event);
          else if (eventDay.getTime() === tomorrow.getTime()) buckets.tomorrow.push(event);
          else buckets.later.push(event);
        });

        const sections = [];

        if (buckets.today.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">Aujourd’hui</div>
              <div class="calendar-event-group-list">
                ${buckets.today.map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        if (buckets.tomorrow.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">Demain</div>
              <div class="calendar-event-group-list">
                ${buckets.tomorrow.map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        if (buckets.later.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">À venir</div>
              <div class="calendar-event-group-list">
                ${buckets.later.slice(0, 4).map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        eventsList.innerHTML = sections.join('') || '<div class="calendar-event-empty">Aucun événement à venir.</div>';
      }

      function renderEvents() {
        if (selectedDateKey) {
          renderSelectedDateEvents();
        } else {
          renderGroupedEvents();
        }
      }

      async function loadEvents() {
        eventsList.innerHTML = '<div class="calendar-event-empty">Chargement des événements…</div>';

        try {
          const res = await fetch('/api/calendar');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          loadedEvents = Array.isArray(data.events) ? data.events.slice(0, 20) : [];
          renderCalendar();
          renderEvents();
        } catch (error) {
          console.error('Calendar API:', error);
          eventsList.innerHTML = '<div class="calendar-event-empty">Calendrier indisponible.</div>';
        }
      }

      prev.addEventListener('click', (event) => {
        event.stopPropagation();
        current.setMonth(current.getMonth() - 1);
        renderCalendar();
      });

      next.addEventListener('click', (event) => {
        event.stopPropagation();
        current.setMonth(current.getMonth() + 1);
        renderCalendar();
      });

      resetSelectionBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        selectedDateKey = null;
        updateSelectionUi();
        renderEvents();
      });

      renderCalendar();
      loadEvents();
    })();


    // --- Init ---
    window.addEventListener("load", () => {
      updateGreeting(); $("#clock").textContent = getTime();
      setInterval(() => { $("#clock").textContent = getTime(); if (new Date().getSeconds() === 0) updateGreeting(); }, 1000);
      setupBookmarks(); 
      getWeather();
      const showNews = localStorage.getItem('showNews') !== 'false';
      if (showNews) loadNews();
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
