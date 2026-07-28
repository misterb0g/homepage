// Installation et cycle de vie de la PWA Start Desk.
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.StartDesk?.emit?.('pwa:update-ready');
          }
        });
      });

      window.StartDesk?.emit?.('pwa:ready', { registration });
    } catch (error) {
      console.warn('Start Desk PWA: service worker non disponible.', error);
    }
  });
})();
