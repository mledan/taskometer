import { useMemo } from 'react';
import { MiniWheel } from '../WheelView.jsx';
import { FAMOUS_WHEELS } from '../../defaults/famousWheels';
import { FAMOUS_PROFILES, FAMOUS_SPOTLIGHT_ORDER } from '../../defaults/famousProfiles';

// Time-of-day slices for mix-and-match. "All day" is a sentinel —
// null from/to means paint the whole day with no clipping.
export const SLICES = [
  { id: 'all', label: 'All day', from: null, to: null },
  { id: 'morning', label: 'AM', from: '05:00', to: '12:00', tip: '5am – noon' },
  { id: 'afternoon', label: 'PM', from: '12:00', to: '17:00', tip: 'noon – 5pm' },
  { id: 'evening', label: 'Eve', from: '17:00', to: '22:00', tip: '5pm – 10pm' },
];

/**
 * Curated historical routines with sourced one-liners. Click to paint
 * on the day in view; AM / PM / Eve paint only that slice so two
 * routines can share a day.
 */
export default function RoutinesTab({ onApply, dateLabel }) {
  const items = useMemo(() => FAMOUS_SPOTLIGHT_ORDER
    .map(id => ({ wheel: FAMOUS_WHEELS.find(w => w.id === id), profile: FAMOUS_PROFILES[id] }))
    .filter(x => x.wheel && x.profile), []);

  if (items.length === 0) return null;

  return (
    <div className="tm-library-tab">
      <p className="tm-library-lede tm-mono tm-md">
        click a card to paint it on {dateLabel || 'this day'} · sourced from biographies, letters, and interviews
      </p>
      <div className="tm-picker-grid">
        {items.map(({ wheel, profile }) => (
          <FamousCard key={wheel.id} wheel={wheel} profile={profile} onApply={onApply} />
        ))}
      </div>
    </div>
  );
}

function FamousCard({ wheel, profile, onApply }) {
  const slotsForMini = (wheel.blocks || []).map(b => ({ startTime: b.startTime, endTime: b.endTime, color: b.color }));
  return (
    <div className="tm-routine-card">
      <div className="tm-routine-head">
        <MiniWheel slots={slotsForMini} size={42} thickness={6} />
        <div className="tm-picker-card-body">
          <div className="tm-routine-name">{wheel.name}</div>
          <div className="tm-mono tm-sm">{profile.era} · {profile.role}</div>
        </div>
      </div>
      <div className="tm-routine-blurb">{profile.blurb}</div>
      <div className="tm-seg">
        {SLICES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onApply?.(wheel.id, s)}
            title={s.tip ? `paint ${s.tip} of ${wheel.name}'s routine` : `paint ${wheel.name}'s full day`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="tm-mono tm-sm tm-routine-source">
        source:{' '}
        {profile.sourceUrl ? (
          <a href={profile.sourceUrl} target="_blank" rel="noopener noreferrer">{profile.source}</a>
        ) : profile.source}
      </div>
    </div>
  );
}
