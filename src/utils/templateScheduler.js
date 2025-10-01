// Enhanced Intelligent Scheduler with Template-Based Task Slotting

import { BLOCK_CATEGORIES, autoSlotTaskIntoTemplate, applyTemplateToDateRange } from './enhancedTemplates.js';
import { toLocalTime, toUTCFromLocal } from './timeDisplay.js';

// Map task types to block categories
export const TASK_TYPE_TO_CATEGORY_MAP = {
  'work': 'professional_duties',
  'personal': 'personal_development',
  'exercise': 'exercise_personal',
  'creative': 'creative_work',
  'learning': 'personal_development',
  'meals': 'meals',
  'social': 'social',
  'rest': 'rest',
  'default': 'flexible_work'
};

/**
 * Apply a template to a date range and auto-slot existing tasks
 */
export function applyTemplateWithTasks(template, startDate, endDate, existingTasks, options = {}) {
  const {
    overrideExisting = false,
    smartSlotting = true,
    preserveManualSchedules = true
  } = options;
  
  // Apply template to date range to get blocks
  const templateBlocks = applyTemplateToDateRange(template, startDate, endDate, options);
  
  // Filter tasks that need scheduling
  const tasksToSchedule = existingTasks.filter(task => {
    if (task.status === 'completed') return false;
    if (preserveManualSchedules && task.manuallyScheduled) return false;
    if (!task.scheduledTime || overrideExisting) return true;
    return false;
  });
  
  // Group blocks by date for easier processing
  const blocksByDate = {};
  templateBlocks.forEach(block => {
    const dateKey = block.date.toISOString().split('T')[0];
    if (!blocksByDate[dateKey]) {
      blocksByDate[dateKey] = [];
    }
    blocksByDate[dateKey].push(block);
  });
  
  // Schedule tasks using smart slotting
  const scheduledTasks = [];
  const overflowTasks = [];
  
  if (smartSlotting) {
    tasksToSchedule.forEach(task => {
      // Add category to task if not present
      if (!task.category) {
        task.category = TASK_TYPE_TO_CATEGORY_MAP[task.taskType] || 'flexible_work';
      }
      
      // Try to slot task into appropriate blocks
      let scheduled = false;
      
      // Sort dates to prefer earlier slots
      const sortedDates = Object.keys(blocksByDate).sort();
      
      for (const dateKey of sortedDates) {
        const dayBlocks = blocksByDate[dateKey];
        const result = autoSlotTaskIntoTemplate(task, dayBlocks, scheduledTasks);
        
        if (!result.overflow) {
          scheduledTasks.push({
            ...task,
            scheduledTime: result.scheduledTime,
            templateBlockId: result.templateBlockId,
            templateBlockName: result.templateBlockName,
            category: result.category,
            autoScheduled: true
          });
          scheduled = true;
          break;
        }
      }
      
      if (!scheduled) {
        overflowTasks.push(task);
      }
    });
  }
  
  return {
    templateBlocks,
    scheduledTasks,
    overflowTasks,
    blocksByDate
  };
}

/**
 * Get suggested time slots for a task based on template
 */
export function getSuggestedSlotsForTask(task, template, existingTasks = []) {
  const suggestions = [];
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  // Apply template to next 7 days
  const templateBlocks = applyTemplateToDateRange(template, today, nextWeek);
  
  // Find matching blocks
  const matchingBlocks = templateBlocks.filter(block => {
    // Check category match
    const taskCategory = TASK_TYPE_TO_CATEGORY_MAP[task.taskType] || 'flexible_work';
    if (block.category !== taskCategory && !block.allowedTaskTypes.includes(task.taskType)) {
      return false;
    }
    
    // Check capacity
    const usedCapacity = existingTasks
      .filter(t => t.templateBlockId === block.id && t.scheduledTime)
      .reduce((sum, t) => sum + (t.duration || 30), 0);
    
    const remainingCapacity = (block.capacity || block.duration) - usedCapacity;
    return remainingCapacity >= task.duration;
  });
  
  // Sort by preference
  matchingBlocks.sort((a, b) => {
    // Prefer earlier dates
    const dateA = new Date(a.startTime);
    const dateB = new Date(b.startTime);
    
    // Priority-based time preferences
    if (task.priority === 'high') {
      // High priority prefers morning
      const hourA = dateA.getHours();
      const hourB = dateB.getHours();
      if (hourA < 12 && hourB >= 12) return -1;
      if (hourA >= 12 && hourB < 12) return 1;
    }
    
    return dateA - dateB;
  });
  
  // Return top 3 suggestions
  return matchingBlocks.slice(0, 3).map(block => ({
    blockId: block.id,
    blockName: block.label,
    date: block.date,
    startTime: block.startTime,
    endTime: block.endTime,
    category: block.category,
    confidence: calculateConfidence(task, block)
  }));
}

