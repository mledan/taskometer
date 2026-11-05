import React from 'react';
import { LENSES, LENS_META } from './viewState.js';

export default function LensToggle({ lens, onChange }) {
  return (
    <div className="tm-seg tm-lens" role="radiogroup" aria-label="how to view this day">
      {LENSES.map(l => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lens === l}
          aria-label={LENS_META[l].label}
          title={LENS_META[l].hint}
          className={lens === l ? 'tm-on' : ''}
          onClick={() => onChange(l)}
        >
          <span aria-hidden className="tm-lens-glyph">{LENS_META[l].glyph}</span>
          <span className="tm-lens-label">{LENS_META[l].label}</span>
        </button>
      ))}
    </div>
  );
}
