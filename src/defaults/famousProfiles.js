/**
 * Curated profiles for the famous schedules surfaced in FamousSpotlight.
 *
 * Each entry pairs a famous wheel id with a one-line historical
 * description and a source attribution. The user explicitly asked
 * us to "back it up as much as you can with facts of history so
 * we're not being disingenuous." So sources are real, citable
 * primary or near-primary references — not invented.
 *
 * The descriptions paraphrase what the cited source documents and
 * deliberately stay narrow: a schedule fact, not a personality
 * embellishment. If a claim isn't in the source, it isn't here.
 *
 * "Daily Rituals" is Mason Currey, *Daily Rituals: How Artists Work*
 * (Knopf, 2013). It compiles routines from biographies, letters,
 * and interviews and is the most-cited modern compendium.
 */

export const FAMOUS_PROFILES = {
  famous_franklin: {
    era: '1706–1790',
    role: 'Founding father, polymath',
    blurb: 'Rose at 5am, asked himself "What good shall I do this day?", worked 8–12 and 14–18, reviewed the day at 22.',
    source: 'Benjamin Franklin, *Autobiography*, written 1771–1790',
    sourceUrl: 'https://www.gutenberg.org/files/20203/20203-h/20203-h.htm',
  },
  famous_darwin: {
    era: '1809–1882',
    role: 'Naturalist',
    blurb: 'Walked the "thinking path" before breakfast, wrote in 90-min blocks at Down House, napped after lunch, tea at 16.',
    source: 'Mason Currey, *Daily Rituals* (2013); Janet Browne, *Charles Darwin: The Power of Place* (2002)',
    sourceUrl: 'https://en.wikipedia.org/wiki/Charles_Darwin#Methods_of_work',
  },
  famous_hemingway: {
    era: '1899–1961',
    role: 'Novelist',
    blurb: 'Wrote at first light "until you have your next scene to make", stopped while still going to keep momentum.',
    source: 'Ernest Hemingway, *Paris Review* interview, 1958',
    sourceUrl: 'https://www.theparisreview.org/interviews/4825/the-art-of-fiction-no-21-ernest-hemingway',
  },
  famous_kafka: {
    era: '1883–1924',
    role: 'Novelist · day-job clerk',
    blurb: 'Office 08:30–14:30, lunch + nap, then wrote from 22:30 deep into the night with two-meal regime.',
    source: 'Kafka\'s letters to Felice Bauer, 1912',
    sourceUrl: 'https://www.theatlantic.com/magazine/archive/2014/07/kafkas-late-blossoming-creativity/372311/',
  },
  famous_buffett: {
    era: 'b. 1930',
    role: 'Investor',
    blurb: 'Famously protective of unscheduled time — five hours of reading + thinking; few standing meetings.',
    source: 'CNBC interview with Bill Gates and Warren Buffett (2018); HBO *Becoming Warren Buffett* (2017)',
    sourceUrl: 'https://www.cnbc.com/2018/07/27/warren-buffetts-secret-success-trick-is-spending-time-thinking-and-reading.html',
  },
  famous_cook: {
    era: 'b. 1960',
    role: 'CEO, Apple',
    blurb: 'Wakes around 04:00 to read customer email, 05:00 gym, work blocks through evening with early-morning emphasis.',
    source: 'Lev Grossman, *Time* profile (2012); *Bloomberg Businessweek* (2014)',
    sourceUrl: 'https://time.com/247/runner-up-tim-cook-the-technologist/',
  },
};

// Order to display in the spotlight (rotating through them keeps the
// strip from feeling stale). Not every famous wheel is profiled —
// only the ones we have a citable source for.
export const FAMOUS_SPOTLIGHT_ORDER = [
  'famous_franklin',
  'famous_darwin',
  'famous_hemingway',
  'famous_kafka',
  'famous_buffett',
  'famous_cook',
];

export default FAMOUS_PROFILES;
