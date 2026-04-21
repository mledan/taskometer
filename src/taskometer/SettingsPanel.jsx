import React, { useRef, useState } from 'react';

/**
 * Consolidated settings surface. Replaces the old floating "tweaks" panel
 * with a better-organised set of sections: look & feel, behavior, backup,
 * and the typed-confirmation wipe (previously a one-click button).
 */
export default function SettingsPanel({
  ui,
  setUIField,
  api,
  autoSchedule,
  onShowShortcuts,
  onClose,
}) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const pick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.backup.restoreJSON(reader.result);
        setStatus('restored from backup');
      } catch (err) {
        setStatus(`restore failed: ${err.message}`);
      }
      setTimeout(() => setStatus(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmWipe = async () => {
    if (wipeText !== 'wipe my data') {
      setStatus('phrase does not match — nothing was wiped');
      setTimeout(() => setStatus(null), 2500);
      return;
    }
    try {
      await api.backup.wipe({ confirm: 'wipe my data' });
      setStatus('wiped');
    } catch (err) {
      setStatus(`wipe failed: ${err.message}`);
    }
    setWipeText('');
    setWipeOpen(false);
    setTimeout(() => setStatus(null), 2500);
  };

  const toggleNotifications = async (on) => {
    setUIField('notifications', !!on);
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
    }
  };

  return (
    <div className="tm-tweaks" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        settings
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontFamily: 'Caveat', fontSize: 18, cursor: 'pointer', color: 'var(--ink-mute)' }}
        >×</button>
      </h4>

      <section>
        <div className="tm-mono tm-md" style={{ marginTop: 6, color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          behavior
        </div>
        <label>
          auto-schedule new tasks
          <input
            type="checkbox"
            checked={!!autoSchedule}
            onChange={(e) => api.settings.setAutoSchedule(e.target.checked)}
          />
        </label>
        <label>
          browser notifications at task start
          <input
            type="checkbox"
            checked={!!ui.notifications}
            onChange={(e) => toggleNotifications(e.target.checked)}
          />
        </label>
        {ui.notifications && notifPerm === 'denied' && (
          <div className="tm-mono tm-sm" style={{ color: 'var(--orange)' }}>
            browser denied permission — enable it from the site settings first.
          </div>
        )}
        <label>
          show coach suggestions
          <input
            type="checkbox"
            checked={!!ui.showCoach}
            onChange={(e) => setUIField('showCoach', e.target.checked)}
          />
        </label>
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          look
        </div>
        <div>
          <div className="tm-mono tm-md" style={{ marginTop: 6 }}>palette</div>
          <div className="tm-seg">
            {['warm', 'cool', 'dusk'].map(p => (
              <button
                key={p}
                className={ui.palette === p ? 'tm-on' : ''}
                onClick={() => setUIField('palette', p)}
              >
                {p === 'warm' ? 'warm cream' : p === 'cool' ? 'cool paper' : 'dusk'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="tm-mono tm-md" style={{ marginTop: 8 }}>rules</div>
          <div className="tm-seg">
            {['lines', 'grid', 'blank'].map(r => (
              <button
                key={r}
                className={ui.rules === r ? 'tm-on' : ''}
                onClick={() => setUIField('rules', r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          help
        </div>
        <button className="tm-btn tm-sm" onClick={onShowShortcuts}>
          keyboard shortcuts
        </button>
      </section>

      <section style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--rule)' }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          backup
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          <button
            className="tm-btn tm-sm"
            onClick={() => api.backup.exportICS()}
            title="iCalendar file for Google, Apple, Outlook"
          >
            export .ics
          </button>
          <button
            className="tm-btn tm-sm"
            onClick={() => api.backup.exportJSON({ minimal: true })}
            title="schedule-only JSON (tasks, slots, wheels, rules, overrides)"
          >
            export schedule.json
          </button>
          <button
            className="tm-btn tm-ghost tm-sm"
            onClick={() => api.backup.exportJSON({ minimal: false, pretty: true })}
            title="full dump with audit log and legacy template library"
          >
            export full.json
          </button>
          <button className="tm-btn tm-sm" onClick={() => fileRef.current?.click()}>
            restore .json
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={pick}
            style={{ display: 'none' }}
          />
        </div>
      </section>

      <section style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--rule)' }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          danger zone
        </div>
        {!wipeOpen ? (
          <button
            className="tm-btn tm-sm tm-danger"
            onClick={() => setWipeOpen(true)}
          >
            wipe all data…
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
              type <strong>wipe my data</strong> to confirm. this removes every task, time block, wheel, rule, and override.
            </div>
            <input
              className="tm-composer-input"
              placeholder="wipe my data"
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="tm-btn tm-danger tm-sm"
                onClick={confirmWipe}
                disabled={wipeText !== 'wipe my data'}
              >
                wipe everything
              </button>
              <button
                className="tm-btn tm-sm"
                onClick={() => { setWipeOpen(false); setWipeText(''); }}
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {status && <div className="tm-mono tm-sm" style={{ marginTop: 10, color: 'var(--orange)' }}>{status}</div>}
    </div>
  );
}
