import React, { useState } from 'react';

const STORAGE_KEY = 'smartcircle.onboarding.done';

export function hasSeenOnboarding() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
}

function markSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
}

const STEPS = [
  {
    title: 'Welcome to your day',
    body: 'Smart Circle turns your day into a 24-hour wheel. Each colored block is a chunk of time — sleep, work, meals, whatever you want.',
  },
  {
    title: '1. Pick a wheel',
    body: 'Use the dropdown to the left of the circle. "Weekday 9-5 (Typical)" is already selected to get you started — you can swap or edit it anytime.',
  },
  {
    title: '2. Click a block',
    body: 'Tap any colored section on the wheel. It will stay highlighted, and the task type dropdown below will update to match.',
  },
  {
    title: '3. Add a task',
    body: 'Type what you need to do in the big orange "What do you need to do?" box and hit Add. Your task lands inside the selected block.',
  },
  {
    title: '4. Reshape your day',
    body: 'Click the ⚙ gear on a block to edit its label, color, or time. Drag the edges of a wedge on the wheel to resize it.',
  },
  {
    title: "You're all set",
    body: 'Click the ? icon in the top right anytime to replay this tour. Have fun!',
  },
];

export default function Onboarding({ onClose }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  const finish = () => {
    markSeen();
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-label="onboarding"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 340,
        maxWidth: 'calc(100vw - 40px)',
        background: 'var(--paper)',
        border: '2px solid var(--orange)',
        borderRadius: 12,
        padding: '16px 18px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        zIndex: 180,
        fontFamily: 'inherit',
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
      <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.45, marginBottom: 14 }}>
        {step.body}
      </div>

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
  );
}
