/**
 * TaskManager Unit Tests
 * 
 * Tests for core CRUD operations and validation logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskManager } from '../TaskManager';
import { Task } from '../../types/maintenanceTask';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('createTask', () => {
    it('should create a task with all required fields', () => {
      const taskData = {
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        defaultSchedulePattern: {
          frequency: 'yearly' as const,
          interval: 1,
        },
      };

      const task = taskManager.createTask(taskData);

      expect(task.id).toBeDefined();
      expect(task.name).toBe('年次点検');
      expect(task.description).toBe('年次定期点検作業');
      expect(task.classification).toBe('01');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.defaultSchedulePattern).toEqual(taskData.defaultSchedulePattern);
    });

    it('should generate unique IDs for multiple tasks', () => {
      const task1 = taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      const task2 = taskManager.createTask({
        name: 'Task 2',
        description: 'Description 2',
        classification: '02',
      });

      expect(task1.id).not.toBe(task2.id);
    });

    it('should throw error for invalid classification (out of range)', () => {
      expect(() => {
        taskManager.createTask({
          name: 'Test Task',
          description: 'Test Description',
          classification: '21', // Invalid: > 20
        });
      }).toThrow('無効な作業分類です');
    });

    it('should throw error for invalid classification (wrong format)', () => {
      expect(() => {
        taskManager.createTask({
          name: 'Test Task',
          description: 'Test Description',
          classification: '1', // Invalid: not 2 digits
        });
      }).toThrow('作業分類は2桁の形式で指定してください');
    });

    it('should throw error for empty name', () => {
      expect(() => {
        taskManager.createTask({
          name: '',
          description: 'Test Description',
          classification: '01',
        });
      }).toThrow('作業名は必須です');
    });

    it('should throw error for empty description', () => {
      expect(() => {
        taskManager.createTask({
          name: 'Test Task',
          description: '',
          classification: '01',
        });
      }).toThrow('作業説明は必須です');
    });

    it('should trim whitespace from name and description', () => {
      const task = taskManager.createTask({
        name: '  年次点検  ',
        description: '  年次定期点検作業  ',
        classification: '01',
      });

      expect(task.name).toBe('年次点検');
      expect(task.description).toBe('年次定期点検作業');
    });
  });

  describe('updateTask', () => {
    it('should update task properties', () => {
      const task = taskManager.createTask({
        name: 'Original Name',
        description: 'Original Description',
        classification: '01',
      });

      const updatedTask = taskManager.updateTask(task.id, {
        name: 'Updated Name',
        description: 'Updated Description',
      });

      expect(updatedTask.name).toBe('Updated Name');
      expect(updatedTask.description).toBe('Updated Description');
      expect(updatedTask.classification).toBe('01'); // Unchanged
      expect(updatedTask.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should not allow ID to be changed', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      const originalId = task.id;
      const updatedTask = taskManager.updateTask(task.id, {
        name: 'Updated Name',
      });

      expect(updatedTask.id).toBe(originalId);
    });

    it('should throw error when updating non-existent task', () => {
      expect(() => {
        taskManager.updateTask('non-existent-id', {
          name: 'Updated Name',
        });
      }).toThrow('作業が見つかりません');
    });

    it('should validate classification when updating', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      expect(() => {
        taskManager.updateTask(task.id, {
          classification: '25', // Invalid
        });
      }).toThrow('無効な作業分類です');
    });
  });

  describe('deleteTask', () => {
    it('should delete an existing task', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      taskManager.deleteTask(task.id);

      expect(taskManager.getTask(task.id)).toBeNull();
    });

    it('should throw error when deleting non-existent task', () => {
      expect(() => {
        taskManager.deleteTask('non-existent-id');
      }).toThrow('作業が見つかりません');
    });
  });

  describe('getTask', () => {
    it('should return task by ID', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      const retrieved = taskManager.getTask(task.id);

      expect(retrieved).toEqual(task);
    });

    it('should return null for non-existent task', () => {
      const retrieved = taskManager.getTask('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', () => {
      const task1 = taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      const task2 = taskManager.createTask({
        name: 'Task 2',
        description: 'Description 2',
        classification: '02',
      });

      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toHaveLength(2);
      expect(allTasks).toContainEqual(task1);
      expect(allTasks).toContainEqual(task2);
    });

    it('should return empty array when no tasks exist', () => {
      const allTasks = taskManager.getAllTasks();

      expect(allTasks).toEqual([]);
    });
  });

  describe('getTasksByClassification', () => {
    it('should filter tasks by classification', () => {
      taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      taskManager.createTask({
        name: 'Task 2',
        description: 'Description 2',
        classification: '02',
      });

      taskManager.createTask({
        name: 'Task 3',
        description: 'Description 3',
        classification: '01',
      });

      const classification01Tasks = taskManager.getTasksByClassification('01');

      expect(classification01Tasks).toHaveLength(2);
      expect(classification01Tasks.every(t => t.classification === '01')).toBe(true);
    });

    it('should return empty array when no tasks match classification', () => {
      taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      const classification02Tasks = taskManager.getTasksByClassification('02');

      expect(classification02Tasks).toEqual([]);
    });

    it('should throw error for invalid classification', () => {
      expect(() => {
        taskManager.getTasksByClassification('25');
      }).toThrow('無効な作業分類です');
    });
  });

  describe('initialization with existing tasks', () => {
    it('should initialize with existing tasks', () => {
      const existingTasks: Task[] = [
        {
          id: 'task-001',
          name: 'Existing Task',
          description: 'Existing Description',
          classification: '01',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const manager = new TaskManager(existingTasks);

      expect(manager.getTask('task-001')).toEqual(existingTasks[0]);
      expect(manager.getTaskCount()).toBe(1);
    });

    it('should continue ID counter from existing tasks', () => {
      const existingTasks: Task[] = [
        {
          id: 'task-005',
          name: 'Existing Task',
          description: 'Existing Description',
          classification: '01',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const manager = new TaskManager(existingTasks);
      const newTask = manager.createTask({
        name: 'New Task',
        description: 'New Description',
        classification: '02',
      });

      expect(newTask.id).toBe('task-006');
    });
  });

  describe('utility methods', () => {
    it('hasTask should return true for existing task', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      expect(taskManager.hasTask(task.id)).toBe(true);
    });

    it('hasTask should return false for non-existent task', () => {
      expect(taskManager.hasTask('non-existent-id')).toBe(false);
    });

    it('getTaskCount should return correct count', () => {
      expect(taskManager.getTaskCount()).toBe(0);

      taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      expect(taskManager.getTaskCount()).toBe(1);

      taskManager.createTask({
        name: 'Task 2',
        description: 'Description 2',
        classification: '02',
      });

      expect(taskManager.getTaskCount()).toBe(2);
    });

    it('clear should remove all tasks', () => {
      taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      taskManager.clear();

      expect(taskManager.getTaskCount()).toBe(0);
      expect(taskManager.getAllTasks()).toEqual([]);
    });
  });
});
