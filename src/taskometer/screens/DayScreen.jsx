import WheelView from '../WheelView.jsx';
import LooseEnds from '../BlockBoard.jsx';
import DailyWrap from '../DailyWrap.jsx';
import RightNow from '../RightNow.jsx';
import { InboxPanel } from '../Inbox.jsx';
import ComingUp from '../ComingUp.jsx';
import Snoozed from '../Snoozed.jsx';
import SleepPSA from '../SleepPSA.jsx';
import RhythmsForToday from '../RhythmsForToday.jsx';
import QuickStart from '../QuickStart.jsx';
import { emit, EVENTS } from '../../services/events.js';
import { log as telemetryLog } from '../../services/telemetry.js';
import { formatYMD, hoursLeftToday } from '../../utils/time.js';

/**
 * One day, three lenses, one stage. Wheel and spiral are the same helix
 * at t=0 and t=1; blocks is that helix dropped into a column. The stage
 * stays mounted across lens changes so the schedule morphs instead of
 * being swapped out. All three share the side column.
 */
export default function DayScreen({
  lens,
  selectedDate,
  viewKey,
  state,
  api,
  derived,
  filteredState,
  filteredDerived,
  rowHandlers,
  actions,
  selectedSlotId,
  onSelectWedge,
  recentRollover,
  setRecentRollover,
  onPickDate,
  onOpenLibrary,
  showQuickStart,
  onQuickStart,
}) {
  const { handleToggle, handleDelete, handleTaskMoveToSlot, handlePlaceOnDate } = actions;
  const slots = state.slots || [];
  const tasks = state.tasks || [];
  const daySlots = slots.filter(s => s.date === viewKey);

  const sideColumn = (
    <aside className="tm-dash-side">
      <RightNow
        currentSlot={filteredDerived.currentSlot?.slot || null}
        currentTasks={filteredDerived.currentSlot?.tasks || []}
        nextSlot={filteredDerived.nextSlot?.slot || null}
        hoursLeft={hoursLeftToday(slots, viewKey, new Date())}
        inboxTasks={filteredDerived.backlog || []}
        onMoveTaskHere={handleTaskMoveToSlot}
        onToggle={handleToggle}
      />
      <InboxPanel
        tasks={filteredDerived.backlog || []}
        rowHandlers={{ onToggle: handleToggle, onDelete: handleDelete }}
        daySlots={daySlots}
        dayKey={viewKey}
        onPlaceInSlot={handleTaskMoveToSlot}
        onPlaceOnDate={handlePlaceOnDate}
      />
      <ComingUp
        tasks={tasks}
        selectedDate={selectedDate}
        recentRollover={recentRollover}
        onJumpToDate={(d) => {
          onPickDate(d);
          setRecentRollover(null);
          telemetryLog('ui:coming-up-jump', { date: formatYMD(d) });
        }}
        onToggle={handleToggle}
        daySlots={daySlots}
        dayKey={viewKey}
        onPlaceInSlot={handleTaskMoveToSlot}
        onPlaceOnDate={handlePlaceOnDate}
      />
      <Snoozed
        tasks={tasks}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onPushTomorrow={(taskId, when) => {
          const base = when || new Date();
          api.tasks.reschedule(taskId, new Date(base.getTime() + 86400000).toISOString(), null);
          telemetryLog('ui:snoozed-push-tomorrow', { id: taskId });
        }}
        daySlots={daySlots}
        dayKey={viewKey}
        onPlaceInSlot={handleTaskMoveToSlot}
        onPlaceOnDate={handlePlaceOnDate}
      />
      <SleepPSA slots={slots} dateKey={viewKey} />
    </aside>
  );

  return (
    <>
      <RhythmsForToday dateKey={viewKey} existingSlots={slots} api={api} />
      {showQuickStart && <QuickStart onPick={onQuickStart} />}

      <div className="tm-dash">
        <div className="tm-dash-main">
          <WheelView
            selectedDate={selectedDate}
            wedges={derived.wedges}
            nowTask={derived.nowTask}
            upcoming={filteredDerived.upcoming}
            pushed={filteredDerived.pushed}
            slots={slots}
            allTasks={filteredState.tasks || []}
            taskTypes={state.taskTypes || []}
            todayTasks={filteredDerived.todayTasks}
            wheels={derived.wheels}
            dayAssignments={derived.dayAssignments}
            dayOverrides={derived.dayOverrides}
            resolveDay={derived.resolveDay}
            api={api}
            rowHandlers={rowHandlers}
            onNavigate={() => {}}
            onOpenWheels={() => onOpenLibrary('schedules')}
            selectedSlotId={selectedSlotId}
            onSelectWedge={(slot) => {
              onSelectWedge(slot);
              if (slot) emit(EVENTS.SLOT_SELECTED, { slotId: slot.id });
            }}
            lens={lens}
            onPickDate={onPickDate}
          />
          {lens === 'blocks' && (
            <LooseEnds
              tasks={filteredState.tasks || []}
              slots={slots}
              date={selectedDate}
              api={api}
              rowHandlers={rowHandlers}
              onPlaceOnDate={handlePlaceOnDate}
            />
          )}
          <DailyWrap
            selectedDate={selectedDate}
            slots={slots}
            tasks={tasks}
            taskTypes={state.taskTypes || []}
          />
        </div>
        {sideColumn}
      </div>
    </>
  );
}
