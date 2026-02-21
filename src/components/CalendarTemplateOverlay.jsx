import React, { useState, useEffect } from 'react';
import { useAppReducer, ACTION_TYPES } from '../AppContext';
import { ENHANCED_FAMOUS_SCHEDULES, BLOCK_CATEGORIES, applyTemplateToDateRange } from '../utils/enhancedTemplates';
import { buildTemplateApplicationSummary } from '../utils/templateApplicationSummary.js';
import '../styles/CalendarTemplateOverlay.css';

const CalendarTemplateOverlay = ({ currentWeekStart, onTemplateApplied }) => {
  const dispatch = useAppReducer();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [previewBlocks, setPreviewBlocks] = useState([]);
  const [applyOptions, setApplyOptions] = useState({
    overrideExisting: false,
    mergeWithExisting: true,
    autoSlotTasks: false
  });

  useEffect(() => {
    // Initialize date range to current week
    // Use currentWeekStart if valid, otherwise use current date
    const baseDate = currentWeekStart && !isNaN(new Date(currentWeekStart).getTime()) 
      ? new Date(currentWeekStart) 
      : new Date();
    
    const weekStart = new Date(baseDate);
    const weekEnd = new Date(baseDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    setDateRange({
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0]
    });
  }, [currentWeekStart]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    generatePreview(template, dateRange);
  };

  const generatePreview = (template, range) => {
    if (!template || !range.startDate || !range.endDate) return;
    
    const blocks = applyTemplateToDateRange(
      template,
      range.startDate,
      range.endDate,
      applyOptions
    );
    setPreviewBlocks(blocks);
  };

  const handleDateRangeChange = (field, value) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRange(newRange);
    if (selectedTemplate) {
      generatePreview(selectedTemplate, newRange);
    }
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate || previewBlocks.length === 0) return;

    // Dispatch action to apply template blocks
    dispatch({
      type: ACTION_TYPES.APPLY_TEMPLATE_BLOCKS,
      payload: {
        blocks: previewBlocks,
        options: applyOptions
      }
    });

    // If auto-slot is enabled, also schedule unscheduled tasks
    if (applyOptions.autoSlotTasks) {
      dispatch({
        type: ACTION_TYPES.AUTO_SLOT_TASKS_INTO_TEMPLATE,
        payload: {
          templateBlocks: previewBlocks
        }
      });
    }

    const applicationSummary = buildTemplateApplicationSummary({
      schedule: selectedTemplate,
      blocks: previewBlocks,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      source: 'calendar-overlay'
    });

    dispatch({
      type: ACTION_TYPES.UPDATE_SETTINGS,
      payload: {
        lastTemplateApplication: applicationSummary
      }
    });

    // Notify parent component
    if (onTemplateApplied) {
      onTemplateApplied(previewBlocks);
    }

    // Reset and close
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTemplate(null);
    setPreviewBlocks([]);
  };

  const getCategoryColor = (categoryId) => {
    const category = Object.values(BLOCK_CATEGORIES).find(c => c.id === categoryId);
    return category?.color || '#8b9dc3';
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        className="template-fab"
        onClick={() => setIsOpen(true)}
        title="Apply Schedule Template"
      >
        <span className="fab-icon">📋</span>
        <span className="fab-label">Templates</span>
      </button>

      {/* Template Application Modal */}
      {isOpen && (
        <div className="template-overlay-modal">
          <div className="template-modal-content">
            <div className="template-modal-header">
              <h2>Apply Schedule Template</h2>
              <button className="close-button" onClick={handleClose}>×</button>
            </div>

            <div className="template-modal-body">
              {/* Template Selection */}
              <div className="template-selection-section">
                <h3>Choose a Template</h3>
                <div className="template-grid">
                  {ENHANCED_FAMOUS_SCHEDULES.map(template => (
                    <div 
                      key={template.id}
                      className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="template-card-header">
                        <h4>{template.name}</h4>
                        <span className="template-author">{template.author}</span>
                      </div>
                      <p className="template-description">{template.description}</p>
                      <div className="template-tags">
                        {template.tags.map(tag => (
                          <span key={tag} className="template-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="date-range-section">
                <h3>Select Date Range</h3>
                <div className="date-inputs">
                  <div className="date-input-group">
                    <label htmlFor="start-date">Start Date</label>
                    <input
                      type="date"
                      id="start-date"
                      value={dateRange.startDate}
                      onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                    />
                  </div>
                  <div className="date-input-group">
                    <label htmlFor="end-date">End Date</label>
                    <input
                      type="date"
                      id="end-date"
                      value={dateRange.endDate}
                      onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                      min={dateRange.startDate}
                    />
                  </div>
                </div>
              </div>

              {/* Application Options */}
              <div className="apply-options-section">
                <h3>Options</h3>
                <div className="options-list">
                  <label className="option-item">
                    <input
                      type="checkbox"
                      checked={applyOptions.overrideExisting}
                      onChange={(e) => setApplyOptions({
                        ...applyOptions,
                        overrideExisting: e.target.checked,
                        mergeWithExisting: !e.target.checked
                      })}
                    />
                    <span>Override existing schedule blocks</span>
                  </label>
                  <label className="option-item">
                    <input
                      type="checkbox"
                      checked={applyOptions.autoSlotTasks}
                      onChange={(e) => setApplyOptions({
                        ...applyOptions,
                        autoSlotTasks: e.target.checked
                      })}
                    />
                    <span>Auto-schedule unscheduled tasks into template blocks</span>
                  </label>
                </div>
              </div>

              {/* Preview Section */}
              {selectedTemplate && previewBlocks.length > 0 && (
                <div className="preview-section">
                  <h3>Preview</h3>
                  <div className="preview-timeline">
                    {/* Group blocks by date */}
                    {Object.entries(
                      previewBlocks.reduce((acc, block) => {
                        const dateKey = formatDate(block.startTime);
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(block);
                        return acc;
                      }, {})
                    ).slice(0, 3).map(([date, blocks]) => (
                      <div key={date} className="preview-day">
                        <div className="preview-day-header">{date}</div>
                        <div className="preview-blocks">
                          {blocks.map((block, idx) => (
                            <div 
                              key={idx} 
                              className="preview-block"
                              style={{ 
                                backgroundColor: getCategoryColor(block.categoryId),
                                opacity: 0.8
                              }}
                            >
                              <span className="block-time">
                                {formatTime(block.startTime)} - {formatTime(block.endTime)}
                              </span>
                              <span className="block-label">{block.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {previewBlocks.length > 15 && (
                      <div className="preview-more">
                        <span>+ {Math.floor(previewBlocks.length / 5) - 3} more days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="template-modal-footer">
              <button className="cancel-button" onClick={handleClose}>
                Cancel
              </button>
              <button 
                className="apply-button"
                onClick={handleApplyTemplate}
                disabled={!selectedTemplate || previewBlocks.length === 0}
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Overlay on Calendar */}
      {previewBlocks.length > 0 && !isOpen && (
        <div className="calendar-template-overlay">
          {previewBlocks.map((block, idx) => {
            const startDate = new Date(block.startTime);
            const dayOfWeek = startDate.getDay();
            const hour = startDate.getHours();
            const minutes = startDate.getMinutes();
            const duration = block.duration / 60; // Convert to hours
            
            // Calculate position based on calendar grid
            const left = `${(dayOfWeek * 14.285)}%`; // 100% / 7 days
            const top = `${((hour + minutes / 60) * 60)}px`; // 60px per hour
            const height = `${duration * 60}px`;
            
            return (
              <div
                key={idx}
                className="template-block-overlay"
                style={{
                  position: 'absolute',
                  left,
                  top,
                  height,
                  width: '13.5%',
                  backgroundColor: getCategoryColor(block.categoryId),
                  opacity: 0.3,
                  pointerEvents: 'none',
                  border: '1px dashed rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  padding: '2px 4px'
                }}
              >
                <div className="overlay-block-label" style={{ fontSize: '10px', color: '#333' }}>
                  {block.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default CalendarTemplateOverlay;