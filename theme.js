// Clean Dark / Light Mode Manager for Get Real
const ThemeManager = (() => {
  const STORAGE_KEY = 'get_real_mode_v2';
  let currentMode = 'light';
  let userHasManualPreference = false;

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

      // Update all mode buttons across all views to state the CURRENT mode
      document.querySelectorAll('.theme-mode-text').forEach(el => {
        el.textContent = isDark ? '🌙 Dark Mode' : '☀️ Light Mode';
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
