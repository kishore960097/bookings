(() => {
  try {
    const savedTheme = localStorage.getItem('qgo-theme') || localStorage.getItem('qgo_theme') || 'system';
    const dark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const intro = new URLSearchParams(window.location.search).get('intro');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const useRed = intro === 'full' || (!intro && !reduced);
    document.documentElement.dataset.qgoIntroBackground = useRed ? 'red' : 'white';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    document.documentElement.dataset.qgoIntroThemeRestore = '#FFFFFF';
    themeMeta?.setAttribute('content', useRed ? '#E9342B' : '#FFFFFF');
  } catch { /* Safe fallback */ }
})();
