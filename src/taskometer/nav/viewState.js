// Two axes of navigation: how much time you see (zoom) and how a single
// day is rendered (lens). Persisted inside the existing `tm.ui` blob.

export const ZOOMS = ['day', 'week', 'month', 'quarter', 'year', 'life'];
export const LENSES = ['wheel', 'blocks', 'spiral'];

export const ZOOM_LABELS = {
  day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year', life: 'Life',
};

export const LENS_META = {
  wheel: { label: 'Wheel', glyph: '◎', hint: 'the 24-hour wheel' },
  blocks: { label: 'Blocks', glyph: '≡', hint: 'the helix dropped into a list of blocks' },
  spiral: { label: 'Spiral', glyph: '֎', hint: 'the wheel unrolled: one turn per day' },
};

export const DEFAULT_VIEW = { zoom: 'day', lens: 'wheel' };

// Legacy `tm.scale` values map onto the two axes. 'block' and 'spiral'
// were never time scales — they were ways of looking at one day.
export function migrateLegacyScale(scale) {
  if (scale === 'block') return { zoom: 'day', lens: 'blocks' };
  if (scale === 'spiral') return { zoom: 'day', lens: 'spiral' };
  if (ZOOMS.includes(scale)) return { zoom: scale, lens: 'wheel' };
  return null;
}

export function normalizeView(view) {
  const zoom = ZOOMS.includes(view?.zoom) ? view.zoom : DEFAULT_VIEW.zoom;
  const lens = LENSES.includes(view?.lens) ? view.lens : DEFAULT_VIEW.lens;
  return { zoom, lens };
}

export function zoomStep(zoom, dir) {
  const i = ZOOMS.indexOf(zoom);
  if (i === -1) return DEFAULT_VIEW.zoom;
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + dir))];
}
