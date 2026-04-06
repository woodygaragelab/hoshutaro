/**
 * UndoRedoManager
 * 
 * 操作履歴を管理し、元に戻す/やり直し機能を提供します。
 * 最大50回の操作履歴を保持し、スタックベースで管理します。
 */

import { HistoryAction, HistoryState } from '../types/maintenanceTask';

/**
 * UndoRedoManager
 * 
 * 履歴スタックを管理し、元に戻す/やり直し操作を提供します。
 */
export class UndoRedoManager {
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private readonly maxStackSize: number = 50;
  private listeners: (() => void)[] = [];
  private muted: boolean = false;

  /**
   * 履歴の記録を一時停止する
   */
  mute(): void {
    this.muted = true;
  }

  /**
   * 履歴の記録を再開する
   */
  unmute(): void {
    this.muted = false;
  }

  /**
   * 状態変更リスナーを登録
   */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * リスナーへ通知
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * 新しい状態を履歴スタックに追加
   * 
   * @param action - 操作タイプ
   * @param data - 操作に関連するデータ
   */
  pushState(action: HistoryAction, data: any): void {
    if (this.muted) return;
    
    const state: HistoryState = {
      timestamp: new Date(),
      action,
      data
    };

    // 新しい操作を追加するとredoスタックはクリアされる
    this.redoStack = [];

    // undoスタックに追加
    this.undoStack.push(state);

    // スタックサイズの制限を適用
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift(); // 最も古い状態を削除
    }
    
    this.notify();
  }

  /**
   * 最後の操作を元に戻す
   * 
   * @returns 元に戻された状態、または元に戻せない場合はnull
   */
  undo(): HistoryState | null {
    if (!this.canUndo()) {
      return null;
    }

    const state = this.undoStack.pop()!;
    this.redoStack.push(state);

    this.notify();
    return state;
  }

  /**
   * 元に戻した操作をやり直す
   * 
   * @returns やり直された状態、またはやり直せない場合はnull
   */
  redo(): HistoryState | null {
    if (!this.canRedo()) {
      return null;
    }

    const state = this.redoStack.pop()!;
    this.undoStack.push(state);

    this.notify();
    return state;
  }

  /**
   * 元に戻す操作が可能かどうかを確認
   * 
   * @returns 元に戻せる場合はtrue
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * やり直し操作が可能かどうかを確認
   * 
   * @returns やり直せる場合はtrue
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * undoスタックのサイズを取得
   * 
   * @returns undoスタックの要素数
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * redoスタックのサイズを取得
   * 
   * @returns redoスタックの要素数
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * すべての履歴をクリア
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  /**
   * undoスタックの内容を取得（デバッグ用）
   * 
   * @returns undoスタックのコピー
   */
  getUndoStack(): HistoryState[] {
    return [...this.undoStack];
  }

  /**
   * redoスタックの内容を取得（デバッグ用）
   * 
   * @returns redoスタックのコピー
   */
  getRedoStack(): HistoryState[] {
    return [...this.redoStack];
  }
}
