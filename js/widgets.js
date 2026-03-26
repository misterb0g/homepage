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
