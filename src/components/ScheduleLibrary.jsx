import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import HistoricalFiguresGantt from './HistoricalFiguresGantt.jsx';
import { getLikes, toggleLike } from '../utils/community.js';

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

const INSPIRATION_EXAMPLES = [
  {
    id: 'elon',
    title: 'Elon Musk',
    summary: 'High-output days with tightly managed work blocks.',
    scheduleIds: ['elon-musk', 'elon_musk']
  },
  {
    id: 'maya',
    title: 'Maya Angelou',
    summary: 'Long, distraction-free creative sessions built around writing.',
    scheduleIds: ['maya-angelou', 'maya_angelou']
  },
  {
    id: 'oprah',
    title: 'Oprah Winfrey',
    summary: 'Wellness-first mornings with balanced work and reflection.',
    scheduleIds: ['oprah-winfrey']
  }
];

const SCHEDULE_COPY = {
  heroEyebrow: 'Schedule templates',
  heroTitle: 'Find a routine that fits your life.',
  heroCopy: 'Start with an example schedule from people you know, then browse all templates or build your own.',
  heroPrimaryCta: 'Browse Templates',
  heroSecondaryCta: 'Continue to Tasks',
  journeySteps: [
    'Get inspired by an example schedule',
    'Choose or customize a full template',
    'Add tasks and let AI map your day'
  ],
  step1Title: 'Get inspired by a schedule, or create your own',
  step1Subtitle: 'Start with examples like Elon, Maya Angelou, and Oprah, or build a custom schedule from scratch.',
  step2Title: 'Pick your full schedule template',
  step2Subtitle: 'Explore famous schedules, community ideas, and your own custom routines.',
  step3Title: 'Enter tasks and let AI plan your day',
  step3Inactive: 'Activate a schedule template first, then continue to Tasks to auto-plan your day.',
  step3Active: (scheduleName) =>
    `You are currently following "${scheduleName}". Add tasks now and AI will place them into this schedule.`,
  searchPlaceholder: 'Search schedules...',
  reviewActiveButton: 'Review Active Schedule',
  modalLaunchTasksButton: 'Activate and Continue to Tasks'
};

