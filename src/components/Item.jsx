import { useMemo, useState } from 'react';
import { useAppReducer, useAppState } from "../AppContext.jsx";
import { formatLocalTime, getLocalDateString, getLocalTimeString } from '../utils/timeDisplay.js';
import styles from "./Item.module.css";

// Individual todo item
function Item({ item }) {
  const dispatch = useAppReducer();
  const { taskTypes, palaces = [] } = useAppState();
  const [isRescheduling, setIsRescheduling] = useState(false);
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

  function startReschedule() {
    setIsRescheduling(true);
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

  return (
    <div 
      className={`${styles.item} ${
        item.scheduledTime ? styles.scheduled : styles.unscheduled
      }`}
      tabIndex="0"
    >
      <div className={styles.itemContent}>
        <div className={styles.itemname}>{text}</div>
        {item.scheduledTime && !isRescheduling && (
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
            {linkedLocation && (
              <span className={styles.locationTag}>
                @{linkedLocation}
              </span>
            )}
            <button
              className={styles.rescheduleButton}
              onClick={startReschedule}
            >
              Reschedule
            </button>
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
