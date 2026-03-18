/**
 * UndoRedoManager Unit Tests
 * 
 * UndoRedoManagerの基本機能をテストします。
 */

import { UndoRedoManager, HistoryAction } from '../UndoRedoManager';

describe('UndoRedoManager', () => {
  let manager: UndoRedoManager;

  beforeEach(() => {
    manager = new UndoRedoManager();
  });

  describe('pushState', () => {
    it('should add a state to the undo stack', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      
      expect(manager.getUndoStackSize()).toBe(1);
      expect(manager.canUndo()).toBe(true);
    });

    it('should clear redo stack when new state is pushed', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      expect(manager.getRedoStackSize()).toBe(1);
      
      manager.pushState('CREATE_TASK', { taskId: 'task-2' });
      expect(manager.getRedoStackSize()).toBe(0);
    });

    it('should maintain max stack size of 50', () => {
      // 51個の状態を追加
      for (let i = 0; i < 51; i++) {
        manager.pushState('CREATE_TASK', { taskId: `task-${i}` });
      }
      
      expect(manager.getUndoStackSize()).toBe(50);
    });

    it('should remove oldest state when exceeding max size', () => {
      // 51個の状態を追加
      for (let i = 0; i < 51; i++) {
        manager.pushState('CREATE_TASK', { taskId: `task-${i}` });
      }
      
      const stack = manager.getUndoStack();
      // 最も古い状態（task-0）は削除されているはず
      expect(stack[0].data.taskId).toBe('task-1');
      expect(stack[stack.length - 1].data.taskId).toBe('task-50');
    });

    it('should store timestamp with each state', () => {
      const beforeTime = new Date();
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      const afterTime = new Date();
      
      const stack = manager.getUndoStack();
      const timestamp = stack[0].timestamp;
      
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should support all action types', () => {
      const actions: HistoryAction[] = [
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

      actions.forEach((action, index) => {
        manager.pushState(action, { id: index });
      });

      expect(manager.getUndoStackSize()).toBe(actions.length);
      
      const stack = manager.getUndoStack();
      actions.forEach((action, index) => {
        expect(stack[index].action).toBe(action);
      });
    });
  });

  describe('undo', () => {
    it('should return null when undo stack is empty', () => {
      const result = manager.undo();
      expect(result).toBeNull();
    });

    it('should return the last state and move it to redo stack', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      
      const state = manager.undo();
      
      expect(state).not.toBeNull();
      expect(state?.action).toBe('CREATE_TASK');
      expect(state?.data.taskId).toBe('task-1');
      expect(manager.getUndoStackSize()).toBe(0);
      expect(manager.getRedoStackSize()).toBe(1);
    });

    it('should handle multiple undo operations', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('UPDATE_TASK', { taskId: 'task-1', name: 'Updated' });
      manager.pushState('DELETE_TASK', { taskId: 'task-1' });
      
      const state1 = manager.undo();
      expect(state1?.action).toBe('DELETE_TASK');
      
      const state2 = manager.undo();
      expect(state2?.action).toBe('UPDATE_TASK');
      
      const state3 = manager.undo();
      expect(state3?.action).toBe('CREATE_TASK');
      
      expect(manager.getUndoStackSize()).toBe(0);
      expect(manager.getRedoStackSize()).toBe(3);
    });
  });

  describe('redo', () => {
    it('should return null when redo stack is empty', () => {
      const result = manager.redo();
      expect(result).toBeNull();
    });

    it('should return the last undone state and move it back to undo stack', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      
      const state = manager.redo();
      
      expect(state).not.toBeNull();
      expect(state?.action).toBe('CREATE_TASK');
      expect(state?.data.taskId).toBe('task-1');
      expect(manager.getUndoStackSize()).toBe(1);
      expect(manager.getRedoStackSize()).toBe(0);
    });

    it('should handle multiple redo operations', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      manager.pushState('DELETE_TASK', { taskId: 'task-1' });
      
      manager.undo();
      manager.undo();
      manager.undo();
      
      const state1 = manager.redo();
      expect(state1?.action).toBe('CREATE_TASK');
      
      const state2 = manager.redo();
      expect(state2?.action).toBe('UPDATE_TASK');
      
      const state3 = manager.redo();
      expect(state3?.action).toBe('DELETE_TASK');
      
      expect(manager.getUndoStackSize()).toBe(3);
      expect(manager.getRedoStackSize()).toBe(0);
    });
  });

  describe('canUndo', () => {
    it('should return false when undo stack is empty', () => {
      expect(manager.canUndo()).toBe(false);
    });

    it('should return true when undo stack has items', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      expect(manager.canUndo()).toBe(true);
    });

    it('should return false after undoing all items', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('canRedo', () => {
    it('should return false when redo stack is empty', () => {
      expect(manager.canRedo()).toBe(false);
    });

    it('should return true after undo', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });

    it('should return false after redoing all items', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      manager.redo();
      expect(manager.canRedo()).toBe(false);
    });

    it('should return false after new state is pushed', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      expect(manager.canRedo()).toBe(true);
      
      manager.pushState('CREATE_TASK', { taskId: 'task-2' });
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('getUndoStackSize', () => {
    it('should return 0 for empty stack', () => {
      expect(manager.getUndoStackSize()).toBe(0);
    });

    it('should return correct size after adding states', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      expect(manager.getUndoStackSize()).toBe(1);
      
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      expect(manager.getUndoStackSize()).toBe(2);
    });

    it('should decrease after undo', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      
      manager.undo();
      expect(manager.getUndoStackSize()).toBe(1);
    });
  });

  describe('getRedoStackSize', () => {
    it('should return 0 for empty stack', () => {
      expect(manager.getRedoStackSize()).toBe(0);
    });

    it('should increase after undo', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      expect(manager.getRedoStackSize()).toBe(1);
    });

    it('should decrease after redo', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.undo();
      manager.redo();
      expect(manager.getRedoStackSize()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear both stacks', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      manager.undo();
      
      expect(manager.getUndoStackSize()).toBe(1);
      expect(manager.getRedoStackSize()).toBe(1);
      
      manager.clear();
      
      expect(manager.getUndoStackSize()).toBe(0);
      expect(manager.getRedoStackSize()).toBe(0);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('should handle undo-redo-undo sequence', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      
      manager.undo(); // UPDATE_TASK
      manager.redo(); // UPDATE_TASK
      manager.undo(); // UPDATE_TASK
      
      expect(manager.getUndoStackSize()).toBe(1);
      expect(manager.getRedoStackSize()).toBe(1);
      
      const redoStack = manager.getRedoStack();
      expect(redoStack[0].action).toBe('UPDATE_TASK');
    });

    it('should handle mixed operations', () => {
      manager.pushState('CREATE_TASK', { taskId: 'task-1' });
      manager.pushState('CREATE_ASSOCIATION', { assocId: 'assoc-1' });
      manager.undo();
      manager.pushState('UPDATE_TASK', { taskId: 'task-1' });
      
      expect(manager.getUndoStackSize()).toBe(2);
      expect(manager.getRedoStackSize()).toBe(0);
      
      const undoStack = manager.getUndoStack();
      expect(undoStack[0].action).toBe('CREATE_TASK');
      expect(undoStack[1].action).toBe('UPDATE_TASK');
    });

    it('should preserve data integrity through undo/redo cycles', () => {
      const testData = {
        taskId: 'task-1',
        name: 'Test Task',
        classification: '01',
        nested: {
          value: 42,
          array: [1, 2, 3]
        }
      };
      
      manager.pushState('CREATE_TASK', testData);
      manager.undo();
      const redone = manager.redo();
      
      expect(redone?.data).toEqual(testData);
      expect(redone?.data.nested.array).toEqual([1, 2, 3]);
    });
  });
});
