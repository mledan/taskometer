import React from 'react';

/**
 * DiscoveryStrip — three big always-visible CTAs for the Wave A–D
 * surfaces. The user couldn't find the path/pack/routine entry
 * points after they tucked into a drawer, so this strip sits at the
 * top of the day view and makes them obvious.
 *
 * Compact card-row, one click per card to open the corresponding
 * picker. Different orange accents so each is distinct at a glance.
 */
export default function DiscoveryStrip({ onOpenPaths, onOpenPacks, onOpenRoutines }) {
  return (
    <div
      style={{
        marginBottom: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 10,
      }}
    >
      <Card
        accent="var(--orange)"
        icon="★"
        title="Adopt a path"
        body="Pick a 5–30 day stretch with a schedule + starter pack — Morning person, Agile sprint, Recovery week, more."
        cta="Browse paths →"
        onClick={onOpenPaths}
      />
      <Card
        accent="#A8BF8C"
        icon="🧹"
        title="Add a starter pack"
        body="Curated todo packs — chores, morning routine, sprint week, travel prep. Pick what fits, deselect what doesn't."
        cta="Browse packs →"
        onClick={onOpenPacks}
      />
      <Card
        accent="#6B46C1"
        icon="🕰"
        title="Try a famous routine"
        body="Six historical schedules with sourced citations — Franklin, Darwin, Hemingway, Buffett, Cook. Click to apply, AM/PM to mix."
        cta="See routines →"
        onClick={onOpenRoutines}
      />
    </div>
  );
}

function Card({ accent, icon, title, body, cta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '14px 16px',
        border: `1.5px solid var(--rule)`,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderRadius: 12,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.background = 'var(--paper-warm, #FAF5EC)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)';
        e.currentTarget.style.borderLeftColor = accent;
        e.currentTarget.style.background = 'var(--paper)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, color: accent }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
        {body}
      </div>
      <div
        className="tm-mono tm-sm"
        style={{ color: accent, fontWeight: 600, marginTop: 2 }}
      >
        {cta}
      </div>
    </button>
  );
}
