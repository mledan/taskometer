import React, { useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';

const CATEGORY_BY_ID = (() => {
  const m = {};
  for (const w of FAMOUS_WHEELS) m[w.id] = w.category;
  return m;
})();

const CATEGORY_ORDER = [
  'My Wheels',
  'Productivity Systems',
  'Tech & CEOs',
  'Modern',
  'Athletes',
  'Writers & Artists',
  'Historical',
  'Lifestyles',
];

function categoryOf(w) {
  return w.category || CATEGORY_BY_ID[w.id] || 'My Wheels';
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
}) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [describe, setDescribe] = useState('');
  const [suggested, setSuggested] = useState(null);

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

  const filtered = useMemo(() => {
    let pool = wheels;
    if (activeCat !== 'All') pool = pool.filter(w => categoryOf(w) === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter(w => {
        const blob = `${w.name} ${categoryOf(w)} ${(w.blocks || []).map(b => b.label).join(' ')}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return pool;
  }, [wheels, activeCat, query]);

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
            {rangeContext ? 'Pick a wheel to paint' : 'Choose a wheel'}
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
            painting {rangeContext.startDate} → {rangeContext.endDate} · click any wheel to apply
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
            style={{ fontFamily: 'Caveat, cursive', fontSize: 22, color: 'var(--orange)', alignSelf: 'center' }}
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
            placeholder="search wheels…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, fontSize: 14 }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-mute)' }}>
            {filtered.length} wheel{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="tm-seg" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button
              key={c}
              type="button"
              className={activeCat === c ? 'tm-on' : ''}
              onClick={() => setActiveCat(c)}
              style={{ fontSize: 12 }}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {filtered.map(w => (
              <WheelCard
                key={w.id}
                wheel={w}
                isCurrent={currentWheelId === w.id}
                onApply={() => onApply?.(w.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--ink-mute)', padding: 32 }}>
                no wheels match — try a different search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
            fontFamily: 'Caveat, cursive',
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
