import storage from '../services/storage.js';

const COMMENTS_KEY = 'taskometer-schedule-comments';

export function getComments(scheduleId) {
  const all = storage.get(COMMENTS_KEY) || {};
  return all[scheduleId] || [];
}

export function addComment(scheduleId, comment) {
  const all = storage.get(COMMENTS_KEY) || {};
  const list = all[scheduleId] || [];
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...comment,
    createdAt: new Date().toISOString(),
  };
  all[scheduleId] = [entry, ...list];
  storage.set(COMMENTS_KEY, all);
  return entry;
}


