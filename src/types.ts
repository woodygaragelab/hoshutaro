export interface HierarchicalData {
  id: string;
  task: string;
  level: number;
  bomCode: string;
  specifications: { key: string; value: string; order: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: any[];
  results: { [timeKey: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  rolledUpResults: { [timeKey: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  hierarchyPath?: string; // For breadcrumb display
  assetId?: string; // Asset ID for filtering and indexing
  taskId?: string; // Task ID for filtering and indexing
  isGroupHeader?: boolean; // Flag for group header rows
  workOrderId?: string; // WorkOrder ID for filtering in workorder-based mode
  type?: string; // Row type for grid mode discrimination ('hierarchy' | 'asset' | 'workOrder' | ...)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aggregatedSchedule?: any; // Aggregated rolled-up schedule used by CostTrendGraph
}

export type RawEquipment = {
  id: string;
  hierarchy: { [key: string]: string };
  specifications: { key: string; value: string; order: number }[];
  maintenances: { [date: string]: { planned: boolean; actual: boolean; cost: number | null } };
};
