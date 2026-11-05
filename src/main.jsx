import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "./styles/variables.css";
import "./index.css";
import "./styles/a11y.css";
import { runStorageMigrations } from './storage-migrations.js';
// Surface a console-grouped report of missing env vars so the operator
// knows at a glance which features are not yet wired up. See SETUP.md.
import { runStartupChecks } from './services/startup-checks.js';

runStorageMigrations();
runStartupChecks();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
