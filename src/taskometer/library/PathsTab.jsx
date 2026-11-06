import { useMemo } from 'react';
import { MiniWheel } from '../WheelView.jsx';
import { PATHS } from '../../defaults/paths';
import { TASK_PACKS } from '../../defaults/taskPacks';
import { FAMOUS_WHEELS } from '../../defaults/famousWheels';
import { ARCHETYPE_WHEELS } from '../../defaults/scheduleArchetypes';
import { DEFAULT_WHEELS } from '../../defaults/defaultSchedule';

function findWheel(id) {
  if (!id) return null;
  return FAMOUS_WHEELS.find(w => w.id === id)
    || ARCHETYPE_WHEELS.find(w => w.id === id)
    || DEFAULT_WHEELS.find(w => w.id === id)
    || null;
}
const findPack = (id) => TASK_PACKS.find(p => p.id === id) || null;

/**
 * A Path is schedule + starter pack + duration adopted in one move:
 * paints the schedule across the stretch and drops the pack's tasks
 * into the inbox.
 */
export default function PathsTab({ onAdopt }) {
  const items = useMemo(() => PATHS.map(p => ({
    path: p,
    wheel: findWheel(p.schedule) || findWheel(p.fallbackSchedule),
    pack: findPack(p.pack),
  })).filter(x => x.wheel && x.pack), []);

  return (
    <div className="tm-library-tab">
      <p className="tm-library-lede tm-mono tm-md">
        a path = a schedule + a starter pack of tasks + a duration · pick one to adopt for the next stretch.
      </p>
      <div className="tm-picker-grid tm-picker-grid-wide">
        {items.map(({ path, wheel, pack }) => (
          <div key={path.id} className="tm-path-card">
            <div className="tm-routine-head">
              <span aria-hidden className="tm-path-icon">{path.icon}</span>
              <div className="tm-picker-card-body">
                <div className="tm-routine-name">{path.name}</div>
                <div className="tm-mono tm-sm">
                  {path.duration} day{path.duration === 1 ? '' : 's'}{path.weekdaysOnly ? ' · weekdays' : ''}
                </div>
              </div>
            </div>
            <div className="tm-routine-blurb">{path.blurb}</div>
            <div className="tm-path-part">
              <MiniWheel
                slots={(wheel.blocks || []).map(b => ({ startTime: b.startTime, endTime: b.endTime, color: b.color }))}
                size={36}
                thickness={5}
              />
              <div>
                <div className="tm-picker-eyebrow">Schedule</div>
                <div>{wheel.name}</div>
              </div>
            </div>
            <div className="tm-path-part">
              <span aria-hidden className="tm-path-part-icon">{pack.icon}</span>
              <div>
                <div className="tm-picker-eyebrow">Pack · {pack.tasks.length} tasks</div>
                <div>{pack.name}</div>
              </div>
            </div>
            <button type="button" className="tm-btn tm-primary tm-sm" onClick={() => onAdopt?.(path, wheel, pack)}>
              Adopt this path →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
