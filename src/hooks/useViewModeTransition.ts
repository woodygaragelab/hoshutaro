/**
 * useViewModeTransition - 表示モード遷移ロジックを管理するカスタムフック
 * 
 * 要件:
 * - 6.1: 表示モードの切り替え
 * - 6.2: フィルターと選択状態の保持
 * - 6.3: 50,000機器で1000ms以内に遷移完了
 * - 6.5: モードに基づいてUI要素を更新
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ViewMode,
  ViewModeState,
  AssetBasedRow,
  WorkOrderBasedRow,
  WorkOrder,
  Asset,
  WorkOrderLine,
  HierarchyDefinition,
} from '../types/maintenanceTask';
import { ViewModeManager } from '../services/ViewModeManager';

interface UseViewModeTransitionProps {
  workOrders: WorkOrder[];
  assets: Asset[];
  associations: WorkOrderLine[];
  hierarchy: HierarchyDefinition;
  onModeChange?: (mode: ViewMode) => void;
  onTransitionStart?: () => void;
  onTransitionComplete?: (duration: number) => void;
}

interface UseViewModeTransitionReturn {
  currentMode: ViewMode;
  currentState: ViewModeState;
  equipmentData: AssetBasedRow[];
  taskData: WorkOrderBasedRow[];
  isTransitioning: boolean;
  transitionDuration: number;
  switchMode: (newMode: ViewMode, preserveState?: boolean) => void;
  applyFilters: (filters: ViewModeState['filters']) => void;
  updateData: (
    workOrders: WorkOrder[],
    assets: Asset[],
    associations: WorkOrderLine[],
    hierarchy: HierarchyDefinition
  ) => void;
}

/**
 * 表示モード遷移を管理するカスタムフック
 * 
 * パフォーマンス最適化:
 * - useMemoでデータ変換結果をキャッシュ
 * - 遷移時間を測定してパフォーマンスを監視
 * - 大規模データセット（50,000機器）で1000ms以内の遷移を保証
 */
export function useViewModeTransition({
  workOrders,
  assets,
  associations,
  hierarchy,
  onModeChange,
  onTransitionStart,
  onTransitionComplete,
}: UseViewModeTransitionProps): UseViewModeTransitionReturn {
  // ViewModeManagerのインスタンスを作成（データが変更されたときのみ再作成）
  const viewModeManager = useMemo(
    () => new ViewModeManager(assets, associations, hierarchy, workOrders),
    [workOrders, assets, associations, hierarchy]
  );

  // 現在の状態
  const [currentState, setCurrentState] = useState<ViewModeState>(
    viewModeManager.getCurrentState()
  );

  // 遷移中フラグ
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 遷移時間
  const [transitionDuration, setTransitionDuration] = useState(0);

  // 遷移開始時刻を記録
  const transitionStartTime = useRef<number>(0);

  // 現在のモード
  const currentMode = currentState.mode;

  /**
   * 機器ベースデータを取得（メモ化）
   * 要件 4.1, 4.2
   */
  const equipmentData = useMemo(() => {
    if (currentMode !== 'asset-based') {
      return [];
    }

    const startTime = performance.now();
    const data = viewModeManager.getAssetBasedData();
    const duration = performance.now() - startTime;

    // パフォーマンス警告（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && duration > 200) {
          }

    return data;
  }, [viewModeManager, currentMode, currentState.filters, workOrders, assets, associations, hierarchy]);

  /**
   * 作業ベースデータを取得（メモ化）
   * 要件 5.1, 5.2
   */
  const taskData = useMemo(() => {
    if (currentMode !== 'workorder-based') {
      return [];
    }

    const startTime = performance.now();
    const data = viewModeManager.getWorkOrderBasedData();
    const duration = performance.now() - startTime;

    // パフォーマンス警告（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && duration > 200) {
          }

    return data;
  }, [viewModeManager, currentMode, currentState.filters, workOrders, assets, associations, hierarchy]);

  /**
   * 表示モードを切り替え
   * 要件 6.1, 6.2, 6.3
   */
  const switchMode = useCallback(
    (newMode: ViewMode, preserveState: boolean = true) => {
      // 同じモードの場合は何もしない
      if (newMode === currentMode) {
        return;
      }

      // 遷移開始
      setIsTransitioning(true);
      transitionStartTime.current = performance.now();

      if (onTransitionStart) {
        onTransitionStart();
      }

      // モード切り替え
      viewModeManager.switchMode(newMode, preserveState);

      // 選択状態の保持
      if (preserveState) {
        viewModeManager.preserveSelection();
      }

      // 状態を更新
      const newState = viewModeManager.getCurrentState();
      setCurrentState(newState);

      // モード変更コールバック
      if (onModeChange) {
        onModeChange(newMode);
      }

      // 遷移完了（次のレンダリングサイクルで）
      requestAnimationFrame(() => {
        const duration = performance.now() - transitionStartTime.current;
        setTransitionDuration(duration);
        setIsTransitioning(false);

        if (onTransitionComplete) {
          onTransitionComplete(duration);
        }

        // パフォーマンス警告（要件 6.3: 1000ms以内）
        if (duration > 1000) {
                  } else if (process.env.NODE_ENV === 'development') {
                  }
      });
    },
    [currentMode, viewModeManager, onModeChange, onTransitionStart, onTransitionComplete]
  );

  /**
   * フィルターを適用
   * 要件 6.2
   */
  const applyFilters = useCallback(
    (filters: ViewModeState['filters']) => {
      viewModeManager.applyFilters(filters);
      const newState = viewModeManager.getCurrentState();
      setCurrentState(newState);
    },
    [viewModeManager]
  );

  /**
   * データを更新
   */
  const updateData = useCallback(
    (
      newWorkOrders: WorkOrder[],
      newAssets: Asset[],
      newAssociations: WorkOrderLine[],
      newHierarchy: HierarchyDefinition
    ) => {
      // Create a fresh manager with exactly matching arguments
      // Note: Data is not explicitly copied here since ViewModeManager handles its own references internally 
      const newManager = new ViewModeManager(newAssets, newAssociations, newHierarchy, newWorkOrders);
      viewModeManager.updateData(newAssets, newAssociations, newHierarchy, newWorkOrders);
      const newState = viewModeManager.getCurrentState();
      setCurrentState(newState);
    },
    [viewModeManager]
  );

  // データが変更されたときに状態を同期
  useEffect(() => {
    const newState = viewModeManager.getCurrentState();
    setCurrentState(newState);
  }, [viewModeManager]);

  return {
    currentMode,
    currentState,
    equipmentData,
    taskData,
    isTransitioning,
    transitionDuration,
    switchMode,
    applyFilters,
    updateData,
  };
}

export default useViewModeTransition;
