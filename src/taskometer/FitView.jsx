import React from 'react';
import { Check, SectionLabel } from './shared.jsx';

export default function FitView({ tasks, onToggle, onNavigate }) {
  const rowLabels = ['deep', 'mtgs', 'admin', 'calls', 'play'];
  const days = [
    { label: 'M 20', today: true },
    { label: 'T 21' },
    { label: 'W 22' },
    { label: 'T 23' },
    { label: 'F 24' },
  ];

  const placed = [
    { row: 0, col: 0, label: 'Q2 doc', kind: 'now' },
    { row: 0, col: 1, label: 'blog outline', kind: 'routed' },
    { row: 1, col: 0, label: 'standup' },
    { row: 1, col: 1, label: '1:1 Dana' },
    { row: 1, col: 2, label: 'all-hands' },
    { row: 1, col: 4, label: 'retro', kind: 'light' },
    { row: 2, col: 0, label: 'expenses' },
    { row: 2, col: 1, label: 'review PRs', kind: 'routed' },
    { row: 2, col: 2, label: 'faucet', kind: 'routed' },
    { row: 3, col: 2, label: 'mom', kind: 'routed' },
    { row: 4, col: 4, label: "Josie's bday", kind: 'light' },
  ];

  const placeable = [
    { id: 'a', title: 'finish Q2 planning doc', ctx: 'deep work · 90m' },
    { id: 'b', title: 'draft blog outline', ctx: 'deep work · 60m' },
    { id: 'c', title: 'review PRs', ctx: 'admin · 30m' },
    { id: 'd', title: 'call mom', ctx: 'calls · 20m' },
    { id: 'e', title: "plan Josie's birthday", ctx: 'play · 45m' },
    { id: 'f', title: 'fix leaky faucet', ctx: 'admin · 30m' },
    { id: 'g', title: 'research new laptop', ctx: 'admin · 30m', warn: true },
  ];

  return (
    <div className="tm-fade-up">
      <div style={{ marginBottom: 14 }}>
        <SectionLabel right="38h slotted · 12h to place · 6h buffer">Week capacity</SectionLabel>
        <CapacityBar />
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 26, fontStyle: 'italic', color: 'var(--sage)' }}>
          everything fits.
        </div>
      </div>

      <div className="tm-grid-2" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr', gap: 22, alignItems: 'start' }}>
        <div>
          <SectionLabel right={<span style={{ color: 'var(--orange)' }}>+ add</span>}>To place</SectionLabel>
          <div className="tm-card tm-flush">
            {placeable.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)' }}>
                <Check checked={false} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, lineHeight: 1.1 }}>{t.title}</div>
                  <div className="tm-mono">{t.ctx}</div>
                </div>
                {t.warn ? (
                  <span className="tm-mono tm-sm" style={{ border: '1.5px solid var(--orange)', color: 'var(--orange)', borderRadius: 4, padding: '2px 6px' }}>⚠</span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="tm-card tm-dashed" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--sage-pale)', borderColor: 'var(--sage)' }}>
            <div style={{ fontSize: 20, lineHeight: 1.1 }}>↓ auto-routed into the week →</div>
            <div className="tm-mono">drag a row onto any cell to override</div>
          </div>
        </div>

        <div>
          <SectionLabel right="orange = auto-routed · drag to move">This week</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '58px repeat(5, 1fr)', gap: 4 }}>
            <div />
            {days.map((d, i) => (
              <div key={i} className="tm-mono tm-md" style={{ textAlign: 'center', color: d.today ? 'var(--orange)' : 'var(--ink-mute)', paddingBottom: 4 }}>
                {d.label}{d.today ? ' · now' : ''}
              </div>
            ))}
            {rowLabels.map((row, ri) => (
              <React.Fragment key={ri}>
                <div className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center' }}>{row}</div>
                {days.map((d, ci) => {
                  const p = placed.find(x => x.row === ri && x.col === ci);
                  let bg = 'var(--paper)', bd = 'var(--rule)', fg = 'var(--ink)';
                  if (p) {
                    if (p.kind === 'now') { bg = 'var(--orange)'; bd = 'var(--orange)'; fg = 'var(--paper)'; }
                    else if (p.kind === 'routed') { bg = 'var(--orange-pale)'; bd = 'var(--orange)'; }
                    else if (p.kind === 'light') { bg = 'var(--sage-pale)'; bd = 'var(--sage)'; }
                    else { bg = 'var(--paper)'; bd = 'var(--ink-mute)'; }
                  }
                  return (
                    <div key={ci} style={{
                      border: `1px ${p ? 'solid' : 'dashed'} ${bd}`,
                      background: bg,
                      color: fg,
                      borderRadius: 6,
                      minHeight: 44,
                      padding: '6px 8px',
                      fontSize: 17,
                      fontStyle: p ? 'italic' : 'normal',
                      lineHeight: 1.05,
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                    }}>
                      {p ? p.label : <span style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>—</span>}
                      {p?.kind === 'now' && (
                        <span className="tm-mono" style={{ position: 'absolute', top: -8, right: 4, background: 'var(--paper)', padding: '0 4px', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: 3, fontSize: 9 }}>now</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 22, paddingTop: 14, borderTop: '1px dashed var(--rule)' }}>
        <button className="tm-btn tm-primary tm-sm">auto-fit all</button>
        <button className="tm-btn tm-sm">add time block</button>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('gauge')}>back to today</button>
      </div>
    </div>
  );
}

function CapacityBar() {
  return (
    <div style={{ display: 'flex', height: 30, border: '1.5px solid var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
      <div className="tm-caveat" style={{ flex: '38 38 0%', background: 'var(--sage-pale)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
        <span style={{ fontSize: 17 }}>already placed</span>
      </div>
      <div className="tm-caveat" style={{ flex: '12 12 0%', background: 'var(--orange-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)', fontStyle: 'italic' }}>
        incoming
      </div>
      <div className="tm-caveat" style={{ flex: '6 6 0%', background: 'var(--paper)', borderLeft: '1px dashed var(--ink-mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        buffer ✓
      </div>
    </div>
  );
}
