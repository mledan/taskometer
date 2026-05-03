import React, { useMemo, useState } from 'react';
import DayMenu, { buildDayMenuHandlers } from './DayMenu.jsx';
import { MiniWheel } from './WheelView.jsx';

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayYMD() { return ymd(new Date()); }

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

// Six-row (42-cell) grid including leading/trailing days from adjacent months.
// Gives every month the same footprint so the quarter/year layouts don't jitter
// between 5- and 6-row months.
function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon=0
  const numDays = daysInMonth(year, month);

  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const prevDays = daysInMonth(prev.year, prev.month);

  const out = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevDays - i;
    out.push({ year: prev.year, month: prev.month, day: d, outside: true });
  }
  for (let d = 1; d <= numDays; d++) {
    out.push({ year, month, day: d, outside: false });
  }
  let tail = 1;
  while (out.length < 42) {
    out.push({ year: next.year, month: next.month, day: tail++, outside: true });
  }
  return out;
}

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
    if (scopeControlled) return;
    setInternalScope(s);
  };
  const [dayMenu, setDayMenu] = useState(null); // {date, x, y}
  const [paintWheel, setPaintWheel] = useState(null);
  const [isPainting, setIsPainting] = useState(false);

  const slotsByDate = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!s?.date) continue;
      map[s.date] = (map[s.date] || 0) + 1;
    }
    return map;
  }, [slots]);

  const wheelsById = useMemo(() => {
    const m = {};
    for (const w of wheels) m[w.id] = w;
    return m;
  }, [wheels]);

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
      ? `${monthName(anchor.month)} → ${monthName(((anchor.month + 2) % 12))} ${anchor.year}`
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

  React.useEffect(() => {
    const up = () => {
      setIsPainting(false);
      paintConfirmedRef.current = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const todayKey = todayYMD();

  // A density mode per scope — the cell layout and sizing differ substantially
  // between full month, condensed quarter, and year-heatmap.
  const density = scope === 'year' ? 'mini' : scope === 'quarter' ? 'compact' : 'full';
  const gridCols = scope === 'year' ? 'repeat(4, 1fr)' : scope === 'quarter' ? 'repeat(3, 1fr)' : '1fr';

  // Peak slot count across all rendered months — used to normalize the
  // heatmap intensity so a quiet stretch doesn't look empty and a busy one
  // doesn't clip at full saturation.
  const peakSlotCount = useMemo(() => {
    let peak = 1;
    for (const k in slotsByDate) {
      if (slotsByDate[k] > peak) peak = slotsByDate[k];
    }
    return peak;
  }, [slotsByDate]);

  return (
    <div className="tm-fade-up tm-cal-root">
      <div className="tm-cal-toolbar">
        <div className="tm-cal-nav">
          <button className="tm-btn tm-sm" onClick={() => shift(-1)} aria-label="previous">‹</button>
          <span className="tm-caveat tm-cal-title">{title}</span>
          <button className="tm-btn tm-sm" onClick={() => shift(1)} aria-label="next">›</button>
          <button
            className="tm-btn tm-sm tm-cal-today-btn"
            onClick={() => setAnchor({ year: today.getFullYear(), month: today.getMonth() })}
          >today</button>
        </div>
        {!scopeControlled && (
          <div className="tm-seg tm-cal-scope">
            {['month', 'quarter', 'year'].map(s => (
              <button
                key={s}
                className={scope === s ? 'tm-on' : ''}
                onClick={() => setScope(s)}
              >{s}</button>
            ))}
          </div>
        )}
        <div className="tm-cal-paint">
          <span className="tm-mono tm-sm tm-cal-paint-label">paint with</span>
          <select
            className="tm-composer-select"
            value={paintWheel || ''}
            onChange={(e) => setPaintWheel(e.target.value || null)}
            title="pick a schedule, then drag across days to paint"
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
                title="layer the schedule on top of existing blocks"
              >merge</button>
            </div>
          )}
        </div>
      </div>

      <div className={`tm-cal-deck tm-cal-deck-${density}`} style={{ gridTemplateColumns: gridCols }}>
        {monthsToRender.map(({ year, month }) => (
          <MonthCard
            key={`${year}-${month}`}
            year={year}
            month={month}
            density={density}
            todayKey={todayKey}
            wheels={wheels}
            wheelsById={wheelsById}
            dayAssignments={dayAssignments}
            dayOverrides={dayOverrides}
            resolveDay={resolveDay}
            slots={slots}
            slotsByDate={slotsByDate}
            peakSlotCount={peakSlotCount}
            onDayClick={onDayClick}
            onDayPointerDown={onDayPointerDown}
            onDayPointerEnter={onDayPointerEnter}
            onJumpToMonth={scopeControlled ? null : (y, m) => {
              setAnchor({ year: y, month: m });
              setScope('month');
            }}
          />
        ))}
      </div>

      <div className="tm-cal-legend tm-mono tm-sm">
        <span>click a day for actions</span>
        <span className="tm-cal-legend-sep">·</span>
        <span>set "paint with" then drag to bulk-paint</span>
        <span className="tm-cal-legend-sep">·</span>
        <span className="tm-cal-legend-key">
          <span className="tm-cal-legend-swatch tm-cal-legend-pin" /> pinned
        </span>
        <span className="tm-cal-legend-key">
          <span className="tm-cal-legend-swatch tm-cal-legend-rule" /> from rule
        </span>
        <span className="tm-cal-legend-key">
          <span className="tm-cal-legend-swatch tm-cal-legend-today" /> today
        </span>
      </div>

      <div className="tm-cal-actions">
        <button className="tm-btn tm-sm" onClick={() => onNavigate('wheel')}>back to day</button>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('fit')}>week view</button>
        {onOpenWheels && (
          <button className="tm-btn tm-sm" onClick={onOpenWheels} title="manage schedules">schedules</button>
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

function MonthCard({
  year, month, density, todayKey,
  wheels, wheelsById,
  dayAssignments, dayOverrides, resolveDay,
  slots = [], slotsByDate, peakSlotCount,
  onDayClick, onDayPointerDown, onDayPointerEnter,
  onJumpToMonth,
}) {
  const cells = buildMonthCells(year, month);
  const weekdayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const isCurrentRealMonth = (() => {
    const n = new Date();
    return n.getFullYear() === year && n.getMonth() === month;
  })();

  // Summary: blocks this month (from slots) + painted days + dominant wheel.
  const stats = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}-`;
    let blocks = 0;
    let paintedDays = 0;
    const wheelTally = {};
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const key = `${prefix}${pad(d)}`;
      if (slotsByDate[key]) blocks += slotsByDate[key];
      const eff = resolveDay ? resolveDay(key) : {
        wheelId: dayAssignments[key] || null,
        override: dayOverrides[key] || null,
        source: (dayAssignments[key] || dayOverrides[key]) ? 'pin' : 'none',
      };
      if (eff.wheelId || eff.override) {
        if (eff.source === 'pin') paintedDays += 1;
        if (eff.wheelId) wheelTally[eff.wheelId] = (wheelTally[eff.wheelId] || 0) + 1;
      }
    }
    let dominantWheelId = null;
    let dominantCount = 0;
    for (const id in wheelTally) {
      if (wheelTally[id] > dominantCount) {
        dominantCount = wheelTally[id];
        dominantWheelId = id;
      }
    }
    return { blocks, paintedDays, dominantWheelId };
  }, [year, month, slotsByDate, dayAssignments, dayOverrides, resolveDay]);

  const dominantWheel = stats.dominantWheelId ? wheelsById[stats.dominantWheelId] : null;

  return (
    <div className={`tm-cal-card tm-cal-card-${density}${isCurrentRealMonth ? ' tm-cal-card-current' : ''}`}>
      <header className="tm-cal-card-header">
        {onJumpToMonth ? (
          <button
            type="button"
            className="tm-cal-card-title tm-caveat"
            onClick={() => onJumpToMonth(year, month)}
            title="open this month"
          >
            {monthName(month)}{density !== 'full' ? '' : ` ${year}`}
          </button>
        ) : (
          <span className="tm-cal-card-title tm-caveat">
            {monthName(month)}{density !== 'full' ? '' : ` ${year}`}
          </span>
        )}
        <div className="tm-cal-card-stats tm-mono tm-sm">
          {stats.blocks > 0 && (
            <span title="scheduled blocks this month">{stats.blocks} blk</span>
          )}
          {stats.paintedDays > 0 && (
            <span title="days pinned to a schedule">{stats.paintedDays} pin</span>
          )}
          {dominantWheel && (
            <span
              className="tm-cal-card-dot"
              style={{ background: dominantWheel.color }}
              title={`most-used schedule: ${dominantWheel.name}`}
            />
          )}
        </div>
      </header>

      <div className="tm-cal-weekdays">
        {weekdayHeaders.map((w, i) => (
          <div key={i} className={`tm-cal-weekday tm-mono${i >= 5 ? ' tm-cal-weekend' : ''}`}>{w}</div>
        ))}
      </div>

      <div className="tm-cal-grid">
        {cells.map((c, idx) => {
          const dateKey = `${c.year}-${pad(c.month + 1)}-${pad(c.day)}`;
          const isWeekend = (idx % 7) >= 5;
          const isToday = dateKey === todayKey;
          const pinnedWheelId = dayAssignments[dateKey];
          const pinnedOverride = dayOverrides[dateKey] || null;
          const eff = resolveDay ? resolveDay(dateKey) : {
            wheelId: pinnedWheelId || null,
            override: pinnedOverride,
            source: pinnedOverride || pinnedWheelId ? 'pin' : 'none',
          };
          const wheel = eff.wheelId ? wheelsById[eff.wheelId] : null;
          const override = eff.override;
          const fromRule = eff.source === 'rule';
          const slotCount = slotsByDate[dateKey] || 0;
          const color = override ? override.color : wheel ? wheel.color : null;

          return (
            <DayCell
              key={`${idx}-${dateKey}`}
              dateKey={dateKey}
              day={c.day}
              outside={c.outside}
              density={density}
              isWeekend={isWeekend}
              isToday={isToday}
              color={color}
              wheel={wheel}
              override={override}
              fromRule={fromRule}
              slotCount={slotCount}
              peakSlotCount={peakSlotCount}
              slots={slots}
              onDayClick={onDayClick}
              onDayPointerDown={onDayPointerDown}
              onDayPointerEnter={onDayPointerEnter}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  dateKey, day, outside, density, isWeekend, isToday,
  color, wheel, override, fromRule, slotCount, peakSlotCount,
  slots, onDayClick, onDayPointerDown, onDayPointerEnter,
}) {
  const label = override ? (override.label || override.type) : wheel ? wheel.name : null;
  const title = `${dateKey}${wheel ? ' · ' + wheel.name : ''}${override ? ' · ' + (override.label || override.type) : ''}${fromRule ? ' · from rule' : ''}${slotCount ? ` · ${slotCount} block${slotCount === 1 ? '' : 's'}` : ''}`;

  // Heatmap wash opacity. In mini (year) we also scale by slot-count to get a
  // real heatmap feel; elsewhere opacity purely distinguishes pin vs rule.
  let washOpacity = 0;
  if (color) {
    if (density === 'mini') {
      const base = fromRule ? 0.10 : 0.22;
      const bonus = slotCount > 0 ? Math.min(0.28, (slotCount / Math.max(peakSlotCount, 1)) * 0.28) : 0;
      washOpacity = base + bonus;
    } else {
      washOpacity = fromRule ? 0.12 : 0.22;
    }
  } else if (density === 'mini' && slotCount > 0) {
    // Unpainted busy day still shows faint ink wash so year-view scanning works
    washOpacity = Math.min(0.18, (slotCount / Math.max(peakSlotCount, 1)) * 0.18);
  }

  const background = color ? hexA(color, washOpacity) : (density === 'mini' && slotCount > 0 ? hexA('#1C1A16', washOpacity) : 'var(--paper)');
  const accentColor = color || null;
  const accentClass = accentColor ? (fromRule ? 'tm-cal-accent-rule' : 'tm-cal-accent-pin') : '';

  const classNames = [
    'tm-cal-cell',
    `tm-cal-cell-${density}`,
    outside ? 'tm-cal-cell-outside' : '',
    isWeekend ? 'tm-cal-cell-weekend' : '',
    isToday ? 'tm-cal-cell-today' : '',
    accentClass,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      style={{ background }}
      onClick={(ev) => onDayClick(dateKey, ev)}
      onPointerDown={(ev) => onDayPointerDown(dateKey, ev)}
      onPointerEnter={() => onDayPointerEnter(dateKey)}
      title={title}
    >
      {accentColor && (
        <span
          className="tm-cal-cell-accent"
          style={{ '--tm-accent': accentColor }}
          aria-hidden
        />
      )}

      <span className={`tm-cal-day-num${isToday ? ' tm-cal-day-num-today' : ''}`}>{day}</span>

      {density === 'full' && (
        <div className="tm-cal-cell-body">
          <MiniWheel
            slots={(slots || []).filter(s => s.date === dateKey)}
            size={48}
            thickness={6}
            highlight={isToday}
          />
          {label && (
            <div
              className="tm-cal-cell-tag tm-mono"
              style={{
                color: (override && override.color) || (wheel && wheel.color) || 'var(--ink-mute)',
                fontStyle: fromRule ? 'italic' : 'normal',
              }}
            >
              {label}{fromRule ? ' ·rule' : ''}
            </div>
          )}
          {!label && slotCount > 0 && (
            <div className="tm-cal-cell-tag tm-mono" style={{ color: 'var(--ink-mute)' }}>
              {slotCount} block{slotCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {density === 'compact' && (
        <div className="tm-cal-cell-body">
          <MiniWheel
            slots={(slots || []).filter(s => s.date === dateKey)}
            size={26}
            thickness={4}
            highlight={isToday}
          />
        </div>
      )}

      {density === 'mini' && slotCount > 0 && (
        <span className="tm-cal-slot-dot" style={{ background: color || 'var(--ink)' }} aria-hidden />
      )}
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
