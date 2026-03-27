/**
 * OnboardingTour Component
 *
 * Provides a guided tour for new users to learn the app features.
 */

import { useState, useEffect, useCallback } from 'react';
import styles from './OnboardingTour.module.css';

// Tour steps configuration
const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Taskometer!',
    description: 'Build your ideal day with templates, add tasks, and let the scheduler map them. Let\'s take a quick tour.',
    target: null,
    position: 'center'
  },
  {
    id: 'schedules',
    title: '1. Build Your Schedule',
    description: 'Use the Day Builder to split your day into time slots, or pick a famous template. The clock face shows all 24 hours at a glance.',
    target: '[data-tour="schedules"]',
    position: 'bottom'
  },
  {
    id: 'add-task',
    title: '2. Add Your Tasks',
    description: 'Capture tasks with duration, priority, and recurrence. Set tasks to repeat daily, weekly, or monthly. The scheduler auto-places them into your slots.',
    target: '[data-tour="add-task"]',
    position: 'bottom'
  },
  {
    id: 'search-filter',
    title: '3. Search & Filter',
    description: 'Use the search bar to find tasks instantly. Filter by priority, type, or status. Sort by time, priority, or duration. Press / to jump to search.',
    target: '[data-tour="add-task"]',
    position: 'bottom'
  },
  {
    id: 'task-details',
    title: '4. Task Details',
    description: 'Click the "..." button on any task to open its detail panel. Add subtasks, notes, and track time with start/stop timer.',
    target: '[data-tour="add-task"]',
    position: 'bottom'
  },
  {
    id: 'calendar',
    title: '5. Your Calendar',
    description: 'See your week at a glance. Drag tasks to reschedule them, or drag the bottom edge to resize duration. Right-click for more options.',
    target: '[data-tour="calendar"]',
    position: 'bottom'
  },
  {
    id: 'dashboard',
    title: '6. Today View',
    description: 'Your daily command center. See all today\'s tasks, remaining time, and complete or pause tasks inline. No task limit.',
    target: '[data-tour="dashboard"]',
    position: 'bottom'
  },
  {
    id: 'community',
    title: '7. Community Schedules',
    description: 'Browse schedules shared by others. Like your favorites and apply them to your own framework.',
    target: '[data-tour="community"]',
    position: 'bottom'
  },
  {
    id: 'settings',
    title: '8. Settings & Data',
    description: 'Configure auto-scheduling, notifications, export/import your data, and customize keyboard shortcuts. Press ? anytime to see all shortcuts.',
    target: '[data-tour="settings"]',
    position: 'left'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Build a schedule, add tasks, and structure your day. You can replay this tour anytime from Settings.',
    target: null,
    position: 'center'
  }
];

// Storage key
const TOUR_COMPLETED_KEY = 'taskometer-tour-completed';

function OnboardingTour({ onComplete }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  // Check if tour should show
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!completed) {
      // Delay showing tour to let UI render
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update target position
  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (step.target) {
      const updatePosition = () => {
        const element = document.querySelector(step.target);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  // Handle next step
  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  }, [currentStep]);

  // Handle previous step
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Complete tour
  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  // Skip tour
  const skipTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'skipped');
    onComplete?.();
  }, [onComplete]);

  // Restart tour (for external use)
  const restartTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
  }, []);

  // Expose restart function
  useEffect(() => {
    window.restartOnboardingTour = restartTour;
    return () => {
      delete window.restartOnboardingTour;
    };
  }, [restartTour]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Calculate tooltip position
  function getTooltipStyle() {
    if (!targetRect || step.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const style = { position: 'fixed' };
    const padding = 12;

    switch (step.position) {
      case 'bottom':
        style.top = `${targetRect.bottom + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = `${window.innerHeight - targetRect.top + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.right = `${window.innerWidth - targetRect.left + padding}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'right':
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.left = `${targetRect.right + padding}px`;
        style.transform = 'translateY(-50%)';
        break;
      default:
        break;
    }

    return style;
  }

  return (
    <div className={styles.overlay}>
      {/* Spotlight */}
      {targetRect && (
        <div
          className={styles.spotlight}
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16
          }}
        />
      )}

      {/* Tooltip */}
      <div className={styles.tooltip} style={getTooltipStyle()}>
        <div className={styles.tooltipHeader}>
          <h3>{step.title}</h3>
          <span className={styles.stepCounter}>
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
        </div>
        <p className={styles.tooltipDescription}>{step.description}</p>
        <div className={styles.tooltipActions}>
          {!isFirstStep && (
            <button className={styles.backButton} onClick={prevStep}>
              Back
            </button>
          )}
          <div className={styles.tooltipRight}>
            {!isLastStep && (
              <button className={styles.skipButton} onClick={skipTour}>
                Skip Tour
              </button>
            )}
            <button className={styles.nextButton} onClick={nextStep}>
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className={styles.progressDots}>
          {TOUR_STEPS.map((_, index) => (
            <span
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.activeDot : ''} ${index < currentStep ? styles.completedDot : ''}`}
              onClick={() => setCurrentStep(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;
