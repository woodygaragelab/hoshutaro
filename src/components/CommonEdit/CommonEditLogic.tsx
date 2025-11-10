import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CommonEditLogicProps, 
  EditContext, 
  EditState, 
  DeviceDetection,
  StatusValue,
  CostValue,
  SpecificationValue,
  ValidationResult,
  ValidationError
} from './types';
import { createStatusValue, extractPlannedActual } from './statusLogic';

/**
 * 共通編集ロジックを提供するコンポーネント
 */
export const CommonEditLogic: React.FC<CommonEditLogicProps & { children: React.ReactNode }> = ({
  data,
  viewMode,
  deviceDetection: initialDeviceDetection,
  onCellEdit,
  onSpecificationEdit,
  onValidationError,
  readOnly = false,
  children
}) => {
  // デバイス検出状態（デスクトップ固定）
  const [deviceDetection, setDeviceDetection] = useState<DeviceDetection>(
    initialDeviceDetection || {
      type: 'desktop',
      screenSize: { width: window.innerWidth, height: window.innerHeight },
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      touchCapabilities: {
        hasTouch: 'ontouchstart' in window,
        hasHover: window.matchMedia('(hover: hover)').matches,
        hasPointerEvents: 'PointerEvent' in window,
        maxTouchPoints: navigator.maxTouchPoints || 0,
      },
      userAgent: navigator.userAgent,
    }
  );

  // 編集状態管理
  const [editState, setEditState] = useState<EditState>({
    activeEdit: null,
    selection: {
      selectedCells: [],
      selectedRange: null,
      focusedCell: null,
    },
    ui: {
      dialogStates: {
        statusSelection: false,
        costInput: false,
        specificationEdit: false,
      },
      loadingStates: {
        saving: false,
        validating: false,
        syncing: false,
      },
      errorStates: {
        validationErrors: {},
        syncErrors: [],
      },
    },
  });

  // デバイス変更の監視（デスクトップ固定のため不要）
  // useEffect(() => {
  //   const cleanup = setupDeviceChangeListener(setDeviceDetection);
  //   return cleanup;
  // }, []);

  /**
   * セル編集の開始
   */
  const startCellEdit = useCallback((
    rowId: string,
    columnId: string,
    editType: 'status' | 'cost' | 'specification'
  ) => {
    if (readOnly) return;

    const item = data.find(d => d.id === rowId);
    if (!item) return;

    let originalValue: any;
    
    if (editType === 'status') {
      const timeHeader = columnId.replace('time_', '');
      const result = item.results[timeHeader];
      originalValue = result ? createStatusValue(result.planned, result.actual) : createStatusValue(false, false);
    } else if (editType === 'cost') {
      const timeHeader = columnId.replace('time_', '');
      const result = item.results[timeHeader];
      originalValue = {
        planCost: result?.planCost || 0,
        actualCost: result?.actualCost || 0,
      };
    } else if (editType === 'specification') {
      originalValue = item.specifications || [];
    } else {
      originalValue = item[columnId as keyof typeof item];
    }

    setEditState(prev => ({
      ...prev,
      activeEdit: {
        cellReference: { rowId, columnId },
        editType,
        originalValue,
        currentValue: originalValue,
        isDirty: false,
      },
      ui: {
        ...prev.ui,
        dialogStates: {
          statusSelection: editType === 'status',
          costInput: editType === 'cost',
          specificationEdit: editType === 'specification',
        },
      },
    }));
  }, [data, readOnly]);

  /**
   * 編集値の更新
   */
  const updateEditValue = useCallback((value: any) => {
    setEditState(prev => {
      if (!prev.activeEdit) return prev;

      const isDirty = JSON.stringify(value) !== JSON.stringify(prev.activeEdit.originalValue);

      return {
        ...prev,
        activeEdit: {
          ...prev.activeEdit,
          currentValue: value,
          isDirty,
        },
      };
    });
  }, []);

  /**
   * 編集の保存
   */
  const saveEdit = useCallback(async () => {
    if (!editState.activeEdit) return;

    const { cellReference, editType, currentValue } = editState.activeEdit;
    const { rowId, columnId } = cellReference;

    setEditState(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        loadingStates: {
          ...prev.ui.loadingStates,
          saving: true,
        },
      },
    }));

    try {
      if (editType === 'status') {
        const statusValue = currentValue as StatusValue;
        const { planned, actual } = extractPlannedActual(statusValue);
        onCellEdit(rowId, columnId, { planned, actual });
      } else if (editType === 'cost') {
        const costValue = currentValue as CostValue;
        onCellEdit(rowId, columnId, costValue);
      } else if (editType === 'specification') {
        const specifications = currentValue as SpecificationValue[];
        // 仕様編集の場合は、各仕様項目を個別に保存
        specifications.forEach((spec, index) => {
          onSpecificationEdit(rowId, index, 'key', spec.key);
          onSpecificationEdit(rowId, index, 'value', spec.value);
        });
      } else {
        onCellEdit(rowId, columnId, currentValue);
      }

      // 編集状態をクリア
      setEditState(prev => ({
        ...prev,
        activeEdit: null,
        ui: {
          ...prev.ui,
          dialogStates: {
            statusSelection: false,
            costInput: false,
            specificationEdit: false,
          },
          loadingStates: {
            ...prev.ui.loadingStates,
            saving: false,
          },
        },
      }));
    } catch (error) {
      console.error('編集の保存に失敗しました:', error);
      
      setEditState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          loadingStates: {
            ...prev.ui.loadingStates,
            saving: false,
          },
          errorStates: {
            ...prev.ui.errorStates,
            syncErrors: [...prev.ui.errorStates.syncErrors, error],
          },
        },
      }));
    }
  }, [editState.activeEdit, onCellEdit, onSpecificationEdit]);

  /**
   * 編集のキャンセル
   */
  const cancelEdit = useCallback(() => {
    setEditState(prev => ({
      ...prev,
      activeEdit: null,
      ui: {
        ...prev.ui,
        dialogStates: {
          statusSelection: false,
          costInput: false,
          specificationEdit: false,
        },
      },
    }));
  }, []);

  /**
   * バリデーション実行
   */
  const validateEdit = useCallback((value: any, editType: 'status' | 'cost' | 'specification'): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    if (editType === 'cost') {
      const costValue = value as CostValue;
      if (costValue.planCost < 0) {
        errors.push({
          field: 'planCost',
          message: '計画コストは0以上である必要があります',
          code: 'MIN_VALUE',
        });
      }
      if (costValue.actualCost < 0) {
        errors.push({
          field: 'actualCost',
          message: '実績コストは0以上である必要があります',
          code: 'MIN_VALUE',
        });
      }
    } else if (editType === 'specification') {
      const specifications = value as SpecificationValue[];
      specifications.forEach((spec, index) => {
        if (!spec.key.trim()) {
          errors.push({
            field: `specifications[${index}].key`,
            message: '仕様項目名は必須です',
            code: 'REQUIRED',
          });
        }
        if (spec.key.length > 50) {
          errors.push({
            field: `specifications[${index}].key`,
            message: '仕様項目名は50文字以内で入力してください',
            code: 'MAX_LENGTH',
          });
        }
        if (spec.value.length > 200) {
          errors.push({
            field: `specifications[${index}].value`,
            message: '仕様値は200文字以内で入力してください',
            code: 'MAX_LENGTH',
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, []);

  /**
   * 編集コンテキストの生成
   */
  const createEditContext = useCallback((
    rowId: string,
    columnId: string,
    editType: 'status' | 'cost' | 'specification'
  ): EditContext => {
    const item = data.find(d => d.id === rowId);
    let currentValue: any;

    if (item) {
      if (editType === 'status') {
        const timeHeader = columnId.replace('time_', '');
        const result = item.results[timeHeader];
        currentValue = result ? createStatusValue(result.planned, result.actual) : createStatusValue(false, false);
      } else if (editType === 'cost') {
        const timeHeader = columnId.replace('time_', '');
        const result = item.results[timeHeader];
        currentValue = {
          planCost: result?.planCost || 0,
          actualCost: result?.actualCost || 0,
        };
      } else if (editType === 'specification') {
        currentValue = item.specifications || [];
      } else {
        currentValue = item[columnId as keyof typeof item];
      }
    }

    return {
      deviceType: deviceDetection.type,
      editMode: editType,
      cellData: {
        rowId,
        columnId,
        currentValue,
        dataType: editType === 'specification' ? 'text' : editType,
      },
      onSave: (value: any) => {
        const validationResult = validateEdit(value, editType);
        if (validationResult.isValid) {
          updateEditValue(value);
          saveEdit();
        } else {
          validationResult.errors.forEach(onValidationError);
        }
      },
      onCancel: cancelEdit,
    };
  }, [data, deviceDetection.type, validateEdit, updateEditValue, saveEdit, cancelEdit, onValidationError]);

  // コンテキスト値
  const contextValue = useMemo(() => ({
    deviceDetection,
    editState,
    startCellEdit,
    updateEditValue,
    saveEdit,
    cancelEdit,
    validateEdit,
    createEditContext,
  }), [
    deviceDetection,
    editState,
    startCellEdit,
    updateEditValue,
    saveEdit,
    cancelEdit,
    validateEdit,
    createEditContext,
  ]);

  return (
    <CommonEditContext.Provider value={contextValue}>
      {children}
    </CommonEditContext.Provider>
  );
};

// コンテキストの作成
export const CommonEditContext = React.createContext<{
  deviceDetection: DeviceDetection;
  editState: EditState;
  startCellEdit: (rowId: string, columnId: string, editType: 'status' | 'cost' | 'specification') => void;
  updateEditValue: (value: any) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
  validateEdit: (value: any, editType: 'status' | 'cost' | 'specification') => ValidationResult;
  createEditContext: (rowId: string, columnId: string, editType: 'status' | 'cost' | 'specification') => EditContext;
} | null>(null);

// カスタムフック
export const useCommonEdit = () => {
  const context = React.useContext(CommonEditContext);
  if (!context) {
    throw new Error('useCommonEdit must be used within a CommonEditLogic provider');
  }
  return context;
};