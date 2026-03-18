/**
 * ViewModeManager - 表示モードの切り替えとデータ変換を管理
 *
 * v3.0.0: TaskAssociation/AssociationSchedule → WorkOrderLine/WorkOrderSchedule に移行
 *
 * 要件:
 * - 4.1: 機器ベース表示モード
 * - 4.2: 機器ベースモードでの複数作業表示
 * - 5.1: 作業ベース表示モード
 * - 5.2: 作業ベースモードでの階層構造表示
 * - 6.1: 表示モードの切り替え
 * - 6.2: フィルターと選択状態の保持
 * - 6.4: 時間スケール集約
 * - 6.5: 表示モード切り替え時のUI更新
 */

import {
  ViewMode,
  ViewModeState,
  EquipmentBasedRow,
  TaskBasedRow,
  AggregatedStatus,
  WorkOrderSchedule,
  Task,
  Asset,
  WorkOrderLine,
  WorkOrder,
  HierarchyDefinition,
  HierarchyPath,
  TimeScale,
  EditContext,
} from '../types/maintenanceTask';
import { TaskManager } from './TaskManager';
import { AssetManager } from './AssetManager';
import { WorkOrderLineManager } from './WorkOrderLineManager';
import { WorkOrderManager } from './WorkOrderManager';
import { memoizeDeep, createMemoizedSelector, MemoizationBatch } from '../utils/memoization';
import { getISOWeek, generateTimeRange, getTimeKey, parseTimeKey } from '../utils/dateUtils';

interface HierarchyNode {
  key: string;
  value: string;
  level: number;
  children: HierarchyNode[];
  assets: Asset[];
}

interface HierarchyTree {
  roots: HierarchyNode[];
}

export class ViewModeManager {
  private currentState: ViewModeState;
  private tasks: Map<string, Task>;
  private assets: Map<string, Asset>;
  private workOrderLines: Map<string, WorkOrderLine>;
  private workOrders: Map<string, WorkOrder>;
  private hierarchy: HierarchyDefinition;
  private memoizationBatch: MemoizationBatch;

  // Memoized methods
  private memoizedBuildHierarchyTree: () => HierarchyTree;
  private memoizedAggregateSchedule: (schedule: WorkOrderSchedule, timeScale: TimeScale) => { [timeKey: string]: AggregatedStatus };

  constructor(
    tasks: Task[],
    assets: Asset[],
    workOrderLines: WorkOrderLine[],
    hierarchy: HierarchyDefinition,
    workOrders?: WorkOrder[]
  ) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.assets = new Map(assets.map(a => [a.id, a]));
    this.workOrderLines = new Map(workOrderLines.map(l => [l.id, l]));
    this.workOrders = new Map((workOrders || []).map(wo => [wo.id, wo]));
    this.hierarchy = hierarchy;

    // 初期状態: 機器ベースモード
    this.currentState = {
      mode: 'equipment-based',
      filters: {},
    };

    // Initialize memoization batch
    this.memoizationBatch = new MemoizationBatch();

    // Create memoized versions of expensive operations
    this.memoizedBuildHierarchyTree = (() => {
      let cache: HierarchyTree | null = null;
      return () => {
        if (!cache) {
          cache = this.buildHierarchyTreeInternal();
        }
        return cache;
      };
    })();

