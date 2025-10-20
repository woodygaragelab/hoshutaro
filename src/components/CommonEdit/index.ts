// 型定義のエクスポート
export type {
  EditContext,
  CellData,
  StatusValue,
  CostValue,
  SpecificationValue,
  StatusOption,
  ValidationRule,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  EditHistoryEntry,
  EnhancedCellData,
  TouchCapabilities,
  DeviceDetection,
  CommonEditLogicProps,
  EditState,
} from './types';

// デバイス検出関数のエクスポート
export {
  detectTouchCapabilities,
  detectDeviceType,
  detectOrientation,
  detectDevice,
  setupDeviceChangeListener,
  getOptimalTouchTargetSize,
  getOptimalSpacing,
  getOptimalFontSize,
} from './deviceDetection';

// 星取表状態ロジックのエクスポート
export {
  STATUS_OPTIONS,
  createStatusValue,
  extractPlannedActual,
  getStatusFromSymbol,
  getSymbolFromStatus,
  getColorFromStatus,
  getStatusDescription,
  getNextStatus,
  isValidStatusTransition,
  requiresConfirmation,
  getConfirmationMessage,
  calculateStatusStatistics,
} from './statusLogic';

// 共通編集ロジックコンポーネントのエクスポート
export {
  CommonEditLogic,
  CommonEditContext,
  useCommonEdit,
} from './CommonEditLogic';