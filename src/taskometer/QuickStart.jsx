import React, { useMemo } from 'react';
import { MiniWheel } from './WheelView.jsx';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { ARCHETYPES, ARCHETYPE_WHEELS } from '../defaults/scheduleArchetypes';

/** First-run picker: choose the archetype that sounds like you. */
export default function QuickStart({ onPick }) {
  const options = useMemo(() => {
    const map = new Map();
    for (const w of ARCHETYPE_WHEELS) map.set(w.id, w);
    for (const w of FAMOUS_WHEELS) if (!map.has(w.id)) map.set(w.id, w);
    return ARCHETYPES
      .map(a => ({ archetype: a, wheel: map.get(a.wheelId) }))
      .filter(x => !!x.wheel);
  }, []);

  return (
    <div className="tm-card tm-dashed tm-quickstart">
      <div className="tm-quickstart-title">What kind of day are you?</div>
      <div className="tm-mono tm-md tm-quickstart-lede">
        Pick the archetype that sounds closest. We'll paint a starting schedule for you.
        Tweak everything afterwards.
      </div>
      <div className="tm-picker-grid">
        {options.map(({ archetype, wheel }) => (
          <button
            key={archetype.id}
            type="button"
            onClick={() => onPick(wheel)}
            title={archetype.blurb}
            className="tm-picker-card tm-picker-card-btn"
            style={{ '--card-accent': archetype.color, borderColor: archetype.color }}
          >
            <MiniWheel slots={wheel.blocks || []} size={56} thickness={7} />
            <div className="tm-picker-card-body">
              <div className="tm-picker-card-title">
                <span aria-hidden className="tm-picker-card-icon">{archetype.icon}</span>
                <span className="tm-picker-card-name" style={{ color: archetype.color }}>{archetype.name}</span>
              </div>
              <div className="tm-picker-card-blurb">{archetype.blurb}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="tm-quickstart-foot">
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onPick(null)}>
          build my own day from scratch →
        </button>
      </div>
    </div>
  );
}
