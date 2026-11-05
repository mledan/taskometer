import { ZOOMS, ZOOM_LABELS } from './viewState.js';

export default function ZoomNav({ zoom, onChange }) {
  return (
    <nav className="tm-zoom" aria-label="zoom">
      <div className="tm-seg tm-zoom-seg" role="radiogroup" aria-label="how much time to show">
        {ZOOMS.map(z => (
          <button
            key={z}
            type="button"
            role="radio"
            aria-checked={zoom === z}
            className={zoom === z ? 'tm-on' : ''}
            onClick={() => onChange(z)}
          >
            {ZOOM_LABELS[z]}
          </button>
        ))}
      </div>
      <select
        className="tm-zoom-select tm-composer-select"
        aria-label="how much time to show"
        value={zoom}
        onChange={(e) => onChange(e.target.value)}
      >
        {ZOOMS.map(z => <option key={z} value={z}>{ZOOM_LABELS[z]}</option>)}
      </select>
    </nav>
  );
}
