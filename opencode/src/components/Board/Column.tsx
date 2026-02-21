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
  onEdit?: (column: ColumnType) => void;
  onDelete?: (columnId: string) => void;
}

export function Column({ column, children, isDropTarget, onEdit, onDelete }: ColumnProps) {
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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(column);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(column.id);
    }
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
      data-testid={`column-${column.id}`}
    >
      <div className="column-header" {...attributes} {...listeners}>
        <div className="column-drag-handle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </div>
        <h3 className="column-title">{column.title}</h3>
        <span className="card-count">{React.Children.count(children)}</span>
        <div className="column-header-actions">
          <button
            type="button"
            className="column-action-btn edit-column-btn"
            onClick={handleEditClick}
            aria-label="Edit column"
            title="Edit column"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
          </button>
          <button
            type="button"
            className="column-action-btn delete-column-btn"
            onClick={handleDeleteClick}
            aria-label="Delete column"
            title="Delete column"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
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
