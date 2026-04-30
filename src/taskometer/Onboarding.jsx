import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'taskometer.onboarding.done';

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
    target: null,
  },
  {
    title: '1. Pick a wheel',
    body: 'Try the dropdown — pick any of the famous schedules or a starter. The whole day repaints to match.',
    target: '[data-onboard="wheel-picker"]',
    awaitSignal: 'wheelPicked',
    progressHint: "go ahead — change the dropdown",
  },
  {
    title: '2. Click a block',
    body: 'Tap any colored wedge. It stays highlighted and the task-type dropdown below auto-matches.',
    target: '[data-onboard="wheel"]',
    awaitSignal: 'blockClicked',
    progressHint: "click a wedge on the wheel",
  },
  {
    title: '3. Add a task',
    body: 'Type something into the orange box and hit Add. It lands inside the block you selected.',
    target: '[data-onboard="composer"]',
    awaitSignal: 'taskAdded',
    progressHint: "add any task to continue",
  },
  {
    title: '4. Reshape your day',
    body: 'Click a wedge then hit the ⚙ gear to edit its label, color, or time. Drag the wedge edges to resize.',
    target: '[data-onboard="wheel"]',
  },
  {
    title: '5. Your account',
    body: 'Open the account button in the top-right to view your profile or sign out. Guest sessions reset on refresh.',
    target: '[data-onboard="account"]',
    awaitSignal: 'accountOpened',
    progressHint: "click the account button",
  },
  {
    title: "You're all set",
    body: 'Click the ? icon in the top right anytime to replay this tour. Have fun!',
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
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const rect = useTargetRect(step.target, i);

  // Snapshot signal values when a step opens; auto-advance when they change.
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
      // small delay so the user sees their action register before advancing
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
