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



