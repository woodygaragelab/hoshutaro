/**
 * TaskManager Property-Based Tests
 * 
 * **Feature: maintenance-task-management**
 * 
 * These tests use fast-check to verify universal properties that should hold
 * across all valid inputs for the TaskManager.
 * 
 * Requirements: 1.1, 1.6
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { TaskManager } from '../TaskManager';
import { Task } from '../../types/maintenanceTask';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid task classification codes (01-20)
 */
const classificationGenerator = fc.integer({ min: 1, max: 20 }).map(n => 
  n.toString().padStart(2, '0')
);

/**
 * Generator for valid task names (non-empty strings)
 */
const taskNameGenerator = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/**
 * Generator for valid task descriptions (non-empty strings)
 */
const taskDescriptionGenerator = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Generator for schedule frequency
 */
const scheduleFrequencyGenerator = fc.constantFrom('yearly', 'monthly', 'quarterly', 'custom') as fc.Arbitrary<'yearly' | 'monthly' | 'quarterly' | 'custom'>;

/**
 * Generator for default schedule pattern
 */
const schedulePatternGenerator = fc.record({
  frequency: scheduleFrequencyGenerator,
  interval: fc.option(fc.integer({ min: 1, max: 365 }), { nil: undefined }),
});

/**
 * Generator for valid task data (without id, createdAt, updatedAt)
 */
const taskDataGenerator = fc.record({
  name: taskNameGenerator,
  description: taskDescriptionGenerator,
  classification: classificationGenerator,
  defaultSchedulePattern: fc.option(schedulePatternGenerator, { nil: undefined }),
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('TaskManager Property-Based Tests', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  /**
   * **Feature: maintenance-task-management, Property 1: 作業作成の完全性**
   * 
   * For any valid task data, after creating a task, all required fields
   * (unique key, name, description, classification) should be correctly saved.
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: 作業作成の完全性', () => {
    it('should create tasks with all required fields correctly saved', () => {
      fc.assert(
        fc.property(taskDataGenerator, (taskData) => {
          const createdTask = taskManager.createTask(taskData);
          
          // Verify all required fields are present and correct
          expect(createdTask.id).toBeDefined();
          expect(typeof createdTask.id).toBe('string');
          expect(createdTask.id.length).toBeGreaterThan(0);
          
          expect(createdTask.name).toBe(taskData.name.trim());
          expect(createdTask.description).toBe(taskData.description.trim());
          expect(createdTask.classification).toBe(taskData.classification);
          
          expect(createdTask.createdAt).toBeInstanceOf(Date);
          expect(createdTask.updatedAt).toBeInstanceOf(Date);
          
          // Verify default schedule pattern if provided
          if (taskData.defaultSchedulePattern) {
            expect(createdTask.defaultSchedulePattern).toEqual(taskData.defaultSchedulePattern);
          }
          
          // Verify the task can be retrieved
          const retrievedTask = taskManager.getTask(createdTask.id);
          expect(retrievedTask).toEqual(createdTask);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 2: 作業キーの一意性**
   * 
   * For any set of tasks, all task IDs should be unique.
   * 
   * **Validates: Requirements 1.6**
   */
  describe('Property 2: 作業キーの一意性', () => {
    it('should generate unique IDs for all created tasks', () => {
      fc.assert(
        fc.property(
          fc.array(taskDataGenerator, { minLength: 2, maxLength: 50 }),
          (tasksData) => {
            const manager = new TaskManager();
            const createdTasks = tasksData.map(data => manager.createTask(data));
            
            // Extract all IDs
            const ids = createdTasks.map(t => t.id);
            
            // Verify all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
            
            // Verify each ID is a non-empty string
            ids.forEach(id => {
              expect(typeof id).toBe('string');
              expect(id.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain ID uniqueness across multiple operations', () => {
      fc.assert(
        fc.property(
          fc.array(taskDataGenerator, { minLength: 5, maxLength: 20 }),
          (tasksData) => {
            const manager = new TaskManager();
            const allIds = new Set<string>();
            
            // Create tasks in batches
            for (let i = 0; i < tasksData.length; i++) {
              const task = manager.createTask(tasksData[i]);
              
              // Verify this ID hasn't been used before
              expect(allIds.has(task.id)).toBe(false);
              allIds.add(task.id);
              
              // Delete some tasks randomly to test ID generation continues correctly
              if (i > 0 && i % 3 === 0) {
                const tasksToDelete = manager.getAllTasks().slice(0, Math.floor(manager.getTaskCount() / 2));
                tasksToDelete.forEach(t => manager.deleteTask(t.id));
              }
            }
            
            // Final verification: all remaining tasks have unique IDs
            const remainingTasks = manager.getAllTasks();
            const remainingIds = remainingTasks.map(t => t.id);
            const uniqueRemainingIds = new Set(remainingIds);
            expect(uniqueRemainingIds.size).toBe(remainingIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Task data integrity after creation
   * 
   * Verifies that created tasks maintain data integrity and can be retrieved correctly.
   */
  describe('Additional Property: Task data integrity', () => {
    it('should maintain data integrity for all created tasks', () => {
      fc.assert(
        fc.property(
          fc.array(taskDataGenerator, { minLength: 1, maxLength: 30 }),
          (tasksData) => {
            const manager = new TaskManager();
            const createdTasks = tasksData.map(data => manager.createTask(data));
            
            // Verify all tasks can be retrieved and match original data
            createdTasks.forEach((createdTask, index) => {
              const retrievedTask = manager.getTask(createdTask.id);
              
              expect(retrievedTask).not.toBeNull();
              expect(retrievedTask).toEqual(createdTask);
              
              // Verify data matches original input (with trimming)
              expect(retrievedTask!.name).toBe(tasksData[index].name.trim());
              expect(retrievedTask!.description).toBe(tasksData[index].description.trim());
              expect(retrievedTask!.classification).toBe(tasksData[index].classification);
            });
            
            // Verify getAllTasks returns all created tasks
            const allTasks = manager.getAllTasks();
            expect(allTasks.length).toBe(createdTasks.length);
            
            createdTasks.forEach(createdTask => {
              expect(allTasks).toContainEqual(createdTask);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Classification filtering correctness
   * 
   * Verifies that filtering by classification returns only tasks with that classification.
   */
  describe('Additional Property: Classification filtering', () => {
    it('should correctly filter tasks by classification', () => {
      fc.assert(
        fc.property(
          fc.array(taskDataGenerator, { minLength: 5, maxLength: 30 }),
          classificationGenerator,
          (tasksData, targetClassification) => {
            const manager = new TaskManager();
            tasksData.forEach(data => manager.createTask(data));
            
            const filteredTasks = manager.getTasksByClassification(targetClassification);
            
            // All returned tasks should have the target classification
            filteredTasks.forEach(task => {
              expect(task.classification).toBe(targetClassification);
            });
            
            // All tasks with target classification should be in the result
            const allTasks = manager.getAllTasks();
            const expectedTasks = allTasks.filter(t => t.classification === targetClassification);
            
            expect(filteredTasks.length).toBe(expectedTasks.length);
            expectedTasks.forEach(expectedTask => {
              expect(filteredTasks).toContainEqual(expectedTask);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
