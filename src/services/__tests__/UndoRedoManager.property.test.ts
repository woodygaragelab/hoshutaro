/**
 * UndoRedoManager Property-Based Tests
 * 
 * **Feature: maintenance-task-management**
 * 
 * These tests use fast-check to verify universal properties that should hold
 * across all valid inputs for the UndoRedoManager.
 * 
 * Requirements: 8.2, 8.3, 8.5, 8.6, 8.7
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { UndoRedoManager, HistoryAction, HistoryState } from '../UndoRedoManager';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid history actions
 */
const historyActionGenerator: fc.Arbitrary<HistoryAction> = fc.constantFrom(
  'CREATE_TASK',
  'UPDATE_TASK',
  'DELETE_TASK',
  'CREATE_ASSOCIATION',
  'UPDATE_ASSOCIATION',
  'DELETE_ASSOCIATION',
  'UPDATE_HIERARCHY',
  'REASSIGN_HIERARCHY',
  'UPDATE_ASSET',
  'UPDATE_SPECIFICATION'
);

/**
 * Generator for arbitrary data payloads
 */
const dataPayloadGenerator = fc.oneof(
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ maxLength: 100 }),
  }),
  fc.record({
    taskId: fc.string({ minLength: 1, maxLength: 20 }),
    assetId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  fc.record({
    hierarchyPath: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 50 })
    ),
  }),
  fc.anything()
);

/**
 * Generator for a single history operation (action + data)
 */
