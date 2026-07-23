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
