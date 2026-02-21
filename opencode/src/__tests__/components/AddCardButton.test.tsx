import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddCardButton } from '../../components/Board/AddCardButton';
import { useBoardStore } from '../../stores/boardStore';

vi.mock('../../stores/boardStore');

describe('AddCardButton Component', () => {
  const mockAddCard = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
      addCard: mockAddCard,
      columns: [
        { id: 'col-1', title: 'To Do', order: 0 },
        { id: 'col-2', title: 'In Progress', order: 1 },
      ],
      cards: [
        { id: 'card-1', title: 'Task 1', description: 'Desc 1', columnId: 'col-1', order: 0 },
      ],
      reorderCards: vi.fn(),
      reorderColumns: vi.fn(),
      updateColumn: vi.fn(),
      deleteColumn: vi.fn(),
      updateCard: vi.fn(),
      deleteCard: vi.fn(),
    });
  });

  describe('Initial State', () => {
    it('should render add card button in initial state', () => {
      render(<AddCardButton columnId="col-1" />);
      expect(screen.getByText('Add a card')).toBeInTheDocument();
    });

    it('should render add card button with icon', () => {
      render(<AddCardButton columnId="col-1" />);
      const button = screen.getByText('Add a card');
      expect(button.parentElement).toHaveClass('add-card-button');
    });
  });

  describe('Click to Add', () => {
    it('should show form when add button is clicked', () => {
      render(<AddCardButton columnId="col-1" />);
      const addButton = screen.getByText('Add a card');
      fireEvent.click(addButton);
      
      expect(screen.getByPlaceholderText('Enter card title...')).toBeInTheDocument();
      expect(screen.getByText('Add Card')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call addCard with title when form is submitted', () => {
      render(<AddCardButton columnId="col-1" />);
      
      // Click add button to show form
      fireEvent.click(screen.getByText('Add a card'));
      
      // Fill in the title
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: 'New Card Title' } });
      
      // Submit form
      fireEvent.submit(screen.getByRole('form'));
      
      expect(mockAddCard).toHaveBeenCalledWith('col-1', 'New Card Title');
    });

    it('should trim whitespace from title', () => {
      render(<AddCardButton columnId="col-1" />);
      
      fireEvent.click(screen.getByText('Add a card'));
      
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: '  Trimmed Title  ' } });
      
      fireEvent.submit(screen.getByRole('form'));
      
      expect(mockAddCard).toHaveBeenCalledWith('col-1', 'Trimmed Title');
    });

    it('should not call addCard when title is empty', () => {
      render(<AddCardButton columnId="col-1" />);
      
      fireEvent.click(screen.getByText('Add a card'));
      
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: '   ' } });
      
      fireEvent.submit(screen.getByRole('form'));
      
      expect(mockAddCard).not.toHaveBeenCalled();
    });

    it('should reset form after successful submission', () => {
      render(<AddCardButton columnId="col-1" />);
      
      fireEvent.click(screen.getByText('Add a card'));
      
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: 'New Card' } });
      
      fireEvent.submit(screen.getByRole('form'));
      
      // Form should be hidden after submission
      expect(screen.queryByPlaceholderText('Enter card title...')).not.toBeInTheDocument();
      expect(screen.getByText('Add a card')).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should hide form and reset when cancel is clicked', () => {
      render(<AddCardButton columnId="col-1" />);
      
      fireEvent.click(screen.getByText('Add a card'));
      
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: 'Some text' } });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.queryByPlaceholderText('Enter card title...')).not.toBeInTheDocument();
      expect(screen.getByText('Add a card')).toBeInTheDocument();
    });

    it('should not call addCard when cancel is clicked', () => {
      render(<AddCardButton columnId="col-1" />);
      
      fireEvent.click(screen.getByText('Add a card'));
      
      const input = screen.getByPlaceholderText('Enter card title...');
      fireEvent.change(input, { target: { value: 'Some text' } });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(mockAddCard).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Instances', () => {
    it('should handle multiple add card buttons with different columnIds', () => {
      render(
        <>
          <AddCardButton columnId="col-1" />
          <AddCardButton columnId="col-2" />
        </>
      );
      
      const buttons = screen.getAllByText('Add a card');
      expect(buttons).toHaveLength(2);
    });
  });
});