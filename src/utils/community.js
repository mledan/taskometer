import storage from '../services/storage.js';

const COMMENTS_KEY = 'taskometer-schedule-comments';
const LIKES_KEY = 'taskometer-schedule-likes';

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

export function getLikes(scheduleId) {
  const all = storage.get(LIKES_KEY) || {};
  const entry = all[scheduleId];
  if (!entry) return { count: 0, liked: false };
  return entry;
}

export function toggleLike(scheduleId) {
  const all = storage.get(LIKES_KEY) || {};
  const current = all[scheduleId] || { count: 0, liked: false };
  const next = {
    count: Math.max(0, current.count + (current.liked ? -1 : 1)),
    liked: !current.liked,
  };
  all[scheduleId] = next;
  storage.set(LIKES_KEY, all);
  return next;
}


