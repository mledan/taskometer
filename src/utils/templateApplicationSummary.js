import { differenceInCalendarDays, format } from 'date-fns';

function toDateKey(isoDateTime) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'yyyy-MM-dd');
}

function toTimeLabel(isoDateTime) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '--:--';
  return format(date, 'HH:mm');
}

function toDisplayDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return format(date, 'EEE, MMM d');
}

export function buildTemplateApplicationSummary({
  schedule,
  blocks,
  startDate,
  endDate,
  source = 'schedule-library',
  maxPreviewDays = 3,
  maxPreviewBlocksPerDay = 3
}) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  const groupedByDate = safeBlocks.reduce((acc, block) => {
    const key = toDateKey(block.startTime);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(block);
    return acc;
  }, {});

  const orderedDateKeys = Object.keys(groupedByDate).sort();
  const previewDays = orderedDateKeys.slice(0, maxPreviewDays).map((dateKey) => {
    const dayBlocks = [...groupedByDate[dateKey]].sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );

    return {
      date: dateKey,
      displayDate: toDisplayDate(dateKey),
      totalBlocks: dayBlocks.length,
      blocks: dayBlocks.slice(0, maxPreviewBlocksPerDay).map((block) => ({
        start: toTimeLabel(block.startTime),
        end: toTimeLabel(block.endTime),
        label: block.label || block.name || block.type || 'Schedule Block',
        type: block.type || block.category || 'custom',
        color: block.color || null
      }))
    };
  });

  const parsedStart = new Date(`${startDate}T00:00:00`);
  const parsedEnd = new Date(`${endDate}T00:00:00`);
  const hasValidRange =
    !Number.isNaN(parsedStart.getTime()) &&
    !Number.isNaN(parsedEnd.getTime()) &&
    parsedEnd >= parsedStart;

  return {
    id: `${schedule?.id || 'schedule'}-${Date.now()}`,
    source,
    scheduleId: schedule?.id || null,
    scheduleName: schedule?.name || 'Selected schedule',
    startDate,
    endDate,
    appliedAt: new Date().toISOString(),
    appliedBlockCount: safeBlocks.length,
    dayCount: hasValidRange
      ? differenceInCalendarDays(parsedEnd, parsedStart) + 1
      : orderedDateKeys.length,
    previewDays
  };
}