/**
 * Calculate confidence score for task-block matching
 */
function calculateConfidence(task, block) {
  let score = 0;
  
  // Category match
  const taskCategory = TASK_TYPE_TO_CATEGORY_MAP[task.taskType] || 'flexible_work';
  if (block.category === taskCategory) {
    score += 40;
  } else if (block.allowedTaskTypes.includes(task.taskType)) {
    score += 30;
  }
  
  // Time preference match
  const hour = new Date(block.startTime).getHours();
  if (task.priority === 'high' && hour < 12) {
    score += 20; // Morning for high priority
  } else if (task.priority === 'medium' && hour >= 12 && hour < 17) {
    score += 20; // Afternoon for medium
  } else if (task.priority === 'low' && hour >= 17) {
    score += 20; // Evening for low
  }
  
  // Duration fit
  const blockDuration = block.capacity || block.duration;
  if (task.duration <= blockDuration * 0.5) {
    score += 20; // Good fit
  } else if (task.duration <= blockDuration * 0.8) {
    score += 10; // Acceptable fit
  }
  
  // Day preference (if specified)
  if (task.preferredDays && task.preferredDays.length > 0) {
    const dayName = new Date(block.date).toLocaleDateString('en-US', { weekday: 'long' });
    if (task.preferredDays.includes(dayName)) {
      score += 20;
    }
  }
  
  return Math.min(100, score);
}

/**
 * Handle overflow tasks when template blocks are full
 */
export function handleOverflowTasks(overflowTasks, options = {}) {
  const {
    strategy = 'extend', // 'extend', 'compress', 'defer', 'buffer'
    bufferBlocks = [],
    maxExtension = 120 // Maximum minutes to extend blocks
  } = options;
  
  const solutions = [];
  
  switch (strategy) {
    case 'extend':
      // Suggest extending work blocks
      overflowTasks.forEach(task => {
        solutions.push({
          task,
          solution: 'extend',
          message: `Extend work hours by ${task.duration} minutes to accommodate "${task.text}"`,
          additionalTime: task.duration
        });
      });
      break;
      
    case 'compress':
      // Suggest compressing existing tasks
      const totalOverflow = overflowTasks.reduce((sum, task) => sum + task.duration, 0);
      solutions.push({
        solution: 'compress',
        message: `Compress existing tasks by ${Math.ceil(totalOverflow * 0.2)} minutes each to fit overflow`,
        compressionFactor: 0.8
      });
      break;
      
    case 'defer':
      // Suggest moving to next available day
      overflowTasks.forEach(task => {
        solutions.push({
          task,
          solution: 'defer',
          message: `Defer "${task.text}" to next available day`,
          deferDays: 1
        });
      });
      break;
      
    case 'buffer':
      // Use buffer/flex blocks
      overflowTasks.forEach(task => {
        const availableBuffer = bufferBlocks.find(b => b.capacity >= task.duration);
        if (availableBuffer) {
          solutions.push({
            task,
            solution: 'buffer',
            message: `Schedule "${task.text}" in buffer block at ${availableBuffer.start}`,
            bufferBlock: availableBuffer
          });
        } else {
          solutions.push({
            task,
            solution: 'defer',
            message: `No buffer available for "${task.text}", suggest deferring`,
            deferDays: 1
          });
        }
      });
      break;
  }
  
  return solutions;
}

