import { useMemo, useState } from 'react';
import { useAppReducer, useAppState } from "../AppContext.jsx";
import { formatLocalTime, getLocalDateString, getLocalTimeString } from '../utils/timeDisplay.js';
import styles from "./Item.module.css";

function Item({ item }) {
  const dispatch = useAppReducer();
  const { taskTypes, palaces = [] } = useAppState();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editType, setEditType] = useState(item.taskType || item.primaryType || '');
  const [editDuration, setEditDuration] = useState(item.duration || 30);
  const [editPriority, setEditPriority] = useState(item.priority || 'medium');
  const [rescheduleDate, setRescheduleDate] = useState(
    item.scheduledTime ? 
      getLocalDateString(item.scheduledTime) : 
      new Date().toISOString().split('T')[0]
  );
  const [rescheduleTime, setRescheduleTime] = useState(
    item.scheduledTime ? 
      getLocalTimeString(item.scheduledTime) : 
      '09:00'
  );
  let text = item.text;
  let paused = item.status === "paused";
  let completed = item.status === "completed";

  const linkedLocation = useMemo(() => {
    const taskId = item.id || item.key?.toString();
    if (!taskId) return null;

    for (const palace of palaces) {
      const location = palace.locations?.find((entry) =>
        (entry.linkedTaskIds || []).includes(taskId)
      );
      if (location) {
        return `${palace.name} / ${location.name}`;
      }
    }

    return null;
  }, [item.id, item.key, palaces]);

  function deleteItem() {
    dispatch({ type: "DELETE_ITEM", item });
  }

  function pauseItem() {
    const pausedItem = { ...item, status: "paused" };
    dispatch({ type: "UPDATE_ITEM", item: pausedItem });
  }

  function resumeItem() {
    const pendingItem = { ...item, status: "pending" };
    dispatch({ type: "UPDATE_ITEM", item: pendingItem });
  }

  function completeItem() {
    const completedItem = { ...item, status: "completed" };
    dispatch({ type: "UPDATE_ITEM", item: completedItem });
  }

  function startEdit() {
    setEditText(item.text);
    setEditType(item.taskType || item.primaryType || '');
    setEditDuration(item.duration || 30);
    setEditPriority(item.priority || 'medium');
    setIsEditing(true);
    setIsRescheduling(false);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function submitEdit() {
    if (!editText.trim()) return;

    const updatedItem = {
      ...item,
      text: editText.trim(),
      taskType: editType,
      primaryType: editType,
      duration: editDuration,
      priority: editPriority,
    };
    dispatch({ type: "UPDATE_ITEM", item: updatedItem });
    setIsEditing(false);
  }

  function startReschedule() {
    setIsRescheduling(true);
    setIsEditing(false);
  }

  function cancelReschedule() {
    setIsRescheduling(false);
  }

  function submitReschedule() {
    const nextStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
    if (Number.isNaN(nextStart.getTime())) {
      return;
    }

    dispatch({
      type: 'RESCHEDULE_TASK',
      payload: {
        taskId: item.id || item.key?.toString(),
        scheduledTime: nextStart.toISOString(),
        specificTime: rescheduleTime,
        specificDay: nextStart.toLocaleDateString('en-US', { weekday: 'long' })
      }
    });

    setIsRescheduling(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') submitEdit();
    if (e.key === 'Escape') cancelEdit();
  }

  return (
    <div 
      className={`${styles.item} ${
        item.scheduledTime ? styles.scheduled : styles.unscheduled
      }`}
      tabIndex="0"
    >
      <div className={styles.itemContent}>
        {!isEditing ? (
          <div className={styles.itemname} onDoubleClick={startEdit}>{text}</div>
        ) : (
          <div className={styles.editForm}>
            <input
              type="text"
              className={styles.editTextInput}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className={styles.editRow}>
              <label className={styles.editLabel}>
                Type
                <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="">None</option>
                  {taskTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.editLabel}>
                Duration
                <div className={styles.editDurationRow}>
                  {[15, 30, 60, 90].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.editDurationChip} ${editDuration === d ? styles.editDurationActive : ''}`}
                      onClick={() => setEditDuration(d)}
                    >{d}m</button>
                  ))}
                </div>
              </label>
              <label className={styles.editLabel}>
                Priority
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <div className={styles.editActions}>
              <button className={styles.editSaveBtn} onClick={submitEdit}>Save</button>
              <button className={styles.editCancelBtn} onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        )}
        {!isEditing && item.scheduledTime && !isRescheduling && (
          <div className={styles.scheduleInfo}>
            <span className={styles.scheduleTime}>
              {formatLocalTime(item.scheduledTime, 'MMM d, h:mm a')}
            </span>
            <span className={styles.duration}>
              ({item.duration} min)
            </span>
            {item.taskType && (
              <span className={styles.taskType}>
                {taskTypes.find(t => t.id === item.taskType)?.name || 'Default'}
              </span>
            )}
            {item.metadata?.scheduledLabel && (
              <span className={styles.slotLabel}>
                {item.metadata.scheduledLabel}
              </span>
            )}
            {linkedLocation && (
              <span className={styles.locationTag}>
                @{linkedLocation}
              </span>
            )}
            <button className={styles.editButton} onClick={startEdit}>Edit</button>
            <button className={styles.rescheduleButton} onClick={startReschedule}>Reschedule</button>
          </div>
        )}
        {!isEditing && !item.scheduledTime && item.status === 'pending' && (
          <div className={styles.unscheduledInfo}>
            <div className={styles.unscheduledBadge}>Unscheduled</div>
            <button className={styles.editButton} onClick={startEdit}>Edit</button>
          </div>
        )}
        {isRescheduling && (
          <div className={styles.rescheduleForm}>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
            />
            <div className={styles.rescheduleActions}>
              <button onClick={submitReschedule}>Save</button>
              <button onClick={cancelReschedule}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className={`${styles.buttons} ${completed ? styles.completedButtons : ""}`}>
        {completed && <button className={styles.empty} tabIndex="0"></button>}
        <button
          className={styles.delete}
          onClick={deleteItem}
          tabIndex="0"
        ></button>
        {!paused && !completed && (
          <button
            className={styles.pause}
            onClick={pauseItem}
            tabIndex="0"
          ></button>
        )}
        {(paused || completed) && (
          <button
            className={styles.resume}
            onClick={resumeItem}
            tabIndex="0"
          ></button>
        )}
        {!completed && (
          <button
            className={styles.complete}
            onClick={completeItem}
            tabIndex="0"
          ></button>
        )}
      </div>
    </div>
  );
}

export default Item;
