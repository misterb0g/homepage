/* Neumorphism preview: load current weather even when Start Desk starts in Focus.
 * Production code defers secondary modules in Focus and leaves the weather skeleton.
 * This fixes only that gap; normal non-Focus boot continues unchanged. */
(() => {
  'use strict';
  let pending = false;
  function ensureWeather() {
    const weather = document.getElementById('weather');
    if (!weather || !document.body.classList.contains('focus-mode')) return;
    if (typeof window.getWeather === 'function') {
      if (weather.querySelector('.skeleton')) window.getWeather();
      return;
    }
    if (pending) return;
    const existing = document.querySelector('script[data-startdesk-src="js/weather.js"]');
    if (existing) {
      if (existing.dataset.loaded === '1') {
        if (typeof window.getWeather === 'function') window.getWeather();
        return;
      }
      existing.addEventListener('load', () => {
        if (typeof window.getWeather === 'function') window.getWeather();
      }, {once: true});
      return;
    }
    pending = true;
    const module = document.createElement('script');
    module.src = 'js/weather.js';
    module.async = false;
    module.dataset.startdeskSrc = 'js/weather.js';
    module.addEventListener('load', () => {
      pending = false;
      module.dataset.loaded = '1';
      if (typeof window.getWeather === 'function') window.getWeather();
    }, {once: true});
    module.addEventListener('error', () => {
      pending = false;
      module.dataset.failed = '1';
      module.remove();
      if (weather.querySelector('.skeleton')) weather.textContent = 'Météo indisponible';
    }, {once: true});
    document.body.appendChild(module);
  }
  window.addEventListener('load', ensureWeather);
  window.addEventListener('startdesk:focus-changed', event => {
    if (event.detail?.focus) ensureWeather();
  });
})();