/**
 * TagSelector Component
 *
 * Multi-select dropdown for choosing tags on a task.
 * Used in AddItemForm (TaskInput) for tagging tasks during creation.
 *
 * Features:
 * - Multi-select with visual tag chips
 * - Search/filter tags
 * - Group by category
 * - Quick add inline
 * - Keyboard navigation
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTags } from '../../context/AppContext';
import { TAG_CATEGORIES, searchTags, getTagStyle } from '../../models/Tag';
import styles from './TagSelector.module.css';

function TagSelector({
  selectedTags = [],
  onChange,
  placeholder = 'Add tags...',
  maxTags = 10,
  disabled = false,
  showCategories = true,
  compact = false
}) {
  const tags = useTags();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filter tags based on search and exclude already selected
  const filteredTags = useMemo(() => {
    let result = tags.filter(tag => !selectedTags.includes(tag.id));

    if (searchTerm) {
      result = searchTags(result, searchTerm);
    }

    return result;
  }, [tags, selectedTags, searchTerm]);

  // Group filtered tags by category
  const groupedTags = useMemo(() => {
    if (!showCategories || searchTerm) {
      return { all: filteredTags };
    }

    const groups = {};
    filteredTags.forEach(tag => {
      const category = tag.category || 'custom';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(tag);
    });
    return groups;
  }, [filteredTags, showCategories, searchTerm]);

  // Get flat list for keyboard navigation
  const flatFilteredTags = useMemo(() => {
    if (!showCategories || searchTerm) {
      return filteredTags;
    }
    return Object.values(groupedTags).flat();
  }, [filteredTags, groupedTags, showCategories, searchTerm]);

  // Get selected tag objects
  const selectedTagObjects = useMemo(() => {
    return selectedTags.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean);
  }, [selectedTags, tags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered tags change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [flatFilteredTags.length]);

  function handleToggleTag(tagId) {
    if (disabled) return;

    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else if (selectedTags.length < maxTags) {
      onChange([...selectedTags, tagId]);
    }
  }

  function handleRemoveTag(tagId, e) {
    e?.stopPropagation();
    if (disabled) return;
    onChange(selectedTags.filter(id => id !== tagId));
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < flatFilteredTags.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : flatFilteredTags.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatFilteredTags[highlightedIndex]) {
          handleToggleTag(flatFilteredTags[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'Backspace':
        if (!searchTerm && selectedTags.length > 0) {
          handleRemoveTag(selectedTags[selectedTags.length - 1]);
        }
        break;
    }
  }

  function handleInputChange(e) {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${compact ? styles.compact : ''} ${disabled ? styles.disabled : ''}`}
    >
      {/* Selected tags display */}
      <div
        className={styles.inputWrapper}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <div className={styles.selectedTags}>
          {selectedTagObjects.map(tag => (
            <span
              key={tag.id}
              className={styles.tagChip}
              style={{
                backgroundColor: `${tag.color}30`,
                borderColor: tag.color,
                color: tag.color
              }}
            >
              <span className={styles.chipIcon}>{tag.icon}</span>
              <span className={styles.chipName}>{tag.name}</span>
              {!disabled && (
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  aria-label={`Remove ${tag.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {selectedTags.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              placeholder={selectedTags.length === 0 ? placeholder : ''}
              className={styles.searchInput}
              disabled={disabled}
            />
          )}
        </div>

        <span className={styles.dropdownIcon}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className={styles.dropdown}>
          {filteredTags.length === 0 ? (
            <div className={styles.noResults}>
              {searchTerm ? `No tags match "${searchTerm}"` : 'No more tags available'}
            </div>
          ) : showCategories && !searchTerm ? (
            // Grouped view
            Object.entries(groupedTags).map(([categoryId, categoryTags]) => {
              if (categoryTags.length === 0) return null;
              const category = TAG_CATEGORIES[categoryId];

              return (
                <div key={categoryId} className={styles.categoryGroup}>
                  <div className={styles.categoryHeader}>
                    <span>{category?.icon || '📁'}</span>
                    <span>{category?.name || categoryId}</span>
                  </div>
                  {categoryTags.map((tag, index) => {
                    // Calculate global index for highlighting
                    let globalIndex = 0;
                    for (const [cId, cTags] of Object.entries(groupedTags)) {
                      if (cId === categoryId) {
                        globalIndex += index;
                        break;
                      }
                      globalIndex += cTags.length;
                    }

                    return (
                      <TagOption
                        key={tag.id}
                        tag={tag}
                        isHighlighted={highlightedIndex === globalIndex}
                        onSelect={() => handleToggleTag(tag.id)}
                      />
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Flat view (search results)
            flatFilteredTags.map((tag, index) => (
              <TagOption
                key={tag.id}
                tag={tag}
                isHighlighted={highlightedIndex === index}
                onSelect={() => handleToggleTag(tag.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Tag count indicator */}
      {selectedTags.length > 0 && (
        <div className={styles.tagCount}>
          {selectedTags.length}/{maxTags} tags
        </div>
      )}
    </div>
  );
}

/**
 * Individual tag option in dropdown
 */
function TagOption({ tag, isHighlighted, onSelect }) {
  return (
    <div
      className={`${styles.option} ${isHighlighted ? styles.highlighted : ''}`}
      onClick={onSelect}
      onMouseEnter={(e) => {
        // Could trigger highlight on mouse enter for smoother UX
      }}
    >
      <span
        className={styles.optionIcon}
        style={{ backgroundColor: `${tag.color}30` }}
      >
        {tag.icon}
      </span>
      <div className={styles.optionContent}>
        <span className={styles.optionName}>{tag.name}</span>
        {tag.description && (
          <span className={styles.optionDescription}>{tag.description}</span>
        )}
      </div>
    </div>
  );
}

export default TagSelector;
