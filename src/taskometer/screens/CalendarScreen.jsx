import TimeBreakdown from '../TimeBreakdown.jsx';
import PaintMaterialToolbar from '../PaintMaterialToolbar.jsx';
import { MonthInsights, QuarterInsights, YearInsights } from '../TimelineViews.jsx';
import { monthRangeFor, quarterRangeFor, quarterLabel, yearRangeFor } from '../../utils/time.js';
import '../screens.css';

const ZOOM_CONFIG = {
  month: {
    Insights: MonthInsights,
    range: monthRangeFor,
    title: 'Where the month goes',
    subtitle: (d) => `${d.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · planned hours by category`,
  },
  quarter: {
    Insights: QuarterInsights,
    range: quarterRangeFor,
    title: 'Where the quarter goes',
    subtitle: (d) => `${quarterLabel(d)} · planned hours by category`,
  },
  year: {
    Insights: YearInsights,
    range: yearRangeFor,
    title: 'Where the year goes',
    subtitle: (d) => `${d.getFullYear()} · planned hours by category`,
  },
};

/** Month, quarter and year share one shape: paint the calendar, reflect on the breakdown below. */
export default function CalendarScreen({
  zoom,
  selectedDate,
  state,
  filteredState,
  paintMaterial,
  setPaintMaterial,
  multiSelect,
  onPickDate,
  onPaintDay,
  onPaintRange,
  onPaintDays,
  onSaveDaysAsRhythm,
}) {
  const cfg = ZOOM_CONFIG[zoom] || ZOOM_CONFIG.month;
  const { Insights } = cfg;
  return (
    <div className="tm-screen">
      <PaintMaterialToolbar material={paintMaterial} setMaterial={setPaintMaterial} />
      <Insights
        selectedDate={selectedDate}
        slots={state.slots || []}
        taskTypes={state.taskTypes || []}
        onPickDate={onPickDate}
        onPaintDay={(wheelId, dateKey) => onPaintDay(wheelId, dateKey, paintMaterial)}
        onPaintRange={(startDate, endDate) => onPaintRange(startDate, endDate, paintMaterial)}
        onPaintDays={(dates) => onPaintDays(dates, paintMaterial)}
        onSaveDaysAsRhythm={onSaveDaysAsRhythm}
        multiSelect={multiSelect}
      />
      <TimeBreakdown
        slots={state.slots || []}
        tasks={filteredState.tasks || []}
        taskTypes={state.taskTypes || []}
        range={cfg.range(selectedDate)}
        title={cfg.title}
        subtitle={cfg.subtitle(selectedDate)}
      />
    </div>
  );
}
