import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EVENTS } from '../services/events.js';

const DONE_KEY = 'taskometer.onboarding.done';
const LIVE_KEY = 'taskometer.onboarding.live';
const STEP_KEY = 'taskometer.onboarding.step';

export function hasSeenOnboarding() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch (_) { return false; }
}

/** Has the user started the tour but not finished it? Used by App.jsx
 *  to decide whether to mount the overlay across route changes. */
export function isOnboardingLive() {
  try { return localStorage.getItem(LIVE_KEY) === '1'; } catch (_) { return false; }
}

/** Begin the tour. Called from anywhere — sets the live flag and
 *  resets to step 0 so re-running starts fresh. */
export function startOnboarding() {
  try {
    localStorage.setItem(LIVE_KEY, '1');
    localStorage.setItem(STEP_KEY, '0');
  } catch (_) {}
}

function markSeen() {
  try {
    localStorage.setItem(DONE_KEY, '1');
    localStorage.removeItem(LIVE_KEY);
    localStorage.removeItem(STEP_KEY);
  } catch (_) {}
}

function readStep() {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    return raw ? Math.max(0, Math.min(parseInt(raw, 10) || 0, 99)) : 0;
  } catch (_) { return 0; }
}
function writeStep(i) {
  try { localStorage.setItem(STEP_KEY, String(i)); } catch (_) {}
}

// Tour script — capture, plan, repeat.
// We start with capture because the most common failure mode is a
// blank planner: type something now, decide where it goes later. Then
// drag from the inbox into a block. Then point at the shapes rail for
// when the skeleton needs to change. Each step optionally watches a
// signal so the tour auto-advances when the user actually performs
// the action.
const STEPS = [
  {
    title: 'Welcome to taskometer',
    body: 'Your week already has a schedule. Capture things as they come up, drag them into blocks when you sit down to plan. No empty planner.',
    target: null,
  },
  {
    title: '1. Capture anything',
    body: "Type a task into the inbox at the top and hit Enter. No type, no time, no block — just text. Hotkey n focuses this from anywhere.",
    target: '[data-onboard="quick-capture"]',
    awaitEvent: EVENTS.TASK_ADDED,
    progressHint: 'type something and hit Enter · or hit Next',
  },
  {
    title: '2. Drag into a block',
    body: "When you're ready to plan, drag a task from the inbox onto a colored wedge in your day. That's it — the task is scheduled.",
    target: '[data-onboard="inbox"]',
    awaitEvent: EVENTS.SLOT_SELECTED,
    progressHint: 'drag a task onto a block · or hit Next',
  },
  {
    title: '3. Swap schedules when you need to',
    body: "Your day already runs Workday on weekdays, Weekend on Sat/Sun. Pick a different schedule to repaint a day — click the chip in the header to swap.",
    target: '[data-onboard="wheel-picker"]',
    awaitEvent: EVENTS.WHEEL_APPLIED,
    progressHint: 'pick a schedule · or hit Next',
  },
  {
    title: "You're set",
    body: 'Press n to capture, Cmd+K for the palette, ? to replay this tour. The rest is just doing.',
    target: null,
  },
];

const PADDING = 12;

function useTargetRect(selector, stepIndex) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    };
    measure();
    const id = setTimeout(measure, 250); // re-measure after smooth scroll settles
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector, stepIndex]);
  return rect;
}

function pickPanelPlacement(rect) {
  // Place the coach panel adjacent to the target without overlapping it.
  if (!rect) {
    return { right: 24, bottom: 24, top: 'auto', left: 'auto' };
  }
  const margin = 24;
  const panelW = 340;
  const panelH = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // try right side first
  if (rect.left + rect.width + margin + panelW < vw) {
    return {
      left: rect.left + rect.width + margin,
      top: Math.max(margin, Math.min(vh - panelH - margin, rect.top + rect.height / 2 - panelH / 2)),
    };
  }
  // try left side
  if (rect.left - margin - panelW > 0) {
    return {
      left: rect.left - margin - panelW,
      top: Math.max(margin, Math.min(vh - panelH - margin, rect.top + rect.height / 2 - panelH / 2)),
    };
  }
  // fall back to below
  if (rect.top + rect.height + margin + panelH < vh) {
    return {
      left: Math.max(margin, Math.min(vw - panelW - margin, rect.left + rect.width / 2 - panelW / 2)),
      top: rect.top + rect.height + margin,
    };
  }
  // fall back to above
  return {
    left: Math.max(margin, Math.min(vw - panelW - margin, rect.left + rect.width / 2 - panelW / 2)),
    top: Math.max(margin, rect.top - margin - panelH),
  };
}

