import React, { useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { ARCHETYPES, ARCHETYPE_WHEELS } from '../defaults/scheduleArchetypes';

const CATEGORY_BY_ID = (() => {
  const m = {};
  for (const w of FAMOUS_WHEELS) m[w.id] = w.category;
  for (const w of ARCHETYPE_WHEELS) m[w.id] = w.category;
  return m;
})();

// Wheels owned by an archetype — surfaced via the archetype rail
// instead of in the category list, so we don't double up.
const ARCHETYPE_WHEEL_IDS = new Set(ARCHETYPES.map(a => a.wheelId));

// Categories that count as "Famous routines" — collapsed into the
// easter-egg section so the main picker focuses on archetypes and
// the user's own shapes.
const FAMOUS_CATEGORIES = new Set([
  'Tech & CEOs',
  'Modern',
  'Athletes',
  'Writers & Artists',
  'Historical',
  'Lifestyles',
  'Productivity Systems',
]);

const CATEGORY_ORDER = [
  'My Schedules',
];

function categoryOf(w) {
  return w.category || CATEGORY_BY_ID[w.id] || 'My Schedules';
}

function isFamousWheel(w) {
  return FAMOUS_CATEGORIES.has(categoryOf(w));
}

/**
 * Score a wheel against a free-text query. Mostly useful for the "describe
 * your day" suggestion path — counts how many of the user's tokens appear
 * in the wheel's name, category, block labels, or slot types.
 */
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
    if ((wheel.name || '').toLowerCase().includes(t)) score += 2; // name boost
  }
  return score;
}

