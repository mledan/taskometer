import { useState } from 'react';
import { useAppReducer, useAppState } from '../AppContext.jsx';
import styles from './TaskTypeManager.module.css';

function TaskTypeManager() {
  const dispatch = useAppReducer();
  const { taskTypes = [] } = useAppState();
  const [newTypeName, setNewTypeName] = useState('');
  const [newDefaultDuration, setNewDefaultDuration] = useState(30);
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingType, setEditingType] = useState(null);

  // Days of the week for scheduling restrictions
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function addTaskType(e) {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newType = {
      id: Date.now().toString(),
      name: newTypeName,
      defaultDuration: newDefaultDuration,
      allowedDays: daysOfWeek, // Default to all days allowed
      color: newColor,
    };

    dispatch({ type: 'ADD_TASK_TYPE', taskType: newType });
    setNewTypeName('');
    setNewDefaultDuration(30);
    setNewColor('#3b82f6');
  }

  function updateTaskType(typeId, updates) {
    dispatch({
      type: 'UPDATE_TASK_TYPE',
      taskType: { id: typeId, ...updates },
    });
  }

  function deleteTaskType(typeId) {
    if (window.confirm('Are you sure you want to delete this task type?')) {
      dispatch({ type: 'DELETE_TASK_TYPE', taskTypeId: typeId });
    }
  }

  function toggleDayForType(typeId, day) {
    const type = taskTypes.find(t => t.id === typeId);
    if (!type) return;

    const newAllowedDays = type.allowedDays.includes(day)
      ? type.allowedDays.filter(d => d !== day)
      : [...type.allowedDays, day];

    updateTaskType(typeId, { ...type, allowedDays: newAllowedDays });
  }

  return (
    <div className={styles.container}>
      <h2>Task Types</h2>
      
      {/* Add new task type form */}
      <form onSubmit={addTaskType} className={styles.addForm}>
        <input
          type="text"
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          placeholder="New task type name"
        />
        <input
          type="number"
          value={newDefaultDuration}
          onChange={(e) => setNewDefaultDuration(parseInt(e.target.value) || 30)}
          min="5"
          max="480"
          placeholder="Default duration (min)"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          title="Task type color"
        />
        <button type="submit">Add Type</button>
      </form>

      {/* List of existing task types */}
      <div className={styles.typeList}>
        {taskTypes.map(type => (
          <div key={type.id} className={styles.typeItem}>
            {editingType === type.id ? (
              // Edit mode
              <div className={styles.editMode}>
                <input
                  type="text"
                  value={type.name}
                  onChange={(e) => updateTaskType(type.id, { ...type, name: e.target.value })}
                />
                <input
                  type="number"
                  value={type.defaultDuration}
                  onChange={(e) => updateTaskType(type.id, { ...type, defaultDuration: parseInt(e.target.value) || 30 })}
                  min="5"
                  max="480"
                />
                <input
                  type="color"
                  value={type.color || '#3b82f6'}
                  onChange={(e) => updateTaskType(type.id, { ...type, color: e.target.value })}
                  title="Task type color"
                />
                <button onClick={() => setEditingType(null)}>Save</button>
              </div>
            ) : (
              // View mode
              <div className={styles.viewMode}>
                <span className={styles.typeName}>{type.name}</span>
                <span className={styles.duration}>{type.defaultDuration} min</span>
                <button onClick={() => setEditingType(type.id)}>Edit</button>
                <button onClick={() => deleteTaskType(type.id)}>Delete</button>
              </div>
            )}

            {/* Day selector */}
            <div className={styles.daySelector}>
              {daysOfWeek.map(day => (
                <label key={day} className={styles.dayLabel}>
                  <input
                    type="checkbox"
                    checked={type.allowedDays.includes(day)}
                    onChange={() => toggleDayForType(type.id, day)}
                  />
                  <span>{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TaskTypeManager;
