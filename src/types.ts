export interface HierarchicalData {
  id: string;
  task: string;
  level: number;
  bomCode: string;
  cycle?: number;
  specifications: { key: string; value: string; order: number }[];
  children: any[];
  results: { [timeKey: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  rolledUpResults: { [timeKey: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  hierarchyPath?: string; // For breadcrumb display
}

export type RawEquipment = {
  id: string;
  hierarchy: { [key: string]: string };
  specifications: { key: string; value: string; order: number }[];
  maintenances: { [date: string]: { planned: boolean; actual: boolean; cost: number | null } };
};
