import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from '../../components/Board/Card';
import { Card as CardType } from '../../types';

describe('Card Component', () => {
  const mockCard: CardType = {
    id: 'card-1',
    title: 'Test Card Title',
    description: 'Test card description',
    columnId: 'col-1',
    order: 0,
  };

  const mockCardWithoutDescription: CardType = {
    id: 'card-2',
    title: 'Card Without Description',
    description: '',
    columnId: 'col-1',
    order: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render card title', () => {
      render(<Card card={mockCard} />);
      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    });

    it('should render card description when provided', () => {
      render(<Card card={mockCard} />);
      expect(screen.getByText('Test card description')).toBeInTheDocument();
    });

    it('should not render description element when description is empty', () => {
      render(<Card card={mockCardWithoutDescription} />);
      const description = screen.queryByText('Test card description');
      expect(description).not.toBeInTheDocument();
    });

    it('should render card with correct data-testid', () => {
      render(<Card card={mockCard} />);
      const cardElement = screen.getByTestId('card-card-1');
      expect(cardElement).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should have card class for styling', () => {
      render(<Card card={mockCard} />);
      const cardElement = screen.getByTestId('card-card-1');
      expect(cardElement).toHaveClass('card');
    });

    it('should contain card-handle element for drag functionality', () => {
      render(<Card card={mockCard} />);
      const handle = screen.getByTestId('card-card-1').querySelector('.card-handle');
      expect(handle).toBeInTheDocument();
    });

    it('should contain card-content element', () => {
      render(<Card card={mockCard} />);
      const content = screen.getByTestId('card-card-1').querySelector('.card-content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should render with all required props', () => {
      const card: CardType = {
        id: 'card-test',
        title: 'Test',
        description: 'Test desc',
        columnId: 'col-1',
        order: 0,
      };
      render(<Card card={card} />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle card with null description', () => {
      const card: CardType = {
        id: 'card-3',
        title: 'Null Desc Card',
        description: null as any,
        columnId: 'col-1',
        order: 0,
      };
      render(<Card card={card} />);
      expect(screen.getByText('Null Desc Card')).toBeInTheDocument();
    });
  });
});