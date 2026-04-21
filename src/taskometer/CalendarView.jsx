import React, { useMemo, useState } from 'react';
import { OVERRIDE_TYPES } from '../services/api/TaskometerAPI';

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayYMD() { return ymd(new Date()); }

function startOfMonth(y, m) { return new Date(y, m, 1); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

export default function CalendarView({
  wheels = [],
  slots = [],
  dayAssignments = {},
  dayOverrides = {},
  api,
  onNavigate,
}) {
  const today = new Date();
  const [anchor, setAnchor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [scope, setScope] = useState('month'); // 'month' | 'quarter' | 'year'
  const [dayMenu, setDayMenu] = useState(null); // {date, x, y}
  const [paintWheel, setPaintWheel] = useState(null); // wheelId for drag-paint
  const [isPainting, setIsPainting] = useState(false);

  const slotsByDate = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!s?.date) continue;
      map[s.date] = (map[s.date] || 0) + 1;
    }
    return map;
  }, [slots]);

  const shift = (delta) => {
    let { year, month } = anchor;
    const units = scope === 'year' ? 12 : scope === 'quarter' ? 3 : 1;
    const total = month + delta * units;
    year += Math.floor(total / 12);
    month = ((total % 12) + 12) % 12;
    setAnchor({ year, month });
  };

  const monthsToRender = scope === 'year'
    ? Array.from({ length: 12 }, (_, i) => ({ year: anchor.year, month: i }))
    : scope === 'quarter'
      ? Array.from({ length: 3 }, (_, i) => {
          const t = anchor.month + i;
          return { year: anchor.year + Math.floor(t / 12), month: ((t % 12) + 12) % 12 };
        })
      : [{ year: anchor.year, month: anchor.month }];

  const title = scope === 'year'
    ? `${anchor.year}`
    : scope === 'quarter'
      ? `Q starting ${monthName(anchor.month)} ${anchor.year}`
      : `${monthName(anchor.month)} ${anchor.year}`;

  const onDayClick = (dateKey, ev) => {
    if (isPainting) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    setDayMenu({
      date: dateKey,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 4,
    });
  };

  const closeDayMenu = () => setDayMenu(null);

  const handleAssign = async (wheelId) => {
    if (!dayMenu) return;
    await api.wheels.applyToDate(wheelId, dayMenu.date, { mode: 'replace' });
    closeDayMenu();
  };

  const handleClearAssignment = async () => {
    if (!dayMenu) return;
    await api.days.unassign(dayMenu.date);
    closeDayMenu();
  };

  const handleOverride = async (type) => {
    if (!dayMenu) return;
    const preset = OVERRIDE_TYPES.find(o => o.id === type);
    const shouldClear = preset?.clearsSlots;
    let note = null;
    if (type === 'event' || type === 'custom') {
      note = window.prompt(`label for ${preset?.label || type}:`, preset?.label || '') || null;
    }
    await api.days.setOverride(dayMenu.date, {
      type,
      label: note || preset?.label || type,
      color: preset?.color,
      clearSlots: shouldClear,
    });
    closeDayMenu();
  };

  const handleClearOverride = async () => {
    if (!dayMenu) return;
    await api.days.clearOverride(dayMenu.date);
    closeDayMenu();
  };

  // Drag-paint: hold a wheel, hover over days to assign
  const onDayPointerDown = async (dateKey, ev) => {
    if (ev.button !== 0) return;
    if (!paintWheel) return;
    setIsPainting(true);
    await api.wheels.applyToDate(paintWheel, dateKey, { mode: 'replace' });
  };
  const onDayPointerEnter = async (dateKey) => {
    if (!isPainting || !paintWheel) return;
    await api.wheels.applyToDate(paintWheel, dateKey, { mode: 'replace' });
  };

  // Global pointer up clears painting
  React.useEffect(() => {
    const up = () => setIsPainting(false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const todayKey = todayYMD();

  return (
    <div className="tm-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="tm-btn tm-sm" onClick={() => shift(-1)} aria-label="previous">‹</button>
        <span className="tm-caveat" style={{ fontSize: 26 }}>{title}</span>
        <button className="tm-btn tm-sm" onClick={() => shift(1)} aria-label="next">›</button>
        <button
          className="tm-btn tm-sm"
          onClick={() => setAnchor({ year: today.getFullYear(), month: today.getMonth() })}
        >today</button>
        <div className="tm-seg" style={{ marginLeft: 10 }}>
          {['month', 'quarter', 'year'].map(s => (
            <button
              key={s}
              className={scope === s ? 'tm-on' : ''}
              onClick={() => setScope(s)}
            >{s}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            paint with:
          </span>
          <select
            className="tm-composer-select"
            value={paintWheel || ''}
            onChange={(e) => setPaintWheel(e.target.value || null)}
            title="pick a wheel, then drag across days to paint"
          >
            <option value="">(off)</option>
            {wheels.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: scope === 'year' ? 'repeat(4, 1fr)' : scope === 'quarter' ? 'repeat(3, 1fr)' : '1fr',
          gap: 16,
        }}
      >
        {monthsToRender.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            todayKey={todayKey}
            wheels={wheels}
            dayAssignments={dayAssignments}
            dayOverrides={dayOverrides}
            slotsByDate={slotsByDate}
            scope={scope}
            onDayClick={onDayClick}
            onDayPointerDown={onDayPointerDown}
            onDayPointerEnter={onDayPointerEnter}
          />
        ))}
      </div>

      <div className="tm-mono tm-sm" style={{ marginTop: 10, color: 'var(--ink-mute)' }}>
        click a day for actions · set "paint with" to a wheel, then drag across days to bulk-paint
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('wheel')}>back to wheel</button>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('fit')}>week view</button>
      </div>

      {dayMenu && (
        <DayMenu
          menu={dayMenu}
          wheels={wheels}
          onClose={closeDayMenu}
          onAssign={handleAssign}
          onClearAssignment={handleClearAssignment}
          onOverride={handleOverride}
          onClearOverride={handleClearOverride}
          assignedWheelId={dayAssignments[dayMenu.date] || null}
          override={dayOverrides[dayMenu.date] || null}
        />
      )}
    </div>
  );
}