    this.memoizedAggregateSchedule = memoizeDeep(
      (schedule: WorkOrderSchedule, timeScale: TimeScale) =>
        this.aggregateScheduleByTimeScaleInternal(schedule, timeScale),
      100
    );
  }

  /**
   * 現在の表示モードを取得
   * 要件 6.1
   */
  getCurrentMode(): ViewMode {
    return this.currentState.mode;
  }

  /**
   * 表示モードを切り替え
   * 要件 6.1, 6.2
   */
  switchMode(newMode: ViewMode, preserveState: boolean = true): void {
    if (preserveState) {
      this.currentState = {
        ...this.currentState,
        mode: newMode,
      };
    } else {
      this.currentState = {
        mode: newMode,
        filters: {},
      };
    }
  }

  /**
   * フィルターを適用
   * 要件 6.2
   */
  applyFilters(filters: ViewModeState['filters']): void {
    this.currentState.filters = {
      ...this.currentState.filters,
      ...filters,
    };
  }

  /**
   * 選択状態を保持
   * 要件 6.2
   */
  preserveSelection(): void {
    if (this.currentState.selection) {
      const { rowId, columnId } = this.currentState.selection;
      let assetId: string | undefined;

      if (this.currentState.mode === 'equipment-based') {
        if (rowId.startsWith('asset_') && rowId.includes('_task_')) {
          const match = rowId.match(/^asset_([^_]+)_task_/);
          if (match) {
            assetId = match[1];
          }
        } else {
          assetId = rowId;
        }

        if (assetId && this.assets.has(assetId)) {
          this.currentState.selection = { rowId: assetId, columnId };
        } else {
          this.currentState.selection = undefined;
        }
      } else {
        assetId = rowId;

        if (assetId && this.assets.has(assetId)) {
          const relatedLines = Array.from(this.workOrderLines.values())
            .filter(line => line.assetId === assetId);

          if (relatedLines.length > 0) {
            const firstLine = relatedLines[0];
            this.currentState.selection = {
              rowId: `asset_${assetId}_task_${firstLine.taskId}`,
              columnId,
            };
          } else {
            this.currentState.selection = undefined;
          }
        } else {
          this.currentState.selection = undefined;
        }
      }
    }
  }

  /**
   * 機器ベースデータを取得
   * 要件 4.1, 4.2
   *
   * グループ行: 製油所 > エリア > ユニット (フラットパス)
   * データ行: 機器名のみ（TAG No.は別列）
   */
  getEquipmentBasedData(): EquipmentBasedRow[] {
    const rows: EquipmentBasedRow[] = [];
    const hierarchyTree = this.buildHierarchyTree();

    const traverseHierarchy = (node: HierarchyNode, parentPath: string[] = [], depth: number = 0) => {
      const currentPath = [...parentPath, node.value];

      // 子ノードを先に再帰
      node.children.forEach(child => {
        traverseHierarchy(child, currentPath, depth + 1);
      });

      // このノードにアセットがある場合、グループ行+アセットデータ行を出力
      if (node.assets.length > 0) {
        // グループ行: フラットパス（例: 第一製油所 > Aエリア > 原油蒸留ユニット）
        const groupPath = currentPath.join(' > ');
        rows.push({
          type: 'hierarchy',
          level: depth,
          hierarchyKey: node.key,
          hierarchyValue: groupPath,
        });

        // データ行: 各アセット（機器名のみ）
        node.assets.forEach(asset => {
          const relatedLines = Array.from(this.workOrderLines.values())
            .filter(line => line.assetId === asset.id);

          const tasks = relatedLines.map(line => {
            const task = this.tasks.get(line.taskId);
            const wo = this.workOrders.get(line.workOrderId);
            return {
              taskId: line.taskId,
              taskName: task?.name || '',
              classification: wo?.taskClassificationId || '',
              schedule: line.schedule,
            };
          });

          rows.push({
            type: 'asset',
            assetId: asset.id,
            assetName: asset.name,
            hierarchyPath: asset.hierarchyPath,
            specifications: asset.specifications,
            tasks,
            level: depth + 1,
          });
        });
      }
    };

    hierarchyTree.roots.forEach(root => {
      traverseHierarchy(root, [], 0);
    });

    return this.applyFiltersToEquipmentData(rows);
  }

  /**
   * 作業ベースデータを取得
   * 要件 5.1, 5.2
   */
  getTaskBasedData(timeScale: TimeScale = 'year'): TaskBasedRow[] {
    console.log('[ViewModeManager] getTaskBasedData called');
    console.log('[ViewModeManager] Data counts:', {
      assets: this.assets.size,
      tasks: this.tasks.size,
      workOrderLines: this.workOrderLines.size,
      hierarchyLevels: this.hierarchy.levels.length,
    });

    const rows: TaskBasedRow[] = [];
    const hierarchyTree = this.buildHierarchyTree();

    console.log('[ViewModeManager] Hierarchy tree built:', {
      rootCount: hierarchyTree.roots.length,
      roots: hierarchyTree.roots.map(r => `${r.key}=${r.value} (${r.assets.length} assets)`),
    });

    const traverseHierarchy = (node: HierarchyNode, parentPath: string[] = [], depth: number = 0) => {
      const currentPath = [...parentPath, node.value];

      // 子ノードを先に再帰
      node.children.forEach(child => {
        traverseHierarchy(child, currentPath, depth + 1);
      });

      // このノードにアセットがある場合、アセットグループ行+WOLデータ行を出力
      node.assets.forEach(asset => {
        // グループ行: フラットパス（例: 第一製油所 > Aエリア > 原油蒸留ユニット > P-101（原油供給ポンプ））
        const fullPath = [...currentPath, `${asset.id}（${asset.name}）`].join(' > ');

        rows.push({
          id: `asset_${asset.id}`,
          type: 'asset',
          assetId: asset.id,
          assetName: fullPath,
          hierarchyPath: asset.hierarchyPath,
          level: 0,
        } as any);

        // データ行: WOL（作業名のみ）
        const relatedLines = Array.from(this.workOrderLines.values())
          .filter(line => line.assetId === asset.id);

        console.log(`[ViewModeManager] Asset ${asset.id} has ${relatedLines.length} work order lines`);

        relatedLines.forEach(line => {
          const task = this.tasks.get(line.taskId);
          if (task) {
            const aggregatedSchedule = this.aggregateScheduleByTimeScale(line.schedule, timeScale);
            const wo = this.workOrders.get(line.workOrderId);

            rows.push({
              id: `task_${task.id}_asset_${asset.id}`,
              type: 'workOrderLine',
              taskId: task.id,
              taskName: task.name,
              classification: wo?.taskClassificationId || '',
              assetId: asset.id,
              schedule: aggregatedSchedule,
              level: 1,
            } as any);
          } else {
            console.log(`[ViewModeManager] Task ${line.taskId} not found for WorkOrderLine ${line.id}`);
          }
        });
      });
    };

    hierarchyTree.roots.forEach(root => {
      traverseHierarchy(root, [], 0);
    });

    console.log(`[ViewModeManager] Generated ${rows.length} task-based rows before filtering`);

    const filteredRows = this.applyFiltersToTaskData(rows);

    console.log(`[ViewModeManager] Final task-based data: ${filteredRows.length} rows after filtering`);
    if (filteredRows.length > 0) {
      console.log('[ViewModeManager] Sample rows:', filteredRows.slice(0, 5));
      console.log('[ViewModeManager] Row types breakdown:', {
        hierarchy: filteredRows.filter(r => r.type === 'hierarchy').length,
        asset: filteredRows.filter(r => r.type === 'asset').length,
        task: filteredRows.filter(r => r.type === 'workOrderLine').length,
      });
    }

    return filteredRows;
  }

  /**
   * 時間スケールによる集約
   * 要件 6.4
   */
  aggregateScheduleByTimeScale(
    schedule: WorkOrderSchedule,
    timeScale: TimeScale
  ): { [timeKey: string]: AggregatedStatus } {
    return this.aggregateScheduleByTimeScaleInternal(schedule, timeScale);
  }

  /**
   * 時間スケールによる集約の内部実装
   *
   * IMPORTANT: Uses string-based key extraction for year/month/day scales
   * to avoid timezone pitfalls with new Date(dateKey) + getFullYear().
   */
  private aggregateScheduleByTimeScaleInternal(
    schedule: WorkOrderSchedule,
    timeScale: TimeScale
  ): { [timeKey: string]: AggregatedStatus } {
    const aggregated: { [timeKey: string]: AggregatedStatus } = {};

    Object.entries(schedule).forEach(([dateKey, status]) => {
      let aggregateKey: string | null = null;

      if (timeScale === 'year') {
        const yearMatch = dateKey.match(/^(\d{4})/);
        if (yearMatch) {
          aggregateKey = yearMatch[1];
        }
      } else if (timeScale === 'month') {
        const monthMatch = dateKey.match(/^(\d{4}-\d{2})/);
        if (monthMatch) {
          aggregateKey = monthMatch[1];
        } else {
          const yearMatch = dateKey.match(/^(\d{4})$/);
          if (yearMatch) {
            aggregateKey = `${yearMatch[1]}-01`;
          }
        }
      } else if (timeScale === 'day') {
        const dayMatch = dateKey.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dayMatch) {
          aggregateKey = dayMatch[1];
        } else {
          const monthMatch = dateKey.match(/^(\d{4}-\d{2})$/);
          if (monthMatch) {
            aggregateKey = `${monthMatch[1]}-01`;
          } else {
            const yearMatch = dateKey.match(/^(\d{4})$/);
            if (yearMatch) {
              aggregateKey = `${yearMatch[1]}-01-01`;
            }
          }
        }
      }

      // For week scale or unmatched formats, fall back to Date-based parsing
      if (!aggregateKey) {
        let date = new Date(dateKey);

        if (isNaN(date.getTime())) {
          let parsedDate: Date | null = null;

          if (/^\d{4}-W\d{1,2}$/.test(dateKey)) {
            parsedDate = parseTimeKey(dateKey, 'week');
          } else if (/^\d{4}-\d{2}$/.test(dateKey)) {
            parsedDate = parseTimeKey(dateKey, 'month');
          } else if (/^\d{4}$/.test(dateKey)) {
            parsedDate = parseTimeKey(dateKey, 'year');
          }

          if (parsedDate) {
            date = parsedDate;
          } else {
            return;
          }
        }

        aggregateKey = getTimeKey(date, timeScale);
      }

      if (!aggregated[aggregateKey]) {
        aggregated[aggregateKey] = {
          planned: false,
          actual: false,
          totalPlanCost: 0,
          totalActualCost: 0,
          count: 0,
        };
      }

      aggregated[aggregateKey].planned = aggregated[aggregateKey].planned || status.planned;
      aggregated[aggregateKey].actual = aggregated[aggregateKey].actual || status.actual;
      aggregated[aggregateKey].totalPlanCost += status.planCost;
      aggregated[aggregateKey].totalActualCost += status.actualCost;
      aggregated[aggregateKey].count += 1;
    });

    return aggregated;
  }

  /**
   * 表示記号を取得
   */
  getDisplaySymbol(status: AggregatedStatus): string {
    if (status.planned && status.actual) {
      return '◎';
    } else if (status.planned && !status.actual) {
      return '○';
    } else if (!status.planned && status.actual) {
      return '●';
    } else {
      return '';
    }
  }

  /**
   * WorkOrderLinesを取得（DataIndexManager用）
   */
  getWorkOrderLines(): WorkOrderLine[] {
    return Array.from(this.workOrderLines.values());
  }

  /**
   * 現在の状態を取得
   */
  getCurrentState(): ViewModeState {
    return { ...this.currentState };
  }

  /**
   * 現在の編集コンテキストを取得
   * Requirement 5.7
   */
  getEditContext(): EditContext {
    return {
      viewMode: this.currentState.mode,
      editScope: this.currentState.mode === 'task-based' ? 'all-assets' : 'single-asset',
    };
  }

  /**
   * データを更新
   */
  updateData(
    tasks: Task[],
    assets: Asset[],
    workOrderLines: WorkOrderLine[],
    hierarchy: HierarchyDefinition,
    workOrders?: WorkOrder[]
  ): void {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.assets = new Map(assets.map(a => [a.id, a]));
    this.workOrderLines = new Map(workOrderLines.map(l => [l.id, l]));
    if (workOrders) {
      this.workOrders = new Map(workOrders.map(wo => [wo.id, wo]));
    }
    this.hierarchy = hierarchy;

    // Clear memoization caches
    this.memoizationBatch.clearAll();

    this.memoizedBuildHierarchyTree = (() => {
      let cache: HierarchyTree | null = null;
      return () => {
        if (!cache) {
          cache = this.buildHierarchyTreeInternal();
        }
        return cache;
      };
    })();

    this.memoizedAggregateSchedule = memoizeDeep(
      (schedule: WorkOrderSchedule, timeScale: TimeScale) =>
        this.aggregateScheduleByTimeScaleInternal(schedule, timeScale),
      100
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * 階層ツリーを構築 (memoized wrapper)
   */
  private buildHierarchyTree(): HierarchyTree {
    return this.memoizedBuildHierarchyTree();
  }

  /**
   * 階層ツリーを構築 (internal implementation)
   */
  private buildHierarchyTreeInternal(): HierarchyTree {
    const roots: HierarchyNode[] = [];
    const nodeMap = new Map<string, HierarchyNode>();

    const sortedLevels = [...this.hierarchy.levels].sort((a, b) => a.order - b.order);

    console.log('[ViewModeManager] Building hierarchy tree with levels:', sortedLevels.map(l => `${l.key}(${l.order})`));

    if (sortedLevels.length === 0) {
      console.log('[ViewModeManager] No hierarchy levels defined, returning empty tree');
      return { roots };
    }

    let processedAssets = 0;
    let skippedAssets = 0;

    Array.from(this.assets.values()).forEach(asset => {
      let parentKey = '';
      let assetProcessed = true;

      sortedLevels.forEach((level, index) => {
        const value = asset.hierarchyPath[level.key];
        if (!value) {
          if (skippedAssets < 3) {
            console.log(`[ViewModeManager] Skipping asset ${asset.id} - missing value for level "${level.key}". Asset hierarchy:`, asset.hierarchyPath);
          }
          assetProcessed = false;
          return;
        }

        const nodeKey = parentKey ? `${parentKey}/${level.key}:${value}` : `${level.key}:${value}`;

        let node = nodeMap.get(nodeKey);
        if (!node) {
          node = {
            key: level.key,
            value,
            level: index,
            children: [],
            assets: [],
          };
          nodeMap.set(nodeKey, node);

          if (parentKey) {
            const parentNode = nodeMap.get(parentKey);
            if (parentNode) {
              parentNode.children.push(node);
            }
          } else {
            roots.push(node);
          }
        }

        if (index === sortedLevels.length - 1) {
          node.assets.push(asset);
        }

        parentKey = nodeKey;
      });

      if (assetProcessed) {
        processedAssets++;
      } else {
        skippedAssets++;
      }
    });

    console.log(`[ViewModeManager] Hierarchy tree built: ${processedAssets} assets processed, ${skippedAssets} assets skipped, ${roots.length} root nodes`);

    if (roots.length > 0) {
      console.log('[ViewModeManager] Root nodes:', roots.map(r => `${r.key}=${r.value} (${r.assets.length} assets)`));

      const logNode = (node: HierarchyNode, depth: number = 0) => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}${node.key}=${node.value} (${node.assets.length} assets, ${node.children.length} children)`);
        if (node.assets.length > 0) {
          console.log(`${indent}  Assets: ${node.assets.map(a => a.id).join(', ')}`);
        }
        node.children.forEach(child => logNode(child, depth + 1));
      };

      console.log('[ViewModeManager] Detailed hierarchy tree:');
      roots.forEach(root => logNode(root));
    }

    return { roots };
  }

  /**
   * 機器ベースデータにフィルターを適用
   */
  private applyFiltersToEquipmentData(rows: EquipmentBasedRow[]): EquipmentBasedRow[] {
    let filtered = rows;

    if (this.currentState.filters.hierarchyPath) {
      filtered = filtered.filter(row => {
        if (row.type === 'asset' && row.hierarchyPath) {
          return this.matchesHierarchyFilter(row.hierarchyPath, this.currentState.filters.hierarchyPath!);
        }
        return true;
      });
    }

    if (this.currentState.filters.dateRange) {
      filtered = filtered.filter(row => {
        if (row.type === 'asset' && row.tasks) {
          return row.tasks.some(task =>
            this.hasScheduleInDateRange(task.schedule, this.currentState.filters.dateRange!)
          );
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * 作業ベースデータにフィルターを適用
   */
  private applyFiltersToTaskData(rows: TaskBasedRow[]): TaskBasedRow[] {
    let filtered = rows;

    if (this.currentState.filters.taskClassification) {
      const targetClassification = this.currentState.filters.taskClassification;
      filtered = filtered.filter(row => {
        if (row.type === 'workOrderLine') {
          return row.classification === targetClassification;
        }
        return true;
      });
    }

    if (this.currentState.filters.hierarchyPath) {
      filtered = filtered.filter(row => {
        if (row.type === 'asset' && row.hierarchyPath) {
          return this.matchesHierarchyFilter(row.hierarchyPath, this.currentState.filters.hierarchyPath!);
        }
        if (row.type === 'workOrderLine' && row.assetId) {
          const asset = this.assets.get(row.assetId);
          if (asset?.hierarchyPath) {
            return this.matchesHierarchyFilter(asset.hierarchyPath, this.currentState.filters.hierarchyPath!);
          }
        }
        return true;
      });
    }

    if (this.currentState.filters.dateRange) {
      filtered = filtered.filter(row => {
        if (row.type === 'workOrderLine' && row.schedule) {
          return this.hasScheduleInDateRange(row.schedule as WorkOrderSchedule, this.currentState.filters.dateRange!);
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * 階層パスがフィルターに一致するかチェック
   */
  private matchesHierarchyFilter(
    hierarchyPath: HierarchyPath,
    filter: Partial<HierarchyPath>
  ): boolean {
    return Object.entries(filter).every(([key, value]) => {
      return hierarchyPath[key] === value;
    });
  }

  /**
   * 現在のデータに基づく時間ヘッダーを取得
   * Requirements 6.4: Auto-scale time range based on data
   */
  getTimeHeaders(timeScale: TimeScale): string[] {
    const years = new Set<number>();
    const months = new Set<string>();
    const weeks = new Set<string>();
    const days = new Set<string>();

    const currentYear = new Date().getFullYear();

    years.add(currentYear);
    years.add(currentYear + 1);
    years.add(currentYear + 2);

    // Scan all WorkOrderLines to find data range
    this.workOrderLines.forEach(line => {
      if (line.schedule) {
        Object.keys(line.schedule).forEach(dateKey => {
          const yearMatch = dateKey.match(/^(\d{4})/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            years.add(year);

            if (timeScale === 'month') {
              const monthMatch = dateKey.match(/^(\d{4}-\d{2})/);
              if (monthMatch) {
                months.add(monthMatch[1]);
              }
            } else if (timeScale === 'week') {
              const date = new Date(dateKey);
              if (!isNaN(date.getTime())) {
                const { year: isoYear, week } = getISOWeek(date);
                weeks.add(`${isoYear}-W${String(week).padStart(2, '0')}`);
              }
            } else if (timeScale === 'day') {
              const dayMatch = dateKey.match(/^(\d{4}-\d{2}-\d{2})/);
              if (dayMatch) {
                days.add(dayMatch[1]);
              }
            }
          }
        });
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => a - b);

    if (timeScale === 'year') {
      return sortedYears.map(y => y.toString());
    }

    const minYear = sortedYears[0];
    const maxYear = sortedYears[sortedYears.length - 1];

    const startDate = new Date(Date.UTC(minYear, 0, 1));
    const endDate = new Date(Date.UTC(maxYear, 11, 31));

    return generateTimeRange(startDate, endDate, timeScale);
  }

  /**
   * スケジュールが日付範囲内にあるかチェック
   */
  private hasScheduleInDateRange(
    schedule: WorkOrderSchedule,
    dateRange: { start: string; end: string }
  ): boolean {
    return Object.keys(schedule).some(dateKey => {
      return dateKey >= dateRange.start && dateKey <= dateRange.end;
    });
  }
}

export default ViewModeManager;
