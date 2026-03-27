import { useState, useEffect, useRef } from 'react';
import { useAppReducer, useTaskTypes } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { formatLocalTime } from '../../utils/timeDisplay';
import styles from './TaskDetail.module.css';

function TaskDetail({ task, onClose }) {
  const dispatch = useAppReducer();
  const taskTypes = useTaskTypes();
  const [description, setDescription] = useState(task.description || '');
  const [newSubtask, setNewSubtask] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const subtaskInputRef = useRef(null);

  const taskType = taskTypes.find(t => t.id === (task.primaryType || task.taskType));
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const isTimerRunning = !!task.startedAt;

  // Live timer update
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - new Date(task.startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, task.startedAt]);

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function handleDescriptionBlur() {
    if (description !== (task.description || '')) {
      dispatch({
        type: ACTION_TYPES.UPDATE_TASK,
        payload: { id: task.id || task.key, description }
      });
    }
  }

  function handleAddSubtask(e) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    dispatch({
      type: ACTION_TYPES.ADD_SUBTASK,
      payload: { taskId: task.id || task.key, text: newSubtask.trim() }
    });
    setNewSubtask('');
    subtaskInputRef.current?.focus();
  }

  function handleToggleSubtask(subtaskId) {
    dispatch({
      type: ACTION_TYPES.TOGGLE_SUBTASK,
      payload: { taskId: task.id || task.key, subtaskId }
    });
  }

  function handleDeleteSubtask(subtaskId) {
    dispatch({
      type: ACTION_TYPES.DELETE_SUBTASK,
      payload: { taskId: task.id || task.key, subtaskId }
    });
  }

  function handleStartTimer() {
    dispatch({
      type: ACTION_TYPES.START_TIMER,
      payload: { taskId: task.id || task.key }
    });
  }

  function handleStopTimer() {
    dispatch({
      type: ACTION_TYPES.STOP_TIMER,
      payload: { taskId: task.id || task.key }
    });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {taskType && (
              <span className={styles.typeIcon} style={{ color: taskType.color }}>
                {taskType.icon}
              </span>
            )}
            <h2 className={styles.title}>{task.text}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>x</button>
        </div>

        {/* Meta row */}
        <div className={styles.metaRow}>
          {task.priority && (
            <span className={`${styles.metaPill} ${styles[`priority_${task.priority}`]}`}>
              {task.priority}
            </span>
          )}
          {task.duration && (
            <span className={styles.metaPill}>{task.duration}m est.</span>
          )}
          {task.scheduledTime && (
            <span className={styles.metaPill}>
              {formatLocalTime(task.scheduledTime)}
            </span>
          )}
          <span className={`${styles.metaPill} ${styles[`status_${task.status}`]}`}>
            {task.status}
          </span>
        </div>

        {/* Timer */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Time Tracking</div>
          <div className={styles.timerRow}>
            {isTimerRunning ? (
              <>
                <span className={styles.timerDisplay}>{formatDuration(elapsed)}</span>
                <button className={styles.timerStopBtn} onClick={handleStopTimer}>Stop</button>
              </>
            ) : (
              <>
                {task.actualDuration != null && (
                  <span className={styles.timerActual}>
                    {task.actualDuration}m tracked
                    {task.duration ? ` / ${task.duration}m est.` : ''}
                  </span>
                )}
                <button className={styles.timerStartBtn} onClick={handleStartTimer}>
                  Start Timer
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subtasks */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            Subtasks
            {subtasks.length > 0 && (
              <span className={styles.subtaskCount}>
                {completedSubtasks}/{subtasks.length}
              </span>
            )}
          </div>
          {subtasks.length > 0 && (
            <>
              <div className={styles.subtaskProgress}>
                <div
                  className={styles.subtaskProgressFill}
                  style={{ width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%` }}
                />
              </div>
              <div className={styles.subtaskList}>
                {subtasks.map(s => (
                  <div key={s.id} className={`${styles.subtaskItem} ${s.completed ? styles.subtaskDone : ''}`}>
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={() => handleToggleSubtask(s.id)}
                      className={styles.subtaskCheck}
                    />
                    <span className={styles.subtaskText}>{s.text}</span>
                    <button
                      className={styles.subtaskDelete}
                      onClick={() => handleDeleteSubtask(s.id)}
                    >x</button>
                  </div>
                ))}
              </div>
            </>
          )}
          <form className={styles.subtaskAdd} onSubmit={handleAddSubtask}>
            <input
              ref={subtaskInputRef}
              type="text"
              placeholder="Add subtask..."
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              className={styles.subtaskInput}
            />
            <button type="submit" disabled={!newSubtask.trim()} className={styles.subtaskAddBtn}>+</button>
          </form>
        </div>

        {/* Notes */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Notes</div>
          <textarea
            className={styles.notesArea}
            placeholder="Add notes..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}

export default TaskDetail;
