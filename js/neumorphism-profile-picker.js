/* Visual-only accessible picker for the existing Start Desk profile select.
 * The native select remains the single source of truth; its change handler
 * applies the existing Boulot / Perso / Complet behavior unchanged. */
(() => {
  'use strict';
  let installed = false;
  function install() {
    if (installed) return;
    const select = document.querySelector('.profile-picker > select.startpage-profile-pill');
    if (!select || !select.options.length) return;
    installed = true;
    const wrapper = select.parentElement;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'profile-picker-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Profil de page');
    const menu = document.createElement('div');
    menu.className = 'profile-picker-menu';
    menu.id = 'neo-profile-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Profil de page');
    menu.hidden = true;
    trigger.setAttribute('aria-controls', menu.id);

    const options = [...select.options].map(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'option';
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent;
      btn.tabIndex = -1;
      menu.append(btn);
      return btn;
    });
    function sync() {
      trigger.firstChild && trigger.firstChild.nodeType === Node.TEXT_NODE
        ? trigger.firstChild.textContent = select.selectedOptions[0]?.textContent || 'Profil'
        : trigger.insertBefore(document.createTextNode(select.selectedOptions[0]?.textContent || 'Profil'), trigger.firstChild);
      for (const btn of options) {
        btn.setAttribute('aria-selected', String(btn.dataset.value === select.value));
      }
    }
    function close(restoreFocus = false) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
    function open() {
      sync();
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      (options.find(b => b.dataset.value === select.value) || options[0])?.focus();
    }
    function choose(btn) {
      if (select.value !== btn.dataset.value) {
        select.value = btn.dataset.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
      close(true);
    }
    trigger.addEventListener('click', () => menu.hidden ? open() : close(true));
    menu.addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-value]');
      if (btn) choose(btn);
    });
    menu.addEventListener('keydown', ev => {
      const idx = options.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); close(true); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        options[(idx + (ev.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
      } else if (ev.key === 'Home' || ev.key === 'End') {
        ev.preventDefault();
        options[ev.key === 'Home' ? 0 : options.length - 1]?.focus();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (idx >= 0) choose(options[idx]);
      } else if (ev.key === 'Tab') close();
    });
    document.addEventListener('pointerdown', ev => {
      if (!wrapper.contains(ev.target)) close();
    });
    select.addEventListener('change', sync);
    wrapper.append(trigger, menu);
    sync();
    wrapper.classList.add('neo-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  const observer = new MutationObserver(() => {
    if (!installed) install();
    else observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();