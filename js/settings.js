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



