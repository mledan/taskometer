// Enhanced schedule templates with famous routines and standardized categories

// Block categories for template-based scheduling
export const BLOCK_CATEGORIES = {
  SLEEP: { id: 'sleep', name: 'Sleep', color: '#4B5563', icon: '🛌', matchTypes: [] },
  EXERCISE_PERSONAL: { id: 'exercise_personal', name: 'Exercise & Personal', color: '#10B981', icon: '💪', matchTypes: ['exercise', 'personal'] },
  PROFESSIONAL_DUTIES: { id: 'professional_duties', name: 'Professional Duties', color: '#3B82F6', icon: '💼', matchTypes: ['work'] },
  CREATIVE_WORK: { id: 'creative_work', name: 'Creative Work', color: '#8B5CF6', icon: '🎨', matchTypes: ['creative'] },
  PERSONAL_DEVELOPMENT: { id: 'personal_development', name: 'Personal Development', color: '#F59E0B', icon: '📚', matchTypes: ['learning', 'personal'] },
  MEALS: { id: 'meals', name: 'Meals', color: '#EF4444', icon: '🍽️', matchTypes: [] },
  LEISURE: { id: 'leisure', name: 'Leisure', color: '#EC4899', icon: '🎮', matchTypes: ['personal'] },
  SOCIAL: { id: 'social', name: 'Social', color: '#06B6D4', icon: '👥', matchTypes: ['personal'] },
  WIND_DOWN: { id: 'wind_down', name: 'Wind Down', color: '#6366F1', icon: '🌙', matchTypes: [] },
  REFLECTION: { id: 'reflection', name: 'Reflection', color: '#84CC16', icon: '🤔', matchTypes: ['personal'] },
  CORE_WORK: { id: 'core_work', name: 'Core Work', color: '#2563EB', icon: '⚡', matchTypes: ['work'] },
  FLEXIBLE_WORK: { id: 'flexible_work', name: 'Flexible Work', color: '#0EA5E9', icon: '🔄', matchTypes: ['work'] },
  COMMUTE: { id: 'commute', name: 'Commute', color: '#78716C', icon: '🚗', matchTypes: [] },
  REST: { id: 'rest', name: 'Rest', color: '#9333EA', icon: '😴', matchTypes: [] },
  TRAVEL: { id: 'travel', name: 'Travel', color: '#DC2626', icon: '✈️', matchTypes: [] },
  EVENT: { id: 'event', name: 'Event', color: '#FBBF24', icon: '🎉', matchTypes: [] },
  ENTERTAINMENT: { id: 'entertainment', name: 'Entertainment', color: '#C084FC', icon: '🎬', matchTypes: [] },
  PREPARATION: { id: 'preparation', name: 'Preparation', color: '#F97316', icon: '📝', matchTypes: [] },
  CUSTOM: { id: 'custom', name: 'Custom', color: '#94A3B8', icon: '📌', matchTypes: [] }
};

// Helper to create time blocks with categories
export function createBlock(start, end, category, description, options = {}) {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  // Handle crossing midnight
  let duration;
  if (endHour < startHour || (endHour === 0 && startHour !== 0)) {
    duration = ((24 - startHour) * 60 - startMin) + (endHour * 60 + endMin);
  } else {
    duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  }
  
  return {
    start,
    end,
    label: category.name,
    type: category.id,
    category: category.id,
    description,
    color: category.color,
    icon: category.icon,
    duration,
    capacity: duration, // Available minutes in this block
    flexibility: options.flexibility || 'flexible',
    allowedTaskTypes: category.matchTypes || [],
    ...options
  };
}

