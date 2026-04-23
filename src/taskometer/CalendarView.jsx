import React, { useMemo, useState } from 'react';
import DayMenu, { buildDayMenuHandlers } from './DayMenu.jsx';
import { MiniWheel } from './WheelView.jsx';

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
  resolveDay,
  api,
  onNavigate,
  onOpenWheels,
  onOpenRules,
  scope: controlledScope,
}) {
  const today = new Date();
  const [anchor, setAnchor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [internalScope, setInternalScope] = useState('month'); // 'month' | 'quarter' | 'year'
  const scope = controlledScope || internalScope;
  const scopeControlled = !!controlledScope;
  const setScope = (s) => {
    if (scopeControlled) return; // parent owns scope
    setInternalScope(s);
  };
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

  const dayMenuHandlers = buildDayMenuHandlers({ api, menu: dayMenu, close: closeDayMenu });

  // Drag-paint: hold a wheel, hover over days to assign. When the starting
  // cell already has slots (or an override), confirm once before we nuke it —
  // then the drag can continue freely for the rest of the gesture.
  const [paintMode, setPaintMode] = useState('replace'); // 'replace' | 'merge'
  const paintConfirmedRef = React.useRef(false);
  const onDayPointerDown = async (dateKey, ev) => {
    if (ev.button !== 0) return;
    if (!paintWheel) return;

    if (paintMode === 'replace' && !paintConfirmedRef.current) {
      const existing = (slots || []).filter(s => s.date === dateKey).length;
      if (existing > 0) {
        const ok = window.confirm(
          `replace ${existing} existing block${existing === 1 ? '' : 's'} on ${dateKey}? this also applies to every day you drag across.`
        );
        if (!ok) return;
      }
      paintConfirmedRef.current = true;
    }

    setIsPainting(true);
    await api.wheels.applyToDate(paintWheel, dateKey, { mode: paintMode });
  };
  const onDayPointerEnter = async (dateKey) => {
    if (!isPainting || !paintWheel) return;
    await api.wheels.applyToDate(paintWheel, dateKey, { mode: paintMode });
  };

  // Global pointer up clears painting and resets the "I've confirmed"
  // latch so the next drag gets its own confirmation prompt.
  React.useEffect(() => {
    const up = () => {
      setIsPainting(false);
      paintConfirmedRef.current = false;
    };
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
        {!scopeControlled && (
          <div className="tm-seg" style={{ marginLeft: 10 }}>
            {['month', 'quarter', 'year'].map(s => (
              <button
                key={s}
                className={scope === s ? 'tm-on' : ''}
                onClick={() => setScope(s)}
              >{s}</button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
          {paintWheel && (
            <div className="tm-seg">
              <button
                className={paintMode === 'replace' ? 'tm-on' : ''}
                onClick={() => setPaintMode('replace')}
                title="clear existing blocks then paint (asks once per drag)"
              >replace</button>
              <button
                className={paintMode === 'merge' ? 'tm-on' : ''}
                onClick={() => setPaintMode('merge')}
                title="layer the wheel on top of existing blocks"
              >merge</button>
            </div>
          )}
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
            resolveDay={resolveDay}
            slots={slots}
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
        <span style={{ marginLeft: 8 }}>
          · <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid var(--ink-mute)', borderRadius: 2, verticalAlign: 'middle' }} /> pinned ·
          <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px dashed var(--ink-mute)', borderRadius: 2, verticalAlign: 'middle', marginLeft: 4 }} /> from a rule
        </span>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('wheel')}>back to wheel</button>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('fit')}>week view</button>
        {onOpenWheels && (
          <button className="tm-btn tm-sm" onClick={onOpenWheels} title="manage wheels">wheels</button>
        )}
        {onOpenRules && (
          <button className="tm-btn tm-sm" onClick={onOpenRules} title="rules for weekdays, weekends, vacation, holidays">rules</button>
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

function MonthGrid({
  year, month, todayKey, wheels, dayAssignments, dayOverrides, resolveDay, slots = [], slotsByDate,
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
    const pinnedWheelId = dayAssignments[dateKey];
    const pinnedOverride = dayOverrides[dateKey] || null;
    const effective = resolveDay ? resolveDay(dateKey) : {
      wheelId: pinnedWheelId || null,
      override: pinnedOverride,
      source: pinnedOverride || pinnedWheelId ? 'pin' : 'none',
    };
    const wheel = wheels.find(w => w.id === effective.wheelId) || null;
    const override = effective.override;
    const fromRule = effective.source === 'rule';
    const slotCount = slotsByDate[dateKey] || 0;
    const isToday = dateKey === todayKey;
    const bg = override ? override.color : wheel ? wheel.color : null;

    cells.push(
      <div
        key={dateKey}
        className={`tm-cal-cell tm-cal-${cellSize}${isToday ? ' tm-cal-today' : ''}${fromRule ? ' tm-cal-ruled' : ''}`}
        onClick={(ev) => onDayClick(dateKey, ev)}
        onPointerDown={(ev) => onDayPointerDown(dateKey, ev)}
        onPointerEnter={() => onDayPointerEnter(dateKey)}
        style={{
          background: bg ? hexA(bg, fromRule ? 0.12 : 0.22) : 'var(--paper)',
          borderColor: bg || 'var(--rule)',
          borderStyle: fromRule ? 'dashed' : 'solid',
        }}
        title={`${dateKey}${wheel ? ' · ' + wheel.name : ''}${override ? ' · ' + (override.label || override.type) : ''}${fromRule ? ' · from rule' : ''}`}
      >
        <div className="tm-cal-day-num">{d}</div>
        {cellSize === 'full' && (
          <div
            className="tm-cal-day-body"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
          >
            <MiniWheel
              slots={(slots || []).filter(s => s.date === dateKey)}
              size={48}
              thickness={6}
              highlight={isToday}
            />
            {wheel && (
              <div
                className="tm-mono tm-sm tm-cal-tag"
                style={{
                  color: wheel.color,
                  fontStyle: fromRule ? 'italic' : 'normal',
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                {wheel.name}{fromRule ? ' ·rule' : ''}
              </div>
            )}
            {override && (
              <div
                className="tm-mono tm-sm tm-cal-tag"
                style={{
                  color: override.color,
                  fontWeight: 600,
                  fontStyle: fromRule ? 'italic' : 'normal',
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                {override.label || override.type}{fromRule ? ' ·rule' : ''}
              </div>
            )}
            {!wheel && !override && slotCount > 0 && (
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                {slotCount} block{slotCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
        {cellSize === 'mini' && (
          <MiniWheel
            slots={(slots || []).filter(s => s.date === dateKey)}
            size={28}
            thickness={4}
            highlight={isToday}
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
