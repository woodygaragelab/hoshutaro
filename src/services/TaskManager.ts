/**
 * TaskManager - 保守作業（Task）のライフサイクルを管理
 *
 * v3.0.0: Taskは「機器部位＋作業名」のみ管理。
 * classification / defaultSchedulePattern はWorkOrder側に移行済み。
 *
 * Requirements: Task CRUD
 */

import { Task } from '../types/maintenanceTask';
import { UndoRedoManager } from './UndoRedoManager';

export class TaskManager {
  private tasks: Map<string, Task>;
  private taskIdCounter: number;
  private undoRedoManager?: UndoRedoManager;

  constructor(initialTasks?: Task[], undoRedoManager?: UndoRedoManager) {
    this.tasks = new Map();
    this.taskIdCounter = 1;
    this.undoRedoManager = undoRedoManager;

    if (initialTasks && initialTasks.length > 0) {
      initialTasks.forEach(task => {
        this.tasks.set(task.id, task);
        const idNum = this.extractIdNumber(task.id);
        if (idNum >= this.taskIdCounter) {
          this.taskIdCounter = idNum + 1;
        }
      });
    }
  }

  /**
   * Set the UndoRedoManager instance
   */
  setUndoRedoManager(undoRedoManager: UndoRedoManager): void {
    this.undoRedoManager = undoRedoManager;
  }

  /**
   * IDから数値部分を抽出
   */
  private extractIdNumber(id: string): number {
    const match = id.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * 一意のタスクIDを生成
   */
  private generateTaskId(): string {
    const id = `task-${String(this.taskIdCounter).padStart(3, '0')}`;
    this.taskIdCounter++;
    return id;
  }

  /**
   * 必須フィールドのバリデーション
   */
  private validateTaskData(data: {
    name: string;
    description: string;
  }): void {
    if (!data.name || data.name.trim() === '') {
      throw new Error('作業名は必須です。');
    }
    if (!data.description || data.description.trim() === '') {
      throw new Error('作業説明は必須です。');
    }
  }

  /**
   * 新しい作業を作成
   */
  createTask(
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Task {
    this.validateTaskData(taskData);

    const now = new Date();
    const id = taskData.id || this.generateTaskId();

    if (taskData.id) {
      const idNum = this.extractIdNumber(taskData.id);
      if (idNum >= this.taskIdCounter) {
        this.taskIdCounter = idNum + 1;
      }
    }

    const task: Task = {
      id,
      name: taskData.name.trim(),
      description: taskData.description.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);

    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('CREATE_TASK', {
        task: { ...task },
      });
    }

    return task;
  }

  /**
   * 作業を更新
   */
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task {
    const existingTask = this.tasks.get(id);
    if (!existingTask) {
      throw new Error(`作業が見つかりません: ${id}`);
    }

    if (updates.name !== undefined || updates.description !== undefined) {
      const dataToValidate = {
        name: updates.name ?? existingTask.name,
        description: updates.description ?? existingTask.description,
      };
      this.validateTaskData(dataToValidate);
    }

    const updatedTask: Task = {
      ...existingTask,
      ...updates,
      id: existingTask.id,
      createdAt: existingTask.createdAt,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updatedTask);

    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_TASK', {
        previousTask: { ...existingTask },
        updatedTask: { ...updatedTask },
      });
    }

    return updatedTask;
  }

  /**
   * 作業を削除
   * 注: 関連WorkOrderLineの削除はWorkOrderLineManagerが担当
   */
  deleteTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`作業が見つかりません: ${id}`);
    }

    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('DELETE_TASK', {
        task: { ...task },
      });
    }

    this.tasks.delete(id);
  }

  /**
   * 作業を取得
   */
  getTask(id: string): Task | null {
    return this.tasks.get(id) || null;
  }

  /**
   * すべての作業を取得
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 作業が存在するかチェック
   */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * すべての作業をクリア（テスト用）
   */
  clear(): void {
    this.tasks.clear();
    this.taskIdCounter = 1;
  }

  /**
   * 作業数を取得
   */
  getTaskCount(): number {
    return this.tasks.size;
  }
}

export default TaskManager;
