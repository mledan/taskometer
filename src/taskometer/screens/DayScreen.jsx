import React from 'react';
import WheelView from '../WheelView.jsx';
import BlockBoard from '../BlockBoard.jsx';
import SpiralBoard from '../SpiralBoard.jsx';
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
 * One day, three lenses. The wheel and blocks lenses share the side
 * column (right now / inbox / coming up / snoozed); the spiral carries
 * its own todo list so it takes the full width.
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
  const { handleToggle, handleDelete, handleTaskMoveToSlot, handleAddTask } = actions;
  const slots = state.slots || [];
  const tasks = state.tasks || [];

  const sideColumn = (
    <aside className="tm-dash-side">
      <RightNow
        currentSlot={filteredDerived.currentSlot?.slot || null}
        currentTasks={filteredDerived.currentSlot?.tasks || []}
        nextSlot={filteredDerived.nextSlot?.slot || null}
        hoursLeft={hoursLeftToday(slots, viewKey, new Date())}
        onMoveTaskHere={handleTaskMoveToSlot}
        onToggle={handleToggle}
      />
      <InboxPanel
        tasks={filteredDerived.backlog || []}
        rowHandlers={{ onToggle: handleToggle, onDelete: handleDelete }}
        onScheduleToDate={(taskId, dateKey) => {
          const [y, m, d] = dateKey.split('-').map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0);
          api.tasks.reschedule(taskId, dt.toISOString(), null);
          telemetryLog('ui:inbox-schedule-to-date', { date: dateKey });
        }}
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
        onReschedule={(taskId, iso) => {
          api.tasks.reschedule(taskId, iso, null);
          telemetryLog('ui:coming-up-reschedule', { id: taskId });
        }}
      />
      <Snoozed
        tasks={tasks}
        onReschedule={(taskId, iso) => {
          api.tasks.reschedule(taskId, iso, null);
          telemetryLog('ui:snoozed-reschedule', { id: taskId });
        }}
        onComplete={(taskId) => api.tasks.toggleComplete(taskId)}
        onPushTomorrow={(taskId, when) => {
          const base = when || new Date();
          api.tasks.reschedule(taskId, new Date(base.getTime() + 86400000).toISOString(), null);
        }}
        onDelete={(taskId) => api.tasks.remove(taskId)}
      />
      <SleepPSA slots={slots} dateKey={viewKey} />
    </aside>
  );

  return (
    <>
      <RhythmsForToday dateKey={viewKey} existingSlots={slots} api={api} />
      {showQuickStart && <QuickStart onPick={onQuickStart} />}

      {lens === 'spiral' ? (
        <SpiralBoard
          settings={state.settings || {}}
          slots={slots}
          tasks={filteredState.tasks || []}
          api={api}
          onAdd={handleAddTask}
        />
      ) : (
        <div className="tm-dash">
          <div className="tm-dash-main">
            {lens === 'blocks' ? (
              <BlockBoard
                tasks={filteredState.tasks || []}
                slots={slots}
                date={selectedDate}
                api={api}
                rowHandlers={rowHandlers}
              />
            ) : (
              <WheelView
                selectedDate={selectedDate}
                wedges={derived.wedges}
                nowTask={derived.nowTask}
                upcoming={filteredDerived.upcoming}
                pushed={filteredDerived.pushed}
                slots={slots}
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
      )}
    </>
  );
}
