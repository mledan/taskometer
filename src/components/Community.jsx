import { useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import styles from './ScheduleLibrary.module.css';
import {
  FAMOUS_SCHEDULES,
  getSchedulesFromLocalStorage,
  setActiveSchedule as setActiveScheduleStorage
} from '../utils/scheduleTemplates.js';
import { ENHANCED_FAMOUS_SCHEDULES, applyTemplateToDateRange } from '../utils/enhancedTemplates.js';
import CircularSchedule from './CircularSchedule.jsx';
import { getLikes, toggleLike } from '../utils/community.js';
import { ACTION_TYPES, useAppContext } from '../context/AppContext.jsx';

function Community() {
  const [state, dispatch] = useAppContext();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most_liked');
  const [likesVersion, setLikesVersion] = useState(0);
  const [message, setMessage] = useState(null);

  const schedules = useMemo(() => {
    return [...FAMOUS_SCHEDULES, ...ENHANCED_FAMOUS_SCHEDULES, ...getSchedulesFromLocalStorage()]
      .filter(s => s.author && s.author.includes('Community'));
  }, [state.activeScheduleId, likesVersion]);

  const withLikes = useMemo(
    () => schedules.map(s => ({ ...s, _likes: getLikes(s.id) })),
    [schedules, likesVersion]
  );
  const filtered = withLikes.filter(s => {
    const hay = (s.name + ' ' + s.description + ' ' + (s.tags||[]).join(' ')).toLowerCase();
    return hay.includes(search.toLowerCase());
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'most_liked') return (b._likes?.count||0) - (a._likes?.count||0);
    return a.name.localeCompare(b.name);
  });

  function handleActivateSchedule(schedule) {
    setActiveScheduleStorage(schedule.id);
    dispatch({
      type: ACTION_TYPES.SET_ACTIVE_SCHEDULE,
      payload: { schedule, scheduleId: schedule.id }
    });
    setMessage(`Activated "${schedule.name}"`);
    setTimeout(() => setMessage(null), 2500);
  }

  function handleApplySchedule(schedule) {
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 6);
    const blocks = applyTemplateToDateRange(
      schedule,
      format(weekStart, 'yyyy-MM-dd'),
      format(weekEnd, 'yyyy-MM-dd')
    );

    if (blocks.length === 0) {
      setMessage('No blocks available for this week');
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    dispatch({
      type: ACTION_TYPES.APPLY_SCHEDULE,
      payload: {
        blocks,
        options: { mergeWithExisting: true }
      }
    });
    setMessage(`Applied ${blocks.length} blocks from "${schedule.name}"`);
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className={styles.container}>
      {message && <div className={`${styles.notification} ${styles.success}`}>{message}</div>}
      <div className={styles.header}>
        <h2>Community Schedules</h2>
        <p>Discover and discuss schedules shared by the community</p>
      </div>
      <div className={styles.controls}>
        <input className={styles.searchInput} placeholder="Search community..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="most_liked">Sort: Most Liked</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>
      <div className={styles.scheduleGrid}>
        {sorted.map(s => {
          const likes = s._likes || { count: 0, liked: false };
          const isActive = s.id === state.activeScheduleId;
          return (
            <div key={s.id} className={styles.scheduleCard}>
              <div className={styles.cardHeader}>
                <h3>{s.name}</h3>
                <span className={styles.activeLabel}>{isActive ? 'Active' : 'Community'}</span>
              </div>
              <div className={styles.cardPreview}>
                <CircularSchedule timeBlocks={s.timeBlocks} showLegend={false} showNow={false} title={''} />
              </div>
              <p className={styles.author}>by {s.author}</p>
              <p className={styles.description}>{s.description}</p>
              <div className={styles.tags}>
                {s.tags?.map(t => <span key={t} className={styles.tag}>#{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <button className={styles.previewButton} onClick={() => { toggleLike(s.id); setLikesVersion(v => v + 1); }}>
                  {likes.liked ? '❤️' : '🤍'} {likes.count}
                </button>
                <button
                  className={styles.activateButton}
                  disabled={isActive}
                  onClick={() => handleActivateSchedule(s)}
                >
                  {isActive ? 'Active' : 'Activate'}
                </button>
                <button
                  className={styles.previewButton}
                  onClick={() => handleApplySchedule(s)}
                >
                  Apply This Week
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Community;


