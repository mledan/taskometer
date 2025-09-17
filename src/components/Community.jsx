import { useEffect, useMemo, useState } from 'react';
import styles from './ScheduleLibrary.module.css';
import { FAMOUS_SCHEDULES, getSchedulesFromLocalStorage } from '../utils/scheduleTemplates.js';
import CircularSchedule from './CircularSchedule.jsx';
import { getLikes, toggleLike } from '../utils/community.js';

function Community() {
  const [schedules, setSchedules] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most_liked');

  useEffect(() => {
    const all = [...FAMOUS_SCHEDULES, ...getSchedulesFromLocalStorage()].filter(s => s.author && s.author.includes('Community'));
    setSchedules(all);
  }, []);

  const withLikes = useMemo(() => schedules.map(s => ({ ...s, _likes: getLikes(s.id) })), [schedules]);
  const filtered = withLikes.filter(s => {
    const hay = (s.name + ' ' + s.description + ' ' + (s.tags||[]).join(' ')).toLowerCase();
    return hay.includes(search.toLowerCase());
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'most_liked') return (b._likes?.count||0) - (a._likes?.count||0);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.container}>
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
          return (
            <div key={s.id} className={styles.scheduleCard}>
              <div className={styles.cardHeader}>
                <h3>{s.name}</h3>
                <span className={styles.activeLabel}>Community</span>
              </div>
              <div className={styles.cardPreview}>
                <CircularSchedule timeBlocks={s.timeBlocks} showLegend={false} title={''} />
              </div>
              <p className={styles.author}>by {s.author}</p>
              <p className={styles.description}>{s.description}</p>
              <div className={styles.tags}>
                {s.tags?.map(t => <span key={t} className={styles.tag}>#{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <button className={styles.previewButton} onClick={() => { toggleLike(s.id); setSchedules(prev => [...prev]); }}>
                  {likes.liked ? '❤️' : '🤍'} {likes.count}
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


