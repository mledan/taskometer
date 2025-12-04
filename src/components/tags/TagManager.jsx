/**
 * TagManager Component
 *
 * CRUD interface for managing tags. Tags provide multi-categorization
 * for tasks beyond the single primary type.
 *
 * Features:
 * - Create new custom tags with name, color, icon
 * - Edit existing tags
 * - Delete custom tags (system tags cannot be deleted)
 * - Group tags by category
 */

import { useState, useMemo } from 'react';
import { useAppReducer, useAppState } from '../../AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { TAG_CATEGORIES, isSystemTag, getTagsByCategory, createTag, validateTag } from '../../models/Tag';
import styles from './TagManager.module.css';

// Common emoji icons for quick selection
const COMMON_ICONS = ['🏷️', '📌', '⭐', '🔥', '💡', '🎯', '📝', '🔔', '💼', '🏠', '❤️', '📚', '🎨', '🎮', '🚀', '⏰', '✅', '🔄'];

function TagManager() {
  const dispatch = useAppReducer();
  const { tags = [] } = useAppState();

  // Form state for new tag
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#94A3B8');
  const [newTagIcon, setNewTagIcon] = useState('🏷️');
  const [newTagCategory, setNewTagCategory] = useState('custom');
  const [newTagDescription, setNewTagDescription] = useState('');

  // UI state
  const [editingTag, setEditingTag] = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  // Group and filter tags
  const filteredTags = useMemo(() => {
    let result = tags;

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(tag =>
        tag.name.toLowerCase().includes(term) ||
        tag.description?.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(tag => tag.category === selectedCategory);
    }

    return result;
  }, [tags, searchTerm, selectedCategory]);

  const tagsByCategory = useMemo(() => {
    return getTagsByCategory(filteredTags);
  }, [filteredTags]);

  function handleAddTag(e) {
    e.preventDefault();
    setError('');

    if (!newTagName.trim()) {
      setError('Tag name is required');
      return;
    }

    // Check for duplicate names
    if (tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      setError('A tag with this name already exists');
      return;
    }

    const newTag = createTag({
      name: newTagName.trim(),
      color: newTagColor,
      icon: newTagIcon,
      category: newTagCategory,
      description: newTagDescription.trim() || null
    });

    const validation = validateTag(newTag);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    dispatch({ type: ACTION_TYPES.ADD_TAG, payload: newTag });

    // Reset form
    setNewTagName('');
    setNewTagColor('#94A3B8');
    setNewTagIcon('🏷️');
    setNewTagCategory('custom');
    setNewTagDescription('');
  }

  function handleUpdateTag(tagId, updates) {
    dispatch({
      type: ACTION_TYPES.UPDATE_TAG,
      payload: { tagId, updates }
    });
  }

  function handleDeleteTag(tagId) {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    if (isSystemTag(tagId)) {
      setError('System tags cannot be deleted');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the "${tag.name}" tag?`)) {
      dispatch({ type: ACTION_TYPES.DELETE_TAG, payload: { tagId } });
    }
  }

  function startEditing(tag) {
    setEditingTag({
      ...tag,
      originalId: tag.id
    });
  }

  function saveEditing() {
    if (!editingTag) return;

    handleUpdateTag(editingTag.originalId, {
      name: editingTag.name,
      color: editingTag.color,
      icon: editingTag.icon,
      category: editingTag.category,
      description: editingTag.description
    });

    setEditingTag(null);
  }

  function cancelEditing() {
    setEditingTag(null);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Tags</h2>
        <p className={styles.subtitle}>Create tags to categorize your tasks with multiple labels</p>
      </div>

      {/* Search and filter */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={styles.categoryFilter}
        >
          <option value="all">All Categories</option>
          {Object.entries(TAG_CATEGORIES).map(([id, cat]) => (
            <option key={id} value={id}>{cat.icon} {cat.name}</option>
          ))}
        </select>
      </div>

      {/* Error display */}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Add new tag form */}
      <form onSubmit={handleAddTag} className={styles.addForm}>
        <div className={styles.formRow}>
          <div className={styles.iconInput}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setShowIconPicker(!showIconPicker)}
              title="Choose icon"
            >
              {newTagIcon}
            </button>
            {showIconPicker && (
              <div className={styles.iconPicker}>
                {COMMON_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      setNewTagIcon(icon);
                      setShowIconPicker(false);
                    }}
                    className={styles.iconOption}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
            className={styles.nameInput}
          />

          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className={styles.colorInput}
            title="Tag color"
          />

          <select
            value={newTagCategory}
            onChange={(e) => setNewTagCategory(e.target.value)}
            className={styles.categorySelect}
          >
            {Object.entries(TAG_CATEGORIES).map(([id, cat]) => (
              <option key={id} value={id}>{cat.name}</option>
            ))}
          </select>

          <button type="submit" className={styles.addButton}>
            Add Tag
          </button>
        </div>

        <input
          type="text"
          value={newTagDescription}
          onChange={(e) => setNewTagDescription(e.target.value)}
          placeholder="Description (optional)"
          className={styles.descriptionInput}
        />
      </form>

      {/* Tags list grouped by category */}
      <div className={styles.tagsList}>
        {selectedCategory === 'all' ? (
          // Show grouped by category
          Object.entries(tagsByCategory).map(([categoryId, categoryTags]) => {
            if (categoryTags.length === 0) return null;
            const category = TAG_CATEGORIES[categoryId];

            return (
              <div key={categoryId} className={styles.categoryGroup}>
                <h3 className={styles.categoryTitle}>
                  <span>{category?.icon || '📁'}</span>
                  {category?.name || categoryId}
                  <span className={styles.tagCount}>({categoryTags.length})</span>
                </h3>
                <div className={styles.tagsGrid}>
                  {categoryTags.map(tag => (
                    <TagItem
                      key={tag.id}
                      tag={tag}
                      isEditing={editingTag?.originalId === tag.id}
                      editingData={editingTag?.originalId === tag.id ? editingTag : null}
                      onEdit={() => startEditing(tag)}
                      onSave={saveEditing}
                      onCancel={cancelEditing}
                      onDelete={() => handleDeleteTag(tag.id)}
                      onEditChange={setEditingTag}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Show flat list for selected category
          <div className={styles.tagsGrid}>
            {filteredTags.map(tag => (
              <TagItem
                key={tag.id}
                tag={tag}
                isEditing={editingTag?.originalId === tag.id}
                editingData={editingTag?.originalId === tag.id ? editingTag : null}
                onEdit={() => startEditing(tag)}
                onSave={saveEditing}
                onCancel={cancelEditing}
                onDelete={() => handleDeleteTag(tag.id)}
                onEditChange={setEditingTag}
              />
            ))}
          </div>
        )}

        {filteredTags.length === 0 && (
          <div className={styles.emptyState}>
            {searchTerm ? 'No tags match your search' : 'No tags yet. Create your first tag above!'}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual tag item component
 */
function TagItem({ tag, isEditing, editingData, onEdit, onSave, onCancel, onDelete, onEditChange }) {
  const isSystem = isSystemTag(tag.id);

  if (isEditing && editingData) {
    return (
      <div className={styles.tagItem} style={{ borderColor: editingData.color }}>
        <div className={styles.tagEditMode}>
          <input
            type="text"
            value={editingData.name}
            onChange={(e) => onEditChange({ ...editingData, name: e.target.value })}
            className={styles.editNameInput}
          />
          <input
            type="color"
            value={editingData.color}
            onChange={(e) => onEditChange({ ...editingData, color: e.target.value })}
            className={styles.editColorInput}
          />
          <div className={styles.editActions}>
            <button onClick={onSave} className={styles.saveButton}>Save</button>
            <button onClick={onCancel} className={styles.cancelButton}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.tagItem} ${isSystem ? styles.systemTag : ''}`}
      style={{
        '--tag-color': tag.color,
        backgroundColor: `${tag.color}15`,
        borderColor: tag.color
      }}
    >
      <div className={styles.tagContent}>
        <span className={styles.tagIcon}>{tag.icon}</span>
        <span className={styles.tagName}>{tag.name}</span>
        {isSystem && <span className={styles.systemBadge}>System</span>}
      </div>

      {tag.description && (
        <p className={styles.tagDescription}>{tag.description}</p>
      )}

      <div className={styles.tagActions}>
        {!isSystem && (
          <>
            <button onClick={onEdit} className={styles.editButton} title="Edit tag">
              ✏️
            </button>
            <button onClick={onDelete} className={styles.deleteButton} title="Delete tag">
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TagManager;
