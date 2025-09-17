import { useState, useEffect } from 'react';
import { 
  FAMOUS_SCHEDULES, 
  getSchedulesFromLocalStorage, 
  setActiveSchedule,
  getActiveSchedule,
  ACTIVITY_TYPES,
  saveScheduleToLocalStorage 
} from '../utils/scheduleTemplates.js';
import styles from './ScheduleLibrary.module.css';
import CircularSchedule from './CircularSchedule.jsx';
import ScheduleBuilder from './ScheduleBuilder.jsx';
import ScheduleDiscussion from './ScheduleDiscussion.jsx';

function ScheduleLibrary() {
  const [schedules, setSchedules] = useState([]);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    // Load schedules from localStorage and famous templates
    const customSchedules = getSchedulesFromLocalStorage();
    const allSchedules = [...FAMOUS_SCHEDULES, ...customSchedules];
    setSchedules(allSchedules);
    
    // Get active schedule
    const active = getActiveSchedule();
    if (active) {
      setActiveScheduleId(active.id);
    }
  }, []);

  const filteredSchedules = schedules.filter(schedule => {
    // Filter by search term
    if (searchTerm && !schedule.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !schedule.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !schedule.author.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Filter by category
    if (filter === 'famous' && schedule.isCustom) return false;
    if (filter === 'custom' && !schedule.isCustom) return false;
    if (filter === 'community' && !schedule.author.includes('Community')) return false;
    
    return true;
  });

  function handleActivateSchedule(scheduleId) {
    setActiveSchedule(scheduleId);
    setActiveScheduleId(scheduleId);
    // No full reload; future scheduling reads active schedule from storage
  }

  function renderTimeBlock(block) {
    const activityType = ACTIVITY_TYPES[block.type.toUpperCase()] || ACTIVITY_TYPES.BUFFER;
    return (
      <div 
        key={`${block.start}-${block.end}`}
        className={styles.timeBlock}
        style={{ backgroundColor: activityType.color + '20', borderLeft: `4px solid ${activityType.color}` }}
      >
        <div className={styles.timeRange}>
          {activityType.icon} {block.start} - {block.end}
        </div>
        <div className={styles.blockLabel}>{block.label}</div>
        {block.description && (
          <div className={styles.blockDescription}>{block.description}</div>
        )}
      </div>
    );
  }

  function renderScheduleCard(schedule) {
    const isActive = schedule.id === activeScheduleId;
    
    return (
      <div 
        key={schedule.id} 
        className={`${styles.scheduleCard} ${isActive ? styles.active : ''}`}
        onClick={() => setSelectedSchedule(schedule)}
      >
        <div className={styles.cardHeader}>
          <h3>{schedule.name}</h3>
          {isActive && <span className={styles.activeLabel}>Active</span>}
        </div>
        <div className={styles.cardPreview}
             aria-label={`Preview of ${schedule.name} as a 24-hour circle`}>
          <CircularSchedule timeBlocks={schedule.timeBlocks} showLegend={false} title={''} />
        </div>
        <p className={styles.author}>by {schedule.author}</p>
        <p className={styles.description}>{schedule.description}</p>
        <div className={styles.tags}>
          {schedule.tags?.map(tag => (
            <span key={tag} className={styles.tag}>#{tag}</span>
          ))}
        </div>
        <div className={styles.cardActions}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSchedule(schedule);
            }}
            className={styles.previewButton}
          >
            Preview
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleActivateSchedule(schedule.id);
            }}
            className={styles.activateButton}
            disabled={isActive}
          >
            {isActive ? 'Active' : 'Activate'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Schedule Library</h2>
        <p>Choose a schedule template that fits your lifestyle</p>
        <div>
          <button className={styles.activateButton} onClick={() => setShowBuilder(true)}>Create Schedule</button>
        </div>
      </div>

      <div className={styles.controls}>
        <input 
          type="text"
          placeholder="Search schedules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.filters}>
          <button 
            className={filter === 'all' ? styles.filterActive : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'famous' ? styles.filterActive : ''}
            onClick={() => setFilter('famous')}
          >
            Famous People
          </button>
          <button 
            className={filter === 'community' ? styles.filterActive : ''}
            onClick={() => setFilter('community')}
          >
            Community
          </button>
          <button 
            className={filter === 'custom' ? styles.filterActive : ''}
            onClick={() => setFilter('custom')}
          >
            My Schedules
          </button>
        </div>
      </div>

      <div className={styles.scheduleGrid}>
        {filteredSchedules.map(schedule => renderScheduleCard(schedule))}
      </div>

      {/* Schedule Preview Modal */}
      {selectedSchedule && (
        <div className={styles.modal} onClick={() => setSelectedSchedule(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{selectedSchedule.name}</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setSelectedSchedule(null)}
              >
                ×
              </button>
            </div>
            <p className={styles.modalAuthor}>by {selectedSchedule.author}</p>
            <p className={styles.modalDescription}>{selectedSchedule.description}</p>
            
            <div className={styles.timelineContainer}>
              <h3>Daily Timeline</h3>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <CircularSchedule timeBlocks={selectedSchedule.timeBlocks} showLegend={true} title={'24h view'} />
                <div className={styles.timeline}>
                  {selectedSchedule.timeBlocks.map(block => renderTimeBlock(block))}
                </div>
              </div>
            </div>

            <ScheduleDiscussion scheduleId={selectedSchedule.id} />

            <div className={styles.modalActions}>
              <button 
                onClick={() => handleActivateSchedule(selectedSchedule.id)}
                className={styles.modalActivateButton}
                disabled={selectedSchedule.id === activeScheduleId}
              >
                {selectedSchedule.id === activeScheduleId ? 'Currently Active' : 'Activate This Schedule'}
              </button>
              <button 
                onClick={() => {
                  // TODO: Implement clone/customize functionality
                  alert('Customize feature coming soon!');
                }}
                className={styles.customizeButton}
              >
                Customize
              </button>
              {selectedSchedule.isCustom && selectedSchedule.author !== 'Community' && (
                <button
                  onClick={() => {
                    const updated = { ...selectedSchedule, author: 'Community', communityUploadedAt: new Date().toISOString() };
                    saveScheduleToLocalStorage(updated);
                    const custom = getSchedulesFromLocalStorage();
                    setSchedules([...FAMOUS_SCHEDULES, ...custom]);
                    setSelectedSchedule(updated);
                    alert('Uploaded to Community');
                  }}
                  className={styles.activateButton}
                >
                  Upload to Community
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBuilder && (
        <ScheduleBuilder 
          onClose={() => setShowBuilder(false)}
          onCreated={(sched) => {
            setShowBuilder(false);
            const custom = getSchedulesFromLocalStorage();
            setSchedules([...FAMOUS_SCHEDULES, ...custom]);
            setSelectedSchedule(sched);
          }}
        />
      )}
    </div>
  );
}

export default ScheduleLibrary;
