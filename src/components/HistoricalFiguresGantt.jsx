import React, { useState, useMemo } from 'react';
import styles from './HistoricalFiguresGantt.module.css';

// Activity type mappings
const GANTT_CATEGORIES = {
  SLEEP: { id: 'sleep', name: 'Sleep', color: '#CBD5E1' },
  DEEP_WORK: { id: 'deep_work', name: 'Deep Work', color: '#2563EB' },
  ADMIN: { id: 'admin', name: 'Admin', color: '#93C5FD' },
  EXERCISE: { id: 'exercise', name: 'Exercise', color: '#10B981' },
  LEISURE: { id: 'leisure', name: 'Leisure/Meals', color: '#F59E0B' },
  NAP: { id: 'nap', name: 'Nap/Rest', color: '#A78BFA' },
  CREATIVE: { id: 'creative', name: 'Creative', color: '#EC4899' }
};

// ============================================
// WORK CULTURE SCHEDULES
// Famous/notorious work schedules from around the world
// ============================================
const WORK_CULTURE_SCHEDULES = [
  {
    name: "996 (China Tech)",
    subtitle: "9am-9pm, 6 days/week",
    source: "Chinese tech industry standard",
    schedule: [
      { start: 0, end: 7, type: 'SLEEP', desc: "Sleep (7h)" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Commute/Breakfast" },
      { start: 8, end: 9, type: 'ADMIN', desc: "Arrive Early" },
      { start: 9, end: 12, type: 'DEEP_WORK', desc: "Morning Work" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch at Desk" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "Afternoon Work" },
      { start: 18, end: 19, type: 'LEISURE', desc: "Dinner at Office" },
      { start: 19, end: 21, type: 'DEEP_WORK', desc: "Evening Work" },
      { start: 21, end: 22, type: 'ADMIN', desc: "Commute Home" },
      { start: 22, end: 24, type: 'LEISURE', desc: "Personal Time" }
    ]
  },
  {
    name: "007 (Extreme China)",
    subtitle: "24/7 availability",
    source: "Midnight to midnight, 7 days",
    schedule: [
      { start: 0, end: 4, type: 'DEEP_WORK', desc: "Night Shift Work" },
      { start: 4, end: 8, type: 'SLEEP', desc: "Brief Sleep" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Morning Work" },
      { start: 12, end: 12.5, type: 'LEISURE', desc: "Quick Lunch" },
      { start: 12.5, end: 18, type: 'DEEP_WORK', desc: "Afternoon Work" },
      { start: 18, end: 18.5, type: 'LEISURE', desc: "Quick Dinner" },
      { start: 18.5, end: 24, type: 'DEEP_WORK', desc: "Night Work" }
    ]
  },
  {
    name: "Classic 9-to-5",
    subtitle: "Traditional Western",
    source: "Standard 40-hour work week",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Morning Routine" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast/Commute" },
      { start: 8, end: 9, type: 'ADMIN', desc: "Arrive/Coffee" },
      { start: 9, end: 12, type: 'DEEP_WORK', desc: "Morning Work" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch Break" },
      { start: 13, end: 17, type: 'DEEP_WORK', desc: "Afternoon Work" },
      { start: 17, end: 18, type: 'ADMIN', desc: "Commute Home" },
      { start: 18, end: 22, type: 'LEISURE', desc: "Evening/Family" }
    ]
  },
  {
    name: "Swedish 6-Hour Day",
    subtitle: "Nordic productivity model",
    source: "Swedish workplace experiment",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 7, type: 'EXERCISE', desc: "Morning Exercise" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 9, type: 'ADMIN', desc: "Commute" },
      { start: 9, end: 12, type: 'DEEP_WORK', desc: "Focused Work" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Fika (Coffee Break)" },
      { start: 13, end: 15, type: 'DEEP_WORK', desc: "Afternoon Focus" },
      { start: 15, end: 18, type: 'LEISURE', desc: "Personal Time" },
      { start: 18, end: 19, type: 'LEISURE', desc: "Dinner" },
      { start: 19, end: 22, type: 'LEISURE', desc: "Family/Hobbies" }
    ]
  },
  {
    name: "4-Day Work Week",
    subtitle: "Modern productivity movement",
    source: "32-hour compressed schedule",
    schedule: [
      { start: 23, end: 31, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Morning Routine" },
      { start: 8, end: 9, type: 'ADMIN', desc: "Commute/Setup" },
      { start: 9, end: 13, type: 'DEEP_WORK', desc: "Deep Work Block 1" },
      { start: 13, end: 14, type: 'LEISURE', desc: "Lunch" },
      { start: 14, end: 18, type: 'DEEP_WORK', desc: "Deep Work Block 2" },
      { start: 18, end: 19, type: 'EXERCISE', desc: "Exercise" },
      { start: 19, end: 20, type: 'LEISURE', desc: "Dinner" },
      { start: 20, end: 23, type: 'LEISURE', desc: "Personal Time" }
    ]
  },
  {
    name: "Investment Banker",
    subtitle: "Wall Street hours",
    source: "100+ hour weeks typical",
    schedule: [
      { start: 2, end: 7, type: 'SLEEP', desc: "Sleep (5h)" },
      { start: 7, end: 7.5, type: 'LEISURE', desc: "Quick Shower" },
      { start: 7.5, end: 8, type: 'ADMIN', desc: "Car to Office" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Deal Work" },
      { start: 12, end: 12.5, type: 'LEISURE', desc: "Desk Lunch" },
      { start: 12.5, end: 18, type: 'DEEP_WORK', desc: "Models/Pitches" },
      { start: 18, end: 18.5, type: 'LEISURE', desc: "Dinner Ordered In" },
      { start: 18.5, end: 26, type: 'DEEP_WORK', desc: "Night Grind" }
    ]
  },
  {
    name: "Medical Resident",
    subtitle: "Hospital training hours",
    source: "80-hour week caps post-reform",
    schedule: [
      { start: 0, end: 5, type: 'SLEEP', desc: "Sleep (5h)" },
      { start: 5, end: 6, type: 'ADMIN', desc: "Pre-Rounds Prep" },
      { start: 6, end: 12, type: 'DEEP_WORK', desc: "Rounds/Patients" },
      { start: 12, end: 12.5, type: 'LEISURE', desc: "Quick Lunch" },
      { start: 12.5, end: 18, type: 'DEEP_WORK', desc: "Procedures/Notes" },
      { start: 18, end: 19, type: 'ADMIN', desc: "Handoff" },
      { start: 19, end: 24, type: 'LEISURE', desc: "Rest/Study" }
    ]
  },
  {
    name: "Remote Async Worker",
    subtitle: "Distributed team schedule",
    source: "Flexible hours, results-oriented",
    schedule: [
      { start: 23, end: 31, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Morning Run" },
      { start: 8, end: 9, type: 'LEISURE', desc: "Breakfast/Coffee" },
      { start: 9, end: 12, type: 'DEEP_WORK', desc: "Deep Work (No Meetings)" },
      { start: 12, end: 14, type: 'LEISURE', desc: "Long Lunch/Walk" },
      { start: 14, end: 16, type: 'ADMIN', desc: "Meetings/Sync" },
      { start: 16, end: 18, type: 'DEEP_WORK', desc: "Async Work" },
      { start: 18, end: 23, type: 'LEISURE', desc: "Personal Time" }
    ]
  }
];

// ============================================
// MODERN TITANS (Tech & Business)
// ============================================
const MODERN_FIGURES = [
  {
    name: "Elon Musk",
    subtitle: "Tesla, SpaceX CEO",
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
    subtitle: "Apple CEO",
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
    subtitle: "Amazon Founder",
    schedule: [
      { start: 22, end: 30.5, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6.5, end: 10, type: 'LEISURE', desc: "Puttering/Kids" },
      { start: 10, end: 12, type: 'DEEP_WORK', desc: "High IQ Meetings" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 17, type: 'ADMIN', desc: "Low IQ Tasks" },
      { start: 17, end: 22, type: 'LEISURE', desc: "Family Time" }
    ]
  },
  {
    name: "Warren Buffett",
    subtitle: "Berkshire Hathaway",
    schedule: [
      { start: 22.75, end: 30.75, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6.75, end: 7.5, type: 'LEISURE', desc: "McDonald's Breakfast" },
      { start: 7.5, end: 8.5, type: 'ADMIN', desc: "Read Newspapers" },
      { start: 8.5, end: 12, type: 'DEEP_WORK', desc: "Reading (80% of day)" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 17, type: 'DEEP_WORK', desc: "Reading/Thinking" },
      { start: 17, end: 18, type: 'ADMIN', desc: "Drive Home" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Bridge" },
      { start: 20, end: 22.75, type: 'LEISURE', desc: "Reading/TV" }
    ]
  },
  {
    name: "Bill Gates",
    subtitle: "Microsoft Founder",
    schedule: [
      { start: 0, end: 7, type: 'SLEEP', desc: "Sleep (7h)" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Treadmill + Courses" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Work (5-min blocks)" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "Meetings/Foundation" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 20, end: 22, type: 'ADMIN', desc: "Reading/Email" },
      { start: 22, end: 24, type: 'LEISURE', desc: "Reading Before Bed" }
    ]
  },
  {
    name: "Oprah Winfrey",
    subtitle: "Media Mogul",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 6.5, type: 'ADMIN', desc: "Wake Up (No Alarm)" },
      { start: 6.5, end: 7.5, type: 'EXERCISE', desc: "Workout" },
      { start: 7.5, end: 8, type: 'ADMIN', desc: "Meditation" },
      { start: 8, end: 8.5, type: 'LEISURE', desc: "Breakfast" },
      { start: 8.5, end: 13, type: 'DEEP_WORK', desc: "Work Block 1" },
      { start: 13, end: 14, type: 'LEISURE', desc: "Lunch" },
      { start: 14, end: 18, type: 'DEEP_WORK', desc: "Filming/Business" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner" },
      { start: 20, end: 22, type: 'ADMIN', desc: "Bath/Gratitude Journal" }
    ]
  },
  {
    name: "Jack Dorsey",
    subtitle: "Twitter/Square Founder",
    schedule: [
      { start: 23, end: 29, type: 'SLEEP', desc: "Sleep (6h)" },
      { start: 5, end: 6, type: 'LEISURE', desc: "Ice Bath/Meditation" },
      { start: 6, end: 7.5, type: 'EXERCISE', desc: "Walk to Work (5mi)" },
      { start: 7.5, end: 12, type: 'DEEP_WORK', desc: "Deep Work" },
      { start: 12, end: 13, type: 'LEISURE', desc: "One Meal (OMAD)" },
      { start: 13, end: 18, type: 'ADMIN', desc: "Meetings" },
      { start: 18, end: 23, type: 'LEISURE', desc: "Home/Sauna/Reading" }
    ]
  },
  {
    name: "Mark Zuckerberg",
    subtitle: "Meta CEO",
    schedule: [
      { start: 0, end: 8, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 8, end: 9, type: 'LEISURE', desc: "Time with Kids" },
      { start: 9, end: 10, type: 'ADMIN', desc: "Meetings Start" },
      { start: 10, end: 12, type: 'DEEP_WORK', desc: "Product Reviews" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 17, type: 'ADMIN', desc: "Meetings" },
      { start: 17, end: 18, type: 'EXERCISE', desc: "MMA Training" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Family Dinner" },
      { start: 20, end: 24, type: 'LEISURE', desc: "Personal Time" }
    ]
  },
  {
    name: "Barack Obama",
    subtitle: "44th US President",
    schedule: [
      { start: 1, end: 7, type: 'SLEEP', desc: "Sleep (6h)" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Workout" },
      { start: 8, end: 9, type: 'LEISURE', desc: "Family Breakfast" },
      { start: 9, end: 18, type: 'DEEP_WORK', desc: "Oval Office" },
      { start: 18, end: 20.5, type: 'LEISURE', desc: "Family Dinner" },
      { start: 20.5, end: 23, type: 'DEEP_WORK', desc: "Briefing Papers" },
      { start: 23, end: 25, type: 'LEISURE', desc: "Reading/ESPN" }
    ]
  }
];

// ============================================
// WRITERS & ARTISTS
// ============================================
const WRITERS_ARTISTS = [
  {
    name: "Stephen King",
    subtitle: "Horror Author",
    schedule: [
      { start: 23, end: 31, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 11.5, type: 'CREATIVE', desc: "Writing (2000 Words)" },
      { start: 11.5, end: 13, type: 'ADMIN', desc: "Letters/Paperwork" },
      { start: 13, end: 14, type: 'LEISURE', desc: "Lunch" },
      { start: 14, end: 16, type: 'NAP', desc: "Nap/Rest" },
      { start: 16, end: 19, type: 'LEISURE', desc: "Red Sox/Reading" },
      { start: 19, end: 21, type: 'LEISURE', desc: "Family/Reading" },
      { start: 21, end: 23, type: 'LEISURE', desc: "TV" }
    ]
  },
  {
    name: "Haruki Murakami",
    subtitle: "Japanese Novelist",
    schedule: [
      { start: 21, end: 28, type: 'SLEEP', desc: "Sleep (7h) - Bed at 9pm" },
      { start: 4, end: 10, type: 'CREATIVE', desc: "Writing (5-6 hours)" },
      { start: 10, end: 11, type: 'LEISURE', desc: "Lunch" },
      { start: 11, end: 12, type: 'EXERCISE', desc: "Run 10km" },
      { start: 12, end: 13, type: 'EXERCISE', desc: "Swim 1500m" },
      { start: 13, end: 17, type: 'LEISURE', desc: "Reading/Music" },
      { start: 17, end: 19, type: 'ADMIN', desc: "Errands/Admin" },
      { start: 19, end: 21, type: 'LEISURE', desc: "Dinner/Relax" }
    ]
  },
  {
    name: "Franz Kafka",
    subtitle: "Metamorphosis Author",
    schedule: [
      { start: 2, end: 7, type: 'SLEEP', desc: "Sleep (5h)" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Morning Routine" },
      { start: 8.5, end: 14.5, type: 'DEEP_WORK', desc: "Insurance Office" },
      { start: 14.5, end: 15.5, type: 'LEISURE', desc: "Lunch" },
      { start: 15.5, end: 19.5, type: 'NAP', desc: "Long Nap (4h)" },
      { start: 19.5, end: 23, type: 'LEISURE', desc: "Exercise/Family" },
      { start: 23, end: 26, type: 'CREATIVE', desc: "Writing (Prime Time)" }
    ]
  },
  {
    name: "Ernest Hemingway",
    subtitle: "Nobel Prize Author",
    schedule: [
      { start: 0, end: 6, type: 'SLEEP', desc: "Sleep (6h)" },
      { start: 6, end: 12, type: 'CREATIVE', desc: "Writing (Standing)" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 17, type: 'LEISURE', desc: "Fishing/Hunting" },
      { start: 17, end: 19, type: 'LEISURE', desc: "Socializing" },
      { start: 19, end: 21, type: 'LEISURE', desc: "Dinner/Drinks" },
      { start: 21, end: 24, type: 'LEISURE', desc: "More Drinks/Stories" }
    ]
  },
  {
    name: "Maya Angelou",
    subtitle: "Poet & Author",
    schedule: [
      { start: 0, end: 5.5, type: 'SLEEP', desc: "Rest" },
      { start: 5.5, end: 6.5, type: 'LEISURE', desc: "Wake/Coffee" },
      { start: 6.5, end: 14, type: 'CREATIVE', desc: "Writing (Hotel Room)" },
      { start: 14, end: 15, type: 'LEISURE', desc: "Lunch" },
      { start: 15, end: 19, type: 'DEEP_WORK', desc: "Editing" },
      { start: 19, end: 22, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 22, end: 24, type: 'NAP', desc: "Wind Down" }
    ]
  },
  {
    name: "Pablo Picasso",
    subtitle: "Artist",
    schedule: [
      { start: 2, end: 11, type: 'SLEEP', desc: "Sleep (Late Riser)" },
      { start: 11, end: 13, type: 'LEISURE', desc: "Brunch/Friends" },
      { start: 13, end: 15, type: 'LEISURE', desc: "Leisure/Gallery" },
      { start: 15, end: 22, type: 'CREATIVE', desc: "Painting" },
      { start: 22, end: 23, type: 'LEISURE', desc: "Dinner" },
      { start: 23, end: 26, type: 'CREATIVE', desc: "Late Night Painting" }
    ]
  },
  {
    name: "Honoré de Balzac",
    subtitle: "French Novelist",
    schedule: [
      { start: 18, end: 25, type: 'SLEEP', desc: "Sleep (Evening)" },
      { start: 1, end: 8, type: 'CREATIVE', desc: "Writing + Coffee" },
      { start: 8, end: 9.5, type: 'NAP', desc: "Nap" },
      { start: 9.5, end: 16, type: 'CREATIVE', desc: "More Writing + Coffee" },
      { start: 16, end: 18, type: 'LEISURE', desc: "Guests/Bath" }
    ]
  },
  {
    name: "Leo Tolstoy",
    subtitle: "War and Peace Author",
    schedule: [
      { start: 0, end: 8, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 8, end: 9, type: 'LEISURE', desc: "Breakfast" },
      { start: 9, end: 10, type: 'EXERCISE', desc: "Walk in Woods" },
      { start: 10, end: 14, type: 'CREATIVE', desc: "Writing" },
      { start: 14, end: 15, type: 'LEISURE', desc: "Lunch" },
      { start: 15, end: 17, type: 'CREATIVE', desc: "More Writing" },
      { start: 17, end: 19, type: 'EXERCISE', desc: "Horse Riding/Tennis" },
      { start: 19, end: 21, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 21, end: 24, type: 'LEISURE', desc: "Reading/Cards" }
    ]
  },
  {
    name: "Toni Morrison",
    subtitle: "Nobel Laureate",
    schedule: [
      { start: 1, end: 5, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 5, end: 5.5, type: 'LEISURE', desc: "Coffee/Watch Dawn" },
      { start: 5.5, end: 10, type: 'CREATIVE', desc: "Writing (Before Kids Wake)" },
      { start: 10, end: 18, type: 'ADMIN', desc: "Publishing Job" },
      { start: 18, end: 21, type: 'LEISURE', desc: "Family/Dinner" },
      { start: 21, end: 25, type: 'CREATIVE', desc: "Late Writing" }
    ]
  }
];

// ============================================
// HISTORICAL THINKERS & SCIENTISTS
// ============================================
const HISTORICAL_FIGURES = [
  {
    name: "Benjamin Franklin",
    subtitle: "Founding Father",
    schedule: [
      { start: 22, end: 29, type: 'SLEEP', desc: "Sleep (7h)" },
      { start: 5, end: 8, type: 'LEISURE', desc: "Rise/Wash/Goodness" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Work" },
      { start: 12, end: 14, type: 'ADMIN', desc: "Read/Accounts" },
      { start: 14, end: 18, type: 'DEEP_WORK', desc: "Work" },
      { start: 18, end: 22, type: 'LEISURE', desc: "Music/Conversation" }
    ]
  },
  {
    name: "Nikola Tesla",
    subtitle: "Inventor",
    schedule: [
      { start: 3, end: 5, type: 'SLEEP', desc: "Sleep (2h Only!)" },
      { start: 5, end: 6, type: 'LEISURE', desc: "Mental Planning" },
      { start: 6, end: 8, type: 'EXERCISE', desc: "Walk (8-10 miles)" },
      { start: 8, end: 10, type: 'LEISURE', desc: "Breakfast/Papers" },
      { start: 10, end: 18, type: 'DEEP_WORK', desc: "Lab Work" },
      { start: 18, end: 20.15, type: 'LEISURE', desc: "Dinner (8:10 sharp)" },
      { start: 20.15, end: 27, type: 'DEEP_WORK', desc: "Lab Until 3am" }
    ]
  },
  {
    name: "Charles Darwin",
    subtitle: "Naturalist",
    schedule: [
      { start: 22.5, end: 31, type: 'SLEEP', desc: "Sleep (8.5h)" },
      { start: 7, end: 7.5, type: 'EXERCISE', desc: "Short Walk" },
      { start: 7.5, end: 8, type: 'LEISURE', desc: "Breakfast" },
      { start: 8, end: 9.5, type: 'DEEP_WORK', desc: "Focused Work 1" },
      { start: 9.5, end: 10.5, type: 'ADMIN', desc: "Reading Mail" },
      { start: 10.5, end: 12, type: 'DEEP_WORK', desc: "Focused Work 2" },
      { start: 12, end: 12.5, type: 'EXERCISE', desc: "Walk w/ Dog" },
      { start: 12.5, end: 15, type: 'LEISURE', desc: "Lunch/Newspaper" },
      { start: 15, end: 16, type: 'NAP', desc: "Nap" },
      { start: 16, end: 16.5, type: 'EXERCISE', desc: "Walk 3" },
      { start: 16.5, end: 17.5, type: 'DEEP_WORK', desc: "Focused Work 3" },
      { start: 17.5, end: 22.5, type: 'LEISURE', desc: "Dinner/Backgammon" }
    ]
  },
  {
    name: "Immanuel Kant",
    subtitle: "Philosopher",
    schedule: [
      { start: 22, end: 29, type: 'SLEEP', desc: "Sleep (7h)" },
      { start: 5, end: 6, type: 'LEISURE', desc: "Tea/Pipe/Meditation" },
      { start: 6, end: 7, type: 'ADMIN', desc: "Lecture Prep" },
      { start: 7, end: 13, type: 'DEEP_WORK', desc: "Writing/Lectures" },
      { start: 13, end: 15.5, type: 'LEISURE', desc: "Lunch (Only Meal)" },
      { start: 15.5, end: 16.5, type: 'EXERCISE', desc: "The Walk (Exact Hour)" },
      { start: 16.5, end: 22, type: 'ADMIN', desc: "Reading/Thinking" }
    ]
  },
  {
    name: "Beethoven",
    subtitle: "Composer",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Coffee (60 Beans Counted)" },
      { start: 7, end: 14.5, type: 'CREATIVE', desc: "Composing" },
      { start: 14.5, end: 15.5, type: 'LEISURE', desc: "Dinner w/ Wine" },
      { start: 15.5, end: 17.5, type: 'EXERCISE', desc: "Long Walk" },
      { start: 17.5, end: 20, type: 'LEISURE', desc: "Tavern/Newspapers" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Supper/Pipe" }
    ]
  },
  {
    name: "Mozart",
    subtitle: "Composer",
    schedule: [
      { start: 1, end: 6, type: 'SLEEP', desc: "Sleep (5h)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Dressing" },
      { start: 7, end: 9, type: 'CREATIVE', desc: "Composing" },
      { start: 9, end: 13, type: 'ADMIN', desc: "Giving Lessons" },
      { start: 13, end: 17, type: 'LEISURE', desc: "Lunch/Socializing" },
      { start: 17, end: 21, type: 'CREATIVE', desc: "Composing/Concerts" },
      { start: 21, end: 23, type: 'LEISURE', desc: "Socializing" },
      { start: 23, end: 25, type: 'CREATIVE', desc: "Late Composing" }
    ]
  },
  {
    name: "Victor Hugo",
    subtitle: "Les Misérables Author",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 11, type: 'ADMIN', desc: "Coffee/Letters" },
      { start: 11, end: 12, type: 'LEISURE', desc: "Ice Bath" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch/Visitors" },
      { start: 13, end: 15, type: 'EXERCISE', desc: "Exercise" },
      { start: 15, end: 16, type: 'ADMIN', desc: "Barber" },
      { start: 16, end: 18, type: 'LEISURE', desc: "Personal Time" },
      { start: 18, end: 20, type: 'CREATIVE', desc: "Writing" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Dinner/Cards" }
    ]
  },
  {
    name: "Marie Curie",
    subtitle: "Nobel Physicist",
    schedule: [
      { start: 0, end: 7, type: 'SLEEP', desc: "Sleep" },
      { start: 7, end: 8, type: 'LEISURE', desc: "Breakfast/Family" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Lab Research" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "Lab Research" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Daughters" },
      { start: 20, end: 24, type: 'DEEP_WORK', desc: "Night Lab Work" }
    ]
  },
  {
    name: "Albert Einstein",
    subtitle: "Physicist",
    schedule: [
      { start: 23, end: 33, type: 'SLEEP', desc: "Sleep (10h)" },
      { start: 9, end: 10, type: 'LEISURE', desc: "Big Breakfast" },
      { start: 10, end: 13, type: 'DEEP_WORK', desc: "Thinking/Research" },
      { start: 13, end: 14, type: 'LEISURE', desc: "Lunch" },
      { start: 14, end: 15, type: 'NAP', desc: "Nap" },
      { start: 15, end: 18, type: 'DEEP_WORK', desc: "Research/Writing" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Violin" },
      { start: 20, end: 23, type: 'LEISURE', desc: "Reading/Music" }
    ]
  }
];

// ============================================
// ATHLETES & PERFORMERS
// ============================================
const ATHLETES_PERFORMERS = [
  {
    name: "Cristiano Ronaldo",
    subtitle: "Football Legend",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h in 90min cycles)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Breakfast" },
      { start: 7, end: 8, type: 'EXERCISE', desc: "Gym Session 1" },
      { start: 8, end: 10, type: 'DEEP_WORK', desc: "Team Training" },
      { start: 10, end: 11, type: 'LEISURE', desc: "Snack/Recovery" },
      { start: 11, end: 13, type: 'DEEP_WORK', desc: "Team Training 2" },
      { start: 13, end: 14, type: 'LEISURE', desc: "Lunch" },
      { start: 14, end: 15, type: 'NAP', desc: "Nap" },
      { start: 15, end: 17, type: 'EXERCISE', desc: "Gym/Swimming" },
      { start: 17, end: 19, type: 'LEISURE', desc: "Family Time" },
      { start: 19, end: 21, type: 'LEISURE', desc: "Dinner" },
      { start: 21, end: 22, type: 'ADMIN', desc: "Recovery/Cryo" }
    ]
  },
  {
    name: "The Rock",
    subtitle: "Actor & Wrestler",
    schedule: [
      { start: 22, end: 26, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 2, end: 2.5, type: 'ADMIN', desc: "Quiet Time" },
      { start: 2.5, end: 4, type: 'EXERCISE', desc: "Cardio" },
      { start: 4, end: 4.5, type: 'LEISURE', desc: "Meal 1" },
      { start: 4.5, end: 6.5, type: 'EXERCISE', desc: "Iron Paradise (Weights)" },
      { start: 6.5, end: 7, type: 'LEISURE', desc: "Meal 2" },
      { start: 7, end: 18, type: 'DEEP_WORK', desc: "Film Set/Business" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner/Family" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Tequila/Relax" }
    ]
  },
  {
    name: "Kobe Bryant",
    subtitle: "Basketball Legend",
    schedule: [
      { start: 22, end: 26, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 2, end: 4, type: 'EXERCISE', desc: "Workout 1" },
      { start: 4, end: 6, type: 'DEEP_WORK', desc: "Court Practice" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Breakfast" },
      { start: 7, end: 8, type: 'NAP', desc: "Nap 1" },
      { start: 8, end: 11, type: 'DEEP_WORK', desc: "Team Practice" },
      { start: 11, end: 12, type: 'LEISURE', desc: "Lunch" },
      { start: 12, end: 13, type: 'NAP', desc: "Nap 2" },
      { start: 13, end: 16, type: 'EXERCISE', desc: "Workout 2" },
      { start: 16, end: 18, type: 'DEEP_WORK', desc: "Film Study" },
      { start: 18, end: 22, type: 'LEISURE', desc: "Family/Dinner" }
    ]
  },
  {
    name: "Simone Biles",
    subtitle: "Olympic Gymnast",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Breakfast" },
      { start: 7, end: 8, type: 'ADMIN', desc: "Stretching/Prep" },
      { start: 8, end: 12, type: 'DEEP_WORK', desc: "Morning Training" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 14, type: 'ADMIN', desc: "Recovery/Treatment" },
      { start: 14, end: 18, type: 'DEEP_WORK', desc: "Afternoon Training" },
      { start: 18, end: 20, type: 'LEISURE', desc: "Dinner" },
      { start: 20, end: 22, type: 'LEISURE', desc: "Relaxation" }
    ]
  },
  {
    name: "Serena Williams",
    subtitle: "Tennis Champion",
    schedule: [
      { start: 22, end: 30, type: 'SLEEP', desc: "Sleep (8h)" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Breakfast" },
      { start: 7, end: 8, type: 'ADMIN', desc: "Warm-up/Stretch" },
      { start: 8, end: 11, type: 'DEEP_WORK', desc: "Court Practice" },
      { start: 11, end: 12, type: 'EXERCISE', desc: "Fitness Training" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 14, type: 'NAP', desc: "Rest" },
      { start: 14, end: 17, type: 'DEEP_WORK', desc: "Afternoon Practice" },
      { start: 17, end: 18, type: 'ADMIN', desc: "Recovery/Massage" },
      { start: 18, end: 22, type: 'LEISURE', desc: "Family/Daughter" }
    ]
  }
];

// ============================================
// MILITARY & DISCIPLINE
// ============================================
const MILITARY_DISCIPLINE = [
  {
    name: "Jocko Willink",
    subtitle: "Navy SEAL",
    schedule: [
      { start: 20.5, end: 24.5, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 0.5, end: 2.5, type: 'EXERCISE', desc: "Workout" },
      { start: 2.5, end: 3, type: 'LEISURE', desc: "Breakfast" },
      { start: 3, end: 5, type: 'DEEP_WORK', desc: "Deep Work" },
      { start: 5, end: 12, type: 'ADMIN', desc: "Meetings/Business" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "Work/Podcast" },
      { start: 18, end: 20.5, type: 'LEISURE', desc: "Family/Dinner" }
    ]
  },
  {
    name: "David Goggins",
    subtitle: "Ultra Endurance Athlete",
    schedule: [
      { start: 23, end: 27, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 3, end: 6, type: 'EXERCISE', desc: "Run/Bike/Swim" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Stretch/Eat" },
      { start: 7, end: 12, type: 'DEEP_WORK', desc: "Work/Speaking" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 16, type: 'EXERCISE', desc: "Workout 2" },
      { start: 16, end: 19, type: 'DEEP_WORK', desc: "Study/Work" },
      { start: 19, end: 21, type: 'EXERCISE', desc: "Workout 3" },
      { start: 21, end: 23, type: 'LEISURE', desc: "Dinner/Recovery" }
    ]
  },
  {
    name: "Navy SEAL BUD/S",
    subtitle: "Training Schedule",
    schedule: [
      { start: 1, end: 5, type: 'SLEEP', desc: "Sleep (4h)" },
      { start: 5, end: 6, type: 'EXERCISE', desc: "PT Session 1" },
      { start: 6, end: 7, type: 'LEISURE', desc: "Breakfast" },
      { start: 7, end: 12, type: 'DEEP_WORK', desc: "Training Evolutions" },
      { start: 12, end: 13, type: 'LEISURE', desc: "Lunch" },
      { start: 13, end: 18, type: 'DEEP_WORK', desc: "More Evolutions" },
      { start: 18, end: 19, type: 'LEISURE', desc: "Dinner" },
      { start: 19, end: 21, type: 'EXERCISE', desc: "PT Session 2" },
      { start: 21, end: 24, type: 'ADMIN', desc: "Gear/Study" },
      { start: 24, end: 25, type: 'EXERCISE', desc: "Surf Torture" }
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
      {figure.subtitle && <div className={styles.clockSubtitle}>{figure.subtitle}</div>}
    </div>
  );
}

// Calculate work hours for a schedule
function calculateWorkHours(schedule) {
  let workHours = 0;
  schedule.forEach(block => {
    if (block.type === 'DEEP_WORK' || block.type === 'ADMIN' || block.type === 'CREATIVE') {
      let duration = block.end - block.start;
      if (duration < 0) duration += 24;
      workHours += duration;
    }
  });
  return workHours.toFixed(1);
}

function calculateSleepHours(schedule) {
  let sleepHours = 0;
  schedule.forEach(block => {
    if (block.type === 'SLEEP' || block.type === 'NAP') {
      let duration = block.end - block.start;
      if (duration < 0) duration += 24;
      sleepHours += duration;
    }
  });
  return sleepHours.toFixed(1);
}

const ERA_OPTIONS = [
  { id: 'work_cultures', label: 'Work Cultures', data: WORK_CULTURE_SCHEDULES },
  { id: 'modern', label: 'Tech & Business', data: MODERN_FIGURES },
  { id: 'writers', label: 'Writers & Artists', data: WRITERS_ARTISTS },
  { id: 'historical', label: 'Thinkers & Scientists', data: HISTORICAL_FIGURES },
  { id: 'athletes', label: 'Athletes & Performers', data: ATHLETES_PERFORMERS },
  { id: 'military', label: 'Military & Discipline', data: MILITARY_DISCIPLINE }
];

function HistoricalFiguresGantt() {
  const [era, setEra] = useState('work_cultures');
  const [hoveredFigure, setHoveredFigure] = useState(null);

  const selectedEra = ERA_OPTIONS.find(e => e.id === era);
  const figures = selectedEra?.data || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>
            THE <span className={styles.accent}>CHRONO</span>MAP
          </h2>
          <p className={styles.subtitle}>24-Hour Routines of Remarkable People & Work Cultures</p>
        </div>

        <div className={styles.eraToggle}>
          {ERA_OPTIONS.map(option => (
            <button
              key={option.id}
              className={`${styles.toggleBtn} ${era === option.id ? styles.active : ''}`}
              onClick={() => setEra(option.id)}
            >
              {option.label}
            </button>
          ))}
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
            {hoveredFigure.subtitle && (
              <p className={styles.detailsSubtitle}>{hoveredFigure.subtitle}</p>
            )}
            {hoveredFigure.source && (
              <p className={styles.detailsSource}>Source: {hoveredFigure.source}</p>
            )}
            <div className={styles.statsRow}>
              <span className={styles.statBadge}>
                Work: {calculateWorkHours(hoveredFigure.schedule)}h
              </span>
              <span className={styles.statBadge}>
                Sleep: {calculateSleepHours(hoveredFigure.schedule)}h
              </span>
            </div>
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
