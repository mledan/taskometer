import { useState } from 'react';
import { useAppReducer, useAppState } from "../AppContext.jsx";
import { format, addMinutes } from 'date-fns';
import styles from "./Item.module.css";

// Individual todo item
function Item({ item }) {
  const dispatch = useAppReducer();
  const { taskTypes } = useAppState();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(
    item.scheduledTime ? 
      new Date(item.scheduledTime).toISOString().split('T')[0] : 
      new Date().toISOString().split('T')[0]
  );
  const [rescheduleTime, setRescheduleTime] = useState(
    item.scheduledTime ? 
      format(new Date(item.scheduledTime), 'HH:mm') : 
      '09:00'
  );
  let text = item.text;
  let paused = item.status === "paused";
  let completed = item.status === "completed";

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
    const newScheduledTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
    const updatedItem = {
      ...item,
      schedulingPreference: 'specific',
      scheduledTime: null, // Clear existing time to force reschedule
      specificDay: rescheduleDate,
    };

    dispatch({ 
      type: 'SCHEDULE_TASKS',
      tasks: [updatedItem]
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
              {format(new Date(item.scheduledTime), 'MMM d, h:mm a')}
            </span>
            <span className={styles.duration}>
              ({item.duration} min)
            </span>
            {item.taskType && (
              <span className={styles.taskType}>
                {taskTypes.find(t => t.id === item.taskType)?.name || 'Default'}
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
