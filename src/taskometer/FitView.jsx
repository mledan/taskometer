import React, { useState } from 'react';
import { Check, SectionLabel } from './shared.jsx';
import { SlotComposer, TaskRowEditor } from './Composers.jsx';
import DayMenu, { buildDayMenuHandlers } from './DayMenu.jsx';

// Default time hint per row type, used when the user clicks an empty
// week-cell to pre-populate the slot composer.
const ROW_DEFAULT_TIMES = {
  deep: ['09:00', '11:00'],
  mtgs: ['13:00', '14:00'],
  admin: ['15:00', '16:00'],
  calls: ['11:00', '12:00'],
  play: ['18:00', '19:00'],
};

export default function FitView({
  weekFit,
  backlog,
  taskTypes = [],
  wheels = [],
  dayAssignments = {},
  dayOverrides = {},
  api,
  rowHandlers = {},
  onNavigate,
  onOpenWheels,
}) {
  const { onToggle, onDelete, onEdit, onSaveEdit, editingTaskId } = rowHandlers;
  const [slotComposerOpen, setSlotComposerOpen] = useState(false);
  const [cellDraft, setCellDraft] = useState(null);
  const [dayMenu, setDayMenu] = useState(null);
  const { rowLabels, dayLabels, placed, itinerary = [] } = weekFit;

  const closeDayMenu = () => setDayMenu(null);
  const dayMenuHandlers = buildDayMenuHandlers({ api, menu: dayMenu, close: closeDayMenu });

  const openDayMenu = (dateKey, ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    setDayMenu({
      date: dateKey,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 4,
    });
  };

  const upcomingCount = itinerary.reduce((sum, d) => sum + d.tasks.length, 0);

  return (
    <div className="tm-fade-up">
      <div style={{ marginBottom: 14 }}>
        <SectionLabel right={upcomingCount ? `${upcomingCount} upcoming` : 'nothing upcoming'}>
          itinerary
        </SectionLabel>
        <Itinerary itinerary={itinerary} rowHandlers={rowHandlers} />
      </div>

      <div className="tm-grid-2" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr', gap: 22, alignItems: 'start' }}>
        <div>
          <SectionLabel>To place</SectionLabel>
          <div className="tm-card tm-flush">
            {backlog.length === 0 ? (
              <div style={{ padding: '14px 16px' }} className="tm-mono">
                nothing to place — tasks route into slots automatically
              </div>
            ) : backlog.map(t => {
              const id = t.id || t.key;
              const dur = typeof t.duration === 'number' ? t.duration : 30;
              const ctx = `${t.primaryType || t.taskType || 'task'} · ${dur}m`;
              const warn = !!t.metadata?.warn;

              if (editingTaskId === id) {
                return (
                  <div key={id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)' }}>
                    <TaskRowEditor
                      task={t}
                      onSave={(updates) => onSaveEdit && onSaveEdit(id, updates)}
                      onCancel={() => onEdit && onEdit(id)}
                      onDelete={() => onDelete && onDelete(id)}
                    />
                  </div>
                );
              }

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
                  <div className="tm-row-actions">
                    {onEdit && <button onClick={() => onEdit(id)}>edit</button>}
                    {onDelete && <button className="tm-del" onClick={() => onDelete(id)}>×</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel right="colored cells = auto-routed tasks">This week</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '58px repeat(5, 1fr)', gap: 4 }}>
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', alignSelf: 'end', paddingBottom: 6 }}>
              wheel
            </div>
            {dayLabels.map((d, i) => {
              const wheelId = dayAssignments[d.date] || '';
              const assignedWheel = wheels.find(w => w.id === wheelId) || null;
              const override = dayOverrides[d.date] || null;
              return (
                <div key={`wheel-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingBottom: 4 }}>
                  <select
                    className="tm-composer-select"
                    value={wheelId}
                    onChange={async (ev) => {
                      const next = ev.target.value;
                      if (!next) {
                        await api.days.unassign(d.date);
                      } else {
                        await api.wheels.applyToDate(next, d.date, { mode: 'replace' });
                      }
                    }}
                    title={`wheel for ${d.label}`}
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: '3px 6px',
                      borderColor: assignedWheel?.color || override?.color || 'var(--rule)',
                      color: assignedWheel?.color || override?.color || 'var(--ink)',
                    }}
                  >
                    <option value="">{wheels.length === 0 ? '(no wheels)' : '(none)'}</option>
                    {wheels.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="tm-mono tm-sm"
                    onClick={(ev) => openDayMenu(d.date, ev)}
                    style={{
                      fontSize: 10,
                      background: 'transparent',
                      border: '1px dashed var(--rule)',
                      borderRadius: 4,
                      padding: '1px 4px',
                      color: 'var(--ink-mute)',
                      cursor: 'pointer',
                    }}
                    title="override (sick, vacation, event...)"
                  >
                    {override ? override.label || override.type : 'override…'}
                  </button>
                </div>
              );
            })}
            <div />
            {dayLabels.map((d, i) => (
              <div key={i} className="tm-mono tm-md" style={{ textAlign: 'center', color: d.today ? 'var(--orange)' : 'var(--ink-mute)', paddingBottom: 4 }}>
                {d.label}{d.today ? ' · now' : ''}
              </div>
            ))}
            {rowLabels.map((row, ri) => (
              <React.Fragment key={ri}>
                <div className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center' }}>{row}</div>
                {dayLabels.map((dayInfo, ci) => {
                  const p = placed.find(x => x.row === ri && x.col === ci);
                  let bg = 'var(--paper)', bd = 'var(--rule)', fg = 'var(--ink)';
                  if (p) {
                    if (p.kind === 'now') { bg = 'var(--orange)'; bd = 'var(--orange)'; fg = 'var(--paper)'; }
                    else if (p.kind === 'routed') { bg = 'var(--orange-pale)'; bd = 'var(--orange)'; }
                    else if (p.kind === 'light') { bg = 'var(--sage-pale)'; bd = 'var(--sage)'; }
                    else { bg = 'var(--paper)'; bd = 'var(--ink-mute)'; }
                  }
                  const onCellClick = () => {
                    if (p && onEdit) {
                      onEdit(p.id);
                      return;
                    }
                    const rowKey = rowLabels[ri] || 'deep';
                    const [startTime, endTime] = ROW_DEFAULT_TIMES[rowKey] || ['09:00', '10:00'];
                    setCellDraft({
                      date: dayInfo.date,
                      startTime,
                      endTime,
                      slotType: rowKey,
                      label: '',
                    });
                    setSlotComposerOpen(false);
                  };
                  return (
                    <div
                      key={ci}
                      onClick={onCellClick}
                      title={p ? 'click to edit task' : `click to add a ${rowLabels[ri] || 'block'} on ${dayInfo.label}`}
                      style={{
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
                        cursor: 'pointer',
                      }}
                    >
                      {p ? p.label : <span style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>+ add</span>}
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

      <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px dashed var(--rule)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="tm-btn tm-primary tm-sm"
            onClick={() => {
              setCellDraft(null);
              setSlotComposerOpen(v => !v);
            }}
          >
            {slotComposerOpen ? 'close' : '+ time block'}
          </button>
          <button className="tm-btn tm-sm" onClick={() => onNavigate('wheel')}>day shape</button>
          <button className="tm-btn tm-sm" onClick={() => onNavigate('calendar')}>month / year</button>
          <button className="tm-btn tm-sm" onClick={() => onNavigate('gauge')}>back to today</button>
          {onOpenWheels && (
            <button className="tm-btn tm-sm" onClick={onOpenWheels} title="manage wheels">wheels</button>
          )}
          <span className="tm-mono tm-sm" style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }}>
            pick a wheel per day · click a cell to edit/add
          </span>
        </div>
        {(slotComposerOpen || cellDraft) && (
          <div style={{ marginTop: 10 }}>
            <SlotComposer
              initial={cellDraft || undefined}
              taskTypes={taskTypes}
              onSave={async (data) => {
                await api.slots.add(data);
                setSlotComposerOpen(false);
                setCellDraft(null);
              }}
              onCancel={() => { setSlotComposerOpen(false); setCellDraft(null); }}
            />
          </div>
        )}
      </div>

      {dayMenu && (
        <DayMenu
          menu={dayMenu}
          wheels={wheels}
          onClose={closeDayMenu}
          {...dayMenuHandlers}
          assignedWheelId={dayAssignments[dayMenu.date] || null}
          override={dayOverrides[dayMenu.date] || null}
        />
      )}
    </div>
  );
}

/**
 * Chronological, day-grouped list of every scheduled task in the horizon.
 * Reads like an itinerary — what's up today, what's up tomorrow, in order.
 * Replaces the old capacity/buffer readout (uninformative because auto-
 * schedule already guarantees fit).
 */
function Itinerary({ itinerary, rowHandlers = {} }) {
  const { onToggle, onDelete, onEdit } = rowHandlers;

  if (!itinerary.length) {
    return (
      <div className="tm-card tm-dashed" style={{ padding: '14px 16px' }}>
        <div className="tm-mono">no scheduled tasks yet — add one above and it will slot in.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itinerary.map(day => (
        <div key={day.date} className="tm-card tm-flush">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderBottom: '1px solid var(--rule-soft)',
              background: day.today ? 'var(--orange-pale)' : 'var(--paper-warm)',
            }}
          >
            <span className="tm-caveat" style={{ fontSize: 20, fontStyle: 'italic', color: day.today ? 'var(--orange)' : 'var(--ink)' }}>
              {day.label}{day.today ? ' · today' : ''}
            </span>
            <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
              {day.tasks.length} task{day.tasks.length === 1 ? '' : 's'}
            </span>
          </div>
          {day.tasks.map(t => {
            const id = t.id || t.key;
            const dur = typeof t.duration === 'number' ? t.duration : 30;
            const done = t.status === 'completed';
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--rule-soft)',
                  opacity: done ? 0.55 : 1,
                }}
              >
                <span className="tm-mono tm-sm" style={{ minWidth: 90, color: 'var(--ink-mute)' }}>
                  {fmtWindow(t.scheduledTime, dur)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, lineHeight: 1.15, textDecoration: done ? 'line-through' : 'none' }}>
                    {t.text || t.title || 'untitled'}
                  </div>
                  <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                    {t.primaryType || t.taskType || 'task'} · {dur}m
                    {t.metadata?.segmentsTotal > 1 ? ` · pt ${(t.metadata.segmentIndex ?? 0) + 1} of ${t.metadata.segmentsTotal}` : ''}
                  </div>
                </div>
                {onToggle && (
                  <button
                    className={`tm-btn tm-sm${done ? '' : ' tm-primary'}`}
                    onClick={() => onToggle(id)}
                  >
                    {done ? 'undo' : 'done'}
                  </button>
                )}
                {onEdit && (
                  <button className="tm-btn tm-sm" onClick={() => onEdit(id)}>edit</button>
                )}
                {onDelete && (
                  <button className="tm-btn tm-sm tm-danger" onClick={() => onDelete(id)}>×</button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function fmtWindow(iso, durMin) {
  if (!iso) return '—';
  const start = new Date(iso);
  const end = new Date(start.getTime() + durMin * 60 * 1000);
  const fmt = (d) => {
    const h = d.getHours();
    const hr = ((h % 12) || 12);
    const ampm = h < 12 ? 'a' : 'p';
    const m = d.getMinutes();
    return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}
