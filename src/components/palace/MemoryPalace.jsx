import { useState, useRef, useCallback } from 'react';
import { useAppState, useAppReducer } from '../../AppContext.jsx';
import {
  createMemoryPalace,
  createMemoryLocation,
  createPalaceFromTemplate,
  PALACE_TEMPLATES,
  LOCATION_ICONS,
  LOCATION_COLORS,
} from '../../models/MemoryPalace.js';
import PalaceLocation from './PalaceLocation.jsx';
import styles from './MemoryPalace.module.css';

/**
 * MemoryPalace Component
 * 
 * Visual editor for creating and managing memory palaces.
 * Features:
 * - Create palaces from templates or scratch
 * - Visual drag-and-drop location placement
 * - Link tasks to locations
 * - Add static reminders
 */
function MemoryPalaceEditor() {
  const { palaces = [], items = [] } = useAppState();
  const dispatch = useAppReducer();
  
  const [selectedPalaceId, setSelectedPalaceId] = useState(palaces[0]?.id || null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPalaceName, setNewPalaceName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const canvasRef = useRef(null);
  
  const selectedPalace = palaces.find(p => p.id === selectedPalaceId);
  const selectedLocation = selectedPalace?.locations.find(l => l.id === selectedLocationId);

  // Get tasks that can be linked (pending or paused)
  const availableTasks = items.filter(t => 
    t.status === 'pending' || t.status === 'paused'
  );

  // Create a new palace from scratch
  function handleCreatePalace(e) {
    e.preventDefault();
    if (!newPalaceName.trim()) return;
    
    const newPalace = createMemoryPalace({
      name: newPalaceName,
      description: '',
    });
    
    dispatch({ type: 'ADD_PALACE', payload: newPalace });
    setSelectedPalaceId(newPalace.id);
    setNewPalaceName('');
    setIsCreating(false);
  }

  // Create a palace from template
  function handleCreateFromTemplate(templateKey) {
    const newPalace = createPalaceFromTemplate(templateKey);
    dispatch({ type: 'ADD_PALACE', payload: newPalace });
    setSelectedPalaceId(newPalace.id);
    setShowTemplates(false);
  }

  // Delete a palace
  function handleDeletePalace() {
    if (!selectedPalace) return;
    if (!window.confirm(`Delete "${selectedPalace.name}" and all its locations?`)) return;
    
    dispatch({ type: 'DELETE_PALACE', payload: { palaceId: selectedPalaceId } });
    setSelectedPalaceId(palaces.find(p => p.id !== selectedPalaceId)?.id || null);
    setSelectedLocationId(null);
  }

  // Add a new location
  function handleAddLocation() {
    if (!selectedPalace) return;
    
    const newLocation = createMemoryLocation({
      palaceId: selectedPalace.id,
      name: 'New Location',
      position: { x: 50, y: 50 },
      icon: LOCATION_ICONS[Math.floor(Math.random() * LOCATION_ICONS.length)],
      color: LOCATION_COLORS[selectedPalace.locations.length % LOCATION_COLORS.length],
    });
    
    dispatch({
      type: 'ADD_PALACE_LOCATION',
      payload: { palaceId: selectedPalace.id, location: newLocation }
    });
    setSelectedLocationId(newLocation.id);
  }

  // Update location position via drag
  const handleLocationDrag = useCallback((locationId, newPosition) => {
    if (!selectedPalace) return;
    
    dispatch({
      type: 'UPDATE_PALACE_LOCATION',
      payload: {
        palaceId: selectedPalace.id,
        locationId,
        updates: { position: newPosition }
      }
    });
  }, [selectedPalace, dispatch]);

  // Update location properties
  function handleUpdateLocation(updates) {
    if (!selectedPalace || !selectedLocationId) return;
    
    dispatch({
      type: 'UPDATE_PALACE_LOCATION',
      payload: {
        palaceId: selectedPalace.id,
        locationId: selectedLocationId,
        updates
      }
    });
  }

  // Delete selected location
  function handleDeleteLocation() {
    if (!selectedPalace || !selectedLocationId) return;
    
    dispatch({
      type: 'DELETE_PALACE_LOCATION',
      payload: { palaceId: selectedPalace.id, locationId: selectedLocationId }
    });
    setSelectedLocationId(null);
  }

  // Link/unlink task to location
  function handleToggleTaskLink(taskId) {
    if (!selectedPalace || !selectedLocation) return;
    
    const isLinked = selectedLocation.linkedTaskIds.includes(taskId);
    const newLinkedTasks = isLinked
      ? selectedLocation.linkedTaskIds.filter(id => id !== taskId)
      : [...selectedLocation.linkedTaskIds, taskId];
    
    handleUpdateLocation({ linkedTaskIds: newLinkedTasks });
  }

  // Add static reminder
  function handleAddReminder(e) {
    e.preventDefault();
    const input = e.target.elements.reminder;
    if (!input.value.trim() || !selectedLocation) return;
    
    handleUpdateLocation({
      staticReminders: [...selectedLocation.staticReminders, input.value.trim()]
    });
    input.value = '';
  }

  // Remove static reminder
  function handleRemoveReminder(index) {
    if (!selectedLocation) return;
    handleUpdateLocation({
      staticReminders: selectedLocation.staticReminders.filter((_, i) => i !== index)
    });
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>Memory Palace</h2>
        <p>Link tasks to locations using the Method of Loci</p>
      </div>

      {/* Palace selector and controls */}
      <div className={styles.controls}>
        <div className={styles.palaceSelector}>
          <select
            value={selectedPalaceId || ''}
            onChange={(e) => {
              setSelectedPalaceId(e.target.value);
              setSelectedLocationId(null);
            }}
          >
            {palaces.length === 0 && <option value="">No palaces yet</option>}
            {palaces.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <button onClick={() => setShowTemplates(true)} className={styles.primaryBtn}>
            + New Palace
          </button>
          
          {selectedPalace && (
            <button onClick={handleDeletePalace} className={styles.dangerBtn}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className={styles.mainContent}>
        {/* Canvas for visual palace */}
        <div className={styles.canvasArea}>
          {selectedPalace ? (
            <>
              <div className={styles.canvasHeader}>
                <h3>{selectedPalace.name}</h3>
                <button onClick={handleAddLocation} className={styles.addLocationBtn}>
                  + Add Location
                </button>
              </div>
              
              <div 
                ref={canvasRef}
                className={styles.canvas}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedLocationId(null);
                  }
                }}
              >
                {/* Grid pattern background */}
                <div className={styles.gridPattern} />
                
                {/* Locations */}
                {selectedPalace.locations.map(location => (
                  <PalaceLocation
                    key={location.id}
                    location={location}
                    isSelected={location.id === selectedLocationId}
                    onSelect={() => setSelectedLocationId(location.id)}
                    onDrag={handleLocationDrag}
                    tasks={items.filter(t => location.linkedTaskIds.includes(t.key?.toString() || t.id))}
                  />
                ))}
                
                {selectedPalace.locations.length === 0 && (
                  <div className={styles.emptyCanvas}>
                    <p>Click "Add Location" to start building your palace</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.noPalace}>
              <h3>Welcome to Memory Palace</h3>
              <p>Create a virtual space to organize your tasks spatially</p>
              <button onClick={() => setShowTemplates(true)} className={styles.primaryBtn}>
                Get Started
              </button>
            </div>
          )}
        </div>

        {/* Location details panel */}
        {selectedLocation && (
          <div className={styles.detailsPanel}>
            <div className={styles.detailsHeader}>
              <h3>Location Details</h3>
              <button onClick={handleDeleteLocation} className={styles.smallDangerBtn}>
                Delete
              </button>
            </div>

            {/* Location name */}
            <div className={styles.field}>
              <label>Name</label>
              <input
                type="text"
                value={selectedLocation.name}
                onChange={(e) => handleUpdateLocation({ name: e.target.value })}
              />
            </div>

            {/* Icon picker */}
            <div className={styles.field}>
              <label>Icon</label>
              <div className={styles.iconPicker}>
                {LOCATION_ICONS.slice(0, 15).map(icon => (
                  <button
                    key={icon}
                    className={`${styles.iconBtn} ${selectedLocation.icon === icon ? styles.selected : ''}`}
                    onClick={() => handleUpdateLocation({ icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className={styles.field}>
              <label>Color</label>
              <div className={styles.colorPicker}>
                {LOCATION_COLORS.map(color => (
                  <button
                    key={color}
                    className={`${styles.colorBtn} ${selectedLocation.color === color ? styles.selected : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleUpdateLocation({ color })}
                  />
                ))}
              </div>
            </div>

            {/* Linked tasks */}
            <div className={styles.field}>
              <label>Linked Tasks ({selectedLocation.linkedTaskIds.length})</label>
              <div className={styles.taskList}>
                {availableTasks.length > 0 ? (
                  availableTasks.map(task => {
                    const taskId = task.key?.toString() || task.id;
                    const isLinked = selectedLocation.linkedTaskIds.includes(taskId);
                    return (
                      <div 
                        key={taskId} 
                        className={`${styles.taskItem} ${isLinked ? styles.linked : ''}`}
                        onClick={() => handleToggleTaskLink(taskId)}
                      >
                        <span className={styles.checkbox}>{isLinked ? '✓' : ''}</span>
                        <span className={styles.taskText}>{task.text}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className={styles.noTasks}>No pending tasks to link</p>
                )}
              </div>
            </div>

            {/* Static reminders */}
            <div className={styles.field}>
              <label>Static Reminders</label>
              <form onSubmit={handleAddReminder} className={styles.reminderForm}>
                <input
                  name="reminder"
                  type="text"
                  placeholder="e.g., Keys always here"
                />
                <button type="submit">Add</button>
              </form>
              <div className={styles.reminderList}>
                {selectedLocation.staticReminders.map((reminder, index) => (
                  <div key={index} className={styles.reminderItem}>
                    <span>{reminder}</span>
                    <button onClick={() => handleRemoveReminder(index)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template selection modal */}
      {showTemplates && (
        <div className={styles.modal} onClick={() => setShowTemplates(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3>Create New Palace</h3>
            
            {/* From template */}
            <div className={styles.templateSection}>
              <h4>Start from Template</h4>
              <div className={styles.templates}>
                {Object.entries(PALACE_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    className={styles.templateCard}
                    onClick={() => handleCreateFromTemplate(key)}
                  >
                    <span className={styles.templateName}>{template.name}</span>
                    <span className={styles.templateDesc}>{template.description}</span>
                    <span className={styles.templateLocations}>
                      {template.suggestedLocations.length} locations
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* From scratch */}
            <div className={styles.scratchSection}>
              <h4>Or Create from Scratch</h4>
              <form onSubmit={handleCreatePalace}>
                <input
                  type="text"
                  value={newPalaceName}
                  onChange={(e) => setNewPalaceName(e.target.value)}
                  placeholder="Palace name..."
                />
                <button type="submit" disabled={!newPalaceName.trim()}>
                  Create Empty Palace
                </button>
              </form>
            </div>

            <button 
              className={styles.closeBtn} 
              onClick={() => setShowTemplates(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryPalaceEditor;
