import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Command palette — Cmd+K / Ctrl+K opens it from anywhere in the app.
 * Power-user surface for jumping between routes and triggering actions
 * without leaving the keyboard.
 *
 * Commands are passed in by the parent so each route can add its own.
 * The palette itself is route-agnostic.
 */
export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => {
      const blob = `${c.label} ${c.hint || ''} ${c.keywords || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset index when filter narrows the list out from under us.
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) {
        cmd.run();
        onClose();
      }
    }
  };

  return (
    <div
      className="cp-backdrop"
      role="dialog"
      aria-label="command palette"
      onMouseDown={onClose}
    >
      <div className="cp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="cp-input"
          placeholder="Type a command or jump to…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="command search"
          aria-autocomplete="list"
          aria-controls="cp-list"
          aria-activedescendant={`cp-item-${activeIndex}`}
        />
        <ul id="cp-list" role="listbox" className="cp-list">
          {filtered.length === 0 && (
            <li className="cp-empty">No matches.</li>
          )}
          {filtered.map((c, i) => (
            <li
              id={`cp-item-${i}`}
              key={c.id}
              role="option"
              aria-selected={i === activeIndex}
              className={`cp-item${i === activeIndex ? ' cp-item-active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => { c.run(); onClose(); }}
            >
              <span className="cp-item-label">{c.label}</span>
              {c.hint && <span className="cp-item-hint">{c.hint}</span>}
              {c.shortcut && <span className="cp-item-shortcut">{c.shortcut}</span>}
            </li>
          ))}
        </ul>
        <div className="cp-foot">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
