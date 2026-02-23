import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import {
  FAMOUS_SCHEDULES,
  getSchedulesFromLocalStorage,
  setActiveSchedule as setActiveScheduleStorage,
  getActiveSchedule,
  ACTIVITY_TYPES,
  saveScheduleToLocalStorage
} from '../utils/scheduleTemplates.js';
import {
  ENHANCED_FAMOUS_SCHEDULES,
  applyTemplateToDateRange
} from '../utils/enhancedTemplates.js';
import { useAppContext, ACTION_TYPES } from '../context/AppContext.jsx';
import styles from './ScheduleLibrary.module.css';
import CircularSchedule from './CircularSchedule.jsx';
import ScheduleBuilder from './ScheduleBuilder.jsx';
import ScheduleDiscussion from './ScheduleDiscussion.jsx';
import { getLikes, toggleLike } from '../utils/community.js';
import { buildTemplateApplicationSummary } from '../utils/templateApplicationSummary.js';

function CardDescription({ text = '' }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 140;
  if (!text) return null;
  const isLong = text.length > limit;
  const display = expanded || !isLong ? text : text.slice(0, limit) + '…';
  return (
    <p className={styles.description}>
      {display}
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className={styles.previewButton}
          style={{ marginLeft: 8 }}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </p>
  );
}

function timeToMinutes(timeString) {
  if (!timeString || !timeString.includes(':')) return 0;
  const [h, m] = timeString.split(':').map(Number);
  return (h * 60) + m;
}

function getScheduleSnapshot(schedule) {
  const blocks = schedule?.timeBlocks || [];
  if (blocks.length === 0) {
    return {
      blockCount: 0,
      firstStart: '--:--',
      categoryCount: 0
    };
  }

  const sortedByStart = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const categories = new Set(blocks.map((block) => block.type || block.category || 'custom'));

  return {
    blockCount: blocks.length,
    firstStart: sortedByStart[0]?.start || '--:--',
    categoryCount: categories.size
  };
}

