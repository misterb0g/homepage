// --- Panneau de configuration ---
    (function() {
        const panel = $('#control-panel'), overlay = $('#overlay'); const toggleBtn = $('#settings-toggle-btn'), closeBtn = $('#panel-close-btn');
        function openPanel() { panel.setAttribute('aria-hidden', 'false'); overlay.hidden = false; document.body.classList.add('panel-open'); }
        function closePanel() { panel.setAttribute('aria-hidden', 'true'); overlay.hidden = true; document.body.classList.remove('panel-open'); }
        toggleBtn.addEventListener('click', openPanel); closeBtn.addEventListener('click', closePanel); overlay.addEventListener('click', closePanel);
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
          const effective = (pref === "system") ? resolveSystemTheme() : pref;
          root.setAttribute("data-theme", effective);
          root.setAttribute("data-theme-pref", pref);
        }
        try {
          colorSchemeMQ.addEventListener("change", () => {
            if ((localStorage.getItem("theme") || "system") === "system") applyTheme("system");
          });
        } catch(e) {
          try { colorSchemeMQ.addListener(() => {
            if ((localStorage.getItem("theme") || "system") === "system") applyTheme("system");
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
