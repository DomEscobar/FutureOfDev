export interface Card {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  order: number;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  collapsed?: boolean;
}

export type DragItemType = 'column' | 'card';