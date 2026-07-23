// --- Réglages Start Desk ---
(function initSettingsModule(global) {
  const StartDesk = global.StartDesk;
  const $ = (selector, root = document) => root.querySelector(selector);

  const EDIT_MODE_KEY = 'startpage_edit_mode_v1';
  const COLLAPSE_KEY = 'startpage_widget_collapsed_v4';
  const HIDDEN_KEY = 'startpage_widget_hidden_v4';

  let initialized = false;
  let panelCloseTimer = null;
  let panelPinnedByClick = false;

  function emit(eventName, detail) {
    StartDesk?.emit?.(eventName, detail);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  }

  function applySetting(key, value, action) {
    try { localStorage.setItem(key, String(value)); }
    catch (_) {}
    action(value);
    emit('settings:changed', { key, value });
  }

  function openPanel(options = {}) {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    if (!panel || !overlay) return;
    panel.setAttribute('aria-hidden', 'false');
    overlay.hidden = false;
    document.body.classList.add('panel-open');
    if (options.pinned) panelPinnedByClick = true;
    emit('settings:panel-opened', { pinned: !!options.pinned });
  }

  function closePanel() {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    if (!panel || !overlay) return;
    panel.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    document.body.classList.remove('panel-open');
    panelPinnedByClick = false;
    emit('settings:panel-closed');
  }

  function setupPanel() {
    const panel = $('#control-panel');
    const overlay = $('#overlay');
    const toggleBtn = $('#settings-toggle-btn');
    const closeBtn = $('#panel-close-btn');
    const hoverQuery = global.matchMedia('(hover: hover) and (min-width: 768px)');
    if (!panel || !overlay || !toggleBtn || !closeBtn) return;

    const scheduleHoverClose = () => {
      if (!hoverQuery.matches || panelPinnedByClick) return;
      clearTimeout(panelCloseTimer);
      panelCloseTimer = setTimeout(() => {
        const cursorOnButton = toggleBtn.matches(':hover');
        const cursorOnPanel = panel.matches(':hover');
        if (!cursorOnButton && !cursorOnPanel) closePanel();
      }, 180);
    };

    toggleBtn.addEventListener('mouseenter', () => {
      if (!hoverQuery.matches) return;
      clearTimeout(panelCloseTimer);
      openPanel({ pinned: false });
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
    hoverQuery.addEventListener?.('change', closePanel);
    global.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('panel-open')) closePanel();
    });
  }

  function setupWeatherLocation() {
    const input = $('#weather-location-input');
    const saveBtn = $('#weather-location-save');
    if (!input || !saveBtn) return;
    input.value = localStorage.getItem('weatherLocation') || '';

    const save = () => {
      const location = input.value.trim();
      if (!location) return;
      localStorage.setItem('weatherLocation', location);
      if (typeof global.getWeather === 'function') global.getWeather();
      else StartDesk?.modules?.weather?.refresh?.();
      emit('settings:weather-location-changed', { location });
      closePanel();
    };

    saveBtn.addEventListener('click', save);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
  }

  function setupSelector(selectorId, storageKey, action, defaultValue) {
    const selector = $(selectorId);
    if (!selector) return;
    const buttons = Array.from(selector.querySelectorAll('button'));
    const savedValue = localStorage.getItem(storageKey) || defaultValue;
    action(savedValue);
    buttons.forEach((button) => button.classList.toggle('active', button.dataset.value === savedValue));

    selector.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target?.dataset.value) return;
      applySetting(storageKey, target.dataset.value, action);
      buttons.forEach((button) => button.classList.remove('active'));
      target.classList.add('active');
    });
  }

  function setupAppearance() {
    const root = document.documentElement;
    const colorScheme = global.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (preference) => {
      let effective = preference;
      if (preference === 'system') effective = colorScheme.matches ? 'dark' : 'light';
      if (preference === 'mac') effective = colorScheme.matches ? 'macos-dark' : 'macos-light';
      root.setAttribute('data-theme', effective);
      root.setAttribute('data-theme-pref', preference);
    };

    const refreshSystemTheme = () => {
      const saved = localStorage.getItem('theme') || 'system';
      if (saved === 'system' || saved === 'mac') applyTheme(saved);
    };

    try { colorScheme.addEventListener('change', refreshSystemTheme); }
    catch (_) { try { colorScheme.addListener(refreshSystemTheme); } catch (_) {} }

    setupSelector('#theme-selector', 'theme', applyTheme, 'system');
    setupSelector('#density-selector', 'density', (value) => root.setAttribute('data-density', value), 'cozy');
  }

  function applyEditMode(enabled) {
    document.body.classList.toggle('edit-mode', !!enabled);
    if (typeof global.setTileSortableEnabled === 'function') global.setTileSortableEnabled(!!enabled);
    try { localStorage.setItem(EDIT_MODE_KEY, enabled ? '1' : '0'); }
    catch (_) {}
    emit('settings:edit-mode-changed', { enabled: !!enabled });
  }

  function setupEditMode() {
    const toggle = $('#edit-mode-toggle');
    if (!toggle) {
      applyEditMode(false);
      return;
    }
    const initial = localStorage.getItem(EDIT_MODE_KEY) === '1';
    toggle.checked = initial;
    applyEditMode(initial);
    toggle.addEventListener('change', () => applyEditMode(toggle.checked));
  }

  function setupTileReset() {
    const toggle = $('#tiles-reset-toggle');
    if (!toggle) return;
    toggle.checked = false;
    toggle.addEventListener('change', () => {
      if (!toggle.checked) return;
      if (typeof global.resetTileOrder === 'function') global.resetTileOrder();
      if (typeof global.setupBookmarks === 'function') global.setupBookmarks();
      setTimeout(() => { toggle.checked = false; }, 150);
      emit('settings:tile-order-reset');
      closePanel();
    });
  }

  function getPanelToggle(widgetId) {
    return document.getElementById(`${widgetId}-toggle`);
  }

  function applyHiddenState(widgetId, hidden) {
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widget) widget.style.display = hidden ? 'none' : '';
    document.body.classList.toggle(`${widgetId}-hidden`, !!hidden);
    const toggle = getPanelToggle(widgetId);
    if (toggle) toggle.checked = !hidden;

    if (widgetId === 'news') localStorage.setItem('showNews', hidden ? 'false' : 'true');
    if (widgetId === 'chat') localStorage.setItem('showChat', hidden ? 'false' : 'true');
    if (widgetId === 'calendar') localStorage.setItem('calendarHidden', hidden ? '1' : '0');
  }

  function setupWidgets() {
    const collapsedState = readJson(COLLAPSE_KEY);
    const hiddenState = readJson(HIDDEN_KEY);

    ['news', 'chat', 'calendar'].forEach((widgetId) => {
      if (typeof hiddenState[widgetId] !== 'boolean') {
        if (widgetId === 'news') hiddenState.news = localStorage.getItem('showNews') === 'false';
        if (widgetId === 'chat') hiddenState.chat = localStorage.getItem('showChat') === 'false';
        if (widgetId === 'calendar') hiddenState.calendar = localStorage.getItem('calendarHidden') === '1';
      }
    });
    writeJson(HIDDEN_KEY, hiddenState);

    document.querySelectorAll('.widget-shell[data-widget-id]').forEach((widget) => {
      const widgetId = widget.dataset.widgetId;
      const toolbar = widget.querySelector('.widget-toolbar');
      const closeBtn = widget.querySelector('[data-widget-close]');

      widget.classList.toggle('is-collapsed', !!collapsedState[widgetId]);
      applyHiddenState(widgetId, !!hiddenState[widgetId]);

      toolbar?.addEventListener('click', (event) => {
        if (event.target.closest('button') || hiddenState[widgetId]) return;
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
        writeJson(COLLAPSE_KEY, collapsedState);
        emit('settings:widget-collapsed', { widgetId, collapsed });
      });

      closeBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        hiddenState[widgetId] = true;
        writeJson(HIDDEN_KEY, hiddenState);
        applyHiddenState(widgetId, true);
        emit('settings:widget-visibility-changed', { widgetId, visible: false });
      });
    });

    ['news', 'chat', 'calendar'].forEach((widgetId) => {
      const toggle = getPanelToggle(widgetId);
      if (!toggle) return;
      toggle.checked = !hiddenState[widgetId];
      toggle.addEventListener('change', () => {
        hiddenState[widgetId] = !toggle.checked;
        writeJson(HIDDEN_KEY, hiddenState);
        applyHiddenState(widgetId, hiddenState[widgetId]);
        if (widgetId === 'news' && toggle.checked && typeof global.loadNews === 'function' && !global.__newsLoaded) {
          global.loadNews();
        }
        emit('settings:widget-visibility-changed', { widgetId, visible: toggle.checked });
      });
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    setupPanel();
    setupWeatherLocation();
    setupAppearance();
    setupEditMode();
    setupTileReset();
    setupWidgets();
    emit('settings:ready');
  }

  const api = {
    init,
    openPanel,
    closePanel,
    applyEditMode,
    applyHiddenState
  };

  if (StartDesk?.register) StartDesk.register('settings', api);
  else global.StartDeskSettings = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
