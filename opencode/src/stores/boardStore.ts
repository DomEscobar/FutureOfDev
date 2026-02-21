import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Column, Card } from '../types';

interface BoardState {
  columns: Column[];
  cards: Card[];

   // Column actions
   addColumn: (title: string) => void;
   updateColumn: (id: string, title: string) => void;
   deleteColumn: (id: string) => void;
   toggleColumnCollapse: (id: string) => void;

  // Card actions
  addCard: (columnId: string, title: string, description?: string) => void;
  updateCard: (id: string, title?: string, description?: string, columnId?: string) => void;
  deleteCard: (id: string) => void;

  // Reordering
  reorderColumns: (activeId: string, overId: string) => void;
  reorderCards: (activeId: string, overId: string, sourceColumnId: string, targetColumnId: string) => void;
}

const generateId = () => `_${Math.random().toString(36).substr(2, 9)}`;

const initialColumns: Column[] = [
  { id: 'col-1', title: 'To Do', order: 0, collapsed: false },
  { id: 'col-2', title: 'In Progress', order: 1, collapsed: false },
  { id: 'col-3', title: 'Done', order: 2, collapsed: false },
];

const initialCards: Card[] = [
  { id: 'card-1', title: 'Research competitors', description: 'Analyze top 5 competitors', columnId: 'col-1', order: 0 },
  { id: 'card-2', title: 'Create wireframes', description: 'Design low-fidelity wireframes', columnId: 'col-1', order: 1 },
  { id: 'card-3', title: 'Setup repository', description: 'Initialize git and install dependencies', columnId: 'col-2', order: 0 },
  { id: 'card-4', title: 'Implement authentication', description: 'Add login/signup pages', columnId: 'col-2', order: 1 },
  { id: 'card-5', title: 'Project kickoff', description: 'Meet with stakeholders', columnId: 'col-3', order: 0 },
];

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      columns: initialColumns,
      cards: initialCards,

      addColumn: (title) => {
        const newColumn: Column = {
          id: generateId(),
          title,
          order: Date.now(),
        };
        set((state) => ({
          columns: [...state.columns, newColumn],
        }));
      },

      updateColumn: (id, title) => {
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === id ? { ...col, title } : col
          ),
        }));
      },

       deleteColumn: (id) => {
         set((state) => ({
           columns: state.columns.filter((col) => col.id !== id),
           cards: state.cards.filter((card) => card.columnId !== id),
         }));
       },

       toggleColumnCollapse: (id) => {
         set((state) => ({
           columns: state.columns.map((col) =>
             col.id === id ? { ...col, collapsed: !col.collapsed } : col
           ),
         }));
       },

      addCard: (columnId, title, description) => {
        const newCard: Card = {
          id: generateId(),
          title,
          description: description || '',
          columnId,
          order: Date.now(),
        };
        set((state) => ({
          cards: [...state.cards, newCard],
        }));
      },

      updateCard: (id, title, description, columnId) => {
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id
              ? {
                  ...card,
                  title: title ?? card.title,
                  description: description ?? card.description,
                  columnId: columnId ?? card.columnId,
                }
              : card
          ),
        }));
      },

      deleteCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((card) => card.id !== id),
        }));
      },

      reorderCards: (activeId, overId, sourceColumnId, targetColumnId) => {
        set((state) => {
          const cards = Array.from(state.cards);
          const overCardIndex = cards.findIndex((c) => c.id === overId);
          const activeCardIndex = cards.findIndex((c) => c.id === activeId);

          if (overCardIndex === -1) return state;

          const activeCard = cards[activeCardIndex];

          // Remove from source column
          cards.splice(activeCardIndex, 1);

          // Update column if moving between columns
          if (sourceColumnId !== targetColumnId) {
            activeCard.columnId = targetColumnId;
          }

          // Insert at new position
          cards.splice(overCardIndex, 0, activeCard);

          // Recalculate order values for all cards in target column
          const targetColumnCards = cards.filter((card) => card.columnId === targetColumnId);
          targetColumnCards.forEach((card, index) => {
            card.order = index;
          });

          return { cards };
        });
      },

      reorderColumns: (activeId, overId) => {
        set((state) => {
          const columns = Array.from(state.columns);
          const activeIndex = columns.findIndex((col) => col.id === activeId);
          const overIndex = columns.findIndex((col) => col.id === overId);

          if (overIndex === -1) return state;

          const [activeColumn] = columns.splice(activeIndex, 1);
          columns.splice(overIndex, 0, activeColumn);

          // Recalculate order
          columns.forEach((col, index) => {
            col.order = index;
          });

          return { columns };
        });
      },
    }),
    {
      name: 'kanban-board-storage',
    }
  )
);