function ScheduleLibrary({ onNavigateToTasks, onNavigateToDefaults }) {
  const [state, dispatch] = useAppContext();
  const [schedules, setSchedules] = useState([]);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [scheduleToCustomize, setScheduleToCustomize] = useState(null);
  const [notification, setNotification] = useState(null);
  // Show notification helper
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    // Load schedules from localStorage and famous templates
    const customSchedules = getSchedulesFromLocalStorage();
    const allSchedules = [...FAMOUS_SCHEDULES, ...ENHANCED_FAMOUS_SCHEDULES, ...customSchedules];
    setSchedules(allSchedules);
    
    // Get active schedule - prefer context, fall back to localStorage
    const contextActiveId = state.activeScheduleId;
    const active = contextActiveId 
      ? allSchedules.find(s => s.id === contextActiveId) 
      : getActiveSchedule();
    if (active) {
      setActiveScheduleId(active.id);
    }
    // Deep link support: ?schedule=ID opens modal
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('schedule');
    if (targetId) {
      const match = allSchedules.find(s => s.id === targetId);
      if (match) setSelectedSchedule(match);
    }
  }, [state.activeScheduleId]);


  const filteredSchedules = schedules.filter(schedule => {
    // Filter by search term
    const normalizedSearchTerm = searchTerm.trim().replace(/^#/, '').toLowerCase();
    if (normalizedSearchTerm) {
      const searchableText = [
        schedule.name,
        schedule.description,
        schedule.author,
        ...(schedule.tags || [])
      ]
        .join(' ')
        .toLowerCase();
      if (!searchableText.includes(normalizedSearchTerm)) {
        return false;
      }
    }
    
    // Filter by category
    if (filter === 'famous' && schedule.isCustom) return false;
    if (filter === 'custom' && !schedule.isCustom) return false;
    if (filter === 'community' && !(schedule.author || '').includes('Community')) return false;
    
    return true;
  }).map(s => ({ ...s, _likes: getLikes(s.id) }));

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortBy === 'most_liked') {
      return (b._likes?.count || 0) - (a._likes?.count || 0);
    }
    return 0;
  });

  function handleActivateSchedule(scheduleId, options = {}) {
    const normalizedOptions = typeof options === 'string'
      ? { successMessage: options }
      : options;
    const { successMessage = null, silent = false } = normalizedOptions;

    // Find the schedule object
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      if (!silent) {
        showNotification('Could not find that schedule template.', 'warning');
      }
      return;
    }
    
    // Update localStorage for backwards compatibility
    setActiveScheduleStorage(scheduleId);
    
    // Dispatch to AppContext so auto-scheduling uses this schedule
    dispatch({
      type: ACTION_TYPES.SET_ACTIVE_SCHEDULE,
      payload: { schedule, scheduleId }
    });
    
    setActiveScheduleId(scheduleId);
    if (!silent) {
      showNotification(successMessage || `"${schedule.name}" is now your active schedule!`);
    }
  }

  // Apply schedule blocks to a date range
  function handleApplyToCalendar(schedule, startDate, endDate, options = {}) {
    const { source = 'schedule-library', activate = true } = options;
    if (!schedule || !startDate || !endDate) return;
    
    const blocks = applyTemplateToDateRange(schedule, startDate, endDate);
    
    if (blocks.length > 0) {
      dispatch({
        type: ACTION_TYPES.APPLY_SCHEDULE,
        payload: { 
          blocks,
          options: { mergeWithExisting: true }
        }
      });

      if (activate) {
        handleActivateSchedule(schedule.id, { silent: true });
      }

      const applicationSummary = buildTemplateApplicationSummary({
        schedule,
        blocks,
        startDate,
        endDate,
        source
      });

      dispatch({
        type: ACTION_TYPES.UPDATE_SETTINGS,
        payload: {
          lastTemplateApplication: applicationSummary
        }
      });

      showNotification(`Applied ${blocks.length} labeled slots from "${schedule.name}". Add your tasks and auto-plan into these windows.`);
    } else {
      showNotification('No blocks to apply for the selected date range', 'warning');
    }
  }

  function handleQuickApply(schedule, shouldNavigateToTasks = false) {
    const startDate = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), 6), 'yyyy-MM-dd');
    handleApplyToCalendar(schedule, startDate, endDate, { source: 'quick-apply', activate: true });

    if (shouldNavigateToTasks && onNavigateToTasks) {
      onNavigateToTasks();
    }
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
    const likes = schedule._likes || { count: 0, liked: false };
    const snapshot = getScheduleSnapshot(schedule);
    
    return (
      <div 
        key={schedule.id} 
        className={`${styles.scheduleCard} ${isActive ? styles.scheduleCardActive : ''}`}
        onClick={() => setSelectedSchedule(schedule)}
      >
        <div className={styles.cardHeader}>
          <h3>{schedule.name}</h3>
          <div className={styles.cardHeaderBadges}>
            {isActive && <span className={styles.activeLabel}>Active</span>}
          </div>
        </div>
        <div className={styles.cardPreview}
             aria-label={`Preview of ${schedule.name} as a 24-hour circle`}>
          <CircularSchedule timeBlocks={schedule.timeBlocks} showLegend={false} showNow={false} title={''} />
        </div>
        <p className={styles.author}>by {schedule.author}</p>
        <div className={styles.scheduleStats}>
          <span>{snapshot.blockCount} blocks</span>
          <span>Starts {snapshot.firstStart}</span>
          <span>{snapshot.categoryCount} categories</span>
        </div>
        <CardDescription text={schedule.description} />
        <div className={styles.tags}>
          {schedule.tags?.map(tag => (
            <button
              key={tag}
              className={styles.tag}
              onClick={(e) => { e.stopPropagation(); setFilter('all'); setSearchTerm(tag.toLowerCase()); }}
              title={`Filter by #${tag}`}
            >
              #{tag}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(schedule.id);
              // Trigger refresh to reflect updated like counts
              setSchedules(prev => [...prev]);
            }}
            className={styles.previewButton}
            title={likes.liked ? 'Unlike' : 'Like'}
          >
            {likes.liked ? '❤️' : '🤍'} {likes.count}
          </button>
        </div>
        <div className={styles.cardActions}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickApply(schedule);
            }}
            className={styles.quickApplyButton}
          >
            Use Template
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSchedule(schedule);
            }}
            className={styles.previewButton}
          >
            Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Notification Toast */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type] || ''}`}>
          {notification.type === 'success' && '✓ '}
          {notification.type === 'warning' && '⚠ '}
          {notification.message}
        </div>
      )}
      <section className={styles.templatesSection}>
        <div className={styles.header}>
          <div>
            <h1>Schedule templates</h1>
            <p>Pick a template, activate it, and apply labeled time slots to your calendar.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.activateButton} onClick={() => setShowBuilder(true)}>
              Create Schedule
            </button>
            <button
              type="button"
              className={styles.previewButton}
              onClick={() => onNavigateToTasks?.()}
              disabled={!onNavigateToTasks || !activeScheduleId}
              title={activeScheduleId ? 'Go to Tasks tab' : 'Activate a schedule first'}
            >
              Continue to Tasks
            </button>
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
              Famous
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
              Mine
            </button>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginLeft: 12 }}>
              <option value="default">Sort: Default</option>
              <option value="most_liked">Sort: Most Liked</option>
            </select>
          </div>
        </div>

        <div className={styles.scheduleGrid}>
          {sortedSchedules.map(schedule => renderScheduleCard(schedule))}
          {sortedSchedules.length === 0 && (
            <div className={styles.foundationSummary}>
              No schedules match your filters.
            </div>
          )}
        </div>
      </section>

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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button
                className={styles.previewButton}
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('schedule', selectedSchedule.id);
                  navigator.clipboard.writeText(url.toString());
                  alert('Link copied to clipboard');
                }}
              >
                Copy link
              </button>
            </div>
            <p className={styles.modalAuthor}>by {selectedSchedule.author}</p>
            <p className={styles.modalDescription}>{selectedSchedule.description}</p>
            
            <div className={styles.timelineContainer}>
              <h3>Daily Timeline</h3>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <CircularSchedule timeBlocks={selectedSchedule.timeBlocks} showLegend={true} showNow={true} title={'24h view'} />
                <div className={styles.timeline}>
                  {selectedSchedule.timeBlocks.map(block => renderTimeBlock(block))}
                </div>
              </div>
            </div>

            <ScheduleDiscussion scheduleId={selectedSchedule.id} />

            <div className={styles.modalActions}>
              <button 
                className={styles.applyButton}
                onClick={() => {
                  handleQuickApply(selectedSchedule);
                  setSelectedSchedule(null);
                }}
              >
                Use This Template
              </button>
              <button
                onClick={() => {
                  setScheduleToCustomize(selectedSchedule);
                  setShowBuilder(true);
                }}
                className={styles.customizeButton}
              >
                Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuilder && (
        <ScheduleBuilder
          initialSchedule={scheduleToCustomize}
          onClose={() => {
            setShowBuilder(false);
            setScheduleToCustomize(null);
          }}
          onCreated={(sched) => {
            setShowBuilder(false);
            setScheduleToCustomize(null);
            const custom = getSchedulesFromLocalStorage();
            setSchedules([...FAMOUS_SCHEDULES, ...ENHANCED_FAMOUS_SCHEDULES, ...custom]);
            setSelectedSchedule(sched);
          }}
        />
      )}
    </div>
  );
}

export default ScheduleLibrary;
