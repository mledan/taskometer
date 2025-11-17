import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../AppContext';
import { getLocalTimeString, formatTimeForDisplay } from '../utils/timeDisplay';
import './SmartSchedulingSuggestions.css';

const SmartSchedulingSuggestions = ({ taskType, taskName, duration = 60, onAcceptSuggestion }) => {
  const state = useAppState();
  const [suggestions, setSuggestions] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  // Analyze user's task patterns and habits
  const userPatterns = useMemo(() => {
    const patterns = {
      mostProductiveHours: [],
      commonCategories: {},
      averageDurations: {},
      completionRates: {},
      preferredDays: {},
      workloadDistribution: []
    };

    // Analyze completed tasks from history (stored in localStorage)
    let completedTasks = [];
    try {
      const savedHistory = localStorage.getItem('taskometer-history');
      if (savedHistory) {
        completedTasks = JSON.parse(savedHistory);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    const recentTasks = completedTasks.slice(-100); // Last 100 tasks for analysis

    // Find most productive hours
    const hourCounts = {};
    const hourCompletions = {};
    
    recentTasks.forEach(task => {
      if (task.scheduledTime) {
        const hour = new Date(task.scheduledTime).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        if (task.completed) {
          hourCompletions[hour] = (hourCompletions[hour] || 0) + 1;
        }
      }

      // Track category patterns
      if (task.type) {
        patterns.commonCategories[task.type] = (patterns.commonCategories[task.type] || 0) + 1;
        
        // Track average durations per category
        if (!patterns.averageDurations[task.type]) {
          patterns.averageDurations[task.type] = [];
        }
        patterns.averageDurations[task.type].push(task.duration || 60);
      }

      // Track preferred days
      if (task.scheduledTime) {
        const day = new Date(task.scheduledTime).getDay();
        patterns.preferredDays[day] = (patterns.preferredDays[day] || 0) + 1;
      }
    });

    // Calculate completion rates per hour
    Object.keys(hourCounts).forEach(hour => {
      const rate = (hourCompletions[hour] || 0) / hourCounts[hour];
      if (rate > 0.7) { // 70% completion rate threshold
        patterns.mostProductiveHours.push({
          hour: parseInt(hour),
          rate: rate,
          count: hourCounts[hour]
        });
      }
    });

    // Sort productive hours by rate
    patterns.mostProductiveHours.sort((a, b) => b.rate - a.rate);

    // Calculate average durations
    Object.keys(patterns.averageDurations).forEach(type => {
      const durations = patterns.averageDurations[type];
      patterns.averageDurations[type] = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    });

    return patterns;
  }, [state.items]);

  // Generate smart suggestions based on analysis
  useEffect(() => {
    const generateSuggestions = () => {
      const newSuggestions = [];
      const now = new Date();
      const upcomingDays = 7; // Look ahead 7 days

      // Get current workload
      const scheduledTasks = state.items.filter(t => t.scheduledTime);
      const workloadByDay = {};

      scheduledTasks.forEach(task => {
        const taskDate = new Date(task.scheduledTime);
        const dateKey = taskDate.toDateString();
        if (!workloadByDay[dateKey]) {
          workloadByDay[dateKey] = {
            count: 0,
            totalDuration: 0,
            tasks: []
          };
        }
        workloadByDay[dateKey].count++;
        workloadByDay[dateKey].totalDuration += task.duration || 60;
        workloadByDay[dateKey].tasks.push(task);
      });

      // Find optimal slots for the next week
      for (let dayOffset = 0; dayOffset < upcomingDays; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        targetDate.setHours(0, 0, 0, 0);
        
        const dateKey = targetDate.toDateString();
        const dayWorkload = workloadByDay[dateKey] || { count: 0, totalDuration: 0, tasks: [] };

        // Skip if day is already heavily loaded (>6 hours of tasks)
        if (dayWorkload.totalDuration > 360) continue;

        // Find best time slots based on user patterns
        const preferredHours = userPatterns.mostProductiveHours.length > 0 
          ? userPatterns.mostProductiveHours.map(h => h.hour)
          : [9, 10, 11, 14, 15, 16]; // Default productive hours

        preferredHours.forEach(hour => {
          const slotStart = new Date(targetDate);
          slotStart.setHours(hour, 0, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          // Check if slot is available
          const hasConflict = dayWorkload.tasks.some(task => {
            const taskStart = new Date(task.scheduledTime);
            const taskEnd = new Date(taskStart);
            taskEnd.setMinutes(taskEnd.getMinutes() + (task.duration || 60));
            
            return (slotStart < taskEnd && slotEnd > taskStart);
          });

          if (!hasConflict && slotStart > now) {
            const suggestion = {
              id: `${dateKey}-${hour}`,
              date: new Date(slotStart),
              dateStr: targetDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              }),
              timeStr: formatTimeForDisplay(slotStart.toISOString()),
              reason: generateReason(hour, dayOffset, dayWorkload, userPatterns),
              confidence: calculateConfidence(hour, dayOffset, dayWorkload, userPatterns),
              workloadInfo: {
                tasksOnDay: dayWorkload.count,
                hoursScheduled: Math.round(dayWorkload.totalDuration / 60 * 10) / 10
              }
            };
            
            newSuggestions.push(suggestion);
          }
        });
      }

      // Sort by confidence and limit to top 5
      newSuggestions.sort((a, b) => b.confidence - a.confidence);
      setSuggestions(newSuggestions.slice(0, 5));
    };

    generateSuggestions();
  }, [taskType, taskName, duration, userPatterns, state.items]);

  // Generate reason for suggestion
  const generateReason = (hour, dayOffset, dayWorkload, patterns) => {
    const reasons = [];
    
    // Check if it's a productive hour
    const productiveHour = patterns.mostProductiveHours.find(h => h.hour === hour);
    if (productiveHour) {
      reasons.push(`High productivity (${Math.round(productiveHour.rate * 100)}% completion rate)`);
    }

    // Check workload
    if (dayWorkload.count === 0) {
      reasons.push('Clear schedule');
    } else if (dayWorkload.count < 3) {
      reasons.push('Light workload');
    }

    // Check if it's soon
    if (dayOffset === 0) {
      reasons.push('Available today');
    } else if (dayOffset === 1) {
      reasons.push('Tomorrow');
    }

    // Check category match
    if (taskType && patterns.commonCategories[taskType]) {
      reasons.push(`Matches your ${taskType} routine`);
    }

    return reasons.join(' • ') || 'Good availability';
  };

  // Calculate confidence score
  const calculateConfidence = (hour, dayOffset, dayWorkload, patterns) => {
    let score = 50; // Base score

    // Productive hour bonus
    const productiveHour = patterns.mostProductiveHours.find(h => h.hour === hour);
    if (productiveHour) {
      score += productiveHour.rate * 30;
    }

    // Workload penalty
    score -= dayWorkload.count * 5;

    // Recency bonus (prefer sooner slots)
    score += Math.max(0, (7 - dayOffset) * 3);

    // Category match bonus
    if (taskType && patterns.commonCategories[taskType]) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  };

  return (
    <div className="smart-scheduling-suggestions">
      <div className="suggestions-header">
        <span className="suggestions-icon">✨</span>
        <h3>Smart Scheduling Suggestions</h3>
      </div>

      {suggestions.length === 0 ? (
        <div className="no-suggestions">
          <p>Analyzing your schedule patterns...</p>
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestions.map(suggestion => (
            <div 
              key={suggestion.id}
              className={`suggestion-item ${selectedSuggestion?.id === suggestion.id ? 'selected' : ''}`}
              onClick={() => setSelectedSuggestion(suggestion)}
            >
              <div className="suggestion-main">
                <div className="suggestion-time">
                  <span className="date">{suggestion.dateStr}</span>
                  <span className="time">{suggestion.timeStr}</span>
                </div>
                <div className="suggestion-confidence">
                  <div 
                    className="confidence-bar"
                    style={{ 
                      width: `${suggestion.confidence}%`,
                      backgroundColor: suggestion.confidence > 70 ? '#4caf50' : 
                                     suggestion.confidence > 40 ? '#ff9800' : '#f44336'
                    }}
                  />
                  <span className="confidence-label">
                    {suggestion.confidence > 70 ? 'High' : 
                     suggestion.confidence > 40 ? 'Medium' : 'Low'} match
                  </span>
                </div>
              </div>
              <div className="suggestion-details">
                <p className="reason">{suggestion.reason}</p>
                <p className="workload">
                  {suggestion.workloadInfo.tasksOnDay === 0 
                    ? 'No other tasks scheduled'
                    : `${suggestion.workloadInfo.tasksOnDay} other task${suggestion.workloadInfo.tasksOnDay > 1 ? 's' : ''} (${suggestion.workloadInfo.hoursScheduled}h total)`}
                </p>
              </div>
              {selectedSuggestion?.id === suggestion.id && (
                <button 
                  className="accept-suggestion-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcceptSuggestion(suggestion.date);
                  }}
                >
                  Use this time
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {userPatterns.mostProductiveHours.length > 0 && (
        <div className="patterns-insight">
          <h4>Your Patterns</h4>
          <p>
            Most productive: {userPatterns.mostProductiveHours.slice(0, 3).map(h => {
              const hour = h.hour;
              const period = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
              return `${displayHour}${period}`;
            }).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartSchedulingSuggestions;