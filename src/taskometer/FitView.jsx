import React from 'react';
import { Check, SectionLabel } from './shared.jsx';

export default function FitView({ weekFit, backlog, onToggle, onNavigate }) {
  const { rowLabels, dayLabels, placed, capacity } = weekFit;

  const fitsText = capacity.fits ? 'everything fits.' : 'overflowing.';
  const fitsColor = capacity.fits ? 'var(--sage)' : 'var(--orange)';

  return (
    <div className="tm-fade-up">
      <div style={{ marginBottom: 14 }}>
        <SectionLabel right={`${capacity.slotted} slotted · ${capacity.incoming} to place · ${capacity.buffer} buffer`}>
          Week capacity
        </SectionLabel>
        <CapacityBar capacity={capacity} />
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 26, fontStyle: 'italic', color: fitsColor }}>
          {fitsText}
        </div>
      </div>

      <div className="tm-grid-2" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr', gap: 22, alignItems: 'start' }}>
        <div>
          <SectionLabel right={<span style={{ color: 'var(--orange)' }}>+ add</span>}>To place</SectionLabel>
          <div className="tm-card tm-flush">
            {backlog.length === 0 ? (
              <div style={{ padding: '14px 16px' }} className="tm-mono">nothing to place</div>
            ) : backlog.map(t => {
              const id = t.id || t.key;
              const dur = typeof t.duration === 'number' ? t.duration : 30;
              const ctx = `${t.primaryType || t.taskType || 'task'} · ${dur}m`;
              const warn = !!t.metadata?.warn;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)' }}>
                  <Check
                    checked={t.status === 'completed'}
                    onToggle={() => onToggle && onToggle(id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, lineHeight: 1.1 }}>{t.text || t.title || 'untitled'}</div>
                    <div className="tm-mono">{ctx}</div>
                  </div>
                  {warn ? (
                    <span className="tm-mono tm-sm" style={{ border: '1.5px solid var(--orange)', color: 'var(--orange)', borderRadius: 4, padding: '2px 6px' }}>⚠</span>
                  ) : null}
                </div>
              );
            })}
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
            {dayLabels.map((d, i) => (
              <div key={i} className="tm-mono tm-md" style={{ textAlign: 'center', color: d.today ? 'var(--orange)' : 'var(--ink-mute)', paddingBottom: 4 }}>
                {d.label}{d.today ? ' · now' : ''}
              </div>
            ))}
            {rowLabels.map((row, ri) => (
              <React.Fragment key={ri}>
                <div className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center' }}>{row}</div>
                {dayLabels.map((_, ci) => {
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

function CapacityBar({ capacity }) {
  const placed = Math.max(1, capacity.placedMin);
  const incoming = Math.max(0, capacity.incomingMin);
  const buffer = Math.max(0, capacity.bufferMin);
  const total = placed + incoming + buffer || 1;
  return (
    <div style={{ display: 'flex', height: 30, border: '1.5px solid var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
      <div className="tm-caveat" style={{ flex: `${placed} ${placed} 0%`, background: 'var(--sage-pale)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
        <span style={{ fontSize: 17 }}>already placed</span>
      </div>
      {incoming > 0 && (
        <div className="tm-caveat" style={{ flex: `${incoming} ${incoming} 0%`, background: 'var(--orange-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)', fontStyle: 'italic' }}>
          incoming
        </div>
      )}
      {buffer > 0 && (
        <div className="tm-caveat" style={{ flex: `${buffer} ${buffer} 0%`, background: 'var(--paper)', borderLeft: '1px dashed var(--ink-mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          buffer ✓
        </div>
      )}
    </div>
  );
}