function ScheduleLibrary({ onNavigateToTasks }) {
  const [state, dispatch] = useAppContext();
  const [schedules, setSchedules] = useState([]);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [scheduleToCustomize, setScheduleToCustomize] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'chronomap'
  const [notification, setNotification] = useState(null);
  const [applyDateRange, setApplyDateRange] = useState(null); // { startDate, endDate }
  const templatesSectionRef = useRef(null);

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

  const activeSchedule = useMemo(
    () => schedules.find(schedule => schedule.id === activeScheduleId) || null,
    [schedules, activeScheduleId]
  );

  const inspirationSchedules = useMemo(
    () => INSPIRATION_EXAMPLES.map((example) => {
      const directMatch = schedules.find((schedule) => example.scheduleIds.includes(schedule.id));
      if (directMatch) {
        return { ...example, schedule: directMatch };
      }

      const fuzzyMatch = schedules.find((schedule) => {
        const text = `${schedule.name || ''} ${schedule.author || ''}`.toLowerCase();
        return text.includes(example.title.toLowerCase());
      });

      return { ...example, schedule: fuzzyMatch || null };
    }),
    [schedules]
  );

  const scrollToTemplates = useCallback(() => {
    templatesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  function handleActivateSchedule(scheduleId, successMessage = null) {
    // Find the schedule object
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      showNotification('Could not find that schedule template.', 'warning');
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
    showNotification(successMessage || `"${schedule.name}" is now your active schedule!`);
  }

  function handleInspirationSelect(schedule) {
    if (!schedule) {
      showNotification('That inspiration schedule is not available yet.', 'warning');
      return;
    }

    setFilter('all');
    setSearchTerm('');
    handleActivateSchedule(schedule.id, `"${schedule.name}" is now your active schedule.`);
    setSelectedSchedule(schedule);
  }

  // Apply schedule blocks to a date range
  function handleApplyToCalendar(schedule, startDate, endDate) {
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
      showNotification(`Applied ${blocks.length} time blocks to your calendar!`);
      setApplyDateRange(null);
    } else {
      showNotification('No blocks to apply for the selected date range', 'warning');
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
      {/* Notification Toast */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type] || ''}`}>
          {notification.type === 'success' && '✓ '}
          {notification.type === 'warning' && '⚠ '}
          {notification.message}
        </div>
      )}
      
      <section className={styles.storyHero}>
        <p className={styles.storyEyebrow}>{SCHEDULE_COPY.heroEyebrow}</p>
        <h1>{SCHEDULE_COPY.heroTitle}</h1>
        <p className={styles.storyCopy}>{SCHEDULE_COPY.heroCopy}</p>
        <div className={styles.storyActions}>
          <button type="button" className={styles.storyPrimaryButton} onClick={scrollToTemplates}>
            {SCHEDULE_COPY.heroPrimaryCta}
          </button>
          <button
            type="button"
            className={styles.storySecondaryButton}
            onClick={() => onNavigateToTasks?.()}
            disabled={!onNavigateToTasks || !activeScheduleId}
          >
            {SCHEDULE_COPY.heroSecondaryCta}
          </button>
        </div>
        <div className={styles.journeySteps}>
          <div className={styles.journeyStep}><span>1</span>{SCHEDULE_COPY.journeySteps[0]}</div>
          <div className={styles.journeyStep}><span>2</span>{SCHEDULE_COPY.journeySteps[1]}</div>
          <div className={styles.journeyStep}><span>3</span>{SCHEDULE_COPY.journeySteps[2]}</div>
        </div>
      </section>

      <section className={styles.foundationSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.stepBadge}>Step 1</span>
          <h2>{SCHEDULE_COPY.step1Title}</h2>
          <p>{SCHEDULE_COPY.step1Subtitle}</p>
        </div>
        <div className={styles.foundationGrid}>
          {inspirationSchedules.map((example) => {
            const schedule = example.schedule;
            const isSelected = schedule?.id === activeScheduleId;

            return (
              <button
                key={example.id}
                type="button"
                className={`${styles.foundationCard} ${isSelected ? styles.foundationCardSelected : ''}`}
                onClick={() => handleInspirationSelect(schedule)}
              >
                <h3>{example.title}</h3>
                <p>{example.summary}</p>
                <div className={styles.foundationRecommendation}>
                  {schedule ? `Template: ${schedule.name}` : 'Template unavailable'}
                </div>
                <span className={styles.foundationAction}>
                  {isSelected ? 'Selected' : 'Use this schedule'}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={styles.foundationCard}
            onClick={() => {
              setScheduleToCustomize(null);
              setShowBuilder(true);
            }}
          >
            <h3>Create Your Own</h3>
            <p>Start from scratch and build a schedule that matches your life.</p>
            <div className={styles.foundationRecommendation}>
              Open the schedule builder to define your own time blocks.
            </div>
            <span className={styles.foundationAction}>Create custom schedule</span>
          </button>
        </div>
      </section>

      <section className={styles.templatesSection} ref={templatesSectionRef}>
        <div className={styles.header}>
          <div>
            <span className={styles.stepBadge}>Step 2</span>
            <h2>{SCHEDULE_COPY.step2Title}</h2>
            <p>{SCHEDULE_COPY.step2Subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                Grid
              </button>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'chronomap' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('chronomap')}
                title="ChronoMap View"
              >
                ChronoMap
              </button>
            </div>
            <button className={styles.activateButton} onClick={() => setShowBuilder(true)}>Create Schedule</button>
          </div>
        </div>

        {viewMode === 'chronomap' ? (
          <HistoricalFiguresGantt />
        ) : (
          <>
            <div className={styles.controls}>
              <input
                type="text"
                placeholder={SCHEDULE_COPY.searchPlaceholder}
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
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ marginLeft: 12 }}>
                  <option value="default">Sort: Default</option>
                  <option value="most_liked">Sort: Most Liked</option>
                </select>
              </div>
            </div>

            <div className={styles.scheduleGrid}>
              {sortedSchedules.map(schedule => renderScheduleCard(schedule))}
            </div>
          </>
        )}
      </section>

      <section className={styles.tasksCtaSection}>
        <div>
          <span className={styles.stepBadge}>Step 3</span>
          <h3>{SCHEDULE_COPY.step3Title}</h3>
          <p>
            {activeSchedule
              ? SCHEDULE_COPY.step3Active(activeSchedule.name)
              : SCHEDULE_COPY.step3Inactive}
          </p>
        </div>
        <div className={styles.tasksCtaActions}>
          <button
            type="button"
            className={styles.activateButton}
            onClick={() => onNavigateToTasks?.()}
            disabled={!onNavigateToTasks || !activeScheduleId}
          >
            {SCHEDULE_COPY.heroSecondaryCta}
          </button>
          {activeSchedule && (
            <button
              type="button"
              className={styles.previewButton}
              onClick={() => setSelectedSchedule(activeSchedule)}
            >
              {SCHEDULE_COPY.reviewActiveButton}
            </button>
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

            {/* Apply to Calendar Section */}
            <div className={styles.applyToCalendarSection}>
              <h4>Apply to Calendar</h4>
              <p className={styles.applyDescription}>
                Apply this schedule's time blocks to your calendar for a date range.
              </p>
              <div className={styles.dateRangePicker}>
                <label>
                  Start Date
                  <input 
                    type="date" 
                    value={applyDateRange?.startDate || format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setApplyDateRange(prev => ({ 
                      ...prev, 
                      startDate: e.target.value,
                      endDate: prev?.endDate || format(addDays(new Date(e.target.value), 6), 'yyyy-MM-dd')
                    }))}
                  />
                </label>
                <label>
                  End Date
                  <input 
                    type="date" 
                    value={applyDateRange?.endDate || format(addDays(new Date(), 6), 'yyyy-MM-dd')}
                    onChange={(e) => setApplyDateRange(prev => ({ 
                      ...prev, 
                      endDate: e.target.value 
                    }))}
                  />
                </label>
                <button 
                  className={styles.applyButton}
                  onClick={() => handleApplyToCalendar(
                    selectedSchedule, 
                    applyDateRange?.startDate || format(new Date(), 'yyyy-MM-dd'),
                    applyDateRange?.endDate || format(addDays(new Date(), 6), 'yyyy-MM-dd')
                  )}
                >
                  Apply to Calendar
                </button>
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
              {onNavigateToTasks && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSchedule.id !== activeScheduleId) {
                      handleActivateSchedule(selectedSchedule.id);
                    }
                    onNavigateToTasks();
                  }}
                  className={styles.launchTasksButton}
                >
                  {SCHEDULE_COPY.modalLaunchTasksButton}
                </button>
              )}
              <button
                onClick={() => {
                  setScheduleToCustomize(selectedSchedule);
                  setShowBuilder(true);
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
                    setSchedules([...FAMOUS_SCHEDULES, ...ENHANCED_FAMOUS_SCHEDULES, ...custom]);
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