const historyOperationGenerator = fc.record({
  action: historyActionGenerator,
  data: dataPayloadGenerator,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Captures the current state of the manager for comparison
 */
function captureManagerState(manager: UndoRedoManager): {
  undoSize: number;
  redoSize: number;
  canUndo: boolean;
  canRedo: boolean;
  undoStack: HistoryState[];
  redoStack: HistoryState[];
} {
  return {
    undoSize: manager.getUndoStackSize(),
    redoSize: manager.getRedoStackSize(),
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    undoStack: manager.getUndoStack(),
    redoStack: manager.getRedoStack(),
  };
}

/**
 * Deep clone a history state for comparison
 */
function cloneHistoryState(state: HistoryState): HistoryState {
  return {
    timestamp: new Date(state.timestamp),
    action: state.action,
    data: JSON.parse(JSON.stringify(state.data)),
  };
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('UndoRedoManager Property-Based Tests', () => {
  let manager: UndoRedoManager;

  beforeEach(() => {
    manager = new UndoRedoManager();
  });

  /**
   * **Feature: maintenance-task-management, Property 19: Undo操作の状態復元**
   * 
   * For any operation, executing the operation and then undoing it should restore
   * the previous state.
   * 
   * **Validates: Requirements 8.2**
   */
  describe('Property 19: Undo操作の状態復元', () => {
    it('should restore previous state after undo for single operation', () => {
      fc.assert(
        fc.property(historyOperationGenerator, (operation) => {
          const manager = new UndoRedoManager();
          
          // Capture initial state
          const initialState = captureManagerState(manager);
          
          // Perform operation
          manager.pushState(operation.action, operation.data);
          
          // Undo the operation
          const undoneState = manager.undo();
          
          // Verify state is restored
          const finalState = captureManagerState(manager);
          
          expect(finalState.undoSize).toBe(initialState.undoSize);
          expect(finalState.canUndo).toBe(initialState.canUndo);
          
          // Verify the undone state matches what was pushed
          expect(undoneState).not.toBeNull();
          expect(undoneState!.action).toBe(operation.action);
          expect(undoneState!.data).toEqual(operation.data);
          
          // Verify redo stack has the operation
          expect(finalState.redoSize).toBe(1);
          expect(finalState.canRedo).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should restore previous state after undo for multiple operations', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 2, maxLength: 10 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Perform all operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            const stateAfterOperations = captureManagerState(manager);
            expect(stateAfterOperations.undoSize).toBe(operations.length);
            
            // Undo all operations
            const undoneStates: (HistoryState | null)[] = [];
            for (let i = 0; i < operations.length; i++) {
              undoneStates.push(manager.undo());
            }
            
            // Verify we're back to initial state
            const finalState = captureManagerState(manager);
            expect(finalState.undoSize).toBe(0);
            expect(finalState.canUndo).toBe(false);
            expect(finalState.redoSize).toBe(operations.length);
            
            // Verify undone states match operations in reverse order
            undoneStates.reverse().forEach((state, index) => {
              expect(state).not.toBeNull();
              expect(state!.action).toBe(operations[index].action);
              expect(state!.data).toEqual(operations[index].data);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data integrity through undo operations', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (operations, undoCount) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Capture state before undo
            const beforeUndo = captureManagerState(manager);
            
            // Undo some operations
            const actualUndoCount = Math.min(undoCount, operations.length);
            for (let i = 0; i < actualUndoCount; i++) {
              manager.undo();
            }
            
            // Verify state consistency
            const afterUndo = captureManagerState(manager);
            expect(afterUndo.undoSize).toBe(beforeUndo.undoSize - actualUndoCount);
            expect(afterUndo.redoSize).toBe(actualUndoCount);
            expect(afterUndo.undoSize + afterUndo.redoSize).toBe(operations.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 20: Redo操作の状態復元**
   * 
   * For any undone operation, redoing it should restore the state before the undo.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 20: Redo操作の状態復元', () => {
    it('should restore state before undo after redo for single operation', () => {
      fc.assert(
        fc.property(historyOperationGenerator, (operation) => {
          const manager = new UndoRedoManager();
          
          // Perform operation
          manager.pushState(operation.action, operation.data);
          const stateAfterPush = captureManagerState(manager);
          
          // Undo
          manager.undo();
          
          // Redo
          const redoneState = manager.redo();
          const stateAfterRedo = captureManagerState(manager);
          
          // Verify state is restored to after push
          expect(stateAfterRedo.undoSize).toBe(stateAfterPush.undoSize);
          expect(stateAfterRedo.redoSize).toBe(0);
          expect(stateAfterRedo.canUndo).toBe(true);
          expect(stateAfterRedo.canRedo).toBe(false);
          
          // Verify redone state matches original
          expect(redoneState).not.toBeNull();
          expect(redoneState!.action).toBe(operation.action);
          expect(redoneState!.data).toEqual(operation.data);
        }),
        { numRuns: 100 }
      );
    });

    it('should restore state after multiple undo-redo cycles', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 3, maxLength: 10 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Perform all operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            const stateAfterOperations = captureManagerState(manager);
            
            // Undo all
            for (let i = 0; i < operations.length; i++) {
              manager.undo();
            }
            
            // Redo all
            for (let i = 0; i < operations.length; i++) {
              manager.redo();
            }
            
            // Verify we're back to the state after operations
            const finalState = captureManagerState(manager);
            expect(finalState.undoSize).toBe(stateAfterOperations.undoSize);
            expect(finalState.redoSize).toBe(0);
            expect(finalState.canUndo).toBe(true);
            expect(finalState.canRedo).toBe(false);
            
            // Verify stack contents match
            expect(finalState.undoStack.length).toBe(operations.length);
            finalState.undoStack.forEach((state, index) => {
              expect(state.action).toBe(operations[index].action);
              expect(state.data).toEqual(operations[index].data);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle partial redo correctly', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 5, maxLength: 15 }),
          fc.integer({ min: 1, max: 14 }),
          (operations, redoCount) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Undo all
            for (let i = 0; i < operations.length; i++) {
              manager.undo();
            }
            
            // Redo some
            const actualRedoCount = Math.min(redoCount, operations.length);
            for (let i = 0; i < actualRedoCount; i++) {
              manager.redo();
            }
            
            // Verify state
            const finalState = captureManagerState(manager);
            expect(finalState.undoSize).toBe(actualRedoCount);
            expect(finalState.redoSize).toBe(operations.length - actualRedoCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 21: 新規操作後のRedoスタッククリア**
   * 
   * For any undone state, executing a new operation should clear the redo stack.
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 21: 新規操作後のRedoスタッククリア', () => {
    it('should clear redo stack when new operation is pushed after undo', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 2, maxLength: 10 }),
          historyOperationGenerator,
          (initialOperations, newOperation) => {
            const manager = new UndoRedoManager();
            
            // Perform initial operations
            initialOperations.forEach(op => manager.pushState(op.action, op.data));
            
            // Undo some operations
            const undoCount = Math.min(3, initialOperations.length);
            for (let i = 0; i < undoCount; i++) {
              manager.undo();
            }
            
            // Verify redo stack has items
            const beforeNewOp = captureManagerState(manager);
            expect(beforeNewOp.redoSize).toBeGreaterThan(0);
            expect(beforeNewOp.canRedo).toBe(true);
            
            // Push new operation
            manager.pushState(newOperation.action, newOperation.data);
            
            // Verify redo stack is cleared
            const afterNewOp = captureManagerState(manager);
            expect(afterNewOp.redoSize).toBe(0);
            expect(afterNewOp.canRedo).toBe(false);
            
            // Verify undo stack has the new operation
            expect(afterNewOp.undoSize).toBe(beforeNewOp.undoSize + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear redo stack regardless of redo stack size', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 19 }),
          historyOperationGenerator,
          (operations, undoCount, newOperation) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Undo multiple operations
            const actualUndoCount = Math.min(undoCount, operations.length);
            for (let i = 0; i < actualUndoCount; i++) {
              manager.undo();
            }
            
            const redoSizeBeforeNewOp = manager.getRedoStackSize();
            expect(redoSizeBeforeNewOp).toBe(actualUndoCount);
            
            // Push new operation
            manager.pushState(newOperation.action, newOperation.data);
            
            // Verify redo stack is completely cleared
            expect(manager.getRedoStackSize()).toBe(0);
            expect(manager.canRedo()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain undo stack integrity when clearing redo stack', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 3, maxLength: 10 }),
          historyOperationGenerator,
          (operations, newOperation) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Undo half
            const undoCount = Math.floor(operations.length / 2);
            for (let i = 0; i < undoCount; i++) {
              manager.undo();
            }
            
            const undoStackBeforeNewOp = manager.getUndoStack();
            
            // Push new operation
            manager.pushState(newOperation.action, newOperation.data);
            
            // Verify undo stack still has previous operations plus new one
            const undoStackAfterNewOp = manager.getUndoStack();
            expect(undoStackAfterNewOp.length).toBe(undoStackBeforeNewOp.length + 1);
            
            // Verify previous operations are intact
            for (let i = 0; i < undoStackBeforeNewOp.length; i++) {
              expect(undoStackAfterNewOp[i].action).toBe(undoStackBeforeNewOp[i].action);
              expect(undoStackAfterNewOp[i].data).toEqual(undoStackBeforeNewOp[i].data);
            }
            
            // Verify new operation is at the end
            const lastState = undoStackAfterNewOp[undoStackAfterNewOp.length - 1];
            expect(lastState.action).toBe(newOperation.action);
            expect(lastState.data).toEqual(newOperation.data);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 22: 履歴スタックの操作タイプ**
   * 
   * For any set of operations (task associations, hierarchy changes, task edits, asset edits),
   * these operations should be recorded in the history stack.
   * 
   * **Validates: Requirements 8.6**
   */
  describe('Property 22: 履歴スタックの操作タイプ', () => {
    it('should record all supported operation types in history stack', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 10, maxLength: 30 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Perform all operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Verify all operations are in the undo stack
            const undoStack = manager.getUndoStack();
            expect(undoStack.length).toBe(Math.min(operations.length, 50));
            
            // Verify each operation type is correctly recorded
            const recordedOperations = undoStack.slice(-operations.length);
            recordedOperations.forEach((state, index) => {
              const originalOp = operations[Math.max(0, operations.length - recordedOperations.length) + index];
              expect(state.action).toBe(originalOp.action);
              expect(state.data).toEqual(originalOp.data);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support all defined action types', () => {
      const allActionTypes: HistoryAction[] = [
        'CREATE_TASK',
        'UPDATE_TASK',
        'DELETE_TASK',
        'CREATE_ASSOCIATION',
        'UPDATE_ASSOCIATION',
        'DELETE_ASSOCIATION',
        'UPDATE_HIERARCHY',
        'REASSIGN_HIERARCHY',
        'UPDATE_ASSET',
        'UPDATE_SPECIFICATION'
      ];

      fc.assert(
        fc.property(
          fc.shuffledSubarray(allActionTypes, { minLength: 5, maxLength: 10 }),
          (selectedActions) => {
            const manager = new UndoRedoManager();
            
            // Push one operation for each selected action type
            selectedActions.forEach(action => {
              manager.pushState(action, { testData: `data-for-${action}` });
            });
            
            // Verify all are recorded
            const undoStack = manager.getUndoStack();
            expect(undoStack.length).toBe(selectedActions.length);
            
            // Verify action types match
            undoStack.forEach((state, index) => {
              expect(state.action).toBe(selectedActions[index]);
              expect(state.data.testData).toBe(`data-for-${selectedActions[index]}`);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve operation data through undo/redo cycles', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 5, maxLength: 15 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            
            // Undo all
            const undoneStates: (HistoryState | null)[] = [];
            for (let i = 0; i < operations.length; i++) {
              undoneStates.push(manager.undo());
            }
            
            // Redo all
            const redoneStates: (HistoryState | null)[] = [];
            for (let i = 0; i < operations.length; i++) {
              redoneStates.push(manager.redo());
            }
            
            // Verify all operations maintained their data
            operations.forEach((op, index) => {
              expect(undoneStates[operations.length - 1 - index]!.action).toBe(op.action);
              expect(undoneStates[operations.length - 1 - index]!.data).toEqual(op.data);
              
              expect(redoneStates[index]!.action).toBe(op.action);
              expect(redoneStates[index]!.data).toEqual(op.data);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 23: 履歴スタックのサイズ制限**
   * 
   * For any history stack, when more than 50 operations are added, the oldest
   * state should be removed.
   * 
   * **Validates: Requirements 8.7**
   */
  describe('Property 23: 履歴スタックのサイズ制限', () => {
    it('should maintain maximum stack size of 50', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 51, max: 100 }),
          fc.array(historyOperationGenerator, { minLength: 100, maxLength: 100 }),
          (numOperations, operations) => {
            const manager = new UndoRedoManager();
            
            // Perform more than 50 operations
            for (let i = 0; i < numOperations; i++) {
              const op = operations[i % operations.length];
              manager.pushState(op.action, { ...op.data, index: i });
            }
            
            // Verify stack size is exactly 50
            expect(manager.getUndoStackSize()).toBe(50);
            
            // Verify oldest states were removed
            const undoStack = manager.getUndoStack();
            expect(undoStack.length).toBe(50);
            
            // First item should be from operation (numOperations - 50)
            const firstIndex = undoStack[0].data.index;
            expect(firstIndex).toBe(numOperations - 50);
            
            // Last item should be from operation (numOperations - 1)
            const lastIndex = undoStack[49].data.index;
            expect(lastIndex).toBe(numOperations - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove oldest state when exceeding limit', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 55, maxLength: 80 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Add operations with unique identifiers
            operations.forEach((op, index) => {
              manager.pushState(op.action, { ...op.data, operationIndex: index });
            });
            
            // Verify size is 50
            expect(manager.getUndoStackSize()).toBe(50);
            
            // Verify the first (operations.length - 50) operations were removed
            const undoStack = manager.getUndoStack();
            const removedCount = operations.length - 50;
            
            // First operation in stack should be at index removedCount
            expect(undoStack[0].data.operationIndex).toBe(removedCount);
            
            // Last operation should be at index (operations.length - 1)
            expect(undoStack[49].data.operationIndex).toBe(operations.length - 1);
            
            // Verify no operations before removedCount exist
            undoStack.forEach(state => {
              expect(state.data.operationIndex).toBeGreaterThanOrEqual(removedCount);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain size limit through mixed operations', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 60, maxLength: 100 }),
          fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 10, maxLength: 20 }),
          (operations, undoIndices) => {
            const manager = new UndoRedoManager();
            
            // Perform operations with intermittent undos
            let operationCount = 0;
            operations.forEach((op, index) => {
              manager.pushState(op.action, { ...op.data, opIndex: operationCount++ });
              
              // Occasionally undo
              if (undoIndices.includes(index % 100) && manager.canUndo()) {
                manager.undo();
              }
            });
            
            // Verify stack never exceeds 50
            expect(manager.getUndoStackSize()).toBeLessThanOrEqual(50);
            
            // Verify total operations tracked doesn't exceed 50
            const totalTracked = manager.getUndoStackSize() + manager.getRedoStackSize();
            expect(totalTracked).toBeLessThanOrEqual(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle exactly 50 operations correctly', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 50, maxLength: 50 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Add exactly 50 operations
            operations.forEach((op, index) => {
              manager.pushState(op.action, { ...op.data, index });
            });
            
            // Verify size is exactly 50
            expect(manager.getUndoStackSize()).toBe(50);
            
            // Verify all operations are present
            const undoStack = manager.getUndoStack();
            expect(undoStack.length).toBe(50);
            
            undoStack.forEach((state, index) => {
              expect(state.action).toBe(operations[index].action);
              expect(state.data.index).toBe(index);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle size limit with undo/redo operations', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 60, maxLength: 80 }),
          (operations) => {
            const manager = new UndoRedoManager();
            
            // Add operations exceeding limit
            operations.forEach((op, index) => {
              manager.pushState(op.action, { ...op.data, index });
            });
            
            // Undo some operations
            const undoCount = Math.min(10, manager.getUndoStackSize());
            for (let i = 0; i < undoCount; i++) {
              manager.undo();
            }
            
            // Verify undo stack is still within limit
            expect(manager.getUndoStackSize()).toBeLessThanOrEqual(50);
            expect(manager.getUndoStackSize()).toBe(50 - undoCount);
            
            // Redo operations
            for (let i = 0; i < undoCount; i++) {
              manager.redo();
            }
            
            // Verify we're back to 50
            expect(manager.getUndoStackSize()).toBe(50);
            expect(manager.getRedoStackSize()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Round-trip consistency
   * 
   * Verifies that undo followed by redo maintains data consistency.
   */
  describe('Additional Property: Round-trip consistency', () => {
    it('should maintain consistency through undo-redo round trips', () => {
      fc.assert(
        fc.property(
          fc.array(historyOperationGenerator, { minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 19 }),
          (operations, roundTripCount) => {
            const manager = new UndoRedoManager();
            
            // Perform operations
            operations.forEach(op => manager.pushState(op.action, op.data));
            const initialState = captureManagerState(manager);
            
            // Perform multiple undo-redo round trips
            const actualRoundTrips = Math.min(roundTripCount, operations.length);
            for (let i = 0; i < actualRoundTrips; i++) {
              manager.undo();
              manager.redo();
            }
            
            // Verify state is unchanged
            const finalState = captureManagerState(manager);
            expect(finalState.undoSize).toBe(initialState.undoSize);
            expect(finalState.redoSize).toBe(initialState.redoSize);
            expect(finalState.canUndo).toBe(initialState.canUndo);
            expect(finalState.canRedo).toBe(initialState.canRedo);
            
            // Verify stack contents match
            expect(finalState.undoStack.length).toBe(initialState.undoStack.length);
            finalState.undoStack.forEach((state, index) => {
              expect(state.action).toBe(initialState.undoStack[index].action);
              expect(state.data).toEqual(initialState.undoStack[index].data);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
