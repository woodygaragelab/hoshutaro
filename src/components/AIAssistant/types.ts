import type { Asset, WorkOrder, WorkOrderLine, DataModel } from '../../types/maintenanceTask';

export interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionApply: (suggestion: MaintenanceSuggestion) => void;
  onExcelImport: (file: File) => void;
  onImportComplete?: (dataModel: DataModel) => void;
  dataContext?: {
    assets: Asset[];
    workOrders: WorkOrder[];
    workOrderLines: WorkOrderLine[];
  };
}

export interface ChatAction {
  id: string;
  label: string;
  variant: 'confirm' | 'cancel' | 'info';
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  suggestions?: MaintenanceSuggestion[];
  actions?: ChatAction[];
}

export interface MaintenanceSuggestion {
  equipmentId: string;
  timeHeader: string;
  suggestedAction: 'plan' | 'actual' | 'both';
  reason: string;
  confidence: number;
  cost?: number;
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

export interface ExcelImportResult {
  success: boolean;
  processedRows: number;
  errors: ImportError[];
  suggestions: DataMappingSuggestion[];
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DataMappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  sampleValues: string[];
}

export interface AIServiceConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  timeout: number;
}

export interface AIResponse {
  success: boolean;
  content: string;
  suggestions?: MaintenanceSuggestion[];
  error?: string;
}
