import React, { useEffect, useState } from 'react';
import { getComments, addComment } from '../utils/community.js';
import { formatLocalTime } from '../utils/timeDisplay.js';

function ScheduleDiscussion({ scheduleId }) {
  const [comments, setComments] = useState([]);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    setComments(getComments(scheduleId));
  }, [scheduleId]);

  function submit() {
    if (!text.trim()) return;
    const entry = addComment(scheduleId, { author: author || 'Anonymous', text });
    setComments(prev => [entry, ...prev]);
    setText('');
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h3>Discussion</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="Name (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <input placeholder="Share insights, pitfalls, or tips" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
        <button onClick={submit}>Post</button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {comments.map(c => (
          <div key={c.id} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {c.author} • {formatLocalTime(c.createdAt, 'MMM d, yyyy h:mm a')}
            </div>
            <div>{c.text}</div>
          </div>
        ))}
        {comments.length === 0 && (
          <div style={{ color: '#6b7280' }}>Be the first to comment.</div>
        )}
      </div>
    </div>
  );
}

export default ScheduleDiscussion;


