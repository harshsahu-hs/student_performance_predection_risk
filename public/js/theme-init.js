/* Tiny theme bootstrap, loaded synchronously before paint. */
(function () {
  try {
    var saved = localStorage.getItem('sp-theme');
    var systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = saved === 'light' || saved === 'dark' ? saved : (systemLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
