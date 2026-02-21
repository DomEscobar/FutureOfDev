import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Column } from '../../components/Board/Column';
import { Column as ColumnType } from '../../types';

vi.mock('../../stores/boardStore', () => ({
  useBoardStore: vi.fn(() => ({
    addCard: vi.fn(),
    columns: [],
    cards: [],
    reorderCards: vi.fn(),
    reorderColumns: vi.fn(),
    updateColumn: vi.fn(),
    deleteColumn: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
  })),
}));

describe('Column Component', () => {
  const mockColumn: ColumnType = {
    id: 'col-1',
    title: 'To Do',
    order: 0,
  };

  const mockColumn2: ColumnType = {
    id: 'col-2',
    title: 'In Progress',
    order: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render column title', () => {
      render(
        <Column column={mockColumn}>
          <div>Card content</div>
        </Column>
      );
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <Column column={mockColumn}>
          <div data-testid="child-content">Card content</div>
        </Column>
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should render AddCardButton component', () => {
      render(
        <Column column={mockColumn}>
          <div>Card content</div>
        </Column>
      );
      expect(screen.getByText('Add a card')).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should have column class for styling', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const columnElement = screen.getByTestId('column-col-1');
      expect(columnElement).toHaveClass('column');
    });

    it('should render column-header with drag handle', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const header = screen.getByTestId('column-col-1').querySelector('.column-header');
      expect(header).toBeInTheDocument();
    });

    it('should render column-drag-handle', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const handle = screen.getByTestId('column-col-1').querySelector('.column-drag-handle');
      expect(handle).toBeInTheDocument();
    });

    it('should render column-title with correct text', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const title = screen.getByTestId('column-col-1').querySelector('.column-title');
      expect(title).toHaveTextContent('To Do');
    });
  });

  describe('Card Count', () => {
    it('should display correct card count', () => {
      render(
        <Column column={mockColumn}>
          <div>Card 1</div>
          <div>Card 2</div>
          <div>Card 3</div>
        </Column>
      );
      const countElement = screen.getByTestId('column-col-1').querySelector('.card-count');
      expect(countElement).toHaveTextContent('3');
    });

    it('should display zero for empty column', () => {
      render(
        <Column column={mockColumn}>
          <></>
        </Column>
      );
      const countElement = screen.getByTestId('column-col-1').querySelector('.card-count');
      expect(countElement).toHaveTextContent('0');
    });
  });

  describe('Drop Target State', () => {
    it('should apply drop-target class when isDropTarget is true', () => {
      render(
        <Column column={mockColumn} isDropTarget={true}>
          <div>Content</div>
        </Column>
      );
      const columnElement = screen.getByTestId('column-col-1');
      expect(columnElement).toHaveClass('drop-target');
    });

    it('should not apply drop-target class when isDropTarget is false', () => {
      render(
        <Column column={mockColumn} isDropTarget={false}>
          <div>Content</div>
        </Column>
      );
      const columnElement = screen.getByTestId('column-col-1');
      expect(columnElement).not.toHaveClass('drop-target');
    });

    it('should not apply drop-target class when isDropTarget is undefined', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const columnElement = screen.getByTestId('column-col-1');
      expect(columnElement).not.toHaveClass('drop-target');
    });
  });

  describe('Data Attributes', () => {
    it('should have data-column-id attribute', () => {
      render(
        <Column column={mockColumn}>
          <div>Content</div>
        </Column>
      );
      const columnElement = screen.getByTestId('column-col-1');
      expect(columnElement).toHaveAttribute('data-column-id', 'col-1');
    });
  });

  describe('Multiple Columns', () => {
    it('should render multiple columns correctly', () => {
      render(
        <>
          <Column column={mockColumn}>
            <div>Content 1</div>
          </Column>
          <Column column={mockColumn2}>
            <div>Content 2</div>
          </Column>
        </>
      );
      
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });
});