import React, { useState, useMemo } from 'react';
import styles from './HistoricalFiguresGantt.module.css';

// Activity type mappings
const GANTT_CATEGORIES = {
  SLEEP: { id: 'sleep', name: 'Sleep', color: '#CBD5E1' },
  DEEP_WORK: { id: 'deep_work', name: 'Deep Work', color: '#2563EB' },
  ADMIN: { id: 'admin', name: 'Admin', color: '#93C5FD' },
  EXERCISE: { id: 'exercise', name: 'Exercise', color: '#10B981' },
  LEISURE: { id: 'leisure', name: 'Leisure/Meals', color: '#F59E0B' }
};

// Historical figures data for Modern era
const MODERN_FIGURES = [
  {
    name: "Elon Musk",
    schedule: [
      { start: 1, end: 7, type: 'SLEEP', desc: "Sleep (6h)" },
      { start: 7, end: 7.5, type: 'ADMIN', desc: "Critical Emails" },
      { start: 7.5, end: 12, type: 'DEEP_WORK', desc: "Engineering/Design" },
      { start: 12, end: 12.5, type: 'LEISURE', desc: "Quick Lunch" },
      { start: 12.5, end: 17, type: 'DEEP_WORK', desc: "Factory Floor" },
      { start: 17, end: 21, type: 'ADMIN', desc: "Meetings/Calls" },
      { start: 21, end: 22, type: 'LEISURE', desc: "Family/Reading" },
      { start: 22, end: 25, type: 'ADMIN', desc: "Late Night Work" }
    ]
  },
  {
    name: "Tim Cook",
    schedule: [
      { start: 21.5, end: 27.75, type: 'SLEEP', desc: "Sleep" },
      { start: 3.75, end: 5, type: 'ADMIN', desc: "Emails/Review" },
      { start: 5, end: 6, type: 'EXERCISE', desc: "Gym" },
      { start: 6, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 18, type: 'DEEP_WORK', desc: "Apple Park" },
      { start: 18, end: 21.5, type: 'LEISURE', desc: "Personal Time" }
    ]
  },
  {
    name: "Jeff Bezos",
    schedule: [
      { start: 22, end: 30.5, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6.5, end: 10, type: 'LEISURE', desc: "Reading/Kids" },
      { start: 10, end: 12, type: 'DEEP_WORK', desc: "High IQ Meetings" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 17, type: 'ADMIN', desc: "Low IQ Tasks" },
      { start: 17, end: 22, type: 'LEISURE', desc: "Family" }
    ]
  },
  {
    name: "Barack Obama",
    schedule: [
      { start: 1, end: 7, type: 'SLEEP', desc: "Sleep" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Workout" },
      { start: 8, end: 9, type: 'LEISURE', desc: "Family Breakfast" },
      { start: 9, end: 18, type: 'DEEP_WORK', desc: "Oval Office" },
      { start: 18, end: 20.5, type: 'LEISURE', desc: "Family Dinner" },
      { start: 20.5, end: 23, type: 'DEEP_WORK', desc: "Briefing Papers" },
      { start: 23, end: 25, type: 'LEISURE', desc: "Reading/ESPN" }
    ]
  },
  {
    name: "Stephen King",
    schedule: [
      { start: 23, end: 31, type: 'SLEEP', desc: "Sleep" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 11.5, type: 'DEEP_WORK', desc: "Writing (2000 Words)" },
      { start: 11.5, end: 13, type: 'ADMIN', desc: "Letters/Paperwork" },
      { start: 13, end: 17, type: 'LEISURE', desc: "Nap/Red Sox" },
      { start: 17, end: 21, type: 'LEISURE', desc: "Family/Reading" },
      { start: 21, end: 23, type: 'LEISURE', desc: "TV" }
    ]
  },
  {
    name: "Bill Gates",
    schedule: [
      { start: 0, end: 7, type: 'SLEEP', desc: "Sleep" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Treadmill + Courses" },
      { start: 8, end: 18, type: 'DEEP_WORK', desc: "Work (5-min blocks)" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 20, end: 22, type: 'ADMIN', desc: "Reading/Email" },
      { start: 22, end: 24, type: 'LEISURE', desc: "Reading" }
    ]
  },
  {
    name: "Oprah Winfrey",
    schedule: [
      { start: 0, end: 5.5, type: 'SLEEP', desc: "Sleep" },
      { start: 5.5, end: 6, type: 'ADMIN', desc: "Meditation" },
      { start: 6, end: 7, type: 'EXERCISE', desc: "Workout" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 13, type: 'LEISURE', desc: "Light Activities" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "Filming/Business" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Reading" },
      { start: 20, end: 22, type: 'ADMIN', desc: "Journaling" },
      { start: 22, end: 24, type: 'SLEEP', desc: "Sleep" }
    ]
  },
  {
    name: "Jack Dorsey",
    schedule: [
      { start: 23, end: 29, type: 'SLEEP', desc: "Sleep" },
      { start: 5, end: 6, type: 'LEISURE', desc: "Ice Bath/Meditation" },
      { start: 6, end: 7.5, type: 'EXERCISE', desc: "Walk to Work (5mi)" },
      { start: 7.5, end: 12, type: 'DEEP_WORK', desc: "Deep Work" },
      { start: 12, end: 13, type: 'LEISURE', desc: "One Meal (Dinner)" },
      { start: 13, end: 17, type: 'ADMIN', desc: "Meetings" },
      { start: 17, end: 23, type: 'LEISURE', desc: "Home/Projects" }
    ]
  }
];

// Historical figures data
const HISTORICAL_FIGURES = [
  {
    name: "Benjamin Franklin",
    schedule: [
      { start: 22, end: 29, type: 'SLEEP', desc: "Sleep" },
      { start: 5, end: 8, type: 'LEISURE', desc: "Rise/Wash/Goodness" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Work" },
      { start: 12, end: 14, type: 'ADMIN', desc: "Read/Accounts" },
      { start: 14, end: 18, type: 'DEEP_WORK', desc: "Work" },
      { start: 18, end: 22, type: 'LEISURE', desc: "Music/Conversation" }
    ]
  },
  {
    name: "Honoré de Balzac",
    schedule: [
      { start: 18, end: 25, type: 'SLEEP', desc: "Sleep (Evening)" },
      { start: 1, end: 8, type: 'DEEP_WORK', desc: "Writing (Coffee)" },
      { start: 8, end: 9.5, type: 'SLEEP', desc: "Nap" },
      { start: 9.5, end: 16, type: 'DEEP_WORK', desc: "Writing (More Coffee)" },
      { start: 16, end: 18, type: 'LEISURE', desc: "Guests/Bath" }
    ]
  },
  {
    name: "Beethoven",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Coffee (60 Beans)" },
      { start: 7, end: 14.5, type: 'DEEP_WORK', desc: "Composing" },
      { start: 14.5, end: 15.5, type: 'LEISURE', desc: "Dinner w/ Wine" },
      { start: 15.5, end: 17.5, type: 'EXERCISE', desc: "Long Walk" },
      { start: 17.5, end: 20, type: 'LEISURE', desc: "Tavern/Newspapers" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Supper/Pipe" }
    ]
  },
  {
    name: "Mozart",
    schedule: [
      { start: 1, end: 6, type: 'SLEEP', desc: "Sleep" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Dressing" },
      { start: 7, end: 9, type: 'DEEP_WORK', desc: "Composing" },
      { start: 9, end: 13, type: 'ADMIN', desc: "Giving Lessons" },
      { start: 13, end: 17, type: 'LEISURE', desc: "Lunch/Socializing" },
      { start: 17, end: 21, type: 'DEEP_WORK', desc: "Composing/Concerts" },
      { start: 21, end: 23, type: 'LEISURE', desc: "Social" },
      { start: 23, end: 25, type: 'DEEP_WORK', desc: "Late Composing" }
    ]
  },
  {
    name: "Charles Darwin",
    schedule: [
      { start: 22.5, end: 31, type: 'SLEEP', desc: "Sleep" },
      { start: 7, end: 7.5, type: 'EXERCISE', desc: "Short Walk" },
      { start: 7.5, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 9.5, type: 'DEEP_WORK', desc: "Focused Work 1" },
      { start: 9.5, end: 10.5, type: 'ADMIN', desc: "Reading Mail" },
      { start: 10.5, end: 12, type: 'DEEP_WORK', desc: "Focused Work 2" },
      { start: 12, end: 12.5, type: 'EXERCISE', desc: "Walk w/ Dog" },
      { start: 12.5, end: 15, type: 'LEISURE', desc: "Lunch/Newspaper" },
      { start: 15, end: 16, type: 'SLEEP', desc: "Nap" },
      { start: 16, end: 16.5, type: 'EXERCISE', desc: "Walk 3" },
      { start: 16.5, end: 17.5, type: 'DEEP_WORK', desc: "Focused Work 3" },
      { start: 17.5, end: 22.5, type: 'LEISURE', desc: "Dinner/Backgammon" }
    ]
  },
  {
    name: "Victor Hugo",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep" },
      { start: 6, end: 11, type: 'ADMIN', desc: "Coffee/Letters" },
      { start: 11, end: 12, type: 'LEISURE', desc: "Ice Bath" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch/Visitors" },
      { start: 13, end: 15, type: 'EXERCISE', desc: "Exercise" },
      { start: 15, end: 16, type: 'ADMIN', desc: "Barber" },
      { start: 16, end: 18, type: 'LEISURE', desc: "Personal Time" },
      { start: 18, end: 20, type: 'DEEP_WORK', desc: "Writing" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Dinner/Cards" }
    ]
  },
  {
    name: "Immanuel Kant",
    schedule: [
      { start: 22, end: 29, type: 'SLEEP', desc: "Sleep" },
      { start: 5, end: 6, type: 'LEISURE', desc: "Tea/Pipe/Meditation" },
      { start: 6, end: 7, type: 'ADMIN', desc: "Lecture Prep" },
      { start: 7, end: 13, type: 'DEEP_WORK', desc: "Writing/Lectures" },
      { start: 13, end: 15.5, type: 'LEISURE', desc: "Lunch (Only Meal)" },
      { start: 15.5, end: 16.5, type: 'EXERCISE', desc: "The Walk (Exact Hour)" },
      { start: 16.5, end: 22, type: 'ADMIN', desc: "Reading/Thinking" }
    ]
  },
  {
    name: "Pablo Picasso",
    schedule: [
      { start: 2, end: 11, type: 'SLEEP', desc: "Sleep (Late Riser)" },
      { start: 11, end: 13, type: 'LEISURE', desc: "Brunch/Friends" },
      { start: 13, end: 15, type: 'LEISURE', desc: "Leisure" },
      { start: 15, end: 22, type: 'DEEP_WORK', desc: "Painting" },
      { start: 22, end: 23, type: 'LEISURE', desc: "Dinner" },
      { start: 23, end: 26, type: 'DEEP_WORK', desc: "Late Painting" }
    ]
  },
  {
    name: "Maya Angelou",
    schedule: [
      { start: 0, end: 5.5, type: 'SLEEP', desc: "Rest" },
      { start: 5.5, end: 6.5, type: 'LEISURE', desc: "Wake/Coffee" },
      { start: 6.5, end: 14, type: 'DEEP_WORK', desc: "Writing" },
      { start: 14, end: 15, type: 'LEISURE', desc: "Lunch" },
      { start: 15, end: 19, type: 'DEEP_WORK', desc: "Editing" },
      { start: 19, end: 22, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 22, end: 24, type: 'SLEEP', desc: "Wind Down" }
    ]
  }
];

function formatTime(decimal) {
  let hrs = Math.floor(decimal) % 24;
  const mins = Math.round((decimal - Math.floor(decimal)) * 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayHrs = hrs % 12 || 12;
  const displayMins = mins < 10 ? '0' + mins : mins;
  return `${displayHrs}:${displayMins} ${ampm}`;
}

// Single circular clock component
function ClockRing({ figure, size = 200, onHover, isHovered }) {
  // Process schedule to handle midnight crossover
  const segments = useMemo(() => {
    const result = [];
    figure.schedule.forEach(block => {
      let start = block.start;
      let end = block.end;

      // Normalize to 0-24 range
      while (start >= 24) start -= 24;
      while (end > 24) end -= 24;

      if (end < start) {
        // Split across midnight
        result.push({ ...block, start, end: 24 });
        if (end > 0) {
          result.push({ ...block, start: 0, end });
        }
      } else {
        result.push({ ...block, start, end });
      }
    });
    return result;
  }, [figure.schedule]);

  // Generate conic gradient
  const gradient = useMemo(() => {
    const parts = [];
    segments.forEach(seg => {
      const startDeg = (seg.start / 24) * 360 - 90; // -90 to start at 12 o'clock
      const endDeg = (seg.end / 24) * 360 - 90;
      const color = GANTT_CATEGORIES[seg.type]?.color || '#94A3B8';
      parts.push(`${color} ${startDeg}deg ${endDeg}deg`);
    });
    return `conic-gradient(from 0deg, ${parts.join(', ')})`;
  }, [segments]);

  const hourMarkers = [0, 6, 12, 18];

  return (
    <div
      className={`${styles.clockCard} ${isHovered ? styles.clockCardHovered : ''}`}
      onMouseEnter={() => onHover(figure)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={styles.clockContainer} style={{ width: size, height: size }}>
        {/* Outer ring with gradient */}
        <div className={styles.clockRing} style={{ background: gradient }} />

        {/* Inner circle (center) */}
        <div className={styles.clockCenter}>
          <span className={styles.clockCenterText}>24h</span>
        </div>

        {/* Hour markers */}
        {hourMarkers.map(hour => {
          const angle = (hour / 24) * 360 - 90;
          const labelRadius = size / 2 + 12;
          const x = Math.cos((angle * Math.PI) / 180) * labelRadius;
          const y = Math.sin((angle * Math.PI) / 180) * labelRadius;
          return (
            <span
              key={hour}
              className={styles.hourLabel}
              style={{
                transform: `translate(${x}px, ${y}px)`
              }}
            >
              {hour === 0 ? '12a' : hour === 6 ? '6a' : hour === 12 ? '12p' : '6p'}
            </span>
          );
        })}

        {/* Tick marks */}
        {[...Array(24)].map((_, i) => {
          const angle = (i / 24) * 360;
          const isMajor = i % 6 === 0;
          return (
            <div
              key={i}
              className={`${styles.tick} ${isMajor ? styles.tickMajor : ''}`}
              style={{ transform: `rotate(${angle}deg)` }}
            />
          );
        })}
      </div>

      <div className={styles.clockName}>{figure.name}</div>
    </div>
  );
}

function HistoricalFiguresGantt() {
  const [era, setEra] = useState('modern');
  const [hoveredFigure, setHoveredFigure] = useState(null);

  const figures = era === 'modern' ? MODERN_FIGURES : HISTORICAL_FIGURES;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>
            THE <span className={styles.accent}>CHRONO</span>MAP
          </h2>
          <p className={styles.subtitle}>24-Hour Routines of Remarkable People</p>
        </div>

        <div className={styles.eraToggle}>
          <button
            className={`${styles.toggleBtn} ${era === 'modern' ? styles.active : ''}`}
            onClick={() => setEra('modern')}
          >
            Modern Titans
          </button>
          <button
            className={`${styles.toggleBtn} ${era === 'historical' ? styles.active : ''}`}
            onClick={() => setEra('historical')}
          >
            Historical Giants
          </button>
        </div>

        <div className={styles.legend}>
          {Object.values(GANTT_CATEGORIES).map(cat => (
            <div key={cat.id} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ backgroundColor: cat.color }} />
              <span>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.clockGrid}>
        {figures.map(figure => (
          <ClockRing
            key={figure.name}
            figure={figure}
            size={180}
            onHover={setHoveredFigure}
            isHovered={hoveredFigure?.name === figure.name}
          />
        ))}
      </div>

      <div className={styles.detailsPanel}>
        {hoveredFigure ? (
          <div className={styles.detailsContent}>
            <h3 className={styles.detailsName}>{hoveredFigure.name}</h3>
            <div className={styles.scheduleBreakdown}>
              {hoveredFigure.schedule.map((block, idx) => {
                const category = GANTT_CATEGORIES[block.type];
                let start = block.start % 24;
                let end = block.end % 24;
                if (end === 0 && block.end > block.start) end = 24;
                return (
                  <div key={idx} className={styles.breakdownItem}>
                    <span
                      className={styles.breakdownDot}
                      style={{ backgroundColor: category?.color }}
                    />
                    <span className={styles.breakdownTime}>
                      {formatTime(start)} – {formatTime(end)}
                    </span>
                    <span className={styles.breakdownDesc}>{block.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className={styles.detailsHint}>
            <strong>Hover over a clock</strong> to see the detailed schedule breakdown
          </p>
        )}
      </div>
    </div>
  );
}

export default HistoricalFiguresGantt;
