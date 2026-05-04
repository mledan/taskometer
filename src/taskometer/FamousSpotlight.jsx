import React, { useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { FAMOUS_PROFILES, FAMOUS_SPOTLIGHT_ORDER } from '../defaults/famousProfiles';

const COLLAPSE_KEY = 'taskometer.famousSpotlight.collapsed';

/**
 * FamousSpotlight — horizontal strip surfacing curated historical
 * routines, click-to-apply to today. The user said the side margins
 * are too quiet and asked us to make these schedules shine. So:
 * 6 cards with a sourced one-liner each, click → paint that
 * routine on the day in view.
 *
 * Profiles in src/defaults/famousProfiles.js are paired with citable
 * sources (Hemingway's Paris Review interview, Franklin's
 * Autobiography, Currey's Daily Rituals, etc.). The blurb stays
 * narrow to what the source actually documents.
 *
 * Collapsible — once a user is happy with their routine, the
 * spotlight stays out of the way until they reopen it.
 */
export default function FamousSpotlight({ onApply, onSeeAll }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (_) { return false; }
  });
  const setCollapse = (v) => {
    setCollapsed(v);
    try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch (_) {}
  };

  const items = useMemo(() => {
    return FAMOUS_SPOTLIGHT_ORDER
      .map(id => ({
        wheel: FAMOUS_WHEELS.find(w => w.id === id),
        profile: FAMOUS_PROFILES[id],
      }))
      .filter(x => x.wheel && x.profile);
  }, []);

  if (items.length === 0) return null;

  if (collapsed) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          padding: '8px 14px',
          border: '1.5px dashed var(--rule)',
          borderRadius: 10,
          background: 'var(--paper)',
          flexWrap: 'wrap',
        }}
      >
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          ★ try a routine
        </span>
        <button
          type="button"
          className="tm-btn tm-sm tm-ghost"
          onClick={() => setCollapse(false)}
        >
          show {items.length} historical schedules
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 14,
        padding: '14px 16px',
        border: '1.5px solid var(--rule)',
        borderRadius: 12,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Try a famous routine
          </div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 2 }}>
            click any card to paint it on today · sourced from biographies, letters, and interviews
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onSeeAll && (
            <button
              type="button"
              className="tm-btn tm-sm tm-ghost"
              onClick={onSeeAll}
              title="open the full schedule library"
            >
              browse all →
            </button>
          )}
          <button
            type="button"
            className="tm-btn tm-sm tm-ghost"
            onClick={() => setCollapse(true)}
            title="collapse this strip"
            aria-label="collapse"
          >
            ×
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {items.map(({ wheel, profile }) => (
          <FamousCard
            key={wheel.id}
            wheel={wheel}
            profile={profile}
            onApply={() => onApply?.(wheel.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FamousCard({ wheel, profile, onApply }) {
  const slotsForMini = (wheel.blocks || []).map(b => ({
    startTime: b.startTime,
    endTime: b.endTime,
    color: b.color,
  }));

  return (
    <button
      type="button"
      onClick={onApply}
      title={`paint ${wheel.name}'s routine onto today · drag to weekdays/weekends from the schedule library for a recurring pattern`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '12px 14px',
        border: '1px solid var(--rule)',
        borderRadius: 10,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 0.1s, transform 0.08s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MiniWheel slots={slotsForMini} size={42} thickness={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
            {wheel.name}
          </div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 2 }}>
            {profile.era} · {profile.role}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
        {profile.blurb}
      </div>
      <div
        className="tm-mono tm-sm"
        style={{ color: 'var(--ink-mute)', fontSize: 10, lineHeight: 1.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        source:{' '}
        {profile.sourceUrl ? (
          <a
            href={profile.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--ink-mute)', textDecoration: 'underline' }}
          >
            {profile.source}
          </a>
        ) : (
          profile.source
        )}
      </div>
    </button>
  );
}
