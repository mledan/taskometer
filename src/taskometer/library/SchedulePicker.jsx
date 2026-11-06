import { useMemo, useState } from 'react';
import { MiniWheel } from '../WheelView.jsx';
import { FAMOUS_WHEELS } from '../../defaults/famousWheels';
import { ARCHETYPES, ARCHETYPE_WHEELS } from '../../defaults/scheduleArchetypes';

const CATEGORY_BY_ID = (() => {
  const m = {};
  for (const w of FAMOUS_WHEELS) m[w.id] = w.category;
  for (const w of ARCHETYPE_WHEELS) m[w.id] = w.category;
  return m;
})();

const ARCHETYPE_WHEEL_IDS = new Set(ARCHETYPES.map(a => a.wheelId));

const FAMOUS_CATEGORIES = new Set([
  'Tech & CEOs', 'Modern', 'Athletes', 'Writers & Artists',
  'Historical', 'Lifestyles', 'Productivity Systems',
]);

const CATEGORY_ORDER = ['My Schedules'];

export function categoryOf(w) {
  return w.category || CATEGORY_BY_ID[w.id] || 'My Schedules';
}

export function isFamousWheel(w) {
  return FAMOUS_CATEGORIES.has(categoryOf(w));
}

function scoreWheel(wheel, queryTokens) {
  const haystack = [
    wheel.name || '',
    categoryOf(wheel),
    ...(wheel.blocks || []).map(b => `${b.label || ''} ${b.slotType || ''}`),
  ].join(' ').toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (!t) continue;
    if (haystack.includes(t)) score += 1;
    if ((wheel.name || '').toLowerCase().includes(t)) score += 2;
  }
  return score;
}

/**
 * The "choose a schedule" surface: archetype chooser, the user's own
 * schedules, famous routines collapsed underneath. Rendered inside
 * the Library drawer (Schedules tab) and inside WheelView's modal.
 */
