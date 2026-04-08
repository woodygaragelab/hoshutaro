/**
 * ViewModeManager - 表示モードの切り替えとデータ変換を管理
 *
 * v3.0.0: Event Record Model. WorkOrderLine is entirely flat.
 *
 * 要件:
 * - 4.1: asset-based表示モード (機器単位)
 * - 5.1: workorder-based表示モード (発注行単位のグループ化)
 * - 6.1: 表示モードの切り替え
 * - 6.2: フィルターと選択状態の保持
 * - 6.4: 時間スケール集約
 */

import {
  ViewMode,
  ViewModeState,
  AssetBasedRow,
  WorkOrderBasedRow,
  AggregatedStatus,
  Asset,
  WorkOrderLine,
  WorkOrder,
  HierarchyDefinition,
  HierarchyPath,
  TimeScale,
  EditContext,
} from '../types/maintenanceTask';
import { memoizeDeep, MemoizationBatch } from '../utils/memoization';
import { getISOWeek, generateTimeRange, getTimeKey } from '../utils/dateUtils';

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
  private assets: Map<string, Asset>;
  private workOrderLines: Map<string, WorkOrderLine>;
  private workOrders: Map<string, WorkOrder>;
  private hierarchy: HierarchyDefinition;
  private memoizationBatch: MemoizationBatch;

  private memoizedBuildHierarchyTree: () => HierarchyTree;
  private memoizedAggregateEvents: (events: WorkOrderLine[], timeScale: TimeScale) => { [timeKey: string]: AggregatedStatus };

  constructor(
    assets: Asset[],
    workOrderLines: WorkOrderLine[],
    hierarchy: HierarchyDefinition,
    workOrders?: WorkOrder[]
  ) {
    this.assets = new Map(assets.map(a => [a.id, a]));
    this.workOrderLines = new Map(workOrderLines.map(l => [l.id, l]));
    this.workOrders = new Map((workOrders || []).map(wo => [wo.id, wo]));
    this.hierarchy = hierarchy;

    this.currentState = {
      mode: 'asset-based',
      filters: {},
    };

    this.memoizationBatch = new MemoizationBatch();

    this.memoizedBuildHierarchyTree = (() => {
      let cache: HierarchyTree | null = null;
      return () => {
        if (!cache) {
          cache = this.buildHierarchyTreeInternal();
        }
        return cache;
      };
    })();

    this.memoizedAggregateEvents = memoizeDeep(
      (events: WorkOrderLine[], timeScale: TimeScale) =>
        this.aggregateEventsByTimeScaleInternal(events, timeScale),
      100
    );
  }

  getCurrentMode(): ViewMode {
    return this.currentState.mode;
  }

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

  applyFilters(filters: ViewModeState['filters']): void {
    this.currentState.filters = {
      ...this.currentState.filters,
      ...filters,
    };
  }

  preserveSelection(): void {
    if (this.currentState.selection) {
      const { rowId, columnId } = this.currentState.selection;
      let assetId: string | undefined;

      if (this.currentState.mode === 'asset-based') {
        if (rowId.startsWith('asset_') && rowId.includes('_wo_')) {
          const match = rowId.match(/^asset_([^_]+)_wo_/);
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
            .filter(line => line.AssetId === assetId);

          if (relatedLines.length > 0) {
            const firstLine = relatedLines[0];
            this.currentState.selection = {
              rowId: `asset_${assetId}_wo_${firstLine.WorkOrderId}`,
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
   */
  getAssetBasedData(): AssetBasedRow[] {
    const rows: AssetBasedRow[] = [];
    const hierarchyTree = this.buildHierarchyTree();

    const traverseHierarchy = (node: HierarchyNode, parentPath: string[] = [], depth: number = 0) => {
      const currentPath = [...parentPath, node.value];

      node.children.forEach(child => {
        traverseHierarchy(child, currentPath, depth + 1);
      });

      if (node.assets.length > 0) {
        const groupPath = currentPath.join(' > ');
        rows.push({
          type: 'hierarchy',
          level: depth,
          hierarchyKey: node.key,
          hierarchyValue: groupPath,
        });

        node.assets.forEach(asset => {
          const relatedLines = Array.from(this.workOrderLines.values())
            .filter(line => line.AssetId === asset.id);

          const mappedLines = relatedLines.map(line => {
             const wo = this.workOrders.get(line.WorkOrderId);
             return {
                workOrderLineId: line.id,
                workOrderId: line.WorkOrderId,
                workOrderName: wo?.name || '不明な発注',
                name: line.name,
                ClassificationId: wo?.ClassificationId || '',
                PlanScheduleStart: line.PlanScheduleStart,
                PlanScheduleEnd: line.PlanScheduleEnd,
                ActualScheduleStart: line.ActualScheduleStart,
                ActualScheduleEnd: line.ActualScheduleEnd,
                Planned: line.Planned,
                Actual: line.Actual,
                PlanCost: line.PlanCost,
                ActualCost: line.ActualCost,
                manhours: line.PlannedManhours
             };
          });

          rows.push({
            type: 'asset',
            assetId: asset.id,
            assetName: asset.name,
            hierarchyPath: asset.hierarchyPath,
            classificationPath: asset.classificationPath,
            specifications: asset.specifications,
            workOrderLines: mappedLines,
            level: depth + 1,
          });
        });
      }
    };

    hierarchyTree.roots.forEach(root => {
      traverseHierarchy(root, [], 0);
    });

    return this.applyFiltersToAssetData(rows);
  }

  /**
   * 作業ベースデータを取得 (WorkOrder grouping)
   * 階層構造: 作業 (WorkOrder) ＞ 紐づく機器 (Asset)
   */
  getWorkOrderBasedData(timeScale: TimeScale = 'month'): WorkOrderBasedRow[] {
    const rows: WorkOrderBasedRow[] = [];
    
    // Convert WorkOrders to array and sort (optional: could sort by ClassificationId etc.)
    const workOrdersList = Array.from(this.workOrders.values());
    
    workOrdersList.forEach(wo => {
      // Find all lines for this WorkOrder
      const relatedLines = Array.from(this.workOrderLines.values())
        .filter(line => line.WorkOrderId === wo.id);
        
      // If a WorkOrder has no lines, we still show it so users can double-click to assign assets
      
      // Aggregate schedule for the parent row
      const parentAggregatedSchedule = this.aggregateEventsByTimeScaleInternal(relatedLines, timeScale);
      
      // Create Parent Row (WorkOrder)
      rows.push({
        id: `workOrder_${wo.id}`,
        type: 'workOrder',
        level: 0,
        workOrderId: wo.id,
        workOrderName: wo.name,
        ClassificationId: wo.ClassificationId,
        task: wo.name,
        bomCode: '',
        aggregatedSchedule: parentAggregatedSchedule,
        results: parentAggregatedSchedule,
        rolledUpResults: parentAggregatedSchedule,
      });
      
      // Group lines by AssetId
      const assetMap = new Map<string, WorkOrderLine[]>();
      relatedLines.forEach(line => {
        if (!assetMap.has(line.AssetId)) assetMap.set(line.AssetId, []);
        assetMap.get(line.AssetId)!.push(line);
      });
      
      // Create Child Rows (Assets)
      assetMap.forEach((lines, assetId) => {
        const asset = this.assets.get(assetId);
        if (asset) {
          const childAggregatedSchedule = this.aggregateEventsByTimeScaleInternal(lines, timeScale);
          
          rows.push({
            id: `workOrder_${wo.id}_asset_${asset.id}`,
            type: 'assetChild',
            level: 1,
            workOrderId: wo.id,
            assetId: asset.id,
            assetName: asset.name,
            hierarchyPath: asset.hierarchyPath,
            specifications: asset.specifications,
            task: asset.name,
            bomCode: asset.id,
            aggregatedSchedule: childAggregatedSchedule,
            results: childAggregatedSchedule,
            rolledUpResults: childAggregatedSchedule,
          });
        }
      });
    });

    return this.applyFiltersToWorkOrderData(rows);
  }

  /**
   * 平坦化されたWorkOrderLineの配列から、日付キーでグループ化された集計結果を返す
   */
  public aggregateEventsByTimeScaleInternal(
    events: WorkOrderLine[],
    timeScale: TimeScale
  ): { [timeKey: string]: AggregatedStatus } {
    const aggregated: { [timeKey: string]: AggregatedStatus } = {};

    events.forEach(event => {
       // Support V3 data format where schedule is pre-aggregated
       if (event.schedule) {
         Object.entries(event.schedule).forEach(([dateStr, status]) => {
           // Resolve V3 schedule keys (e.g. "2023-09" -> Date)
           const isYearOnly = dateStr.length === 4;
           const date = new Date(isYearOnly ? `${dateStr}-01-01` : `${dateStr}-01`);
           if (isNaN(date.getTime())) return;

           const aggregateKey = getTimeKey(date, timeScale);

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
           aggregated[aggregateKey].totalPlanCost += status.planCost || 0;
           aggregated[aggregateKey].totalActualCost += status.actualCost || 0;
           aggregated[aggregateKey].count += 1;
         });
         return; // Move to next event
       }

       // Convert string to Date if needed (sometimes JSON parse leaves it as string)
       const date = typeof event.PlanScheduleStart === 'string' 
           ? new Date(event.PlanScheduleStart) 
           : event.PlanScheduleStart;

       // Legacy format requires PlanScheduleStart to be a valid date
       if (!date || isNaN(date.getTime())) return;

       const aggregateKey = getTimeKey(date, timeScale);

       if (!aggregated[aggregateKey]) {
         aggregated[aggregateKey] = {
           planned: false,
           actual: false,
           totalPlanCost: 0,
           totalActualCost: 0,
           count: 0,
         };
       }

       aggregated[aggregateKey].planned = aggregated[aggregateKey].planned || event.Planned;
       aggregated[aggregateKey].actual = aggregated[aggregateKey].actual || event.Actual;
       aggregated[aggregateKey].totalPlanCost += event.PlanCost || 0;
       aggregated[aggregateKey].totalActualCost += event.ActualCost || 0;
       aggregated[aggregateKey].count += 1;
    });

    return aggregated;
  }

  getDisplaySymbol(status: AggregatedStatus): string {
    if (status.planned && status.actual) return '◎';
    if (status.planned && !status.actual) return '○';
    if (!status.planned && status.actual) return '●';
    return '';
  }

  getWorkOrderLines(): WorkOrderLine[] {
    return Array.from(this.workOrderLines.values());
  }

  getCurrentState(): ViewModeState {
    return { ...this.currentState };
  }

  getEditContext(): EditContext {
    return {
      viewMode: this.currentState.mode,
      editScope: this.currentState.mode === 'workorder-based' ? 'all-assets' : 'single-asset',
    };
  }

  updateData(
    assets: Asset[],
    workOrderLines: WorkOrderLine[],
    hierarchy: HierarchyDefinition,
    workOrders?: WorkOrder[]
  ): void {
    this.assets = new Map(assets.map(a => [a.id, a]));
    this.workOrderLines = new Map(workOrderLines.map(l => [l.id, l]));
    if (workOrders) {
      this.workOrders = new Map(workOrders.map(wo => [wo.id, wo]));
    }
    this.hierarchy = hierarchy;

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

    this.memoizedAggregateEvents = memoizeDeep(
      (events: WorkOrderLine[], timeScale: TimeScale) =>
        this.aggregateEventsByTimeScaleInternal(events, timeScale),
      100
    );
  }

  private buildHierarchyTree(): HierarchyTree {
    return this.memoizedBuildHierarchyTree();
  }

  private buildHierarchyTreeInternal(): HierarchyTree {
    const roots: HierarchyNode[] = [];
    const nodeMap = new Map<string, HierarchyNode>();

    const sortedLevels = [...this.hierarchy.levels].sort((a, b) => a.order - b.order);

    if (sortedLevels.length === 0) {
      // If no hierarchy is defined, group all assets under a single root node
      const dummyRoot: HierarchyNode = {
        key: 'all',
        value: '全ての機器',
        level: 0,
        children: [],
        assets: Array.from(this.assets.values()),
      };
      return { roots: [dummyRoot] };
    }

    Array.from(this.assets.values()).forEach(asset => {
      let parentKey = '';

      sortedLevels.forEach((level, index) => {
        const value = asset.hierarchyPath[level.key];
        if (!value) return;

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
    });

    return { roots };
  }

  private applyFiltersToAssetData(rows: AssetBasedRow[]): AssetBasedRow[] {
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
        if (row.type === 'asset' && row.workOrderLines) {
          // dateRange filter logic for flat events
          const startIso = this.currentState.filters.dateRange!.start;
          const endIso = this.currentState.filters.dateRange!.end;
          return row.workOrderLines.some(line => {
             const iso = new Date(line.PlanScheduleStart).toISOString();
             return iso >= startIso && iso <= endIso;
          });
        }
        return true;
      });
    }

    return filtered;
  }

  private applyFiltersToWorkOrderData(rows: WorkOrderBasedRow[]): WorkOrderBasedRow[] {
    let filtered = rows;

    if (this.currentState.filters.taskClassification) {
      const targetClassification = this.currentState.filters.taskClassification;
      filtered = filtered.filter(row => {
        if (row.type === 'workOrder' || row.type === 'assetChild') {
          return row.ClassificationId === targetClassification;
        }
        return true;
      });
    }

    if (this.currentState.filters.hierarchyPath) {
      filtered = filtered.filter(row => {
        if (row.type === 'assetChild' && row.hierarchyPath) {
          return this.matchesHierarchyFilter(row.hierarchyPath, this.currentState.filters.hierarchyPath!);
        }
        if (row.type === 'workOrder') {
          return true; // Keep work orders, children will be filtered
        }
        return true;
      });
    }

    if (this.currentState.filters.dateRange) {
      filtered = filtered.filter(row => {
        if ((row.type === 'assetChild' || row.type === 'workOrder') && row.aggregatedSchedule) {
          return Object.keys(row.aggregatedSchedule).some(dateKey => {
            return dateKey >= this.currentState.filters.dateRange!.start && dateKey <= this.currentState.filters.dateRange!.end;
          });
        }
        return true;
      });
    }

    return filtered;
  }

  private matchesHierarchyFilter(
    hierarchyPath: HierarchyPath,
    filter: Partial<HierarchyPath>
  ): boolean {
    return Object.entries(filter).every(([key, value]) => {
      return hierarchyPath[key] === value;
    });
  }

  getTimeHeaders(timeScale: TimeScale): string[] {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();

    years.add(currentYear);
    years.add(currentYear + 1);
    years.add(currentYear + 2);

    this.workOrderLines.forEach(line => {
       const date = typeof line.PlanScheduleStart === 'string' ? new Date(line.PlanScheduleStart) : line.PlanScheduleStart;
       if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
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
}

export default ViewModeManager;
