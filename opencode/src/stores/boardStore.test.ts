import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from './boardStore';

describe('boardStore', () => {
  // Reset store before each test to ensure clean state
  beforeEach(() => {
    useBoardStore.setState({
      columns: [
        { id: 'col-1', title: 'To Do', order: 0 },
        { id: 'col-2', title: 'In Progress', order: 1 },
        { id: 'col-3', title: 'Done', order: 2 },
      ],
      cards: [
        { id: 'card-1', title: 'Research competitors', description: 'Analyze top 5 competitors', columnId: 'col-1', order: 0 },
        { id: 'card-2', title: 'Create wireframes', description: 'Design low-fidelity wireframes', columnId: 'col-1', order: 1 },
        { id: 'card-3', title: 'Setup repository', description: 'Initialize git and install dependencies', columnId: 'col-2', order: 0 },
        { id: 'card-4', title: 'Implement authentication', description: 'Add login/signup pages', columnId: 'col-2', order: 1 },
        { id: 'card-5', title: 'Project kickoff', description: 'Meet with stakeholders', columnId: 'col-3', order: 0 },
      ],
    });
  });

  describe('initial state', () => {
    it('should have 3 initial columns', () => {
      const { columns } = useBoardStore.getState();
      expect(columns).toHaveLength(3);
    });

    it('should have correct initial column titles', () => {
      const { columns } = useBoardStore.getState();
      expect(columns.map(c => c.title)).toEqual(['To Do', 'In Progress', 'Done']);
    });

    it('should have 5 initial cards', () => {
      const { cards } = useBoardStore.getState();
      expect(cards).toHaveLength(5);
    });

    it('should have cards distributed across columns', () => {
      const { cards } = useBoardStore.getState();
      const cardsByColumn = cards.reduce((acc, card) => {
        acc[card.columnId] = (acc[card.columnId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(cardsByColumn['col-1']).toBe(2);
      expect(cardsByColumn['col-2']).toBe(2);
      expect(cardsByColumn['col-3']).toBe(1);
    });
  });

  describe('column actions', () => {
    describe('addColumn', () => {
      it('should add a new column', () => {
        const { addColumn, columns } = useBoardStore.getState();
        addColumn('New Column');
        
        const newColumns = useBoardStore.getState().columns;
        expect(newColumns).toHaveLength(columns.length + 1);
        expect(newColumns[newColumns.length - 1].title).toBe('New Column');
      });

      it('should generate a unique id for new column', () => {
        const { addColumn, columns } = useBoardStore.getState();
        addColumn('Column 1');
        addColumn('Column 2');
        
        const newColumns = useBoardStore.getState().columns;
        const newColIds = newColumns.slice(columns.length).map(c => c.id);
        expect(newColIds[0]).not.toBe(newColIds[1]);
      });

      it('should add column with a valid order value', () => {
        const { addColumn } = useBoardStore.getState();
        addColumn('Test Column');
        
        const newColumn = useBoardStore.getState().columns[3];
        expect(newColumn.order).toBeDefined();
        expect(typeof newColumn.order).toBe('number');
      });
    });

    describe('updateColumn', () => {
      it('should update column title', () => {
        const { updateColumn } = useBoardStore.getState();
        updateColumn('col-1', 'Updated Title');
        
        const column = useBoardStore.getState().columns.find(c => c.id === 'col-1');
        expect(column?.title).toBe('Updated Title');
      });

      it('should not modify other columns when updating', () => {
        const { updateColumn, columns } = useBoardStore.getState();
        updateColumn('col-1', 'Updated');
        
        const newColumns = useBoardStore.getState().columns;
        expect(newColumns[1].title).toBe(columns[1].title);
        expect(newColumns[2].title).toBe(columns[2].title);
      });

      it('should do nothing for non-existent column', () => {
        const { updateColumn, columns } = useBoardStore.getState();
        updateColumn('non-existent', 'New Title');
        
        expect(useBoardStore.getState().columns).toEqual(columns);
      });
    });

    describe('deleteColumn', () => {
      it('should remove column by id', () => {
        const { deleteColumn } = useBoardStore.getState();
        deleteColumn('col-1');
        
        const columns = useBoardStore.getState().columns;
        expect(columns).toHaveLength(2);
        expect(columns.find(c => c.id === 'col-1')).toBeUndefined();
      });

      it('should also delete all cards in the column', () => {
        const { deleteColumn } = useBoardStore.getState();
        deleteColumn('col-1');
        
        const cards = useBoardStore.getState().cards;
        expect(cards.find(c => c.columnId === 'col-1')).toBeUndefined();
      });

      it('should not affect cards in other columns', () => {
        const { deleteColumn, cards } = useBoardStore.getState();
        deleteColumn('col-1');
        
        const newCards = useBoardStore.getState().cards;
        const col2Cards = cards.filter(c => c.columnId === 'col-2');
        const newCol2Cards = newCards.filter(c => c.columnId === 'col-2');
        expect(newCol2Cards).toHaveLength(col2Cards.length);
      });

      it('should do nothing for non-existent column', () => {
        const { deleteColumn, columns, cards } = useBoardStore.getState();
        deleteColumn('non-existent');
        
        expect(useBoardStore.getState().columns).toEqual(columns);
        expect(useBoardStore.getState().cards).toEqual(cards);
      });
    });
  });

  describe('card actions', () => {
    describe('addCard', () => {
      it('should add a new card to specified column', () => {
        const { addCard, cards } = useBoardStore.getState();
        addCard('col-1', 'New Card', 'New Description');
        
        const newCards = useBoardStore.getState().cards;
        expect(newCards).toHaveLength(cards.length + 1);
        
        const newCard = newCards[newCards.length - 1];
        expect(newCard.title).toBe('New Card');
        expect(newCard.description).toBe('New Description');
        expect(newCard.columnId).toBe('col-1');
      });

      it('should add card with empty description when not provided', () => {
        const { addCard } = useBoardStore.getState();
        addCard('col-1', 'Card without description');
        
        const newCard = useBoardStore.getState().cards[5];
        expect(newCard.description).toBe('');
      });

      it('should generate unique id for new card', () => {
        const { addCard } = useBoardStore.getState();
        addCard('col-1', 'Card 1');
        addCard('col-1', 'Card 2');
        
        const cards = useBoardStore.getState().cards;
        const newCardIds = cards.slice(5).map(c => c.id);
        expect(newCardIds[0]).not.toBe(newCardIds[1]);
      });
    });

    describe('updateCard', () => {
      it('should update card title', () => {
        const { updateCard } = useBoardStore.getState();
        updateCard('card-1', 'Updated Title');
        
        const card = useBoardStore.getState().cards.find(c => c.id === 'card-1');
        expect(card?.title).toBe('Updated Title');
      });

      it('should update card description', () => {
        const { updateCard } = useBoardStore.getState();
        updateCard('card-1', undefined, 'Updated Description');
        
        const card = useBoardStore.getState().cards.find(c => c.id === 'card-1');
        expect(card?.description).toBe('Updated Description');
      });

      it('should update card column', () => {
        const { updateCard } = useBoardStore.getState();
        updateCard('card-1', undefined, undefined, 'col-2');
        
        const card = useBoardStore.getState().cards.find(c => c.id === 'card-1');
        expect(card?.columnId).toBe('col-2');
      });

      it('should update multiple properties at once', () => {
        const { updateCard } = useBoardStore.getState();
        updateCard('card-1', 'New Title', 'New Desc', 'col-3');
        
        const card = useBoardStore.getState().cards.find(c => c.id === 'card-1');
        expect(card?.title).toBe('New Title');
        expect(card?.description).toBe('New Desc');
        expect(card?.columnId).toBe('col-3');
      });

      it('should preserve existing values when not provided', () => {
        const { updateCard, cards } = useBoardStore.getState();
        const originalCard = cards.find(c => c.id === 'card-1');
        updateCard('card-1', undefined, 'New Description');
        
        const updatedCard = useBoardStore.getState().cards.find(c => c.id === 'card-1');
        expect(updatedCard?.title).toBe(originalCard?.title);
        expect(updatedCard?.columnId).toBe(originalCard?.columnId);
      });

      it('should do nothing for non-existent card', () => {
        const { updateCard, cards } = useBoardStore.getState();
        updateCard('non-existent', 'New Title');
        
        expect(useBoardStore.getState().cards).toEqual(cards);
      });
    });

    describe('deleteCard', () => {
      it('should remove card by id', () => {
        const { deleteCard, cards } = useBoardStore.getState();
        deleteCard('card-1');
        
        const newCards = useBoardStore.getState().cards;
        expect(newCards).toHaveLength(cards.length - 1);
        expect(newCards.find(c => c.id === 'card-1')).toBeUndefined();
      });

      it('should not affect other cards', () => {
        const { deleteCard } = useBoardStore.getState();
        deleteCard('card-1');
        
        const cards = useBoardStore.getState().cards;
        expect(cards.find(c => c.id === 'card-2')).toBeDefined();
        expect(cards.find(c => c.id === 'card-3')).toBeDefined();
      });

      it('should do nothing for non-existent card', () => {
        const { deleteCard, cards } = useBoardStore.getState();
        deleteCard('non-existent');
        
        expect(useBoardStore.getState().cards).toEqual(cards);
      });
    });
  });

  describe('reorder actions', () => {
    describe('reorderColumns', () => {
      it('should move column to new position', () => {
        const { reorderColumns, columns } = useBoardStore.getState();
        const originalOrder = columns.map(c => c.id);
        
        // Move 'col-3' (index 2) to position 0
        reorderColumns('col-3', 'col-1');
        
        const newColumns = useBoardStore.getState().columns;
        expect(newColumns[0].id).toBe('col-3');
        expect(newColumns[2].id).toBe('col-2');
      });

      it('should update order values after reordering', () => {
        const { reorderColumns } = useBoardStore.getState();
        reorderColumns('col-3', 'col-1');
        
        const columns = useBoardStore.getState().columns;
        expect(columns[0].order).toBe(0);
        expect(columns[1].order).toBe(1);
        expect(columns[2].order).toBe(2);
      });

      it('should do nothing when overId does not exist', () => {
        const { reorderColumns, columns } = useBoardStore.getState();
        reorderColumns('col-1', 'non-existent');
        
        expect(useBoardStore.getState().columns).toEqual(columns);
      });
    });

    describe('reorderCards', () => {
      it('should move card within same column', () => {
        const { reorderCards, cards } = useBoardStore.getState();
        const col1Cards = cards.filter(c => c.columnId === 'col-1');
        
        // Move card-2 to position of card-1
        reorderCards('card-2', 'card-1', 'col-1', 'col-1');
        
        const newCards = useBoardStore.getState().cards;
        const newCol1Cards = newCards.filter(c => c.columnId === 'col-1');
        expect(newCol1Cards[0].id).toBe('card-2');
      });

      it('should move card to different column', () => {
        const { reorderCards } = useBoardStore.getState();
        
        // Move card-1 from col-1 to col-2
        reorderCards('card-1', 'card-3', 'col-1', 'col-2');
        
        const cards = useBoardStore.getState().cards;
        const card1 = cards.find(c => c.id === 'card-1');
        expect(card1?.columnId).toBe('col-2');
      });

      it('should update order values in target column after moving', () => {
        const { reorderCards } = useBoardStore.getState();
        
        reorderCards('card-1', 'card-3', 'col-1', 'col-2');
        
        const cards = useBoardStore.getState().cards;
        const col2Cards = cards.filter(c => c.columnId === 'col-2').sort((a, b) => a.order - b.order);
        expect(col2Cards[0].order).toBe(0);
        expect(col2Cards[1].order).toBe(1);
        expect(col2Cards[2].order).toBe(2);
      });

      it('should do nothing when overId does not exist', () => {
        const { reorderCards, cards } = useBoardStore.getState();
        reorderCards('card-1', 'non-existent', 'col-1', 'col-1');
        
        expect(useBoardStore.getState().cards).toEqual(cards);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty column title', () => {
      const { addColumn, columns } = useBoardStore.getState();
      addColumn('');
      
      const newColumns = useBoardStore.getState().columns;
      expect(newColumns).toHaveLength(columns.length + 1);
      expect(newColumns[newColumns.length - 1].title).toBe('');
    });

    it('should handle empty card title', () => {
      const { addCard, cards } = useBoardStore.getState();
      addCard('col-1', '');
      
      const newCards = useBoardStore.getState().cards;
      expect(newCards).toHaveLength(cards.length + 1);
      expect(newCards[newCards.length - 1].title).toBe('');
    });

    it('should handle deleting all columns', () => {
      const { deleteColumn } = useBoardStore.getState();
      deleteColumn('col-1');
      deleteColumn('col-2');
      deleteColumn('col-3');
      
      const columns = useBoardStore.getState().columns;
      expect(columns).toHaveLength(0);
    });

    it('should handle deleting all cards', () => {
      const { deleteCard } = useBoardStore.getState();
      deleteCard('card-1');
      deleteCard('card-2');
      deleteCard('card-3');
      deleteCard('card-4');
      deleteCard('card-5');
      
      const cards = useBoardStore.getState().cards;
      expect(cards).toHaveLength(0);
    });
  });
});