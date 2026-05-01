import React from 'react';

/**
 * Sticky pill that floats at the bottom of the viewport while a multi-
 * select is active. Generic — accepts an array of action buttons so
 * callers can show different operations depending on the surface.
 *
 *   <SelectionBar
 *     selected={ms.selected}
 *     actions={[
 *       { label: 'Paint with wheel →', onClick: paint, primary: true },
 *       { label: 'Save as rhythm',     onClick: save },
 *     ]}
 *     onClear={ms.clear}
 *   />
 */
export default function SelectionBar({ selected, actions = [], onClear, label = 'day' }) {
  if (!selected || selected.size === 0) return null;
  const n = selected.size;
  // On phones we drop the pill shape and stretch the bar so action
  // buttons stay visible and tappable. On wider screens the floating
  // pill version is friendlier.
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 600;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: isNarrow ? 12 : 24,
        left: isNarrow ? 12 : '50%',
        right: isNarrow ? 12 : 'auto',
        transform: isNarrow ? 'none' : 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isNarrow ? 'space-between' : 'flex-start',
        gap: 10,
        padding: isNarrow ? '10px 12px' : '10px 14px 10px 18px',
        background: 'var(--ink)',
        color: 'var(--paper)',
        borderRadius: isNarrow ? 14 : 999,
        boxShadow: '0 6px 22px rgba(0, 0, 0, 0.22)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        zIndex: 200,
        flexWrap: 'wrap',
        maxWidth: isNarrow ? 'auto' : '92vw',
      }}
    >
      <span>
        <strong style={{ color: 'var(--orange)' }}>{n}</strong>
        {' '}{label}{n === 1 ? '' : 's'} selected
      </span>
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '6px 14px',
            background: a.primary ? 'var(--orange)' : 'rgba(255,255,255,0.08)',
            color: 'var(--paper)',
            borderRadius: 999,
            fontWeight: a.primary ? 600 : 500,
          }}
          title={a.title}
        >
          {a.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        style={{
          all: 'unset',
          cursor: 'pointer',
          padding: '6px 10px',
          color: 'var(--paper)',
          opacity: 0.7,
          fontSize: 12,
        }}
        title="Esc"
      >
        Clear
      </button>
    </div>
  );
}