export default function Onboarding({ onClose, signals = {} }) {
  // Persist the active step in localStorage so the tour survives a
  // route navigation (the user clicking the "Open year canvas" button
  // mid-tour). On mount we restore from disk; on every change we
  // write back. Bounded by STEPS.length so a stale index can't crash.
  const [i, setI] = useState(() => Math.min(readStep(), STEPS.length - 1));
  useEffect(() => { writeStep(i); }, [i]);

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const rect = useTargetRect(step.target, i);

  // Auto-advance when the step's awaitEvent fires anywhere in the
  // app. Manual Next/Back buttons still work — events and clicks are
  // both first-class. We use a generation counter so re-mounting the
  // listener (when i changes) starts a fresh subscription.
  React.useEffect(() => {
    if (!step.awaitEvent) return;
    const handler = () => {
      // small delay so the user sees the action register visually
      // before the spotlight jumps to the next step.
      const t = setTimeout(() => setI((cur) => (cur === i ? cur + 1 : cur)), 450);
      // store the timer on the listener so cleanup can clear it
      handler._t = t;
    };
    window.addEventListener(step.awaitEvent, handler);
    return () => {
      if (handler._t) clearTimeout(handler._t);
      window.removeEventListener(step.awaitEvent, handler);
    };
  }, [step.awaitEvent, i]);

  // Legacy signals path kept as a fallback for any caller still
  // passing the old prop. New code should emit events instead.
  const baselineRef = React.useRef({});
  React.useEffect(() => {
    baselineRef.current = { ...signals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  React.useEffect(() => {
    if (!step.awaitSignal) return;
    const baseline = baselineRef.current[step.awaitSignal];
    const current = signals[step.awaitSignal];
    if (current !== undefined && current !== baseline) {
      const t = setTimeout(() => setI((cur) => (cur === i ? cur + 1 : cur)), 450);
      return () => clearTimeout(t);
    }
  }, [signals, step.awaitSignal, i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' && !isLast) setI(i + 1);
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, isLast]);

  const finish = () => {
    markSeen();
    onClose?.();
  };

  const placement = pickPanelPlacement(rect);

  // Spotlight uses an SVG mask: full-screen dim, with a rounded rectangle
  // cutout where the target is, plus a pulsing orange ring drawn on top.
  return (
    <>
      <style>{`
        @keyframes sc-pulse-ring {
          0% { stroke-opacity: 0.95; stroke-width: 3.5; }
          50% { stroke-opacity: 0.45; stroke-width: 7; }
          100% { stroke-opacity: 0.95; stroke-width: 3.5; }
        }
        @keyframes sc-panel-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sc-onb-ring { animation: sc-pulse-ring 1.6s ease-in-out infinite; }
        .sc-onb-panel { animation: sc-panel-in 0.28s ease-out both; }
      `}</style>

      {/* Four dim panels framing the spotlight cutout. Leaves the cutout
          itself completely uncovered so clicks pass through to the real
          UI underneath — no more accidental dismissals when the user
          tries the highlighted control. */}
      {(() => {
        if (!rect) {
          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(20, 18, 14, 0.55)',
                zIndex: 250,
                pointerEvents: 'none',
              }}
            />
          );
        }
        const top = Math.max(0, rect.top - PADDING);
        const bottom = rect.top + rect.height + PADDING;
        const left = Math.max(0, rect.left - PADDING);
        const right = rect.left + rect.width + PADDING;
        const dim = 'rgba(20, 18, 14, 0.55)';
        const base = { position: 'fixed', background: dim, zIndex: 250, pointerEvents: 'none' };
        return (
          <>
            <div style={{ ...base, top: 0, left: 0, right: 0, height: top }} />
            <div style={{ ...base, top: bottom, left: 0, right: 0, bottom: 0 }} />
            <div style={{ ...base, top, height: bottom - top, left: 0, width: left }} />
            <div style={{ ...base, top, height: bottom - top, left: right, right: 0 }} />
          </>
        );
      })()}

      {rect && (
        <svg
          width="100%"
          height="100%"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 251,
            pointerEvents: 'none',
          }}
        >
          <rect
            className="sc-onb-ring"
            x={rect.left - PADDING}
            y={rect.top - PADDING}
            width={rect.width + PADDING * 2}
            height={rect.height + PADDING * 2}
            rx="14"
            ry="14"
            fill="none"
            stroke="var(--orange, #D4663A)"
            strokeWidth="4"
            style={{ filter: 'drop-shadow(0 0 12px rgba(212,102,58,0.55))' }}
          />
        </svg>
      )}

      <div
        role="dialog"
        aria-label="onboarding"
        className="sc-onb-panel"
        style={{
          position: 'fixed',
          width: 340,
          maxWidth: 'calc(100vw - 40px)',
          background: 'var(--paper)',
          border: '2px solid var(--orange)',
          borderRadius: 12,
          padding: '16px 18px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
          zIndex: 260,
          fontFamily: 'inherit',
          ...placement,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--ink-mute)',
              letterSpacing: 1,
            }}
          >
            {i + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            className="tm-btn tm-sm"
            onClick={finish}
            aria-label="skip onboarding"
            title="skip"
            style={{ fontSize: 12 }}
          >
            skip
          </button>
        </div>

        <div
          style={{
            fontFamily: 'Caveat, cursive',
            fontSize: 26,
            lineHeight: 1.1,
            color: 'var(--orange)',
            marginBottom: 6,
          }}
        >
          {step.title}
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.45, marginBottom: step.progressHint ? 8 : 14 }}>
          {step.body}
        </div>
        {step.progressHint && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--orange)',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--orange)',
                animation: 'sc-pulse-ring 1.2s ease-in-out infinite',
              }}
            />
            {step.progressHint}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: idx === i ? 'var(--orange)' : 'var(--rule)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          {i > 0 && (
            <button type="button" className="tm-btn tm-sm" onClick={() => setI(i - 1)}>
              back
            </button>
          )}
          {!isLast ? (
            <button type="button" className="tm-btn tm-primary tm-sm" onClick={() => setI(i + 1)}>
              next
            </button>
          ) : (
            <button type="button" className="tm-btn tm-primary tm-sm" onClick={finish}>
              got it
            </button>
          )}
        </div>
      </div>
    </>
  );
}
