import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Prevent scroll wheel from changing number inputs globally
document.addEventListener("wheel", function (e) {
  if (e.target && (e.target as Element).matches('input[type="number"], input[readonly="readonly"]')) {
    e.preventDefault();
  }
}, { passive: false });
