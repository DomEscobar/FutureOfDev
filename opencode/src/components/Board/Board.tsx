import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import React from 'react';
import { Card } from './Card';
import { Column } from './Column';
import { EditModal } from './EditModal';
import { useBoardStore } from '../../stores/boardStore';
import { Column as ColumnType, Card as CardType } from '../../types';
import './Board.css';

export function Board() {
  const { columns, cards, reorderCards, reorderColumns, deleteColumn, deleteCard } = useBoardStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'column' | 'card' | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overType, setOverType] = useState<'column' | 'card' | null>(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<CardType | ColumnType | null>(null);
  const [editModalType, setEditModalType] = useState<'card' | 'column' | null>(null);

  const handleEditColumn = (column: ColumnType) => {
    setEditModalItem(column);
    setEditModalType('column');
    setEditModalOpen(true);
  };

  const handleEditCard = (card: CardType) => {
    setEditModalItem(card);
    setEditModalType('card');
    setEditModalOpen(true);
  };

  const handleDeleteColumn = (columnId: string) => {
    // Check if column has cards
    const columnCards = cards.filter(card => card.columnId === columnId);
    if (columnCards.length > 0) {
      // Show confirmation - for now, just delete
      // TODO: Add delete confirmation modal
      if (window.confirm(`This column has ${columnCards.length} card(s). Delete anyway?`)) {
        deleteColumn(columnId);
      }
    } else {
      deleteColumn(columnId);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    if (window.confirm('Are you sure you want to delete this card?')) {
      deleteCard(cardId);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditModalItem(null);
    setEditModalType(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveType(active.data.current?.type as 'column' | 'card');
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverId(null);
      setOverType(null);
      return;
    }
    setOverId(over.id as string);
    setOverType(over.data.current?.type as 'column' | 'card');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    setOverId(null);
    setOverType(null);

    if (!over || active.id === over.id) return;

    const activeItem = active.data.current;
    const overItem = over.data.current;

    if (!activeItem) return;

    if (activeItem.type === 'card') {
      const activeCard = activeItem.card as CardType;
      const overColumn = over.data.current?.sortable?.containerId
        ? columns.find(col => col.id === over.data.current.sortable.containerId)
        : null;

      if (overColumn) {
        const targetColumnId = overColumn.id;
        const sourceColumnId = activeCard.columnId;

        reorderCards(
          activeCard.id,
          over.id as string,
          sourceColumnId,
          targetColumnId
        );
      }
    } else if (activeItem.type === 'column') {
      const activeColumn = activeItem.column as ColumnType;
      const overColumn = columns.find(col => col.id === over.id);
      if (overColumn && activeColumn.id !== overColumn.id) {
        reorderColumns(activeColumn.id, overColumn.id);
      }
    }
  };

  const getCardsForColumn = (columnId: string) => {
    return cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  };

  const getTargetColumnId = (): string | null => {
    if (!overId || !overType) return null;
    if (overType === 'column') {
      return overId;
    }
    if (overType === 'card') {
      const overCard = cards.find(c => c.id === overId);
      return overCard?.columnId || null;
    }
    return null;
  };

  const targetColumnId = getTargetColumnId();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        <SortableContext
          items={columns.sort((a, b) => a.order - b.order).map(col => col.id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns
            .sort((a, b) => a.order - b.order)
            .map((column) => (
              <Column
                key={column.id}
                column={column}
                isDropTarget={targetColumnId === column.id}
                onEdit={handleEditColumn}
                onDelete={handleDeleteColumn}
              >
                <SortableContext
                  items={getCardsForColumn(column.id).map(card => card.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {getCardsForColumn(column.id).map((card) => (
                    <Card key={card.id} card={card} onEdit={handleEditCard} onDelete={handleDeleteCard} />
                  ))}
                </SortableContext>
              </Column>
            ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}