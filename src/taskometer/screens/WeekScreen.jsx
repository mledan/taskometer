import React from 'react';
import WeekCanvas from '../WeekCanvas.jsx';
import { log as telemetryLog } from '../../services/telemetry.js';
import { formatYMD } from '../../utils/time.js';

export default function WeekScreen({ selectedDate, state, filteredState, derived, userWheels, onPickDate, onPaintRange }) {
  return (
    <WeekCanvas
      selectedDate={selectedDate}
      slots={state.slots || []}
      tasks={filteredState.tasks || []}
      taskTypes={state.taskTypes || []}
      wheels={userWheels}
      dayAssignments={derived.dayAssignments}
      dayOverrides={derived.dayOverrides}
      onPickDate={(d) => {
        telemetryLog('ui:week-pick-day', { date: formatYMD(d) });
        onPickDate(d);
      }}
      onPaintRange={onPaintRange}
    />
  );
}
