// Mock community data for simulating social features

export const MOCK_COMMUNITY_SCHEDULES = [
  {
    id: 'comm-1',
    name: 'Student Finals Week',
    author: 'StudyPro23',
    description: 'Optimized schedule for exam preparation with Pomodoro breaks.',
    tags: ['study', 'exams', 'student', 'focus'],
    likes: 342,
    shares: 89,
    comments: 12,
    createdAt: '2024-01-15',
    isAnonymous: false,
    completionRate: 78,
    timeBlocks: [
      { start: '07:00', end: '09:00', type: 'study', label: 'Morning Study' },
      { start: '09:00', end: '09:30', type: 'break', label: 'Breakfast' },
      { start: '09:30', end: '12:30', type: 'study', label: 'Deep Focus' },
      { start: '12:30', end: '13:30', type: 'break', label: 'Lunch & Walk' },
      { start: '13:30', end: '17:00', type: 'study', label: 'Practice Problems' },
      { start: '17:00', end: '18:00', type: 'exercise', label: 'Gym Break' },
      { start: '18:00', end: '19:00', type: 'meals', label: 'Dinner' },
      { start: '19:00', end: '22:00', type: 'study', label: 'Review Session' },
      { start: '22:00', end: '23:00', type: 'wind_down', label: 'Relax' },
      { start: '23:00', end: '07:00', type: 'sleep', label: 'Sleep' }
    ]
  },
  {
    id: 'comm-2',
    name: 'Remote Developer Flow',
    author: 'CodeNinja',
    description: 'Balanced coding schedule with regular breaks to prevent burnout.',
    tags: ['coding', 'remote', 'developer', 'balanced'],
    likes: 567,
    shares: 234,
    comments: 45,
    createdAt: '2024-02-10',
    isAnonymous: false,
    completionRate: 85,
    timeBlocks: [
      { start: '08:00', end: '10:00', type: 'work', label: 'Deep Coding' },
      { start: '10:00', end: '10:15', type: 'break', label: 'Coffee Break' },
      { start: '10:15', end: '12:00', type: 'work', label: 'Feature Development' },
      { start: '12:00', end: '13:00', type: 'meals', label: 'Lunch' },
      { start: '13:00', end: '15:00', type: 'work', label: 'Code Reviews' },
      { start: '15:00', end: '15:30', type: 'break', label: 'Walk Break' },
      { start: '15:30', end: '17:30', type: 'work', label: 'Meetings & Planning' },
      { start: '17:30', end: '19:00', type: 'personal', label: 'Personal Projects' }
    ]
  },
  {
    id: 'comm-3',
    name: 'Parent Work-Life Balance',
    author: 'Anonymous',
    description: 'Managing work from home with kids. Real schedule that actually works!',
    tags: ['parent', 'work-from-home', 'balance', 'family'],
    likes: 892,
    shares: 445,
    comments: 78,
    createdAt: '2024-03-05',
    isAnonymous: true,
    completionRate: 72,
    timeBlocks: [
      { start: '05:30', end: '07:00', type: 'work', label: 'Quiet Work Time' },
      { start: '07:00', end: '08:30', type: 'family', label: 'Kids Morning Routine' },
      { start: '08:30', end: '12:00', type: 'work', label: 'Core Work Hours' },
      { start: '12:00', end: '13:00', type: 'family', label: 'Lunch with Kids' },
      { start: '13:00', end: '15:00', type: 'work', label: 'Meetings' },
      { start: '15:00', end: '17:00', type: 'family', label: 'Homework Help' },
      { start: '17:00', end: '18:30', type: 'personal', label: 'Dinner Prep' },
      { start: '18:30', end: '20:00', type: 'family', label: 'Family Time' },
      { start: '20:00', end: '22:00', type: 'work', label: 'Catch-up Work' }
    ]
  },
  {
    id: 'comm-4',
    name: 'Creative Writer Routine',
    author: 'WordSmith88',
    description: 'Morning pages, afternoon editing, evening reading. Works like magic!',
    tags: ['writing', 'creative', 'author', 'morning-routine'],
    likes: 423,
    shares: 156,
    comments: 34,
    createdAt: '2024-03-20',
    isAnonymous: false,
    completionRate: 81,
    timeBlocks: [
      { start: '05:00', end: '07:00', type: 'creative', label: 'Morning Pages' },
      { start: '07:00', end: '08:00', type: 'meals', label: 'Breakfast & News' },
      { start: '08:00', end: '12:00', type: 'creative', label: 'Writing Sprint' },
      { start: '12:00', end: '13:00', type: 'meals', label: 'Lunch' },
      { start: '13:00', end: '16:00', type: 'creative', label: 'Editing' },
      { start: '16:00', end: '17:00', type: 'exercise', label: 'Walk' },
      { start: '17:00', end: '19:00', type: 'admin', label: 'Emails & Admin' },
      { start: '19:00', end: '20:00', type: 'meals', label: 'Dinner' },
      { start: '20:00', end: '22:00', type: 'learning', label: 'Reading' }
    ]
  },
  {
    id: 'comm-5',
    name: 'Fitness Enthusiast Daily',
    author: 'FitLife2024',
    description: 'Two workouts a day with proper nutrition timing. Gains guaranteed!',
    tags: ['fitness', 'health', 'nutrition', 'athlete'],
    likes: 612,
    shares: 298,
    comments: 56,
    createdAt: '2024-04-01',
    isAnonymous: false,
    completionRate: 90,
    timeBlocks: [
      { start: '05:00', end: '06:30', type: 'exercise', label: 'Morning Workout' },
      { start: '06:30', end: '07:30', type: 'meals', label: 'Protein Breakfast' },
      { start: '07:30', end: '12:00', type: 'work', label: 'Work' },
      { start: '12:00', end: '13:00', type: 'meals', label: 'Lunch (Meal Prep)' },
      { start: '13:00', end: '17:00', type: 'work', label: 'Work' },
      { start: '17:00', end: '18:30', type: 'exercise', label: 'Evening Training' },
      { start: '18:30', end: '19:30', type: 'meals', label: 'Recovery Dinner' },
      { start: '19:30', end: '21:00', type: 'personal', label: 'Relaxation' },
      { start: '21:00', end: '22:00', type: 'planning', label: 'Next Day Prep' }
    ]
  }
];

