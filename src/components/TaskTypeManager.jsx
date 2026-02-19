import { useMemo, useState } from 'react';
import { useAppReducer, useAppState } from '../AppContext.jsx';
import styles from './TaskTypeManager.module.css';

const ICON_PRESETS = ['💼','🧠','🏃','📚','🎨','👥','🧘','🏠','🎮','🚀','📝','⏰','🧹','💻','🧪'];

function TaskTypeManager() {
  const dispatch = useAppReducer();
  const { taskTypes = [] } = useAppState();
  const [newTypeName, setNewTypeName] = useState('');
  const [newDefaultDuration, setNewDefaultDuration] = useState(30);
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newIcon, setNewIcon] = useState('📌');
  const [search, setSearch] = useState('');
  const [editingType, setEditingType] = useState(null);

  // Days of the week for scheduling restrictions
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const nameExists = useMemo(() =>
    taskTypes.some(t => t.name.trim().toLowerCase() === newTypeName.trim().toLowerCase()),
  [taskTypes, newTypeName]);

  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return taskTypes;
    return taskTypes.filter(t => t.name.toLowerCase().includes(term));
  }, [taskTypes, search]);

  function addTaskType(e) {
    e.preventDefault();
    if (!newTypeName.trim() || nameExists) return;

    const newType = {
      id: Date.now().toString(),
      name: newTypeName.trim(),
      defaultDuration: newDefaultDuration,
      allowedDays: daysOfWeek, // Default to all days allowed
      color: newColor,
      icon: newIcon,
    };

    dispatch({ type: 'ADD_TASK_TYPE', taskType: newType });
    setNewTypeName('');
    setNewDefaultDuration(30);
    setNewColor('#3b82f6');
    setNewIcon('📌');
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

  function setDaysPreset(typeId, preset) {
    const presets = {
      all: daysOfWeek,
      weekdays: daysOfWeek.slice(0,5),
      none: []
    };
    const type = taskTypes.find(t => t.id === typeId);
    if (!type) return;
    updateTaskType(typeId, { ...type, allowedDays: presets[preset] });
  }

  return (
    <div className={styles.container}>
      <h2>Task Types</h2>

      {/* Search & Add */}
      <form onSubmit={addTaskType} className={styles.addForm}>
        <label>
          Name
          <input
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g., Work, Exercise, Reading"
          />
        </label>
        <label title="Used when no duration is provided on a task">
          Default duration (minutes)
          <input
            type="number"
            value={newDefaultDuration}
            onChange={(e) => setNewDefaultDuration(parseInt(e.target.value) || 30)}
            min="5"
            max="480"
            placeholder="30"
          />
        </label>
        <label title="Color used to display tasks of this type">
          Type color
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
        </label>
        <label title="Emoji/icon shown in pickers">
          Icon
          <select value={newIcon} onChange={(e)=>setNewIcon(e.target.value)}>
            {[newIcon, ...ICON_PRESETS].filter((v,i,arr)=>arr.indexOf(v)===i).map(ic => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!newTypeName.trim() || nameExists}>
          {nameExists ? 'Name taken' : 'Add Type'}
        </button>
      </form>

      <div style={{ display:'flex', gap:10, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search types..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          style={{ padding:8, border:'1px solid var(--border-color)', borderRadius:3, background:'var(--input-color)', color:'var(--font-color)', flex:'1 1 auto' }}
        />
      </div>

      {/* List of existing task types */}
      <div className={styles.typeList}>
        {filteredTypes.map(type => (
          <div key={type.id} className={styles.typeItem}>
            {editingType === type.id ? (
              // Edit mode
              <div className={styles.editMode}>
                <label>
                  Name
                  <input
                    type="text"
                    value={type.name}
                    onChange={(e) => updateTaskType(type.id, { ...type, name: e.target.value })}
                  />
                </label>
                <label title="Used when no duration is provided on a task">
                  Default duration (minutes)
                  <input
                    type="number"
                    value={type.defaultDuration}
                    onChange={(e) => updateTaskType(type.id, { ...type, defaultDuration: parseInt(e.target.value) || 30 })}
                    min="5"
                    max="480"
                  />
                </label>
                <label title="Color used to display tasks of this type">
                  Type color
                  <input
                    type="color"
                    value={type.color || '#3b82f6'}
                    onChange={(e) => updateTaskType(type.id, { ...type, color: e.target.value })}
                  />
                </label>
                <label title="Emoji/icon for this type">
                  Icon
                  <select value={type.icon || '📌'} onChange={(e)=>updateTaskType(type.id, { ...type, icon: e.target.value })}>
                    {[type.icon || '📌', ...ICON_PRESETS].filter((v,i,arr)=>arr.indexOf(v)===i).map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </label>
                <label title="Preferred start time (optional)">
                  Pref. start
                  <input type="time" value={type.constraints?.preferredTimeStart || ''}
                    onChange={(e)=> updateTaskType(type.id, { ...type, constraints: { ...(type.constraints||{}), preferredTimeStart: e.target.value||null }})}
                  />
                </label>
                <label title="Preferred end time (optional)">
                  Pref. end
                  <input type="time" value={type.constraints?.preferredTimeEnd || ''}
                    onChange={(e)=> updateTaskType(type.id, { ...type, constraints: { ...(type.constraints||{}), preferredTimeEnd: e.target.value||null }})}
                  />
                </label>
                <button onClick={() => setEditingType(null)}>Save</button>
              </div>
            ) : (
              // View mode
              <div className={styles.viewMode}>
                <span className={styles.typeName}>
                  <span style={{ marginRight:8 }}>{type.icon || '📌'}</span>
                  <span style={{ borderRadius:6, display:'inline-block', width:12, height:12, background: type.color || '#3b82f6', marginRight:8 }} />
                  {type.name}
                </span>
                <span className={styles.duration}>{type.defaultDuration} min</span>
                <button onClick={() => setEditingType(type.id)}>Edit</button>
                <button onClick={() => deleteTaskType(type.id)}>Delete</button>
              </div>
            )}

            {/* Day selector + presets */}
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
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={()=>setDaysPreset(type.id,'weekdays')}>Weekdays</button>
              <button onClick={()=>setDaysPreset(type.id,'all')}>All days</button>
              <button onClick={()=>setDaysPreset(type.id,'none')}>None</button>
            </div>
          </div>
        ))}
        {filteredTypes.length === 0 && (
          <div style={{ color: 'var(--font-color-secondary)' }}>No types match your search.</div>
        )}
      </div>
    </div>
  );
}

export default TaskTypeManager;
