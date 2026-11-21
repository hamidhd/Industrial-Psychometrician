/* روان‌سنج صنعتی — WordPress compatibility layer (no app code changes) */
(function () {
  'use strict';

  // RTL + full-width container for the app root
  function styleRoot() {
    var el = document.getElementById('rsi-root');
    if (!el) return;
    el.setAttribute('dir', 'rtl');
    el.style.width = '100%';
    el.style.maxWidth = '100%';
  }

  // Neutralize theme "reset" rules that fight the app's own styles
  function addGuards() {
    var css = [
      '#rsi-root, #rsi-root * { box-sizing: border-box; }',
      '#rsi-root { line-height: 1.75; }',
      '#rsi-root h1, #rsi-root h2, #rsi-root h3, #rsi-root h4, #rsi-root p,',
      '#rsi-root ul, #rsi-root li, #rsi-root table, #rsi-root button,',
      '#rsi-root input, #rsi-root select, #rsi-root textarea { margin: initial; padding: initial; }',
      '#rsi-root ul, #rsi-root ol { list-style: none; }',
      '#rsi-root a { text-decoration: none; color: inherit; }',
      '@media print { body * { visibility: hidden; } #rsi-root, #rsi-root * { visibility: visible; } #rsi-root { position: absolute; inset: 0; } }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'rsi-wp-guards';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function boot() {
    styleRoot();
    addGuards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
