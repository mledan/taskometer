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
    title: 'Welcome to LifeOS!',
    description: 'Start with a schedule template, then add tasks and let AI map your day. Let\'s take a quick tour.',
    target: null, // No target - centered modal
    position: 'center'
  },
  {
    id: 'schedules',
    title: 'Step 1: Pick a Schedule Template',
    description: 'Choose your base day first: sleep, meals, and work structure. Then browse famous and community routines.',
    target: '[data-tour="schedules"]',
    position: 'bottom'
  },
  {
    id: 'defaults',
    title: 'Step 2: Build Your Default Day',
    description: 'Split your day into time slots visually. Set types, tags, and flexibility per slot. These defaults auto-generate your upcoming calendar.',
    target: '[data-tour="defaults"]',
    position: 'bottom'
  },
  {
    id: 'add-task',
    title: 'Step 3: Add Your Tasks',
    description: 'Capture tasks with duration and priority. The scheduler can place them into your active template.',
    target: '[data-tour="add-task"]',
    position: 'bottom'
  },
  {
    id: 'calendar',
    title: 'Step 4: Review Your Planned Day',
    description: 'See how your template and tasks combine on the calendar, then adjust details as needed.',
    target: '[data-tour="calendar"]',
    position: 'bottom'
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'Get a quick summary of focus, progress, and upcoming work at any time.',
    target: '[data-tour="dashboard"]',
    position: 'bottom'
  },
  {
    id: 'palace',
    title: 'Memory Palace',
    description: 'Create visual memory palaces to link tasks with locations. A powerful technique for remembering and organizing.',
    target: '[data-tour="palace"]',
    position: 'bottom'
  },
  {
    id: 'task-types',
    title: 'Task Types',
    description: 'Customize task categories (Work, Personal, Health, etc.). Each type has its own color and default settings.',
    target: '[data-tour="task-types"]',
    position: 'bottom'
  },
  {
    id: 'history',
    title: 'Analytics & History',
    description: 'Track your productivity, view completed tasks, and analyze your patterns over time.',
    target: '[data-tour="history"]',
    position: 'bottom'
  },
  {
    id: 'community',
    title: 'Community Schedules',
    description: 'Discover and share schedules with the community. Like schedules that inspire you.',
    target: '[data-tour="community"]',
    position: 'bottom'
  },
  {
    id: 'theme',
    title: 'Customize Your Experience',
    description: 'Toggle between light and dark mode. Your preference is saved automatically.',
    target: '[data-tour="theme"]',
    position: 'left'
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press "?" anytime to see all keyboard shortcuts. Use "G+D" for Dashboard, "G+T" for Tasks, "G+P" for Palace, etc.',
    target: null,
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Pick a schedule, add tasks, and let AI structure your day. You can always replay this tour from Settings.',
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
