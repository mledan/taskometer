import { useState, useEffect } from 'react';
import { 
  FAMOUS_SCHEDULES, 
  getSchedulesFromLocalStorage, 
  setActiveSchedule,
  getActiveSchedule,
  ACTIVITY_TYPES 
} from '../utils/scheduleTemplates.js';
import styles from './ScheduleLibrary.module.css';

function ScheduleLibrary() {
  const [schedules, setSchedules] = useState([]);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);

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
    // Refresh the page to apply new schedule
    window.location.reload();
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
              <div className={styles.timeline}>
                {selectedSchedule.timeBlocks.map(block => renderTimeBlock(block))}
              </div>
            </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleLibrary;
