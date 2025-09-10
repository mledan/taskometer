// Schedule Template System
// All data stored in browser localStorage for now

export const SCHEDULE_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  YEARLY: 'yearly'
};

export const ACTIVITY_TYPES = {
  SLEEP: { id: 'sleep', name: 'Sleep/Rest', icon: '🛏️', color: '#6B46C1' },
  WORK: { id: 'work', name: 'Work/Career', icon: '💼', color: '#3B82F6' },
  MEALS: { id: 'meals', name: 'Meals/Nutrition', icon: '🍽️', color: '#F59E0B' },
  EXERCISE: { id: 'exercise', name: 'Exercise/Health', icon: '🏃', color: '#10B981' },
  LEARNING: { id: 'learning', name: 'Learning/Reading', icon: '📚', color: '#8B5CF6' },
  CREATIVE: { id: 'creative', name: 'Creative/Hobbies', icon: '🎨', color: '#EC4899' },
  SOCIAL: { id: 'social', name: 'Social/Family', icon: '👥', color: '#14B8A6' },
  MINDFULNESS: { id: 'mindfulness', name: 'Mindfulness/Meditation', icon: '🧘', color: '#84CC16' },
  CHORES: { id: 'chores', name: 'Chores/Admin', icon: '🏠', color: '#F97316' },
  RECREATION: { id: 'recreation', name: 'Recreation/Entertainment', icon: '🎮', color: '#06B6D4' },
  SIDE_PROJECT: { id: 'side_project', name: 'Side Projects', icon: '🚀', color: '#A855F7' },
  PLANNING: { id: 'planning', name: 'Planning/Review', icon: '📝', color: '#64748B' },
  BUFFER: { id: 'buffer', name: 'Buffer/Flex Time', icon: '⏰', color: '#94A3B8' }
};

