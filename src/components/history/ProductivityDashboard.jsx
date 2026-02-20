/**
 * ProductivityDashboard Component
 *
 * Comprehensive productivity analytics and reporting dashboard.
 * Shows task completion stats, time tracking, and productivity insights.
 *
 * Features:
 * - Task completion statistics
 * - Time tracking analytics
 * - Type/tag distribution charts
 * - Streak tracking
 * - Daily/weekly/monthly views
 * - Export reports
 */

import { useState, useMemo } from 'react';
import { useAppState, useTaskTypes, useTags } from '../../context/AppContext';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  isWithinInterval,
  format,
  eachDayOfInterval
} from 'date-fns';
import styles from './ProductivityDashboard.module.css';

// Time range options
const TIME_RANGES = {
  today: { label: 'Today', getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
  yesterday: { label: 'Yesterday', getValue: () => ({ start: startOfDay(subDays(new Date(), 1)), end: endOfDay(subDays(new Date(), 1)) }) },
  week: { label: 'This Week', getValue: () => ({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
  lastWeek: { label: 'Last Week', getValue: () => ({ start: startOfWeek(subWeeks(new Date(), 1)), end: endOfWeek(subWeeks(new Date(), 1)) }) },
  month: { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  lastMonth: { label: 'Last Month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  all: { label: 'All Time', getValue: () => ({ start: new Date(0), end: new Date() }) }
};

function ProductivityDashboard() {
  const { items = [] } = useAppState();
  const taskTypes = useTaskTypes();
  const tags = useTags();

  const [timeRange, setTimeRange] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');

  function getTaskReferenceDate(task) {
    if (task.completedAt) return new Date(task.completedAt);
    if (task.scheduledTime) return new Date(task.scheduledTime);
    if (task.scheduledFor) return new Date(`${task.scheduledFor}T00:00:00`);
    return new Date(task.createdAt || Date.now());
  }

  // Filter tasks by time range
  const filteredTasks = useMemo(() => {
    const range = TIME_RANGES[timeRange].getValue();
    return items.filter(task => {
      if (!task) return false;
      const taskDate = getTaskReferenceDate(task);
      return isWithinInterval(taskDate, range);
    });
  }, [items, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = filteredTasks.filter(t => t.status === 'completed');
    const incomplete = filteredTasks.filter(t => t.status !== 'completed');
    const totalMinutes = completed.reduce((sum, t) => sum + (t.duration || 30), 0);

    // Type distribution
    const byType = {};
    filteredTasks.forEach(task => {
      const typeId = task.primaryType || task.taskType || task.type || 'untyped';
      if (!byType[typeId]) {
        byType[typeId] = { total: 0, completed: 0, minutes: 0 };
      }
      byType[typeId].total++;
      if (task.status === 'completed') {
        byType[typeId].completed++;
        byType[typeId].minutes += task.duration || 30;
      }
    });

    // Tag distribution
    const byTag = {};
    filteredTasks.forEach(task => {
      const taskTags = task.tags || [];
      if (taskTags.length === 0) {
        if (!byTag['untagged']) byTag['untagged'] = { total: 0, completed: 0 };
        byTag['untagged'].total++;
        if (task.status === 'completed') byTag['untagged'].completed++;
      } else {
        taskTags.forEach(tagId => {
          if (!byTag[tagId]) byTag[tagId] = { total: 0, completed: 0 };
          byTag[tagId].total++;
          if (task.status === 'completed') byTag[tagId].completed++;
        });
      }
    });

    // Daily breakdown
    const range = TIME_RANGES[timeRange].getValue();
    const days = eachDayOfInterval({ start: range.start, end: range.end }).slice(0, 31); // Limit to 31 days
    const dailyData = days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayTasks = filteredTasks.filter(t => {
        const taskDate = getTaskReferenceDate(t);
        return isWithinInterval(taskDate, { start: dayStart, end: dayEnd });
      });
      return {
        date: day,
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.status === 'completed').length,
        minutes: dayTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.duration || 30), 0)
      };
    });

    return {
      total: filteredTasks.length,
      completed: completed.length,
      incomplete: incomplete.length,
      completionRate: filteredTasks.length > 0 ? Math.round((completed.length / filteredTasks.length) * 100) : 0,
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      byType,
      byTag,
      dailyData
    };
  }, [filteredTasks, timeRange]);

  // Calculate streaks
  const streaks = useMemo(() => {
    const completedDates = new Set();
    items.forEach(task => {
      if (task?.status === 'completed') {
        completedDates.add(format(getTaskReferenceDate(task), 'yyyy-MM-dd'));
      }
    });

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let checkDate = new Date();

    // Calculate current streak
    while (completedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    }

    // If no tasks completed today, check yesterday
    if (currentStreak === 0) {
      checkDate = subDays(new Date(), 1);
      while (completedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    // Calculate longest streak (simplified - last 365 days)
    for (let i = 0; i < 365; i++) {
      const date = subDays(new Date(), i);
      if (completedDates.has(format(date, 'yyyy-MM-dd'))) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return { current: currentStreak, longest: longestStreak };
  }, [items]);

  // Get type info helper
  function getTypeInfo(typeId) {
    if (typeId === 'untyped') return { name: 'Untyped', icon: '📝', color: '#6B7280' };
    return taskTypes.find(t => t.id === typeId) || { name: typeId, icon: '📋', color: '#6B7280' };
  }

  // Get tag info helper
  function getTagInfo(tagId) {
    if (tagId === 'untagged') return { name: 'Untagged', icon: '🏷️', color: '#6B7280' };
    return tags.find(t => t.id === tagId) || { name: tagId, icon: '🏷️', color: '#6B7280' };
  }

  // Export report
  function handleExport() {
    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: TIME_RANGES[timeRange].label,
      statistics: {
        totalTasks: stats.total,
        completedTasks: stats.completed,
        completionRate: stats.completionRate,
        totalHours: stats.totalHours
      },
      streaks,
      byType: Object.entries(stats.byType).map(([id, data]) => ({
        type: getTypeInfo(id).name,
        ...data
      })),
      byTag: Object.entries(stats.byTag).map(([id, data]) => ({
        tag: getTagInfo(id).name,
        ...data
      })),
      dailyBreakdown: stats.dailyData.map(d => ({
        date: format(d.date, 'yyyy-MM-dd'),
        ...d
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Render progress bar
  function ProgressBar({ value, max, color }) {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>Productivity Dashboard</h2>
        <div className={styles.headerActions}>
          <select
            className={styles.rangeSelect}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            {Object.entries(TIME_RANGES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className={styles.exportButton} onClick={handleExport}>
            Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'breakdown' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('breakdown')}
        >
          Breakdown
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'trends' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'overview' && (
          <>
            {/* Stats cards */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>✅</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.completed}</span>
                  <span className={styles.statLabel}>Tasks Completed</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>📊</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.completionRate}%</span>
                  <span className={styles.statLabel}>Completion Rate</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>⏱️</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.totalHours}h</span>
                  <span className={styles.statLabel}>Time Tracked</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>🔥</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{streaks.current}</span>
                  <span className={styles.statLabel}>Day Streak</span>
                </div>
              </div>
            </div>

            {/* Progress summary */}
            <div className={styles.section}>
              <h3>Task Progress</h3>
              <div className={styles.progressSummary}>
                <div className={styles.progressLabels}>
                  <span>Completed: {stats.completed}</span>
                  <span>Remaining: {stats.incomplete}</span>
                </div>
                <ProgressBar value={stats.completed} max={stats.total} color="var(--green)" />
              </div>
            </div>

            {/* Streaks */}
            <div className={styles.section}>
              <h3>Productivity Streaks</h3>
              <div className={styles.streakCards}>
                <div className={styles.streakCard}>
                  <span className={styles.streakValue}>{streaks.current}</span>
                  <span className={styles.streakLabel}>Current Streak</span>
                  <span className={styles.streakUnit}>days</span>
                </div>
                <div className={styles.streakCard}>
                  <span className={styles.streakValue}>{streaks.longest}</span>
                  <span className={styles.streakLabel}>Longest Streak</span>
                  <span className={styles.streakUnit}>days</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'breakdown' && (
          <>
            {/* By Type */}
            <div className={styles.section}>
              <h3>By Task Type</h3>
              <div className={styles.breakdownList}>
                {Object.entries(stats.byType).map(([typeId, data]) => {
                  const type = getTypeInfo(typeId);
                  return (
                    <div key={typeId} className={styles.breakdownItem}>
                      <div className={styles.breakdownHeader}>
                        <span className={styles.breakdownIcon}>{type.icon}</span>
                        <span className={styles.breakdownName}>{type.name}</span>
                        <span className={styles.breakdownCount}>
                          {data.completed}/{data.total}
                        </span>
                      </div>
                      <ProgressBar value={data.completed} max={data.total} color={type.color} />
                      <span className={styles.breakdownTime}>
                        {Math.round(data.minutes / 60 * 10) / 10}h tracked
                      </span>
                    </div>
                  );
                })}
                {Object.keys(stats.byType).length === 0 && (
                  <p className={styles.emptyMessage}>No tasks in this period</p>
                )}
              </div>
            </div>

            {/* By Tag */}
            <div className={styles.section}>
              <h3>By Tag</h3>
              <div className={styles.breakdownList}>
                {Object.entries(stats.byTag).map(([tagId, data]) => {
                  const tag = getTagInfo(tagId);
                  return (
                    <div key={tagId} className={styles.breakdownItem}>
                      <div className={styles.breakdownHeader}>
                        <span className={styles.breakdownIcon}>{tag.icon}</span>
                        <span className={styles.breakdownName}>{tag.name}</span>
                        <span className={styles.breakdownCount}>
                          {data.completed}/{data.total}
                        </span>
                      </div>
                      <ProgressBar value={data.completed} max={data.total} color={tag.color} />
                    </div>
                  );
                })}
                {Object.keys(stats.byTag).length === 0 && (
                  <p className={styles.emptyMessage}>No tagged tasks in this period</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'trends' && (
          <>
            {/* Daily chart */}
            <div className={styles.section}>
              <h3>Daily Activity</h3>
              <div className={styles.chartContainer}>
                <div className={styles.barChart}>
                  {stats.dailyData.map((day, idx) => {
                    const maxTasks = Math.max(...stats.dailyData.map(d => d.total), 1);
                    const height = (day.completed / maxTasks) * 100;
                    const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div
                        key={idx}
                        className={`${styles.chartBar} ${isToday ? styles.todayBar : ''}`}
                        title={`${format(day.date, 'MMM d')}: ${day.completed}/${day.total} tasks`}
                      >
                        <div
                          className={styles.chartBarFill}
                          style={{ height: `${height}%` }}
                        />
                        <span className={styles.chartBarLabel}>
                          {format(day.date, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.chartLegend}>
                  <span>Tasks completed per day</span>
                </div>
              </div>
            </div>

            {/* Time distribution */}
            <div className={styles.section}>
              <h3>Time Distribution</h3>
              <div className={styles.timeDistribution}>
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1].minutes - a[1].minutes)
                  .slice(0, 5)
                  .map(([typeId, data]) => {
                    const type = getTypeInfo(typeId);
                    const percentage = stats.totalMinutes > 0
                      ? Math.round((data.minutes / stats.totalMinutes) * 100)
                      : 0;
                    return (
                      <div key={typeId} className={styles.timeItem}>
                        <div className={styles.timeItemHeader}>
                          <span>{type.icon} {type.name}</span>
                          <span>{percentage}%</span>
                        </div>
                        <div className={styles.timeBar}>
                          <div
                            className={styles.timeBarFill}
                            style={{ width: `${percentage}%`, backgroundColor: type.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(stats.byType).length === 0 && (
                  <p className={styles.emptyMessage}>No time tracked in this period</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProductivityDashboard;