export default function SchedulePickerBody({
  wheels = [],
  currentWheelId,
  onApply,
  rangeContext,
  paintingDays,
}) {
  const [query, setQuery] = useState('');
  const [activeCat] = useState('All');
  const [describe, setDescribe] = useState('');
  const [suggested, setSuggested] = useState(null);
  const [famousOpen, setFamousOpen] = useState(false);

  const wheelById = useMemo(() => {
    const m = new Map();
    for (const w of wheels) m.set(w.id, w);
    for (const w of ARCHETYPE_WHEELS) if (!m.has(w.id)) m.set(w.id, w);
    return m;
  }, [wheels]);

  const archetypePool = useMemo(() => ARCHETYPES
    .map(a => ({ archetype: a, wheel: wheelById.get(a.wheelId) }))
    .filter(x => x.wheel), [wheelById]);

  const regularPool = useMemo(
    () => wheels.filter(w => !ARCHETYPE_WHEEL_IDS.has(w.id) && !isFamousWheel(w)),
    [wheels],
  );
  const famousPool = useMemo(() => wheels.filter(isFamousWheel), [wheels]);

  const matches = (w, q) => {
    const blob = `${w.name} ${categoryOf(w)} ${(w.blocks || []).map(b => b.label).join(' ')}`.toLowerCase();
    return blob.includes(q);
  };

  const filtered = useMemo(() => {
    let pool = regularPool;
    if (activeCat !== 'All') pool = pool.filter(w => categoryOf(w) === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter(w => matches(w, q));
    }
    pool = pool.slice().sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(categoryOf(a));
      const bi = CATEGORY_ORDER.indexOf(categoryOf(b));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return pool;
  }, [regularPool, activeCat, query]);

  const filteredFamous = useMemo(() => {
    if (!query.trim()) return famousPool;
    const q = query.toLowerCase();
    return famousPool.filter(w => matches(w, q));
  }, [famousPool, query]);

  const suggestFromDescription = () => {
    const tokens = describe.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!tokens.length) { setSuggested(null); return; }
    const scored = wheels
      .map(w => ({ w, score: scoreWheel(w, tokens) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    setSuggested(scored.slice(0, 3).map(x => x.w));
  };

  const painting = rangeContext || (paintingDays && paintingDays.length > 0);

  return (
    <div className="tm-picker">
      {rangeContext && (
        <div className="tm-picker-banner tm-mono tm-md">
          painting {rangeContext.startDate} → {rangeContext.endDate} · click any schedule to apply
        </div>
      )}

      {paintingDays && paintingDays.length > 0 && (
        <div className="tm-picker-banner tm-mono tm-md">
          painting {paintingDays.length} selected day{paintingDays.length === 1 ? '' : 's'}
          {paintingDays.length <= 4 && (
            <span className="tm-picker-banner-detail">({paintingDays.slice().sort().join(', ')})</span>
          )}
          {paintingDays.length > 4 && (
            <span className="tm-picker-banner-detail">
              ({paintingDays.slice().sort()[0]} … {paintingDays.slice().sort().slice(-1)[0]})
            </span>
          )}
          {' · '}click any schedule to apply
        </div>
      )}

      {!painting && (
        <div className="tm-picker-describe">
          <span aria-hidden className="tm-picker-describe-label">Describe your day —</span>
          <input
            className="tm-composer-input"
            placeholder="early start, lots of meetings, gym at lunch…"
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') suggestFromDescription(); }}
          />
          <button type="button" className="tm-btn tm-primary tm-sm" onClick={suggestFromDescription}>
            Suggest
          </button>
        </div>
      )}

      {suggested && suggested.length > 0 && (
        <section className="tm-picker-section">
          <div className="tm-picker-eyebrow">best matches</div>
          <div className="tm-picker-grid">
            {suggested.map(w => (
              <WheelCard key={`sug-${w.id}`} wheel={w} isCurrent={currentWheelId === w.id} onApply={() => onApply?.(w.id)} compact />
            ))}
          </div>
        </section>
      )}

      <div className="tm-picker-search">
        <input
          className="tm-composer-input"
          type="search"
          placeholder="search schedules…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="search schedules"
        />
        <span className="tm-mono tm-sm">
          {filtered.length} schedule{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {!query.trim() && archetypePool.length > 0 && (
        <section className="tm-picker-section">
          <div className="tm-picker-eyebrow">What kind of day are you?</div>
          <div className="tm-picker-grid">
            {archetypePool.map(({ archetype, wheel }) => (
              <ArchetypeCard
                key={archetype.id}
                archetype={archetype}
                wheel={wheel}
                isCurrent={currentWheelId === wheel.id}
                onApply={() => onApply?.(wheel.id)}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length > 0 && (
        <section className="tm-picker-section">
          <div className="tm-picker-eyebrow">Your schedules</div>
          <div className="tm-picker-grid">
            {filtered.map(w => (
              <WheelCard key={w.id} wheel={w} isCurrent={currentWheelId === w.id} onApply={() => onApply?.(w.id)} />
            ))}
          </div>
        </section>
      )}

      {filteredFamous.length > 0 && (
        <section className="tm-picker-section">
          <button
            type="button"
            className="tm-picker-eyebrow tm-picker-disclosure"
            onClick={() => setFamousOpen(o => !o)}
            aria-expanded={famousOpen || !!query.trim()}
          >
            <span aria-hidden>{(famousOpen || query.trim()) ? '▼' : '▶'}</span>
            Famous routines · {filteredFamous.length}
          </button>
          {(famousOpen || query.trim()) && (
            <div className="tm-picker-grid">
              {filteredFamous.map(w => (
                <WheelCard key={w.id} wheel={w} isCurrent={currentWheelId === w.id} onApply={() => onApply?.(w.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {filtered.length === 0 && filteredFamous.length === 0 && query.trim() && (
        <div className="tm-picker-empty">no schedules match — try a different search.</div>
      )}
    </div>
  );
}

function ArchetypeCard({ archetype, wheel, isCurrent, onApply }) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={`tm-picker-card tm-picker-card-btn${isCurrent ? ' tm-current' : ''}`}
      style={{ '--card-accent': archetype.color }}
      title={archetype.blurb}
    >
      <MiniWheel slots={wheel.blocks || []} size={64} thickness={8} />
      <div className="tm-picker-card-body">
        <div className="tm-picker-card-title">
          <span aria-hidden className="tm-picker-card-icon">{archetype.icon}</span>
          <span className="tm-picker-card-name">{archetype.name}</span>
        </div>
        <div className="tm-picker-card-blurb">{archetype.blurb}</div>
      </div>
    </button>
  );
}

function WheelCard({ wheel, isCurrent, onApply, compact }) {
  return (
    <div className={`tm-picker-card${isCurrent ? ' tm-current' : ''}${compact ? ' tm-compact' : ''}`}>
      <MiniWheel slots={wheel.blocks || []} size={compact ? 56 : 72} thickness={compact ? 8 : 10} />
      <div className="tm-picker-card-body">
        <div className="tm-picker-card-name tm-ellipsis" title={wheel.name}>{wheel.name}</div>
        <div className="tm-picker-card-meta tm-mono tm-sm">
          {(wheel.blocks || []).length} blocks · {categoryOf(wheel)}
        </div>
        <button
          type="button"
          className={`tm-btn tm-sm ${isCurrent ? 'tm-ghost' : 'tm-primary'}`}
          onClick={onApply}
        >
          {isCurrent ? 'applied ✓' : 'apply'}
        </button>
      </div>
    </div>
  );
}
