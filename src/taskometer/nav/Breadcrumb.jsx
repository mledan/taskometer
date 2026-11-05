import React from 'react';
import { isoWeekNumber, formatYMD } from '../../utils/time.js';

// `2026 › Q4 › Nov › W45 › Wed 4` — each segment is where that zoom
// level would land you for the selected date.
export default function Breadcrumb({ date, zoom, onJump }) {
  const segments = [
    { zoom: 'year', label: String(date.getFullYear()) },
    { zoom: 'quarter', label: `Q${Math.floor(date.getMonth() / 3) + 1}` },
    { zoom: 'month', label: date.toLocaleDateString('en', { month: 'short' }) },
    { zoom: 'week', label: `W${isoWeekNumber(date)}` },
    { zoom: 'day', label: `${date.toLocaleDateString('en', { weekday: 'short' })} ${date.getDate()}` },
  ];
  return (
    <nav className="tm-crumbs" aria-label="where you are" title={formatYMD(date)}>
      {segments.map((s, i) => (
        <React.Fragment key={s.zoom}>
          {i > 0 && <span aria-hidden className="tm-crumbs-sep">›</span>}
          <button
            type="button"
            className={`tm-crumb${zoom === s.zoom ? ' tm-on' : ''}`}
            aria-current={zoom === s.zoom ? 'true' : undefined}
            onClick={() => onJump(s.zoom)}
          >
            {s.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
