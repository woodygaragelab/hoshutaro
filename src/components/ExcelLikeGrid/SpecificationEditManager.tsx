import React, { useCallback } from 'react';
import { HierarchicalData } from '../../types';
import { SpecificationEditContext } from './types';

interface SpecificationEditManagerProps {
  data: HierarchicalData[];
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  children: (handlers: SpecificationEditHandlers) => React.ReactNode;
}

export interface SpecificationEditHandlers {
  handleSpecificationEdit: (context: SpecificationEditContext) => void;
  handleSpecificationAdd: (rowId: string, afterIndex?: number) => void;
  handleSpecificationDelete: (rowId: string, specIndex: number) => void;
  handleSpecificationReorder: (rowId: string, fromIndex: number, toIndex: number) => void;
}

export const SpecificationEditManager: React.FC<SpecificationEditManagerProps> = ({
  data,
  onUpdateItem,
  onSpecificationEdit,
  children
}) => {
  const handleSpecificationEdit = useCallback((context: SpecificationEditContext) => {
    const { rowId, specIndex, field, value, isValid } = context;
    
    if (!isValid) {
      console.warn('Invalid specification edit:', context.errorMessage);
      return;
    }

    const item = data.find(d => d.id === rowId);
    if (!item) {
      console.error('Item not found for specification edit:', rowId);
      return;
    }

    const updatedSpecs = [...(item.specifications || [])];
    
    // Ensure the specification exists
    if (!updatedSpecs[specIndex]) {
      console.error('Specification index not found:', specIndex);
      return;
    }

    // Update the specific field
    if (field === 'key') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], key: String(value) };
      onSpecificationEdit(rowId, specIndex, 'key', String(value));
    } else if (field === 'value') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], value: String(value) };
      onSpecificationEdit(rowId, specIndex, 'value', String(value));
    } else if (field === 'order') {
      const newOrder = Number(value);
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], order: newOrder };
      
      // Re-sort specifications by order
      updatedSpecs.sort((a, b) => a.order - b.order);
      
      onSpecificationEdit(rowId, specIndex, 'order', String(newOrder));
    }

    // Update the item with new specifications
    const updatedItem: HierarchicalData = {
      ...item,
      specifications: updatedSpecs
    };

    onUpdateItem(updatedItem);
  }, [data, onUpdateItem, onSpecificationEdit]);

  const handleSpecificationAdd = useCallback((rowId: string, afterIndex?: number) => {
    const item = data.find(d => d.id === rowId);
    if (!item) {
      console.error('Item not found for specification add:', rowId);
      return;
    }

    const currentSpecs = item.specifications || [];
    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : currentSpecs.length;
    
    // Create new specification with appropriate order
    const newOrder = insertIndex < currentSpecs.length 
      ? currentSpecs[insertIndex].order 
      : (currentSpecs.length > 0 ? Math.max(...currentSpecs.map(s => s.order)) + 1 : 0);

    const newSpec = {
      key: `新規項目${currentSpecs.length + 1}`,
      value: '',
      order: newOrder
    };

    // Insert the new specification
    const updatedSpecs = [...currentSpecs];
    updatedSpecs.splice(insertIndex, 0, newSpec);

    // Re-order all specifications to maintain sequence
    updatedSpecs.forEach((spec, index) => {
      spec.order = index;
    });

    const updatedItem: HierarchicalData = {
      ...item,
      specifications: updatedSpecs
    };

    onUpdateItem(updatedItem);
    
    // Notify about the addition
    onSpecificationEdit(rowId, insertIndex, 'add', newSpec.key);
  }, [data, onUpdateItem, onSpecificationEdit]);

  const handleSpecificationDelete = useCallback((rowId: string, specIndex: number) => {
    const item = data.find(d => d.id === rowId);
    if (!item || !item.specifications) {
      console.error('Item or specifications not found for delete:', rowId);
      return;
    }

    if (item.specifications.length <= 1) {
      console.warn('Cannot delete the last specification');
      return;
    }

    if (specIndex < 0 || specIndex >= item.specifications.length) {
      console.error('Invalid specification index for delete:', specIndex);
      return;
    }

    const updatedSpecs = item.specifications.filter((_, index) => index !== specIndex);
    
    // Re-order remaining specifications
    updatedSpecs.forEach((spec, index) => {
      spec.order = index;
    });

    const updatedItem: HierarchicalData = {
      ...item,
      specifications: updatedSpecs
    };

    onUpdateItem(updatedItem);
    
    // Notify about the deletion
    onSpecificationEdit(rowId, specIndex, 'delete', '');
  }, [data, onUpdateItem, onSpecificationEdit]);

  const handleSpecificationReorder = useCallback((rowId: string, fromIndex: number, toIndex: number) => {
    const item = data.find(d => d.id === rowId);
    if (!item || !item.specifications) {
      console.error('Item or specifications not found for reorder:', rowId);
      return;
    }

    if (fromIndex === toIndex) return;

    const updatedSpecs = [...item.specifications];
    
    // Move the specification
    const [movedSpec] = updatedSpecs.splice(fromIndex, 1);
    updatedSpecs.splice(toIndex, 0, movedSpec);

    // Re-order all specifications
    updatedSpecs.forEach((spec, index) => {
      spec.order = index;
    });

    const updatedItem: HierarchicalData = {
      ...item,
      specifications: updatedSpecs
    };

    onUpdateItem(updatedItem);
    
    // Notify about the reorder
    onSpecificationEdit(rowId, fromIndex, 'reorder', `${fromIndex}->${toIndex}`);
  }, [data, onUpdateItem, onSpecificationEdit]);

  const handlers: SpecificationEditHandlers = {
    handleSpecificationEdit,
    handleSpecificationAdd,
    handleSpecificationDelete,
    handleSpecificationReorder
  };

  return <>{children(handlers)}</>;
};

export default SpecificationEditManager;