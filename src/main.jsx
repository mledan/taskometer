import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "./styles/variables.css";
import "./index.css";

// Guest-mode reset: visitors who aren't signed in start fresh on every load.
// Scoped to /app so marketing pages don't bulldoze localStorage.
(function resetGuestData() {
  try {
    if (!window.location.pathname.startsWith('/app')) return;
    const raw = localStorage.getItem('smartcircle.auth');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.mode === 'account') return;
    const keysToWipe = [
      'smartcircle.auth',
      'smartcircle.onboarding.done',
      'state',
      'tm.ui',
      'tm.tweaks',
      'tm.scale',
    ];
    for (const k of keysToWipe) localStorage.removeItem(k);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('taskometer-')) localStorage.removeItem(k);
    }
  } catch (_) {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