export default function WheelPickerModal({
  wheels = [],
  currentWheelId,
  onApply,
  onClose,
  rangeContext,
  paintingDays,
}) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [describe, setDescribe] = useState('');
  const [suggested, setSuggested] = useState(null);
  // The famous-routines collection (Buffett, Mozart, Kafka…) is
  // collapsed by default. Surfaces only when the user explicitly
  // expands it — keeps the main picker focused on archetypes and
  // their own saved shapes.
  const [famousOpen, setFamousOpen] = useState(false);

  // Build a Map<wheelId, wheel> from BOTH the user's wheels and the
  // archetype catalog so an archetype card can render its preview
  // even if the user hasn't saved that wheel yet.
  const wheelById = useMemo(() => {
    const m = new Map();
    for (const w of wheels) m.set(w.id, w);
    for (const w of ARCHETYPE_WHEELS) if (!m.has(w.id)) m.set(w.id, w);
    return m;
  }, [wheels]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const w of wheels) {
      const cat = categoryOf(w);
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat).push(w);
    }
    return m;
  }, [wheels]);

  const categories = useMemo(() => {
    const cats = [...grouped.keys()];
    cats.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return ['All', ...cats];
  }, [grouped]);

  // Three pools:
  //   archetypeWheels — surfaced as a friendly chooser at the top.
  //   regularWheels   — the user's saved shapes + non-famous extras.
  //   famousWheels    — collapsed easter-egg section.
  // Search & category filters apply to the regular grid; archetypes
  // and famous routines stay where they are when filtering.
  const archetypePool = useMemo(() => {
    return ARCHETYPES
      .map(a => ({ archetype: a, wheel: wheelById.get(a.wheelId) }))
      .filter(x => x.wheel);
  }, [wheelById]);

  const regularPool = useMemo(() => {
    return wheels.filter(w => !ARCHETYPE_WHEEL_IDS.has(w.id) && !isFamousWheel(w));
  }, [wheels]);

  const famousPool = useMemo(() => {
    return wheels.filter(isFamousWheel);
  }, [wheels]);

  const filtered = useMemo(() => {
    let pool = regularPool;
    if (activeCat !== 'All') pool = pool.filter(w => categoryOf(w) === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter(w => {
        const blob = `${w.name} ${categoryOf(w)} ${(w.blocks || []).map(b => b.label).join(' ')}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return pool;
  }, [regularPool, activeCat, query]);

  // When the user types a search, expand famous routines so matches
  // surface. Otherwise stay collapsed.
  const filteredFamous = useMemo(() => {
    if (!query.trim()) return famousPool;
    const q = query.toLowerCase();
    return famousPool.filter(w => {
      const blob = `${w.name} ${categoryOf(w)} ${(w.blocks || []).map(b => b.label).join(' ')}`.toLowerCase();
      return blob.includes(q);
    });
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

  return (
    <div
      className="tm-modal-backdrop"
      role="dialog"
      aria-label="wheel picker"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="tm-modal"
        style={{
          maxWidth: 920,
          width: 'min(920px, 96vw)',
          maxHeight: '88vh',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">
            {rangeContext || (paintingDays && paintingDays.length)
              ? 'Pick a schedule to paint'
              : 'Choose a schedule'}
          </div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose} aria-label="close">close</button>
        </div>

        {rangeContext && (
          <div
            className="tm-mono tm-md"
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              border: '1.5px solid var(--orange)',
              borderRadius: 8,
              background: 'var(--orange-pale, #FBE9DD)',
              color: 'var(--orange)',
              fontWeight: 600,
            }}
          >
            painting {rangeContext.startDate} → {rangeContext.endDate} · click any schedule to apply
          </div>
        )}

        {paintingDays && paintingDays.length > 0 && (
          <div
            className="tm-mono tm-md"
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              border: '1.5px solid var(--orange)',
              borderRadius: 8,
              background: 'var(--orange-pale, #FBE9DD)',
              color: 'var(--orange)',
              fontWeight: 600,
            }}
          >
            painting {paintingDays.length} selected day{paintingDays.length === 1 ? '' : 's'}
            {paintingDays.length <= 4 && (
              <span style={{ fontWeight: 400, marginLeft: 8 }}>
                ({paintingDays.slice().sort().join(', ')})
              </span>
            )}
            {paintingDays.length > 4 && (
              <span style={{ fontWeight: 400, marginLeft: 8 }}>
                ({paintingDays.slice().sort()[0]} … {paintingDays.slice().sort().slice(-1)[0]})
              </span>
            )}
            {' · '}click any schedule to apply
          </div>
        )}

        {/* Describe your day → AI-style suggestion (keyword match, no external API) */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'stretch',
            marginBottom: 14,
            padding: '10px 12px',
            background: 'var(--paper-warm, #FAF5EC)',
            border: '1.5px solid var(--orange)',
            borderRadius: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            aria-hidden
            style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, color: 'var(--orange)', alignSelf: 'center' }}
          >
            Describe your day —
          </span>
          <input
            className="tm-composer-input"
            placeholder="early start, lots of meetings, gym at lunch…"
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') suggestFromDescription(); }}
            style={{ flex: 1, minWidth: 240, fontSize: 14 }}
          />
          <button type="button" className="tm-btn tm-primary tm-sm" onClick={suggestFromDescription}>
            Suggest
          </button>
        </div>

        {suggested && suggested.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              best matches
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {suggested.map(w => (
                <WheelCard
                  key={`sug-${w.id}`}
                  wheel={w}
                  isCurrent={currentWheelId === w.id}
                  onApply={() => onApply?.(w.id)}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Search + category tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input
            className="tm-composer-input"
            type="search"
            placeholder="search schedules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, fontSize: 14 }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-mute)' }}>
            {filtered.length} schedule{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {/* Archetype chooser — front and center. The social pivot:
              users self-identify by archetype rather than picking a
              celebrity. Each card shows the prototype wheel + blurb. */}
          {!query.trim() && archetypePool.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--ink-mute)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                What kind of day are you?
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10,
              }}>
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
            </div>
          )}

          {/* The user's own saved shapes + anything else categorized. */}
          {filtered.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--ink-mute)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Your schedules
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(w => (
                  <WheelCard
                    key={w.id}
                    wheel={w}
                    isCurrent={currentWheelId === w.id}
                    onApply={() => onApply?.(w.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Famous routines — easter-egg section, collapsed by default.
              Auto-expands when the user types a search to surface matches.
              We're keeping these as curiosities, not the main offering. */}
          {filteredFamous.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setFamousOpen(o => !o)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: 'var(--ink-mute)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                aria-expanded={famousOpen || !!query.trim()}
              >
                <span>{(famousOpen || query.trim()) ? '▼' : '▶'}</span>
                Famous routines · {filteredFamous.length}
                <span style={{ marginLeft: 6, fontSize: 16 }}>🥚</span>
              </button>
              {(famousOpen || query.trim()) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12,
                  marginTop: 6,
                }}>
                  {filteredFamous.map(w => (
                    <WheelCard
                      key={w.id}
                      wheel={w}
                      isCurrent={currentWheelId === w.id}
                      onApply={() => onApply?.(w.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && filteredFamous.length === 0 && !query.trim() === false && (
            <div style={{ textAlign: 'center', color: 'var(--ink-mute)', padding: 32 }}>
              no schedules match — try a different search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Archetype card — what kind of day are you? Shows the prototype
 * wheel preview plus the archetype's name + blurb.
 */
function ArchetypeCard({ archetype, wheel, isCurrent, onApply }) {
  return (
    <button
      type="button"
      onClick={onApply}
      style={{
        all: 'unset',
        cursor: 'pointer',
        border: `${isCurrent ? '2px solid var(--orange)' : '1.5px solid var(--rule)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        background: 'var(--paper)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        transition: 'border-color 0.12s, transform 0.08s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = archetype.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isCurrent ? 'var(--orange)' : 'var(--rule)'; }}
      title={archetype.blurb}
    >
      <MiniWheel slots={wheel.blocks || []} size={64} thickness={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span aria-hidden style={{ fontSize: 18 }}>{archetype.icon}</span>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 22,
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}>
            {archetype.name}
          </span>
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--ink-mute)',
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {archetype.blurb}
        </div>
      </div>
    </button>
  );
}

function WheelCard({ wheel, isCurrent, onApply, compact }) {
  return (
    <div
      style={{
        border: `${isCurrent ? '2px solid var(--orange)' : '1.5px solid var(--rule)'}`,
        borderRadius: 12,
        padding: compact ? '10px 12px' : '14px 14px',
        background: 'var(--paper)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        transition: 'transform 0.1s, box-shadow 0.15s',
      }}
    >
      <MiniWheel slots={wheel.blocks || []} size={compact ? 56 : 72} thickness={compact ? 8 : 10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: compact ? 18 : 20,
            lineHeight: 1.1,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={wheel.name}
        >
          {wheel.name}
        </div>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-mute)',
            letterSpacing: 0.4,
            marginTop: 2,
            textTransform: 'uppercase',
          }}
        >
          {(wheel.blocks || []).length} blocks · {categoryOf(wheel)}
        </div>
        <button
          type="button"
          className={`tm-btn tm-sm ${isCurrent ? 'tm-ghost' : 'tm-primary'}`}
          onClick={onApply}
          style={{ marginTop: 8, fontSize: 12 }}
        >
          {isCurrent ? 'applied ✓' : 'apply'}
        </button>
      </div>
    </div>
  );
}