export const MOCK_DISCUSSIONS = [
  {
    id: 'disc-1',
    scheduleId: 'comm-1',
    author: 'LearnerX',
    message: 'This schedule helped me ace my finals! The Pomodoro breaks are key.',
    timestamp: '2024-01-16T10:30:00',
    likes: 23,
    replies: [
      {
        id: 'reply-1',
        author: 'StudyPro23',
        message: 'Glad it helped! The key is consistency.',
        timestamp: '2024-01-16T11:00:00',
        likes: 8
      },
      {
        id: 'reply-2',
        author: 'TestAce',
        message: 'What app do you use for Pomodoro timing?',
        timestamp: '2024-01-16T14:20:00',
        likes: 3
      }
    ]
  },
  {
    id: 'disc-2',
    scheduleId: 'comm-2',
    author: 'JuniorDev',
    message: 'The walk break at 3pm is a game changer. My productivity shot up!',
    timestamp: '2024-02-12T15:45:00',
    likes: 45,
    replies: [
      {
        id: 'reply-3',
        author: 'CodeNinja',
        message: 'Movement is crucial for creative problem solving!',
        timestamp: '2024-02-12T16:30:00',
        likes: 12
      }
    ]
  },
  {
    id: 'disc-3',
    scheduleId: 'comm-3',
    author: 'WFHParent',
    message: 'Finally a realistic schedule for parents! That 5:30am slot is golden.',
    timestamp: '2024-03-06T08:00:00',
    likes: 67,
    replies: []
  }
];

export const MOCK_USER_STATS = {
  averageTasksPerDay: 8.5,
  averageCompletionRate: 73,
  topProductiveHour: 10,
  totalUsersSimulated: 10234,
  percentile: 68, // User is more productive than 68% of users
  similarUsers: 342,
  benchmarks: {
    productivity: {
      you: 73,
      average: 65,
      top10Percent: 92
    },
    consistency: {
      you: 81,
      average: 58,
      top10Percent: 95
    },
    balance: {
      you: 68,
      average: 70,
      top10Percent: 88
    }
  }
};

export const POSITIVE_KEYWORDS = [
  'helpful', 'great', 'amazing', 'love', 'excellent', 'perfect',
  'works', 'thanks', 'appreciate', 'improved', 'better', 'success',
  'recommend', 'fantastic', 'brilliant', 'effective', 'productive'
];

export const NEGATIVE_KEYWORDS = [
  'hate', 'terrible', 'awful', 'worst', 'useless', 'stupid',
  'waste', 'garbage', 'trash', 'horrible', 'disgusting'
];

// Helper functions for mock data
export function generateShareableLink(scheduleId) {
  const baseUrl = window.location.origin;
  const encodedData = btoa(JSON.stringify({ scheduleId, shared: true }));
  return `${baseUrl}?import=${encodedData}`;
}

export function parseShareableLink(url) {
  try {
    const params = new URLSearchParams(new URL(url).search);
    const encodedData = params.get('import');
    if (encodedData) {
      return JSON.parse(atob(encodedData));
    }
  } catch (error) {
    console.error('Invalid shareable link:', error);
  }
  return null;
}

export function filterPositiveComments(comments) {
  return comments.filter(comment => {
    const lowerMessage = comment.message.toLowerCase();
    const hasNegative = NEGATIVE_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    );
    const hasPositive = POSITIVE_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Filter out if it has negative keywords or no positive ones
    return !hasNegative && (hasPositive || comment.likes > 5);
  });
}

export function calculateSimilarityScore(userTags, scheduleTags) {
  const commonTags = userTags.filter(tag => scheduleTags.includes(tag));
  return (commonTags.length / Math.max(userTags.length, scheduleTags.length)) * 100;
}

export function getRecommendedSchedules(userPreferences, schedules) {
  return schedules
    .map(schedule => ({
      ...schedule,
      similarity: calculateSimilarityScore(userPreferences.tags || [], schedule.tags)
    }))
    .filter(schedule => schedule.similarity > 30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export function anonymizeSchedule(schedule) {
  return {
    ...schedule,
    author: 'Anonymous',
    isAnonymous: true,
    // Remove any identifying information
    comments: schedule.comments.map(c => ({
      ...c,
      author: c.author === schedule.author ? 'Anonymous' : c.author
    }))
  };
}

// Challenge mode helpers
export function createChallenge(schedule, duration = 7) {
  return {
    id: `challenge-${Date.now()}`,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    duration, // days
    startDate: new Date().toISOString(),
    participants: [],
    isActive: true,
    isPrivate: true,
    completionGoal: 80 // percentage
  };
}

export function compareCompletionRates(user1Stats, user2Stats) {
  return {
    user1: {
      average: user1Stats.averageCompletionRate,
      trend: user1Stats.trend || 'stable'
    },
    user2: {
      average: user2Stats.averageCompletionRate,
      trend: user2Stats.trend || 'stable'
    },
    difference: Math.abs(user1Stats.averageCompletionRate - user2Stats.averageCompletionRate),
    winner: user1Stats.averageCompletionRate > user2Stats.averageCompletionRate ? 'user1' : 'user2'
  };
}