import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

console.log('[QGo] Booting QGo web application...');

// Clean up any stale service workers from localhost:3000
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('[QGo] Unregistering stale service worker:', registration.scope);
      registration.unregister();
    }
  }).catch((err) => {
    console.warn('[QGo] Service worker cleanup warning:', err);
  });
}

// Apply the persisted preference before React renders to avoid a light-theme flash.
try {
  const savedTheme = localStorage.getItem('qgo-theme') || localStorage.getItem('qgo_theme') || 'system';
  const resolvedTheme = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark'
    : 'light';
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Prevent scroll wheel from changing number inputs globally
document.addEventListener("wheel", function (e) {
  if (e.target && (e.target as Element).matches('input[type="number"], input[readonly="readonly"]')) {
    e.preventDefault();
  }
}, { passive: false });

