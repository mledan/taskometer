import React from 'react';
import LifeCanvas from '../LifeCanvas.jsx';
import PaintMaterialToolbar from '../PaintMaterialToolbar.jsx';

export default function LifeScreen({ state, filteredState, paintMaterial, setPaintMaterial, onPickDate, onPaintRange }) {
  return (
    <>
      <PaintMaterialToolbar material={paintMaterial} setMaterial={setPaintMaterial} />
      <LifeCanvas
        slots={state.slots || []}
        tasks={filteredState.tasks || []}
        taskTypes={state.taskTypes || []}
        paintMaterial={paintMaterial}
        onPickDate={onPickDate}
        onPaintRange={(startKey, endKey) => onPaintRange(startKey, endKey, paintMaterial)}
      />
    </>
  );
}
