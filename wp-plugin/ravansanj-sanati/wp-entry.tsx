import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';

declare const __APP_VERSION__: string;

function boot() {
  const el = document.getElementById('rsi-root');
  if (!el) return;
  (window as any).__APP_VERSION__ = __APP_VERSION__;
  createRoot(el).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
