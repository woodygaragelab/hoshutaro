export { SpecificationEditDialog } from './SpecificationEditDialog';
export type { 
  SpecificationEditDialogProps,
  SpecificationEditState,
  SpecificationEditItem,
} from './SpecificationEditDialog';

export {
  validateSpecificationKey,
  validateSpecificationValue,
  validateSpecifications,
  formatSpecifications,
  sanitizeSpecifications,
  detectSpecificationChanges,
  DEFAULT_SPECIFICATION_VALIDATION_RULES,
} from './specificationValidation';

export type {
  SpecificationValidationOptions,
  SpecificationValidationResult,
  SpecificationItemValidationResult,
} from './specificationValidation';

export {
  getSpecificationDeviceStyles,
  getSpecificationInputAttributes,
  getSpecificationButtonStyles,
  createSpecificationKeyboardHandler,
  createSpecificationFocusHandler,
  createSpecificationBlurHandler,
  getSpecificationAnimationConfig,
  getSpecificationLayoutConfig,
  detectTouchCapabilities,
  getSpecificationErrorDisplayConfig,
  DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION,
} from './deviceOptimization';

export type {
  SpecificationDeviceOptimization,
} from './deviceOptimization';

export { SpecificationEditDialogExample } from './SpecificationEditDialog.example';

export {
  DesktopDragHandler,
  TouchReorderHandler,
  moveItem,
  updateSpecificationOrder,
  getActiveItemIndices,
  handleKeyboardReorder,
  getReorderAnimationConfig,
  getReorderAriaAttributes,
  getReorderInstructions,
} from './reorderingUtils';

export type {
  DragState,
  TouchReorderState,
} from './reorderingUtils';

export { useResponsiveLayout } from './useResponsiveLayout';
export type { ResponsiveLayoutState, ResponsiveLayoutConfig } from './useResponsiveLayout';

export {
  DesktopInlineEdit,
  TabletTouchEdit,
  MobileFullscreenEdit,
  MobileFloatingActions,
  DeviceErrorDisplay,
  KeyboardAdjustment,
} from './DeviceSpecificComponents';

export type {
  DesktopInlineEditProps,
  TabletTouchEditProps,
  MobileFullscreenEditProps,
  MobileFloatingActionsProps,
  DeviceErrorDisplayProps,
  KeyboardAdjustmentProps,
} from './DeviceSpecificComponents';