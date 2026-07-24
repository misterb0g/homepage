// Start Desk 5.2 — ambiance temporelle locale.
(function () {
  'use strict';

  function getAmbience(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 18) return 'day';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  function applyAmbience() {
    const root = document.documentElement;
    const ambience = getAmbience();
    if (root.dataset.timeAmbience !== ambience) {
      root.dataset.timeAmbience = ambience;
    }
  }

  function scheduleNextCheck() {
    const now = new Date();
    const delay = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds() + 250;
    window.setTimeout(() => {
      applyAmbience();
      scheduleNextCheck();
    }, Math.max(1000, delay));
  }

  applyAmbience();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleNextCheck, { once: true });
  } else {
    scheduleNextCheck();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyAmbience();
  });
})();
