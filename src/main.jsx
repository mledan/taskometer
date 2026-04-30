import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "./styles/variables.css";
import "./index.css";
// Storage migrations also run inside App.jsx so the test harness picks
// them up. Importing here is harmless because they're idempotent.
import './storage-migrations.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