function MonthGrid({
  year, month, todayKey, wheels, dayAssignments, dayOverrides, slotsByDate,
  scope, onDayClick, onDayPointerDown, onDayPointerEnter,
}) {
  const first = startOfMonth(year, month);
  const numDays = daysInMonth(year, month);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const cellSize = scope === 'year' ? 'mini' : 'full';
  const weekdayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`b${i}`} className="tm-cal-cell tm-cal-empty" />);
  }
  for (let d = 1; d <= numDays; d++) {
    const dateKey = `${year}-${pad(month + 1)}-${pad(d)}`;
    const assignedId = dayAssignments[dateKey];
    const wheel = wheels.find(w => w.id === assignedId) || null;
    const override = dayOverrides[dateKey] || null;
    const slotCount = slotsByDate[dateKey] || 0;
    const isToday = dateKey === todayKey;
    const bg = override
      ? override.color
      : wheel
        ? wheel.color
        : null;

    cells.push(
      <div
        key={dateKey}
        className={`tm-cal-cell tm-cal-${cellSize}${isToday ? ' tm-cal-today' : ''}`}
        onClick={(ev) => onDayClick(dateKey, ev)}
        onPointerDown={(ev) => onDayPointerDown(dateKey, ev)}
        onPointerEnter={() => onDayPointerEnter(dateKey)}
        style={{
          background: bg ? hexA(bg, 0.22) : 'var(--paper)',
          borderColor: bg || 'var(--rule)',
        }}
        title={`${dateKey}${wheel ? ' · ' + wheel.name : ''}${override ? ' · ' + (override.label || override.type) : ''}`}
      >
        <div className="tm-cal-day-num">{d}</div>
        {cellSize === 'full' && (
          <div className="tm-cal-day-body">
            {wheel && (
              <div className="tm-mono tm-sm tm-cal-tag" style={{ color: wheel.color }}>
                {wheel.name}
              </div>
            )}
            {override && (
              <div className="tm-mono tm-sm tm-cal-tag" style={{ color: override.color, fontWeight: 600 }}>
                {override.label || override.type}
              </div>
            )}
            {!wheel && !override && slotCount > 0 && (
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                {slotCount} block{slotCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
        {cellSize === 'mini' && (wheel || override) && (
          <div
            className="tm-cal-mini-dot"
            style={{ background: (override || wheel).color || 'var(--ink-mute)' }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="tm-cal-month">
      <div className="tm-caveat" style={{ fontSize: 18, marginBottom: 4, color: 'var(--ink-soft)' }}>
        {monthName(month)} {year}
      </div>
      <div className="tm-cal-grid">
        {weekdayHeaders.map((w, i) => (
          <div key={i} className="tm-cal-wk tm-mono tm-sm">{w}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}

function DayMenu({
  menu, wheels, onClose, onAssign, onClearAssignment, onOverride, onClearOverride,
  assignedWheelId, override,
}) {
  // Close on outside click / escape
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const maxLeft = window.innerWidth - 280;
  const left = Math.min(menu.x, Math.max(8, maxLeft));
  const top = menu.y;

  return (
    <div
      className="tm-popover-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-label="day actions"
    >
      <div
        className="tm-popover"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left, top }}
      >
        <div className="tm-mono tm-md" style={{ fontWeight: 600, marginBottom: 6 }}>{menu.date}</div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>assign wheel</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {wheels.length === 0 && (
            <span className="tm-mono tm-sm">no wheels yet — create one from the wheel tab</span>
          )}
          {wheels.map(w => (
            <button
              key={w.id}
              className={`tm-btn tm-sm${assignedWheelId === w.id ? ' tm-primary' : ''}`}
              onClick={() => onAssign(w.id)}
              style={assignedWheelId !== w.id ? { borderColor: w.color, color: w.color } : undefined}
            >
              {w.name}
            </button>
          ))}
          {assignedWheelId && (
            <button className="tm-btn tm-sm tm-ghost" onClick={onClearAssignment}>clear</button>
          )}
        </div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>override</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {OVERRIDE_TYPES.map(o => (
            <button
              key={o.id}
              className={`tm-btn tm-sm${override?.type === o.id ? ' tm-primary' : ''}`}
              onClick={() => onOverride(o.id)}
              style={override?.type !== o.id ? { borderColor: o.color, color: o.color } : undefined}
              title={o.clearsSlots ? 'clears that day\'s slots' : ''}
            >
              {o.label.toLowerCase()}
            </button>
          ))}
          {override && (
            <button className="tm-btn tm-sm tm-ghost" onClick={onClearOverride}>clear</button>
          )}
        </div>
      </div>
    </div>
  );
}

function monthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m];
}

function hexA(hex, a) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
