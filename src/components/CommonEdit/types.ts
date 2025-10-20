import { HierarchicalData } from '../../types';

// 共通編集コンテキスト
export interface EditContext {
  deviceType: 'desktop' | 'tablet' | 'mobile';
  editMode: 'status' | 'cost' | 'specification';
  cellData: CellData;
  onSave: (value: any) => void;
  onCancel: () => void;
}

// セルデータ
export interface CellData {
  rowId: string;
  columnId: string;
  currentValue: any;
  dataType: 'status' | 'cost' | 'text' | 'number';
  validation?: ValidationRule[];
}

// 星取表の状態値
export interface StatusValue {
  planned: boolean;
  actual: boolean;
  displaySymbol: '○' | '●' | '◎' | '';
  label: '未計画' | '計画' | '実績' | '両方';
}

// コスト値
export interface CostValue {
  planCost: number;
  actualCost: number;
}

// 機器仕様値
export interface SpecificationValue {
  key: string;
  value: string;
  order: number;
}

// 状態選択オプション
export interface StatusOption {
  value: StatusValue;
  symbol: '○' | '●' | '◎' | '';
  label: '未計画' | '計画' | '実績' | '両方';
  description: string;
  color: string;
}

// バリデーションルール
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern';
  value?: any;
  message: string;
}

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// 編集履歴エントリ
export interface EditHistoryEntry {
  timestamp: Date;
  user: string;
  action: 'create' | 'update' | 'delete';
  oldValue: any;
  newValue: any;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

// 拡張されたセルデータ
export interface EnhancedCellData extends CellData {
  // 星取表専用フィールド
  statusData?: {
    planned: boolean;
    actual: boolean;
    symbol: '○' | '●' | '◎' | '';
    lastModified: Date;
    modifiedBy: string;
  };
  
  // コスト専用フィールド
  costData?: {
    planCost: number;
    actualCost: number;
    currency: string;
    lastModified: Date;
    modifiedBy: string;
  };
  
  // 機器仕様専用フィールド
  specificationData?: {
    specifications: SpecificationValue[];
    lastModified: Date;
    modifiedBy: string;
  };
  
  // 編集履歴
  editHistory: EditHistoryEntry[];
  
  // バリデーション結果
  validationResult: ValidationResult;
}

// タッチ機能検出
export interface TouchCapabilities {
  hasTouch: boolean;
  hasHover: boolean;
  hasPointerEvents: boolean;
  maxTouchPoints: number;
}

// デバイス検出結果
export interface DeviceDetection {
  type: 'desktop' | 'tablet' | 'mobile';
  screenSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  touchCapabilities: TouchCapabilities;
  userAgent: string;
}

// 共通編集ロジックのプロパティ
export interface CommonEditLogicProps {
  data: HierarchicalData[];
  viewMode: 'status' | 'cost';
  deviceDetection: DeviceDetection;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  onValidationError: (error: ValidationError) => void;
  readOnly?: boolean;
}

// 編集状態管理
export interface EditState {
  // 現在の編集状態
  activeEdit: {
    cellReference: { rowId: string; columnId: string };
    editType: 'status' | 'cost' | 'specification';
    originalValue: any;
    currentValue: any;
    isDirty: boolean;
  } | null;
  
  // 選択状態
  selection: {
    selectedCells: { rowId: string; columnId: string }[];
    selectedRange: {
      startRow: string;
      startColumn: string;
      endRow: string;
      endColumn: string;
    } | null;
    focusedCell: { rowId: string; columnId: string } | null;
  };
  
  // UI状態
  ui: {
    dialogStates: {
      statusSelection: boolean;
      costInput: boolean;
      specificationEdit: boolean;
    };
    loadingStates: {
      saving: boolean;
      validating: boolean;
      syncing: boolean;
    };
    errorStates: {
      validationErrors: { [cellId: string]: string[] };
      syncErrors: any[];
    };
  };
}