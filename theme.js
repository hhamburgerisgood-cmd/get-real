// Clean Dark / Light Mode Manager for Get Real
const ThemeManager = (() => {
  const STORAGE_KEY = 'get_real_mode_v2';
  let currentMode = 'light';

  function init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        currentMode = saved;
      } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentMode = 'dark';
      }
    } catch (e) {}

    apply(currentMode);
  }

  function apply(mode) {
    currentMode = mode === 'dark' ? 'dark' : 'light';
    const isDark = currentMode === 'dark';

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark-mode', isDark);

      // Update all mode buttons across all views to state the CURRENT mode
      document.querySelectorAll('.theme-mode-text').forEach(el => {
        el.textContent = isDark ? '🌙 Dark Mode' : '☀️ Light Mode';
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY, currentMode);
    } catch (e) {}
  }

  function toggle() {
    apply(currentMode === 'dark' ? 'light' : 'dark');
  }

  function getMode() {
    return currentMode;
  }

  return {
    init,
    toggle,
    apply,
    getMode,
    // Backwards compatibility aliases if called from older hooks
    toggleDarkLight: toggle,
    applyTheme: (m) => apply(m === 'dark' ? 'dark' : 'light'),
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
