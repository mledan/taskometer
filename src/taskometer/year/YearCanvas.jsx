import React, { useEffect, useMemo, useState } from 'react';
import {
  listRhythms,
  listExceptions,
  removeRhythm,
  removeException,
  addException,
  buildYearMap,
  ymd,
} from '../../services/rhythms.js';
import RhythmComposer from './RhythmComposer.jsx';
import ExceptionModal from './ExceptionModal.jsx';
import './year.css';

/**
 * Year canvas — the new annual-first home for /app/year.
 *
 * Top: header with year nav, "+ rhythm" and "+ exception" CTAs, link
 * back to the day view at /app.
 * Left rail: rhythms library (list + add/edit/delete).
 * Center: 12-month grid. Each month is a tight calendar; each day is
 * tinted with the colors of the rhythms firing that day. Exception
 * ranges show as a dashed overlay.
 *
 * Click a day → navigates to /app?date=YYYY-MM-DD so the user lands
 * in the existing day view at that date.
 */
export default function YearCanvas() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rhythms, setRhythms] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingRhythm, setEditingRhythm] = useState(null);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);

  const reload = () => {
    setRhythms(listRhythms());
    setExceptions(listExceptions());
  };

  useEffect(() => { reload(); }, []);

  const yearMap = useMemo(
    () => buildYearMap(year, rhythms, exceptions),
    [year, rhythms, exceptions],
  );

  const handleDelete = (id) => {
    if (!window.confirm('Delete this rhythm? Its occurrences disappear from the year.')) return;
    removeRhythm(id);
    reload();
  };

  const handleDeleteException = (id) => {
    removeException(id);
    reload();
  };

  return (
    <div className="yc-root tm-paper">
      <header className="yc-header">
        <div className="yc-header-left">
          <a href="/app" className="yc-back" title="day view">
            ← day view
          </a>
          <h1 className="yc-title">{year}</h1>
          <div className="yc-yearnav">
            <button className="tm-btn tm-sm" onClick={() => setYear(y => y - 1)} aria-label="previous year">‹</button>
            <button className="tm-btn tm-sm" onClick={() => setYear(new Date().getFullYear())}>this year</button>
            <button className="tm-btn tm-sm" onClick={() => setYear(y => y + 1)} aria-label="next year">›</button>
          </div>
        </div>
        <div className="yc-header-right">
          <button
            className="tm-btn tm-primary"
            onClick={() => { setEditingRhythm(null); setComposerOpen(true); }}
          >
            + Rhythm
          </button>
          <button
            className="tm-btn"
            onClick={() => setExceptionModalOpen(true)}
          >
            + Exception
          </button>
        </div>
      </header>

      <div className="yc-body">
        <aside className="yc-rail">
          <div className="yc-rail-section">
            <div className="yc-rail-head">
              <span className="yc-rail-title">Rhythms</span>
              <span className="yc-mono">{rhythms.length}</span>
            </div>
            {rhythms.length === 0 ? (
              <div className="yc-rail-empty">
                No rhythms yet. Click <strong>+ Rhythm</strong> to define
                your first recurring block — a weekly all-hands, a
                biweekly retro, a monthly review.
              </div>
            ) : (
              <ul className="yc-rail-list">
                {rhythms.map(r => (
                  <li key={r.id} className="yc-rail-item">
                    <span className="yc-rail-dot" style={{ background: r.color || '#A8BF8C' }} />
                    <div className="yc-rail-text">
                      <div className="yc-rail-name">{r.name}</div>
                      <div className="yc-mono yc-rail-cadence">{describeCadence(r.cadence)}</div>
                    </div>
                    <button
                      className="yc-rail-action"
                      title="edit"
                      onClick={() => { setEditingRhythm(r); setComposerOpen(true); }}
                    >✎</button>
                    <button
                      className="yc-rail-action yc-rail-danger"
                      title="delete"
                      onClick={() => handleDelete(r.id)}
                    >×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="yc-rail-section">
            <div className="yc-rail-head">
              <span className="yc-rail-title">Exceptions</span>
              <span className="yc-mono">{exceptions.length}</span>
            </div>
            {exceptions.length === 0 ? (
              <div className="yc-rail-empty">
                Block out vacations, holidays, conferences. Rhythms are
                automatically suppressed inside an exception range.
              </div>
            ) : (
              <ul className="yc-rail-list">
                {exceptions.map(e => (
                  <li key={e.id} className="yc-rail-item">
                    <span className="yc-rail-dot yc-rail-dot-exc" style={{ background: e.color || '#94A3B8' }} />
                    <div className="yc-rail-text">
                      <div className="yc-rail-name">{e.label}</div>
                      <div className="yc-mono yc-rail-cadence">
                        {e.startDate}{e.startDate === e.endDate ? '' : ` → ${e.endDate}`} · {e.type}
                      </div>
                    </div>
                    <button
                      className="yc-rail-action yc-rail-danger"
                      title="delete"
                      onClick={() => handleDeleteException(e.id)}
                    >×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="yc-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <MonthBlock
              key={m}
              year={year}
              month={m}
              yearMap={yearMap}
            />
          ))}
        </main>
      </div>

      {composerOpen && (
        <RhythmComposer
          rhythm={editingRhythm}
          onClose={() => { setComposerOpen(false); setEditingRhythm(null); }}
          onSaved={() => { setComposerOpen(false); setEditingRhythm(null); reload(); }}
        />
      )}

      {exceptionModalOpen && (
        <ExceptionModal
          onClose={() => setExceptionModalOpen(false)}
          onSaved={() => { setExceptionModalOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function MonthBlock({ year, month, yearMap }) {
  const monthName = useMemo(
    () => new Date(year, month, 1).toLocaleDateString('en', { month: 'long' }),
    [year, month],
  );
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const lead = (first.getDay() + 6) % 7; // Mon-first
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const todayKey = ymd(new Date());

  return (
    <div className="yc-month">
      <div className="yc-month-head">{monthName}</div>
      <div className="yc-month-dows">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <div key={i} className="yc-mono">{l}</div>
        ))}
      </div>
      <div className="yc-month-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="yc-cell yc-cell-empty" />;
          const key = ymd(d);
          const entries = yearMap.get(key) || [];
          const isToday = key === todayKey;
          const isExcepted = entries.some(e => e.suppressed);
          // Derive a layered background from up to 3 rhythms firing.
          const colors = entries
            .filter(e => !e.suppressed)
            .slice(0, 3)
            .map(e => e.rhythm?.color || '#A8BF8C');
          const bg = colors.length === 0
            ? 'var(--paper)'
            : colors.length === 1
            ? hexAlpha(colors[0], 0.34)
            : `linear-gradient(135deg, ${colors.map((c, j) => `${hexAlpha(c, 0.34)} ${(j / colors.length) * 100}% ${(((j + 1) / colors.length) * 100)}%`).join(', ')})`;
          return (
            <a
              key={i}
              href={`/app?date=${key}`}
              className={`yc-cell${isToday ? ' yc-cell-today' : ''}${isExcepted ? ' yc-cell-excepted' : ''}`}
              style={{ background: bg }}
              title={describeCellTitle(key, entries)}
            >
              <span className="yc-cell-num">{d.getDate()}</span>
              {entries.length > 0 && !isExcepted && (
                <span className="yc-cell-dots" aria-hidden>
                  {entries.slice(0, 3).map((e, j) => (
                    <span key={j} className="yc-cell-dot" style={{ background: e.rhythm.color || '#A8BF8C' }} />
                  ))}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function describeCellTitle(dateKey, entries) {
  if (!entries.length) return `${dateKey} — open day`;
  const active = entries.filter(e => !e.suppressed);
  const supp = entries.filter(e => e.suppressed);
  const parts = [];
  if (active.length) parts.push(active.map(e => e.rhythm.name).join(' · '));
  if (supp.length) parts.push(`(${supp[0].suppressed.label || supp[0].suppressed.type} suppresses ${supp.map(e => e.rhythm.name).join(', ')})`);
  return `${dateKey} — ${parts.join(' ')}`;
}

function describeCadence(cad) {
  if (!cad) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (cad.kind) {
    case 'weekly':       return `every ${days[cad.dayOfWeek]} · ${cad.startTime || ''}–${cad.endTime || ''}`;
    case 'biweekly':     return `alt ${days[cad.dayOfWeek]} · ${cad.startTime || ''}–${cad.endTime || ''}`;
    case 'monthly_nth':  return `${ordinal(cad.nth)} ${days[cad.dayOfWeek]} of month`;
    case 'monthly_date': return `the ${ordinal(cad.monthDate)} of each month`;
    case 'quarterly_week': return `wk ${cad.weekOfQuarter} of each quarter`;
    case 'project':      return `project · ${cad.anchor} → ${cad.end}`;
    case 'oneoff':       return `one-off · ${cad.anchor}`;
    default:             return cad.kind;
  }
}

function ordinal(n) {
  if (n === -1) return 'last';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function hexAlpha(hex, a) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
