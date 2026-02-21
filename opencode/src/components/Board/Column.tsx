import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column as ColumnType } from '../../types';
import { AddCardButton } from './AddCardButton';
import { useBoardStore } from '../../stores/boardStore';

interface ColumnProps {
  column: ColumnType;
  children: React.ReactNode;
  isDropTarget?: boolean;
}

export function Column({ column, children, isDropTarget }: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  });

  const toggleColumnCollapse = useBoardStore((state) => state.toggleColumnCollapse);
  
  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleColumnCollapse(column.id);
  };

  const style: React.CSSProperties = {
    transition,
  };

  if (transform) {
    let transformString = CSS.Transform.toString(transform);
    if (isDragging) {
      transformString += ' scale(0.95) rotate(2deg)';
    }
    style.transform = transformString;
  }

  const className = `column ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`;
  const contentClassName = `column-content ${column.collapsed ? 'collapsed' : ''}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      data-column-id={column.id}
    >
      <div className="column-header" {...attributes} {...listeners}>
        <div className="column-drag-handle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </div>
        <h3 className="column-title">{column.title}</h3>
        <span className="card-count">{React.Children.count(children)}</span>
        <button
          type="button"
          className={`btn-toggle-collapse ${column.collapsed ? 'expanded' : ''}`}
          onClick={handleToggleCollapse}
          aria-label={column.collapsed ? 'Expand column' : 'Collapse column'}
          title={column.collapsed ? 'Expand column' : 'Collapse column'}
        />
      </div>
      <div className={contentClassName}>
        {children}
        <AddCardButton columnId={column.id} />
      </div>
    </div>
  );
}
