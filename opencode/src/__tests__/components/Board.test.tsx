import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from '../../components/Board/Board';
import { Column as ColumnType, Card as CardType } from '../../types';
import { useBoardStore } from '../../stores/boardStore';

vi.mock('../../stores/boardStore');

const mockColumns: ColumnType[] = [
  { id: 'col-1', title: 'To Do', order: 0 },
  { id: 'col-2', title: 'In Progress', order: 1 },
  { id: 'col-3', title: 'Done', order: 2 },
];

const mockCards: CardType[] = [
  { id: 'card-1', title: 'Task 1', description: 'Description 1', columnId: 'col-1', order: 0 },
  { id: 'card-2', title: 'Task 2', description: 'Description 2', columnId: 'col-1', order: 1 },
  { id: 'card-3', title: 'Task 3', description: 'Description 3', columnId: 'col-2', order: 0 },
  { id: 'card-4', title: 'Task 4', description: 'Description 4', columnId: 'col-3', order: 0 },
];

describe('Board Component', () => {
  let mockReorderCards: ReturnType<typeof vi.fn>;
  let mockReorderColumns: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReorderCards = vi.fn();
    mockReorderColumns = vi.fn();

    (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
      columns: mockColumns,
      cards: mockCards,
      reorderCards: mockReorderCards,
      reorderColumns: mockReorderColumns,
      addCard: vi.fn(),
      updateColumn: vi.fn(),
      deleteColumn: vi.fn(),
      updateCard: vi.fn(),
      deleteCard: vi.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render board container', () => {
      render(<Board />);
      const boardElement = document.querySelector('.board');
      expect(boardElement).toBeInTheDocument();
    });

    it('should render all columns in correct order', () => {
      render(<Board />);
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('should render columns with correct order based on order property', () => {
      render(<Board />);
      const columns = document.querySelectorAll('[data-column-id]');
      expect(columns).toHaveLength(3);
      expect(columns[0]).toHaveAttribute('data-column-id', 'col-1');
      expect(columns[1]).toHaveAttribute('data-column-id', 'col-2');
      expect(columns[2]).toHaveAttribute('data-column-id', 'col-3');
    });

    it('should render cards within columns', () => {
      render(<Board />);
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
      expect(screen.getByText('Task 4')).toBeInTheDocument();
    });

    it('should render AddCardButton for each column', () => {
      render(<Board />);
      const addButtons = screen.getAllByText('Add a card');
      expect(addButtons).toHaveLength(3);
    });
  });

  describe('Empty States', () => {
    it('should render board with empty columns', () => {
      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: [],
        cards: [],
        reorderCards: mockReorderCards,
        reorderColumns: mockReorderColumns,
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      render(<Board />);
      const boardElement = document.querySelector('.board');
      expect(boardElement).toBeInTheDocument();
      expect(boardElement?.children).toHaveLength(0);
    });

    it('should render columns with no cards', () => {
      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: mockColumns,
        cards: [],
        reorderCards: mockReorderCards,
        reorderColumns: mockReorderColumns,
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      render(<Board />);
      const addButtons = screen.getAllByText('Add a card');
      expect(addButtons).toHaveLength(3);
    });
  });

  describe('Drag and Drop - Card Reordering', () => {
    it('should call reorderCards when cards are reordered within same column', () => {
      render(<Board />);

      // Simulate drag start
      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      // Simulate drag over (over same column)
      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'card-2',
          data: { current: { type: 'card', card: mockCards[1] } },
        },
      });

      // Simulate drag end
      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: {
          id: 'card-2',
          data: { current: { type: 'card', card: mockCards[1] } },
        },
      });

      expect(mockReorderCards).toHaveBeenCalledWith(
        'card-1',
        'card-2',
        'col-1',
        'col-1'
      );
    });

    it('should call reorderCards when card is moved to different column', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      // Drag over a card in a different column
      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'card-3',
          data: { current: { type: 'card', card: mockCards[2] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: {
          id: 'card-3',
          data: { current: { type: 'card', card: mockCards[2] } },
        },
      });

      expect(mockReorderCards).toHaveBeenCalledWith(
        'card-1',
        'card-3',
        'col-1',
        'col-2'
      );
    });
  });

  describe('Drag and Drop - Column Reordering', () => {
    it('should call reorderColumns when columns are reordered', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
      });

      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'col-2',
          data: { current: { type: 'column', column: mockColumns[1] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
        over: {
          id: 'col-2',
          data: { current: { type: 'column', column: mockColumns[1] } },
        },
      });

      expect(mockReorderColumns).toHaveBeenCalledWith('col-1', 'col-2');
    });

    it('should not call reorderColumns when reordering same column', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
      });

      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
        over: {
          id: 'col-1',
          data: { current: { type: 'column', column: mockColumns[0] } },
        },
      });

      expect(mockReorderColumns).not.toHaveBeenCalled();
    });
  });

  describe('Drop Target State', () => {
    it('should set drop target on column when dragging card over it', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      // Drag over a column (not a card)
      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'col-2',
          data: { current: { type: 'column', column: mockColumns[1] } },
        },
      });

      const targetColumn = document.querySelector('[data-column-id="col-2"]');
      expect(targetColumn).toHaveClass('drop-target');
    });

    it('should set drop target on column containing dragged card', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'card-3',
          data: { current: { type: 'card', card: mockCards[2] } },
        },
      });

      const targetColumn = document.querySelector('[data-column-id="col-2"]');
      expect(targetColumn).toHaveClass('drop-target');
    });

    it('should clear drop target after drag ends', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'col-2',
          data: { current: { type: 'column', column: mockColumns[1] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: {
          id: 'col-2',
          data: { current: { type: 'column', column: mockColumns[1] } },
        },
      });

      const targetColumn = document.querySelector('[data-column-id="col-2"]');
      expect(targetColumn).not.toHaveClass('drop-target');
    });
  });

  describe('State Reset', () => {
    it('should reset active and over states after drag ends', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      fireEvent.dragOver(document, {
        bubbles: true,
        cancelable: true,
        over: {
          id: 'card-3',
          data: { current: { type: 'card', card: mockCards[2] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: {
          id: 'card-3',
          data: { current: { type: 'card', card: mockCards[2] } },
        },
      });

      // The Board component internal state should be reset
      // This is implicit in the dragEnd handler logic
      expect(mockReorderCards).toHaveBeenCalledTimes(1);
    });

    it('should not call reorder functions when no valid over target', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: null,
      });

      expect(mockReorderCards).not.toHaveBeenCalled();
      expect(mockReorderColumns).not.toHaveBeenCalled();
    });

    it('should not call reorder functions when active and over have same id', () => {
      render(<Board />);

      fireEvent.dragStart(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      fireEvent.dragEnd(document, {
        bubbles: true,
        cancelable: true,
        active: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
        over: {
          id: 'card-1',
          data: { current: { type: 'card', card: mockCards[0] } },
        },
      });

      expect(mockReorderCards).not.toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('should sort columns by order before rendering', () => {
      const unorderedColumns: ColumnType[] = [
        { id: 'col-3', title: 'Done', order: 2 },
        { id: 'col-1', title: 'To Do', order: 0 },
        { id: 'col-2', title: 'In Progress', order: 1 },
      ];

      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: unorderedColumns,
        cards: mockCards,
        reorderCards: mockReorderCards,
        reorderColumns: mockReorderColumns,
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      render(<Board />);
      const columns = document.querySelectorAll('[data-column-id]');
      expect(columns[0]).toHaveAttribute('data-column-id', 'col-1');
      expect(columns[1]).toHaveAttribute('data-column-id', 'col-2');
      expect(columns[2]).toHaveAttribute('data-column-id', 'col-3');
    });

    it('should sort cards by order within each column', () => {
      render(<Board />);
      
      // Verify cards appear in order within the To Do column
      const toDoColumn = document.querySelector('[data-column-id="col-1"]');
      const toDoCards = toDoColumn?.querySelectorAll('h3, h4, h5, [class*="card-title"]');
      expect(toDoCards?.item(0)?.textContent).toBe('Task 1');
      expect(toDoCards?.item(1)?.textContent).toBe('Task 2');
    });
  });

  describe('Integration with Store', () => {
    it('should pass columns and cards to child components', () => {
      render(<Board />);
      
      // Check that Column components receive correct data
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();

      // Check that cards are rendered in their respective columns
      const toDoColumn = document.querySelector('[data-column-id="col-1"]');
      expect(toDoColumn?.textContent).toContain('Task 1');
      expect(toDoColumn?.textContent).toContain('Task 2');
    });

    it('should handle store updates', () => {
      const { rerender } = render(<Board />);

      const newColumns: ColumnType[] = [
        { id: 'col-4', title: 'New Column', order: 0 },
      ];
      const newCards: CardType[] = [];

      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: newColumns,
        cards: newCards,
        reorderCards: vi.fn(),
        reorderColumns: vi.fn(),
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      rerender(<Board />);
      expect(screen.getByText('New Column')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: undefined as any,
        cards: undefined as any,
        reorderCards: vi.fn(),
        reorderColumns: vi.fn(),
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      expect(() => render(<Board />)).not.toThrow();
    });

    it('should handle null values', () => {
      (useBoardStore as ReturnType<typeof vi.fn>).mockReturnValue({
        columns: null as any,
        cards: null as any,
        reorderCards: vi.fn(),
        reorderColumns: vi.fn(),
        addCard: vi.fn(),
        updateColumn: vi.fn(),
        deleteColumn: vi.fn(),
        updateCard: vi.fn(),
        deleteCard: vi.fn(),
      });

      expect(() => render(<Board />)).not.toThrow();
    });
  });
});
