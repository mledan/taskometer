import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "./styles/variables.css";
import "./index.css";

// Guest-mode reset: any visitor who isn't signed into an account starts fresh
// on every page load. Only accounts persist across refreshes.
(function resetGuestData() {
  try {
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
    // Wipe any taskometer-* adapter keys too (tasks, slots, types, schedules,
    // settings, history, model version, etc.) so guest always starts fresh.
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
