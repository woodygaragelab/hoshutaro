// Advanced Filter Types
export type FilterOperator = 
  | 'equals' 
  | 'contains' 
  | 'startsWith' 
  | 'endsWith' 
  | 'greaterThan' 
  | 'lessThan' 
  | 'between' 
  | 'in' 
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

export type LogicalOperator = 'AND' | 'OR';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

export interface SavedFilter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  createdAt: Date;
  lastUsed?: Date;
  description?: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: { value: any; label: string }[];
}

export interface AdvancedFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterCondition[];
  savedFilters: SavedFilter[];
  availableFields: FilterField[];
  onFilterChange: (filters: FilterCondition[]) => void;
  onSaveFilter: (name: string, description: string, filters: FilterCondition[]) => void;
  onUpdateFilter?: (filterId: string, name: string, description: string, filters: FilterCondition[]) => void;
  onDuplicateFilter?: (filterId: string) => void;
  onLoadFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onClearFilters: () => void;
}

export interface FilterResult {
  totalCount: number;
  filteredCount: number;
  suggestions?: string[];
}