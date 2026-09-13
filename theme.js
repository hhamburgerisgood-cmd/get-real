// Clean Dark / Light Mode Manager for Get Real
const ThemeManager = (() => {
  const STORAGE_KEY = 'get_real_mode_v2';
  let currentMode = 'light';
  let userHasManualPreference = false;

  const sunSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

  const moonSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function getSystemPreference() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  function init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        currentMode = saved;
        userHasManualPreference = true;
      } else {
        currentMode = getSystemPreference();
        userHasManualPreference = false;
      }
    } catch (e) {
      currentMode = getSystemPreference();
    }

    apply(currentMode, false);

    // Listen for OS system theme changes live if user hasn't manually overridden
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', (e) => {
            if (!userHasManualPreference) {
              apply(e.matches ? 'dark' : 'light', false);
            }
          });
        }
      } catch (e) {}
    }

    // Attach to DOMContentLoaded so buttons are updated as soon as DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          apply(currentMode, false);
        });
      } else {
        apply(currentMode, false);
      }
    }
  }

  function apply(mode, save = true) {
    currentMode = mode === 'dark' ? 'dark' : 'light';
    const isDark = currentMode === 'dark';

    if (typeof document !== 'undefined') {
      if (document.documentElement) {
        document.documentElement.classList.toggle('dark-mode', isDark);
      }

      // Update theme toggle buttons across all views
      document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        const iconSlot = btn.querySelector('.theme-icon-slot');
        if (iconSlot) {
          iconSlot.innerHTML = isDark ? moonSvg : sunSvg;
        } else {
          const oldSvg = btn.querySelector('svg');
          if (oldSvg && oldSvg.parentNode) {
            const temp = document.createElement('div');
            temp.innerHTML = isDark ? moonSvg : sunSvg;
            if (temp.firstElementChild) {
              oldSvg.parentNode.replaceChild(temp.firstElementChild, oldSvg);
            }
          }
        }
      });

      // Update all mode text slots across all views to state the CURRENT mode
      document.querySelectorAll('.theme-mode-text').forEach(el => {
        el.textContent = isDark ? 'Dark Mode' : 'Light Mode';
      });
    }

    if (save) {
      userHasManualPreference = true;
      try {
        localStorage.setItem(STORAGE_KEY, currentMode);
      } catch (e) {}
    }
  }

  function toggle() {
    apply(currentMode === 'dark' ? 'light' : 'dark', true);
  }

  function getMode() {
    return currentMode;
  }

  return {
    init,
    toggle,
    apply,
    getMode,
    // Backwards compatibility aliases
    toggleDarkLight: toggle,
    applyTheme: (m) => apply(m === 'dark' ? 'dark' : 'light', true),
    openModal: () => {},
    closeModal: () => {}
  };
})();

// Auto-initialize theme as early as possible
if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
  ThemeManager.init();
}
if (typeof module !== 'undefined') {
  module.exports = ThemeManager;
}
