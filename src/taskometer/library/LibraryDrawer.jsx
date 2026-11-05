import { useEffect, useRef, useState } from 'react';
import SchedulePickerBody from './SchedulePicker.jsx';
import ScheduleManager from './ScheduleManager.jsx';
import RoutinesTab from './RoutinesTab.jsx';
import PathsTab from './PathsTab.jsx';
import PacksTab from './PacksTab.jsx';

export const LIBRARY_TABS = [
  { id: 'schedules', label: 'Schedules', hint: 'day templates — yours and starters' },
  { id: 'routines', label: 'Routines', hint: 'famous daily routines, sourced' },
  { id: 'paths', label: 'Paths', hint: 'schedule + pack + duration, in one move' },
  { id: 'packs', label: 'Packs', hint: 'starter sets of tasks' },
];

/**
 * The one front door to everything that comes from outside the user's
 * own day: schedules, famous routines, paths, and task packs.
 */
export default function LibraryDrawer({
  tab,
  onTabChange,
  onClose,
  schedules,   // { wheels, currentWheelId, rangeContext, paintingDays, onApply, api, userWheels, taskTypes }
  routines,    // { onApply, dateLabel }
  paths,       // { onAdopt }
  packs,       // { onAddToInbox, onScheduleToday }
}) {
  const [manage, setManage] = useState(false);
  const panelRef = useRef(null);
  const painting = !!(schedules?.rangeContext || (schedules?.paintingDays && schedules.paintingDays.length));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus?.();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const active = LIBRARY_TABS.find(t => t.id === tab) || LIBRARY_TABS[0];

  return (
    <div className="tm-library-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside
        ref={panelRef}
        className="tm-library"
        role="dialog"
        aria-modal="true"
        aria-label="library"
        tabIndex={-1}
      >
        <header className="tm-library-head">
          <div>
            <div className="tm-library-title">Library</div>
            <div className="tm-mono tm-sm">{active.hint}</div>
          </div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose} aria-label="close library">close</button>
        </header>

        <div className="tm-library-tabs" role="tablist">
          {LIBRARY_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active.id === t.id}
              className={`tm-tab${active.id === t.id ? ' tm-active' : ''}`}
              onClick={() => onTabChange(t.id)}
              disabled={painting && t.id !== 'schedules'}
            >
              {t.label}
            </button>
          ))}
          {active.id === 'schedules' && !painting && (
            <div className="tm-seg tm-library-mode">
              <button type="button" className={!manage ? 'tm-on' : ''} onClick={() => setManage(false)}>pick</button>
              <button type="button" className={manage ? 'tm-on' : ''} onClick={() => setManage(true)}>manage</button>
            </div>
          )}
        </div>

        <div className="tm-library-body" role="tabpanel">
          {active.id === 'schedules' && (manage && !painting ? (
            <ScheduleManager api={schedules.api} wheels={schedules.userWheels} taskTypes={schedules.taskTypes} />
          ) : (
            <SchedulePickerBody
              wheels={schedules.wheels}
              currentWheelId={schedules.currentWheelId}
              rangeContext={schedules.rangeContext}
              paintingDays={schedules.paintingDays}
              onApply={schedules.onApply}
            />
          ))}
          {active.id === 'routines' && <RoutinesTab onApply={routines.onApply} dateLabel={routines.dateLabel} />}
          {active.id === 'paths' && <PathsTab onAdopt={paths.onAdopt} />}
          {active.id === 'packs' && <PacksTab onAddToInbox={packs.onAddToInbox} onScheduleToday={packs.onScheduleToday} />}
        </div>
      </aside>
    </div>
  );
}