// Famous schedule templates
export const FAMOUS_SCHEDULES = [
  {
    id: 'benjamin_franklin',
    name: "Benjamin Franklin's Daily Routine",
    description: "Early to bed, early to rise. Structured day with morning planning and evening reflection.",
    author: "Benjamin Franklin",
    tags: ['productivity', 'classic', 'structured', 'early_riser'],
    period: SCHEDULE_PERIODS.DAILY,
    timeBlocks: [
      { start: '05:00', end: '08:00', type: 'planning', label: 'Rise, wash, breakfast, plan day', description: 'What good shall I do this day?' },
      { start: '08:00', end: '12:00', type: 'work', label: 'Work', description: 'Morning work block' },
      { start: '12:00', end: '14:00', type: 'meals', label: 'Read, lunch', description: 'Midday break and nourishment' },
      { start: '14:00', end: '18:00', type: 'work', label: 'Work', description: 'Afternoon work block' },
      { start: '18:00', end: '21:00', type: 'social', label: 'Dinner, conversation, music', description: 'Evening relaxation and social time' },
      { start: '21:00', end: '22:00', type: 'planning', label: 'Reflection & planning', description: 'What good have I done today?' },
      { start: '22:00', end: '05:00', type: 'sleep', label: 'Sleep', description: '7 hours of rest' }
    ]
  },
  {
    id: 'maya_angelou',
    name: "Maya Angelou's Writing Routine",
    description: "Dedicated creative blocks with strict morning writing time in a bare room.",
    author: "Maya Angelou",
    tags: ['creative', 'writer', 'focused', 'morning_person'],
    period: SCHEDULE_PERIODS.DAILY,
    timeBlocks: [
      { start: '05:30', end: '06:30', type: 'planning', label: 'Morning routine', description: 'Coffee and preparation' },
      { start: '06:30', end: '14:00', type: 'creative', label: 'Writing time', description: 'Uninterrupted writing in hotel room' },
      { start: '14:00', end: '15:00', type: 'meals', label: 'Lunch', description: 'Break from writing' },
      { start: '15:00', end: '17:00', type: 'chores', label: 'Errands & admin', description: 'Handle daily tasks' },
      { start: '17:00', end: '19:00', type: 'social', label: 'Family time', description: 'Dinner preparation and family' },
      { start: '19:00', end: '20:00', type: 'meals', label: 'Dinner', description: 'Evening meal' },
      { start: '20:00', end: '22:00', type: 'learning', label: 'Reading & review', description: 'Review writing, read' },
      { start: '22:00', end: '05:30', type: 'sleep', label: 'Sleep', description: '7.5 hours of rest' }
    ]
  },
  {
    id: 'elon_musk',
    name: "Elon Musk's Time Blocks",
    description: "Intense schedule with 5-minute time blocks and minimal downtime.",
    author: "Elon Musk",
    tags: ['intense', 'entrepreneur', 'multitasking', 'minimal_sleep'],
    period: SCHEDULE_PERIODS.DAILY,
    timeBlocks: [
      { start: '07:00', end: '07:30', type: 'planning', label: 'Morning routine', description: 'Shower, coffee, news' },
      { start: '07:30', end: '12:00', type: 'work', label: 'Critical work', description: 'Most important tasks in 5-min blocks' },
      { start: '12:00', end: '12:30', type: 'meals', label: 'Working lunch', description: 'Lunch during meetings' },
      { start: '12:30', end: '17:00', type: 'work', label: 'Meetings & decisions', description: 'Back-to-back meetings' },
      { start: '17:00', end: '17:30', type: 'buffer', label: 'Buffer', description: 'Catch up on urgent items' },
      { start: '17:30', end: '19:00', type: 'work', label: 'Engineering time', description: 'Design and engineering work' },
      { start: '19:00', end: '19:30', type: 'meals', label: 'Dinner', description: 'Quick dinner' },
      { start: '19:30', end: '21:00', type: 'social', label: 'Family time', description: 'Time with kids' },
      { start: '21:00', end: '01:00', type: 'side_project', label: 'Email & planning', description: 'Emails and next day planning' },
      { start: '01:00', end: '07:00', type: 'sleep', label: 'Sleep', description: '6 hours of rest' }
    ]
  },
  {
    id: 'stephen_king',
    name: "Stephen King's Writing Schedule",
    description: "Consistent daily writing quota with structured creative time.",
    author: "Stephen King",
    tags: ['writer', 'consistent', 'creative', 'disciplined'],
    period: SCHEDULE_PERIODS.DAILY,
    timeBlocks: [
      { start: '08:00', end: '08:30', type: 'planning', label: 'Morning routine', description: 'Tea and vitamins' },
      { start: '08:30', end: '13:30', type: 'creative', label: 'Writing', description: '2000 words minimum' },
      { start: '13:30', end: '14:30', type: 'meals', label: 'Lunch', description: 'Break and nourishment' },
      { start: '14:30', end: '15:30', type: 'exercise', label: 'Walk', description: 'Daily 4-mile walk' },
      { start: '15:30', end: '18:00', type: 'learning', label: 'Reading', description: '4-6 hours of reading daily' },
      { start: '18:00', end: '19:00', type: 'meals', label: 'Dinner', description: 'Family dinner' },
      { start: '19:00', end: '22:00', type: 'social', label: 'Family time', description: 'TV and family' },
      { start: '22:00', end: '23:00', type: 'learning', label: 'Reading', description: 'Reading before bed' },
      { start: '23:00', end: '08:00', type: 'sleep', label: 'Sleep', description: '9 hours of rest' }
    ]
  },
  {
    id: 'balanced_tech_worker',
    name: "Balanced Tech Worker",
    description: "Modern schedule balancing remote work, health, and personal growth.",
    author: "Community",
    tags: ['balanced', 'tech', 'remote', 'healthy'],
    period: SCHEDULE_PERIODS.DAILY,
    timeBlocks: [
      { start: '07:00', end: '08:00', type: 'exercise', label: 'Morning exercise', description: 'Gym or yoga' },
      { start: '08:00', end: '09:00', type: 'meals', label: 'Breakfast & prep', description: 'Healthy breakfast and day prep' },
      { start: '09:00', end: '12:00', type: 'work', label: 'Deep work', description: 'Focus time - no meetings' },
      { start: '12:00', end: '13:00', type: 'meals', label: 'Lunch break', description: 'Lunch and walk' },
      { start: '13:00', end: '15:00', type: 'work', label: 'Meetings', description: 'Collaboration time' },
      { start: '15:00', end: '15:15', type: 'buffer', label: 'Break', description: 'Stretch and refresh' },
      { start: '15:15', end: '17:30', type: 'work', label: 'Project work', description: 'Implementation time' },
      { start: '17:30', end: '18:30', type: 'side_project', label: 'Personal project', description: 'Side hustle or learning' },
      { start: '18:30', end: '19:30', type: 'meals', label: 'Dinner', description: 'Cook and eat' },
      { start: '19:30', end: '21:00', type: 'recreation', label: 'Leisure', description: 'Hobbies, games, TV' },
      { start: '21:00', end: '22:00', type: 'mindfulness', label: 'Wind down', description: 'Reading, meditation' },
      { start: '22:00', end: '23:00', type: 'planning', label: 'Tomorrow prep', description: 'Review day, plan tomorrow' },
      { start: '23:00', end: '07:00', type: 'sleep', label: 'Sleep', description: '8 hours of rest' }
    ]
  }
];