// Enhanced Famous Schedule Templates
export const ENHANCED_FAMOUS_SCHEDULES = [
  // Barack Obama - Balanced Leadership Day
  {
    id: 'barack-obama',
    name: 'Barack Obama - Balanced Leadership',
    author: 'Historical Figure',
    description: 'Structured day with family time and reflection. Ideal for executives balancing leadership with personal life.',
    tags: ['leadership', 'balance', 'executive', 'family'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '06:45', BLOCK_CATEGORIES.SLEEP, 'Rest and recovery'),
      createBlock('06:45', '08:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Workout, read news, family breakfast'),
      createBlock('08:00', '21:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Meetings, tasks, decision-making'),
      createBlock('21:00', '23:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Family time, review briefs or reading'),
      createBlock('23:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Transition to sleep')
    ]
  },

  // Elon Musk - Entrepreneur Hustle Day
  {
    id: 'elon-musk',
    name: 'Elon Musk - Entrepreneur Hustle',
    author: 'Tech Entrepreneur',
    description: 'Intense work schedule with 5-minute time blocks. For high-achievers pushing boundaries.',
    tags: ['entrepreneur', 'intense', 'tech', 'innovation'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, '6-7 hours rest'),
      createBlock('07:00', '07:30', BLOCK_CATEGORIES.MEALS, 'Quick breakfast'),
      createBlock('07:30', '12:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Emails, meetings in 5-min blocks'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch while working'),
      createBlock('13:00', '22:00', BLOCK_CATEGORIES.CORE_WORK, 'Core engineering work'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Reading, family time')
    ]
  },

  // Maya Angelou - Focused Writer's Isolation
  {
    id: 'maya-angelou',
    name: 'Maya Angelou - Writer\'s Focus',
    author: 'Literary Icon',
    description: 'Distraction-free creative blocks. Perfect for writers and solo creators.',
    tags: ['writing', 'creative', 'focus', 'solitude'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '05:30', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('05:30', '06:30', BLOCK_CATEGORIES.MEALS, 'Wake, coffee'),
      createBlock('06:30', '14:00', BLOCK_CATEGORIES.CREATIVE_WORK, 'Dedicated writing in quiet space'),
      createBlock('14:00', '15:00', BLOCK_CATEGORIES.MEALS, 'Lunch'),
      createBlock('15:00', '19:00', BLOCK_CATEGORIES.CREATIVE_WORK, 'Editing session'),
      createBlock('19:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Dinner, family'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Evening free')
    ]
  },

  // Tim Cook - Early Riser Executive
  {
    id: 'tim-cook',
    name: 'Tim Cook - Early Riser Executive',
    author: 'Tech Executive',
    description: 'Pre-dawn productivity with user feedback focus. For tech leaders who value customer input.',
    tags: ['executive', 'morning', 'tech', 'fitness'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '03:45', BLOCK_CATEGORIES.SLEEP, 'Rest (aim for 7 hours)'),
      createBlock('03:45', '05:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Emails, planning'),
      createBlock('05:00', '06:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Read user feedback'),
      createBlock('06:00', '07:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Hour-long workout'),
      createBlock('07:00', '08:00', BLOCK_CATEGORIES.MEALS, 'Breakfast'),
      createBlock('08:00', '18:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Meetings, team interactions'),
      createBlock('18:00', '21:00', BLOCK_CATEGORIES.MEALS, 'Dinner, evening emails'),
      createBlock('21:00', '00:00', BLOCK_CATEGORIES.SLEEP, 'Early bedtime')
    ]
  },

  // Benjamin Franklin - Disciplined Inventor
  {
    id: 'benjamin-franklin',
    name: 'Benjamin Franklin - Virtuous Day',
    author: 'Historical Figure',
    description: 'Moral reflection and balanced productivity. Great for self-improvers.',
    tags: ['discipline', 'reflection', 'balance', 'wisdom'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '05:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('05:00', '07:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Rise, wash, daily planning: "What good shall I do?"'),
      createBlock('07:00', '12:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Work or study'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch and reading'),
      createBlock('13:00', '17:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Afternoon work'),
      createBlock('17:00', '19:00', BLOCK_CATEGORIES.REFLECTION, 'Evening review: "What good have I done?"'),
      createBlock('19:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Music, conversation, supper'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  // Oprah Winfrey - Media Mogul Wellness
  {
    id: 'oprah-winfrey',
    name: 'Oprah - Wellness Focused',
    author: 'Media Icon',
    description: 'Morning centering with meditation and journaling. For balanced professionals.',
    tags: ['wellness', 'meditation', 'balance', 'media'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '05:30', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('05:30', '06:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Wake, meditation'),
      createBlock('06:00', '07:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Workout'),
      createBlock('07:00', '08:00', BLOCK_CATEGORIES.MEALS, 'Breakfast'),
      createBlock('08:00', '13:00', BLOCK_CATEGORIES.LEISURE, 'Free or light activities'),
      createBlock('13:00', '18:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Meetings, filming, business'),
      createBlock('18:00', '20:00', BLOCK_CATEGORIES.MEALS, 'Dinner, reading'),
      createBlock('20:00', '22:00', BLOCK_CATEGORIES.REFLECTION, 'Journaling, wind down'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  // Charles Darwin - Scientist's Study Day
  {
    id: 'charles-darwin',
    name: 'Darwin - Scientific Method',
    author: 'Historical Figure',
    description: 'Paced research with nature walks. For academics and researchers.',
    tags: ['science', 'research', 'nature', 'study'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('07:00', '07:30', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Short walk'),
      createBlock('07:30', '08:00', BLOCK_CATEGORIES.MEALS, 'Breakfast'),
      createBlock('08:00', '09:30', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Study work'),
      createBlock('09:30', '10:30', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Reading letters'),
      createBlock('10:30', '12:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'More work'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Walk'),
      createBlock('13:00', '16:00', BLOCK_CATEGORIES.LEISURE, 'Rest, reading'),
      createBlock('16:00', '17:30', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Afternoon work'),
      createBlock('17:30', '20:00', BLOCK_CATEGORIES.LEISURE, 'Dinner, family'),
      createBlock('20:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Free time'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  // Jeff Bezos - Relaxed Morning Innovator
  {
    id: 'jeff-bezos',
    name: 'Jeff Bezos - Strategic Leader',
    author: 'Tech Founder',
    description: 'Family-first mornings with strategic thinking time. For long-term visionaries.',
    tags: ['strategy', 'family', 'leadership', 'tech'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, '8 hours rest'),
      createBlock('07:00', '10:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Wake, newspaper, coffee, family breakfast (no meetings)'),
      createBlock('10:00', '18:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Work sessions, high-IQ meetings first'),
      createBlock('18:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Dinner, family time, reading'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  // Arianna Huffington - Mindful Media Day
  {
    id: 'arianna-huffington',
    name: 'Arianna Huffington - Mindful Balance',
    author: 'Media Entrepreneur',
    description: 'Tech-free mornings with wellness focus. For digital detox advocates.',
    tags: ['wellness', 'mindfulness', 'media', 'balance'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, '8 hours, no devices in bedroom'),
      createBlock('07:00', '07:30', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Wake naturally, meditate or journal'),
      createBlock('07:30', '08:00', BLOCK_CATEGORIES.MEALS, 'Bulletproof coffee'),
      createBlock('08:00', '08:30', BLOCK_CATEGORIES.EXERCISE_PERSONAL, '30-min stationary bike'),
      createBlock('08:30', '09:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Check messages'),
      createBlock('09:00', '09:10', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Yoga stretches'),
      createBlock('09:10', '12:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Morning work'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch as first meal'),
      createBlock('13:00', '19:00', BLOCK_CATEGORIES.PROFESSIONAL_DUTIES, 'Afternoon tasks'),
      createBlock('19:00', '23:00', BLOCK_CATEGORIES.LEISURE, 'Dinner, reading, family'),
      createBlock('23:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Device-free prep')
    ]
  },

  // Standard Work Templates
  {
    id: 'standard-9to5',
    name: 'Standard 9-5 Office',
    author: 'Template',
    description: 'Traditional work structure for office professionals.',
    tags: ['work', 'office', 'traditional', 'balanced'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('07:00', '08:00', BLOCK_CATEGORIES.MEALS, 'Wake, breakfast'),
      createBlock('08:00', '09:00', BLOCK_CATEGORIES.COMMUTE, 'Travel to work'),
      createBlock('09:00', '12:00', BLOCK_CATEGORIES.CORE_WORK, 'Morning tasks, meetings'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch'),
      createBlock('13:00', '17:00', BLOCK_CATEGORIES.CORE_WORK, 'Afternoon tasks'),
      createBlock('17:00', '18:00', BLOCK_CATEGORIES.COMMUTE, 'Travel home'),
      createBlock('18:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Dinner, free time'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  {
    id: 'remote-flexible',
    name: 'Flexible Remote Worker',
    author: 'Template',
    description: 'Customizable schedule for home-based professionals.',
    tags: ['remote', 'flexible', 'work-life-balance'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '06:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('06:00', '07:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Morning activity'),
      createBlock('07:00', '08:00', BLOCK_CATEGORIES.MEALS, 'Breakfast'),
      createBlock('08:00', '12:00', BLOCK_CATEGORIES.CORE_WORK, 'Focused deep work'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch'),
      createBlock('13:00', '16:00', BLOCK_CATEGORIES.FLEXIBLE_WORK, 'Meetings, collaboration'),
      createBlock('16:00', '22:00', BLOCK_CATEGORIES.LEISURE, 'Personal time'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Evening reflection')
    ]
  },

  // Leisure Templates
  {
    id: 'self-care-day',
    name: 'Self-Care Focused Day',
    author: 'Template',
    description: 'Wellness priority day with mindful activities.',
    tags: ['wellness', 'self-care', 'leisure', 'mindfulness'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '07:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('07:00', '08:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Meditation, journaling'),
      createBlock('08:00', '09:00', BLOCK_CATEGORIES.MEALS, 'Healthy breakfast'),
      createBlock('09:00', '12:00', BLOCK_CATEGORIES.EXERCISE_PERSONAL, 'Yoga or nature walk'),
      createBlock('12:00', '13:00', BLOCK_CATEGORIES.MEALS, 'Lunch'),
      createBlock('13:00', '16:00', BLOCK_CATEGORIES.LEISURE, 'Hobby time (painting, reading)'),
      createBlock('16:00', '19:00', BLOCK_CATEGORIES.REST, 'Spa time or relaxation'),
      createBlock('19:00', '22:00', BLOCK_CATEGORIES.MEALS, 'Light dinner, reading'),
      createBlock('22:00', '00:00', BLOCK_CATEGORIES.WIND_DOWN, 'Prep for sleep')
    ]
  },

  {
    id: 'weekend-reflection',
    name: 'Weekend Reflection',
    author: 'Template',
    description: 'Reflective weekend with planning and leisure.',
    tags: ['weekend', 'reflection', 'planning', 'leisure'],
    isCustom: false,
    timeBlocks: [
      createBlock('00:00', '08:00', BLOCK_CATEGORIES.SLEEP, 'Rest'),
      createBlock('08:00', '10:00', BLOCK_CATEGORIES.PERSONAL_DEVELOPMENT, 'Journal, gratitude list'),
      createBlock('10:00', '13:00', BLOCK_CATEGORIES.LEISURE, 'Hobbies or outings'),
      createBlock('13:00', '14:00', BLOCK_CATEGORIES.MEALS, 'Lunch'),
      createBlock('14:00', '18:00', BLOCK_CATEGORIES.SOCIAL, 'Friends/family time'),
      createBlock('18:00', '21:00', BLOCK_CATEGORIES.ENTERTAINMENT, 'Dinner, movies/series'),
      createBlock('21:00', '00:00', BLOCK_CATEGORIES.REFLECTION, 'Review week, plan next')
    ]
  }
];

// Template application functions
export function applyTemplateToDateRange(template, startDate, endDate, options = {}) {
  const { overrideExisting = false, mergeWithExisting = true } = options;
  const scheduledBlocks = [];
  
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    template.timeBlocks.forEach(block => {
      const blockStart = new Date(currentDate);
      const [startHour, startMin] = block.start.split(':').map(Number);
      blockStart.setHours(startHour, startMin, 0, 0);
      
      const blockEnd = new Date(currentDate);
      const [endHour, endMin] = block.end.split(':').map(Number);
      blockEnd.setHours(endHour, endMin, 0, 0);
      
      // Handle blocks that cross midnight
      if (endHour < startHour || (endHour === 0 && startHour !== 0)) {
        blockEnd.setDate(blockEnd.getDate() + 1);
      }
      
      scheduledBlocks.push({
        ...block,
        date: new Date(currentDate),
        startTime: blockStart.toISOString(),
        endTime: blockEnd.toISOString(),
        templateId: template.id,
        templateName: template.name
      });
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return scheduledBlocks;
}

// Auto-slot tasks into template blocks
export function autoSlotTaskIntoTemplate(task, templateBlocks, existingTasks = []) {
  // Find matching category blocks
  const eligibleBlocks = templateBlocks.filter(block => {
    // Check if task type matches block's allowed types
    if (block.allowedTaskTypes && block.allowedTaskTypes.length > 0) {
      return block.allowedTaskTypes.includes(task.taskType);
    }
    // Fallback to category matching
    return block.category === task.category || block.type === 'flexible_work';
  });
  
  // Sort by preference (morning tasks go to morning blocks, etc.)
  const sortedBlocks = eligibleBlocks.sort((a, b) => {
    const aStart = parseInt(a.start.split(':')[0]);
    const bStart = parseInt(b.start.split(':')[0]);
    
    // Prefer morning for high-priority tasks
    if (task.priority === 'high') {
      return aStart - bStart;
    }
    // Prefer afternoon for medium priority
    if (task.priority === 'medium') {
      return Math.abs(aStart - 14) - Math.abs(bStart - 14);
    }
    // Evening for low priority
    return bStart - aStart;
  });
  
  // Find first available slot with capacity
  for (const block of sortedBlocks) {
    const blockCapacity = block.capacity || block.duration;
    const usedCapacity = existingTasks
      .filter(t => t.templateBlockId === block.id)
      .reduce((sum, t) => sum + (t.duration || 30), 0);
    
    const remainingCapacity = blockCapacity - usedCapacity;
    
    if (remainingCapacity >= task.duration) {
      // Calculate exact start time within the block
      const blockStart = new Date(block.startTime);
      blockStart.setMinutes(blockStart.getMinutes() + usedCapacity);
      
      return {
        scheduledTime: blockStart.toISOString(),
        templateBlockId: block.id,
        templateBlockName: block.label,
        category: block.category
      };
    }
  }
  
  // No suitable slot found - suggest overflow handling
  return {
    overflow: true,
    suggestion: 'Task doesn\'t fit in template blocks. Consider extending work hours or deferring to next day.'
  };
}

// Get template by ID
export function getTemplateById(templateId) {
  return ENHANCED_FAMOUS_SCHEDULES.find(t => t.id === templateId);
}

// Get templates by tag
export function getTemplatesByTag(tag) {
  return ENHANCED_FAMOUS_SCHEDULES.filter(t => t.tags.includes(tag));
}

// Validate if task fits in template
export function validateTaskFit(task, template) {
  const matchingBlocks = template.timeBlocks.filter(block => {
    return block.allowedTaskTypes.includes(task.taskType) || 
           block.category === task.category;
  });
  
  const totalCapacity = matchingBlocks.reduce((sum, block) => sum + block.capacity, 0);
  
  return {
    fits: totalCapacity >= task.duration,
    matchingBlocks,
    totalCapacity
  };
}