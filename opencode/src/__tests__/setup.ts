// Vitest setup file for React Testing Library
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock @dnd-kit packages
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  DragEndEvent: {},
  DragOverEvent: {},
  DragStartEvent: {},
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => ({})),
  closestCenter: {},
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: {},
  horizontalListSortingStrategy: {},
  arrayMove: vi.fn((arr, from, to) => arr),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn((transform) => transform ? 'translate3d(0, 0, 0)' : ''),
    },
  },
}));

// Mock the board store
vi.mock('../../stores/boardStore', () => ({
  useBoardStore: vi.fn(() => ({
    columns: [
      { id: 'col-1', title: 'To Do', order: 0 },
      { id: 'col-2', title: 'In Progress', order: 1 },
      { id: 'col-3', title: 'Done', order: 2 },
    ],
    cards: [
      { id: 'card-1', title: 'Task 1', description: 'Description 1', columnId: 'col-1', order: 0 },
      { id: 'card-2', title: 'Task 2', description: 'Description 2', columnId: 'col-1', order: 1 },
    ],
    reorderCards: vi.fn(),
    reorderColumns: vi.fn(),
    addCard: vi.fn(),
    addColumn: vi.fn(),
    updateColumn: vi.fn(),
    deleteColumn: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
  })),
}));