/**
 * Validate template application before committing
 */
export function validateTemplateApplication(template, tasks, options = {}) {
  const validation = {
    isValid: true,
    warnings: [],
    errors: [],
    stats: {
      totalTasks: tasks.length,
      fittingTasks: 0,
      overflowTasks: 0,
      totalTaskTime: 0,
      totalTemplateCapacity: 0
    }
  };
  
  // Calculate total task time
  validation.stats.totalTaskTime = tasks.reduce((sum, task) => sum + (task.duration || 30), 0);
  
  // Calculate template capacity by category
  const capacityByCategory = {};
  template.timeBlocks.forEach(block => {
    if (!capacityByCategory[block.category]) {
      capacityByCategory[block.category] = 0;
    }
    capacityByCategory[block.category] += block.capacity || block.duration;
  });
  
  validation.stats.totalTemplateCapacity = Object.values(capacityByCategory).reduce((sum, cap) => sum + cap, 0);
  
  // Check task fit by category
  const tasksByCategory = {};
  tasks.forEach(task => {
    const category = TASK_TYPE_TO_CATEGORY_MAP[task.taskType] || 'flexible_work';
    if (!tasksByCategory[category]) {
      tasksByCategory[category] = [];
    }
    tasksByCategory[category].push(task);
  });
  
  // Validate each category
  Object.entries(tasksByCategory).forEach(([category, categoryTasks]) => {
    const categoryTime = categoryTasks.reduce((sum, task) => sum + (task.duration || 30), 0);
    const categoryCapacity = capacityByCategory[category] || 0;
    
    if (categoryTime > categoryCapacity) {
      validation.warnings.push({
        type: 'capacity_exceeded',
        category,
        message: `${category} tasks (${categoryTime}min) exceed block capacity (${categoryCapacity}min)`,
        overflow: categoryTime - categoryCapacity
      });
      validation.stats.overflowTasks += categoryTasks.length;
    } else {
      validation.stats.fittingTasks += categoryTasks.length;
    }
  });
  
  // Check for scheduling conflicts
  if (validation.stats.overflowTasks > 0) {
    validation.warnings.push({
      type: 'overflow',
      message: `${validation.stats.overflowTasks} tasks may not fit in the template`,
      suggestion: 'Consider using overflow handling strategies'
    });
  }
  
  // Check template compatibility
  if (validation.stats.totalTaskTime > validation.stats.totalTemplateCapacity * 1.2) {
    validation.errors.push({
      type: 'incompatible',
      message: 'Total task time significantly exceeds template capacity',
      suggestion: 'Choose a different template or reduce task load'
    });
    validation.isValid = false;
  }
  
  return validation;
}

/**
 * Create a preview of template application
 */
export function previewTemplateApplication(template, tasks, dateRange) {
  const preview = {
    template: {
      name: template.name,
      author: template.author,
      description: template.description
    },
    dateRange: {
      start: dateRange.start,
      end: dateRange.end,
      days: Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
    },
    blocks: [],
    scheduledTasks: [],
    unscheduledTasks: []
  };
  
  // Apply template and get results
  const result = applyTemplateWithTasks(
    template,
    dateRange.start,
    dateRange.end,
    tasks,
    { smartSlotting: true }
  );
  
  // Format for preview
  preview.blocks = result.templateBlocks.map(block => ({
    date: block.date,
    time: `${block.start} - ${block.end}`,
    category: block.label,
    capacity: block.capacity,
    color: block.color,
    icon: block.icon
  }));
  
  preview.scheduledTasks = result.scheduledTasks.map(task => ({
    text: task.text,
    scheduledTime: task.scheduledTime,
    blockName: task.templateBlockName,
    duration: task.duration
  }));
  
  preview.unscheduledTasks = result.overflowTasks.map(task => ({
    text: task.text,
    duration: task.duration,
    reason: 'No suitable block found'
  }));
  
  return preview;
}