// Helper functions
export function createScheduleTemplate(name, description, period, timeBlocks, tags = []) {
  return {
    id: `custom_${Date.now()}`,
    name,
    description,
    author: 'You',
    tags,
    period,
    timeBlocks,
    createdAt: new Date().toISOString(),
    isCustom: true
  };
}

export function validateTimeBlock(timeBlock) {
  const requiredFields = ['start', 'end', 'type', 'label'];
  return requiredFields.every(field => timeBlock[field]);
}

export function getTimeBlocksForDay(schedule, dayOfWeek = null) {
  // For now, return daily blocks
  // TODO: Handle weekly schedules with different days
  return schedule.timeBlocks;
}

export function findNextAvailableSlot(schedule, activityType, duration, currentTime = new Date()) {
  const timeBlocks = getTimeBlocksForDay(schedule);
  const relevantBlocks = timeBlocks.filter(block => block.type === activityType);
  
  for (const block of relevantBlocks) {
    const blockStart = parseTime(block.start);
    const blockEnd = parseTime(block.end);
    const blockDuration = blockEnd - blockStart;
    
    if (blockDuration >= duration) {
      // Check if this block is in the future
      if (blockStart > currentTime) {
        return {
          start: blockStart,
          end: new Date(blockStart.getTime() + duration * 60000)
        };
      }
    }
  }
  
  return null; // No available slot found
}

export function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Storage functions
export function saveScheduleToLocalStorage(schedule) {
  const schedules = getSchedulesFromLocalStorage();
  const index = schedules.findIndex(s => s.id === schedule.id);
  
  if (index >= 0) {
    schedules[index] = schedule;
  } else {
    schedules.push(schedule);
  }
  
  localStorage.setItem('taskometer-schedules', JSON.stringify(schedules));
  return schedule;
}

export function getSchedulesFromLocalStorage() {
  const stored = localStorage.getItem('taskometer-schedules');
  return stored ? JSON.parse(stored) : [];
}

export function getActiveSchedule() {
  const activeId = localStorage.getItem('taskometer-active-schedule');
  if (!activeId) return null;
  
  const schedules = [...FAMOUS_SCHEDULES, ...getSchedulesFromLocalStorage()];
  return schedules.find(s => s.id === activeId) || null;
}

export function setActiveSchedule(scheduleId) {
  localStorage.setItem('taskometer-active-schedule', scheduleId);
}
