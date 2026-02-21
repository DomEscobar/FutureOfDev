import { useState } from 'react';
import React from 'react';
import { useBoardStore } from '../../stores/boardStore';

interface AddCardButtonProps {
  columnId: string;
}

export function AddCardButton({ columnId }: AddCardButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const addCard = useBoardStore((state) => state.addCard);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      addCard(columnId, title.trim());
      setTitle('');
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button
        className="add-card-button"
        onClick={() => setIsAdding(true)}
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 1 1 0-2h4V3a1 1 0 0 1 1-1z"/>
        </svg>
        Add a card
      </button>
    );
  }

  return (
    <form className="add-card-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter card title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="add-card-input"
      />
      <div className="add-card-actions">
        <button type="submit" className="add-card-submit">
          Add Card
        </button>
        <button
          type="button"
          className="add-card-cancel"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
