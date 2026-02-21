import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { Card as CardType, Column as ColumnType } from '../../types';
import { useBoardStore } from '../../stores/boardStore';
import './EditModal.css';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CardType | ColumnType | null;
  type: 'card' | 'column' | null;
}

export function EditModal({ isOpen, onClose, item, type }: EditModalProps) {
  const { updateCard, updateColumn } = useBoardStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (item && type === 'card') {
      const card = item as CardType;
      setTitle(card.title);
      setDescription(card.description || '');
    } else if (item && type === 'column') {
      const column = item as ColumnType;
      setTitle(column.title);
      setDescription('');
    }
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }, [item, type]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [isEditingDescription]);

  if (!isOpen || !item || !type) return null;

  const handleSave = () => {
    if (type === 'card' && item) {
      updateCard(item.id, title, description);
    } else if (type === 'column' && item) {
      updateColumn(item.id, title);
    }
    onClose();
  };

  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
  };

  const handleDescriptionDoubleClick = () => {
    setIsEditingDescription(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditingDescription(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit {type === 'card' ? 'Card' : 'Column'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="inline-edit-input"
              />
            ) : (
              <div 
                className="inline-display" 
                onDoubleClick={handleTitleDoubleClick}
              >
                {title || 'Double-click to edit'}
              </div>
            )}
          </div>

          {type === 'card' && (
            <div className="form-group">
              <label>Description</label>
              {isEditingDescription ? (
                <textarea
                  ref={descriptionInputRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={handleDescriptionKeyDown}
                  className="inline-edit-textarea"
                  rows={4}
                />
              ) : (
                <div 
                  className="inline-display description" 
                  onDoubleClick={handleDescriptionDoubleClick}
                >
                  {description || 'Double-click to add description'}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
