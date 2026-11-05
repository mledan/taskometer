import React from 'react';
import SchedulePickerBody from './library/SchedulePicker.jsx';

// Thin modal wrapper around the schedule picker. The Library drawer
// renders the same body as its Schedules tab; this stays for callers
// that need a standalone dialog (WheelView's empty-day prompt).
export default function WheelPickerModal({ wheels = [], currentWheelId, onApply, onClose, rangeContext, paintingDays }) {
  return (
    <div
      className="tm-modal-backdrop"
      role="dialog"
      aria-label="schedule picker"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="tm-modal tm-modal-wide">
        <div className="tm-modal-head">
          <div className="tm-modal-title">
            {rangeContext || (paintingDays && paintingDays.length) ? 'Pick a schedule to paint' : 'Choose a schedule'}
          </div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose} aria-label="close">close</button>
        </div>
        <SchedulePickerBody
          wheels={wheels}
          currentWheelId={currentWheelId}
          onApply={onApply}
          rangeContext={rangeContext}
          paintingDays={paintingDays}
        />
      </div>
    </div>
  );
}
