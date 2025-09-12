export interface HierarchicalData {
  id: string;
  task: string;
  level: number;
  bomCode: string;
  cycle?: number;
  specifications: { key: string; value: string; order: number }[];
  children: any[];
  results: { [year: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  rolledUpResults: { [year: string]: { planned: boolean; actual: boolean; planCost: number; actualCost: number; } };
  isOpen: boolean;
}

export type RawEquipment = {
  id: string;
  hierarchy: { [key: string]: string };
  specifications: { key: string; value: string; order: number }[];
  maintenances: { [date: string]: { planned: boolean; actual: boolean; cost: number | null } };
};
