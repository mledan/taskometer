
/** Shared across calendar zooms: drag paints a schedule, or blanks the range. */
export default function PaintMaterialToolbar({ material, setMaterial }) {
  return (
    <div className="tm-paint-toolbar">
      <span className="tm-picker-eyebrow">click + drag paints</span>
      <div className="tm-seg">
        <button
          type="button"
          className={material === 'schedule' ? 'tm-on' : ''}
          onClick={() => setMaterial('schedule')}
          title="drag a range, then pick a schedule to apply"
        >
          schedule
        </button>
        <button
          type="button"
          className={material === 'blank' ? 'tm-on' : ''}
          onClick={() => setMaterial('blank')}
          title="drag a range to clear all blocks (and drop the day assignment)"
        >
          blank
        </button>
      </div>
      <span className="tm-mono tm-sm tm-paint-toolbar-hint">
        {material === 'blank'
          ? 'drag clears every block in the range'
          : 'drag selects a range, then a picker asks which schedule'}
      </span>
    </div>
  );
}
