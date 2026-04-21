import React, { useState } from 'react';
import { OVERRIDE_TYPES } from '../services/api/TaskometerAPI';

/**
 * Rules panel — the user's durable schedule-shaping surface. Rules live
 * above point-in-time pins (dayAssignment, dayOverride) and drive the
 * defaults for "every weekday", "every Saturday", "March 1–10", "every
 * Christmas", without having to repaint the calendar by hand.
 *
 * Four preset categories cover the common cases and each renders a tiny
 * inline composer:
 *   · weekday / weekend default wheel
 *   · specific days-of-week wheel (e.g. "thursdays = deep work")
 *   · date-range override (vacation, off-site, sabbatical)
 *   · yearly recurring holiday (monthDay + month predicate)
 *
 * Anything more exotic can be composed by hand via the raw rule shape,
 * but the presets handle 95% of user scenarios.
 */
export default function RulesPanel({ api, wheels = [], rules = [], onClose }) {
  const [draftKind, setDraftKind] = useState(null);

  const addDraft = async (rule) => {
    await api.rules.add(rule);
    setDraftKind(null);
  };

  const materializeRange = async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const res = await api.rules.materialize(start, end);
    window.alert?.(`painted ${res.touched} day${res.touched === 1 ? '' : 's'} from rules`);
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="schedule rules"
        style={{ maxWidth: 720 }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">schedule rules</div>
          <button type="button" onClick={onClose} className="tm-btn tm-sm">close</button>
        </div>

        <div className="tm-mono tm-md" style={{ marginBottom: 10 }}>
          rules describe "what does this kind of day look like" so you don't have to repaint the calendar every week.
          manual edits always win — rules only fill days you haven't touched.
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="tm-btn tm-primary tm-sm" onClick={() => setDraftKind('dow')}>
            + weekday / weekend default
          </button>
          <button className="tm-btn tm-sm" onClick={() => setDraftKind('days')}>
            + days-of-week wheel
          </button>
          <button className="tm-btn tm-sm" onClick={() => setDraftKind('dateWheel')}>
            + specific date wheel
          </button>
          <button className="tm-btn tm-sm" onClick={() => setDraftKind('rangeWheel')}>
            + date range wheel
          </button>
          <button className="tm-btn tm-sm" onClick={() => setDraftKind('range')}>
            + date range override (vacation, event)
          </button>
          <button className="tm-btn tm-sm" onClick={() => setDraftKind('yearly')}>
            + yearly (holiday)
          </button>
          <button className="tm-btn tm-ghost tm-sm" onClick={materializeRange}>
            paint next 30 days from rules
          </button>
        </div>

        {draftKind === 'dow' && (
          <DowDefaultDraft wheels={wheels} onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}
        {draftKind === 'days' && (
          <DaysOfWeekDraft wheels={wheels} onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}
        {draftKind === 'dateWheel' && (
          <DateWheelDraft wheels={wheels} onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}
        {draftKind === 'rangeWheel' && (
          <RangeWheelDraft wheels={wheels} onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}
        {draftKind === 'range' && (
          <RangeOverrideDraft onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}
        {draftKind === 'yearly' && (
          <YearlyOverrideDraft onAdd={addDraft} onCancel={() => setDraftKind(null)} />
        )}

        <div className="tm-type-list" style={{ marginTop: 12 }}>
          {rules.length === 0 && !draftKind && (
            <div className="tm-card tm-dashed" style={{ padding: '14px 16px' }}>
              <div className="tm-mono">no rules yet — the buttons above walk you through the common ones.</div>
            </div>
          )}
          {rules.map(r => (
            <RuleRow
              key={r.id}
              rule={r}
              wheels={wheels}
              onToggle={(on) => api.rules.toggle(r.id, on)}
              onRemove={() => {
                if (window.confirm(`remove rule "${r.name}"?`)) api.rules.remove(r.id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleRow({ rule, wheels, onToggle, onRemove }) {
  const wheelName = wheels.find(w => w.id === rule.action?.applyWheel)?.name;
  const override = rule.action?.override;
  return (
    <div className="tm-type-row" style={{ opacity: rule.enabled === false ? 0.55 : 1 }}>
      <span className="tm-type-name">{rule.name}</span>
      <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
        {describeWhen(rule.when)}
        {' → '}
        {wheelName ? `wheel: ${wheelName}` : override ? `override: ${override.type}` : 'noop'}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button className="tm-btn tm-sm" onClick={() => onToggle(rule.enabled === false)}>
          {rule.enabled === false ? 'enable' : 'disable'}
        </button>
        <button className="tm-btn tm-sm tm-danger" onClick={onRemove}>remove</button>
      </div>
    </div>
  );
}

function describeWhen(when = {}) {
  const parts = [];
  if (Array.isArray(when.dow) && when.dow.length) {
    const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    parts.push(when.dow.map(i => names[i]).join('/'));
  }
  if (when.date) parts.push(`on ${when.date}`);
  if (Array.isArray(when.range)) parts.push(`${when.range[0]} → ${when.range[1]}`);
  if (Array.isArray(when.monthDay) && Array.isArray(when.month)) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    parts.push(`${when.month.map(m => months[m - 1]).join('/')} ${when.monthDay.join('/')}`);
  } else if (Array.isArray(when.monthDay)) {
    parts.push(`day ${when.monthDay.join('/')}`);
  } else if (Array.isArray(when.month)) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    parts.push(when.month.map(m => months[m - 1]).join('/'));
  }
  return parts.length ? parts.join(' · ') : 'always';
}

function DraftFrame({ title, children, onSave, onCancel, canSave = true }) {
  return (
    <div className="tm-card tm-dashed" style={{ padding: '10px 12px', marginBottom: 10 }}>
      <div className="tm-mono tm-md" style={{ marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="tm-btn tm-primary tm-sm" onClick={onSave} disabled={!canSave}>save rule</button>
        <button className="tm-btn tm-sm" onClick={onCancel}>cancel</button>
      </div>
    </div>
  );
}

function WheelSelect({ value, onChange, wheels }) {
  return (
    <select
      className="tm-composer-select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">(pick a wheel)</option>
      {wheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );
}

function DowDefaultDraft({ wheels, onAdd, onCancel }) {
  const [scope, setScope] = useState('weekday'); // weekday | weekend
  const [wheelId, setWheelId] = useState(null);
  const save = () => {
    if (!wheelId) return;
    const dow = scope === 'weekday' ? [1, 2, 3, 4, 5] : [0, 6];
    onAdd({
      name: scope === 'weekday' ? 'weekday default' : 'weekend default',
      priority: scope === 'weekday' ? 10 : 10,
      when: { dow },
      action: { applyWheel: wheelId },
    });
  };
  return (
    <DraftFrame title="weekday or weekend default" onSave={save} onCancel={onCancel} canSave={!!wheelId}>
      <div className="tm-seg">
        <button className={scope === 'weekday' ? 'tm-on' : ''} onClick={() => setScope('weekday')}>weekdays</button>
        <button className={scope === 'weekend' ? 'tm-on' : ''} onClick={() => setScope('weekend')}>weekends</button>
      </div>
      <span className="tm-mono tm-sm">→</span>
      <WheelSelect value={wheelId} onChange={setWheelId} wheels={wheels} />
    </DraftFrame>
  );
}

function DaysOfWeekDraft({ wheels, onAdd, onCancel }) {
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const [dow, setDow] = useState([]);
  const [wheelId, setWheelId] = useState(null);
  const [name, setName] = useState('');
  const toggle = (i) => setDow(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  const save = () => {
    if (!wheelId || dow.length === 0) return;
    onAdd({
      name: name.trim() || `${dow.map(i => DAYS[i]).join('/')} wheel`,
      priority: 15,
      when: { dow: [...dow].sort() },
      action: { applyWheel: wheelId },
    });
  };
  return (
    <DraftFrame title="specific days of the week" onSave={save} onCancel={onCancel} canSave={!!wheelId && dow.length > 0}>
      <input
        className="tm-composer-input"
        placeholder="rule name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <div className="tm-seg" style={{ flexWrap: 'wrap' }}>
        {DAYS.map((d, i) => (
          <button key={d} className={dow.includes(i) ? 'tm-on' : ''} onClick={() => toggle(i)}>{d}</button>
        ))}
      </div>
      <span className="tm-mono tm-sm">→</span>
      <WheelSelect value={wheelId} onChange={setWheelId} wheels={wheels} />
    </DraftFrame>
  );
}

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function DateWheelDraft({ wheels, onAdd, onCancel }) {
  const [date, setDate] = useState(todayYMD());
  const [wheelId, setWheelId] = useState(null);
  const [name, setName] = useState('');
  const save = () => {
    if (!wheelId) return;
    const w = wheels.find(x => x.id === wheelId);
    onAdd({
      name: name.trim() || `${w?.name || 'wheel'} on ${date}`,
      priority: 40, // specific date beats dow defaults
      when: { date },
      action: { applyWheel: wheelId },
    });
  };
  return (
    <DraftFrame title="specific date → wheel" onSave={save} onCancel={onCancel} canSave={!!wheelId}>
      <input
        className="tm-composer-input"
        placeholder="rule name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <input type="date" className="tm-composer-num" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      <span className="tm-mono tm-sm">→</span>
      <WheelSelect value={wheelId} onChange={setWheelId} wheels={wheels} />
    </DraftFrame>
  );
}

function RangeWheelDraft({ wheels, onAdd, onCancel }) {
  const [start, setStart] = useState(todayYMD());
  const [end, setEnd] = useState(todayYMD());
  const [wheelId, setWheelId] = useState(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('all'); // all | weekdays | weekends
  const save = () => {
    if (!wheelId) return;
    const w = wheels.find(x => x.id === wheelId);
    const when = { range: [start, end] };
    if (scope === 'weekdays') when.dow = [1, 2, 3, 4, 5];
    if (scope === 'weekends') when.dow = [0, 6];
    onAdd({
      name: name.trim() || `${w?.name || 'wheel'} ${start}→${end}${scope !== 'all' ? ' (' + scope + ')' : ''}`,
      priority: 45, // range + dow beats dow defaults
      when,
      action: { applyWheel: wheelId },
    });
  };
  return (
    <DraftFrame title="date range → wheel" onSave={save} onCancel={onCancel} canSave={!!wheelId}>
      <input
        className="tm-composer-input"
        placeholder="rule name (e.g. 'sprint week')"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <input type="date" className="tm-composer-num" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 150 }} />
      <span className="tm-mono">–</span>
      <input type="date" className="tm-composer-num" value={end} onChange={(e) => setEnd(e.target.value)} min={start} style={{ width: 150 }} />
      <div className="tm-seg">
        {['all', 'weekdays', 'weekends'].map(s => (
          <button key={s} className={scope === s ? 'tm-on' : ''} onClick={() => setScope(s)}>{s}</button>
        ))}
      </div>
      <span className="tm-mono tm-sm">→</span>
      <WheelSelect value={wheelId} onChange={setWheelId} wheels={wheels} />
    </DraftFrame>
  );
}

function RangeOverrideDraft({ onAdd, onCancel }) {
  const [type, setType] = useState('vacation');
  const [start, setStart] = useState(todayYMD());
  const [end, setEnd] = useState(todayYMD());
  const [name, setName] = useState('');
  const preset = OVERRIDE_TYPES.find(o => o.id === type);
  const save = () => {
    onAdd({
      name: name.trim() || `${preset?.label || type} ${start}…${end}`,
      priority: 50, // ranges beat weekday defaults
      when: { range: [start, end] },
      action: {
        override: {
          type,
          label: name.trim() || preset?.label || type,
          color: preset?.color,
          clearSlots: !!preset?.clearsSlots,
        },
      },
    });
  };
  return (
    <DraftFrame title="date-range override (vacation, event)" onSave={save} onCancel={onCancel}>
      <input
        className="tm-composer-input"
        placeholder="name (e.g. 'summer trip')"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <select className="tm-composer-select" value={type} onChange={(e) => setType(e.target.value)}>
        {OVERRIDE_TYPES.map(o => <option key={o.id} value={o.id}>{o.label.toLowerCase()}</option>)}
      </select>
      <input type="date" className="tm-composer-num" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 150 }} />
      <span className="tm-mono">–</span>
      <input type="date" className="tm-composer-num" value={end} onChange={(e) => setEnd(e.target.value)} min={start} style={{ width: 150 }} />
    </DraftFrame>
  );
}

function YearlyOverrideDraft({ onAdd, onCancel }) {
  const [type, setType] = useState('holiday');
  const [month, setMonth] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [name, setName] = useState('');
  const preset = OVERRIDE_TYPES.find(o => o.id === type);
  const save = () => {
    onAdd({
      name: name.trim() || `${preset?.label || type} ${month}/${monthDay}`,
      priority: 60, // yearly holidays beat weekday defaults + vacation ranges
      when: { month: [Number(month)], monthDay: [Number(monthDay)] },
      action: {
        override: {
          type,
          label: name.trim() || preset?.label || type,
          color: preset?.color,
          clearSlots: !!preset?.clearsSlots,
        },
      },
    });
  };
  return (
    <DraftFrame title="yearly recurring (holiday)" onSave={save} onCancel={onCancel}>
      <input
        className="tm-composer-input"
        placeholder="name (e.g. 'new year', 'christmas')"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <select className="tm-composer-select" value={type} onChange={(e) => setType(e.target.value)}>
        {OVERRIDE_TYPES.map(o => <option key={o.id} value={o.id}>{o.label.toLowerCase()}</option>)}
      </select>
      <input type="number" min="1" max="12" className="tm-composer-num" value={month} onChange={(e) => setMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} style={{ width: 70 }} title="month (1-12)" />
      <span className="tm-mono">/</span>
      <input type="number" min="1" max="31" className="tm-composer-num" value={monthDay} onChange={(e) => setMonthDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} style={{ width: 70 }} title="day of month" />
    </DraftFrame>
  );
}
