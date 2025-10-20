import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn } from '../ExcelLikeGrid/types';
import { EditContext, DeviceDetection, TouchCapabilities } from '../CommonEdit/types';
import { detectDevice, setupDeviceChangeListener } from '../CommonEdit/deviceDetection';
import MaintenanceGridLayout from '../EnhancedMaintenanceGrid/MaintenanceGridLayout';
import TabletGridView from '../EnhancedMaintenanceGrid/TabletGridView';
import MobileGridView from '../EnhancedMaintenanceGrid/MobileGridView';
import { ResponsiveGridManagerProps, ResponsiveGridState, ResponsiveLayout } from './types';

/**
 * ResponsiveGridManager - デバイス検出とレイアウト選択の自動化を行う統合コンポーネント
 * 
 * 機能:
 * - デバイス検出とレイアウト選択の自動化
 * - 編集イベントの統一処理
 * - TouchCapabilitiesインターフェースに基づくタッチ機能検出
 */
export const ResponsiveGridManager: React.FC<ResponsiveGridManagerProps> = ({
  data,
  columns,
  timeHeaders,
  viewMode,
  displayMode,
  showBomCode,
  showCycle,
  onCellEdit,
  onSpecificationEdit,
  onColumnResize,
  onRowResize,
  onUpdateItem,
  virtualScrolling = false,
  readOnly = false,
  groupedData,
  className = '',
  // Performance options
  enablePerformanceOptimization = true,
  performanceThreshold = 1000,
  // Accessibility options
  enableAccessibility = true,
  // Custom responsive configuration
  customBreakpoints,
  forceLayout,
}) => {
  // State management
  const [gridState, setGridState] = useState<ResponsiveGridState>({
    currentLayout: 'desktop',
    editingCell: null,
    editDialog: {
      type: null,
      open: false,
      data: null,
    },
    touchCapabilities: {
      hasTouch: false,
      hasHover: true,
      hasPointerEvents: false,
      maxTouchPoints: 0,
    },
    deviceDetection: {
      type: 'desktop',
      screenSize: { width: 1920, height: 1080 },
      orientation: 'landscape',
      touchCapabilities: {
        hasTouch: false,
        hasHover: true,
        hasPointerEvents: false,
        maxTouchPoints: 0,
      },
      userAgent: navigator.userAgent,
    },
  });

  // Device detection and layout selection
  const updateDeviceDetection = useCallback((detection: DeviceDetection) => {
    setGridState(prev => ({
      ...prev,
      currentLayout: forceLayout || detection.type,
      touchCapabilities: detection.touchCapabilities,
      deviceDetection: detection,
    }));
  }, [forceLayout]);

  // Initialize device detection
  useEffect(() => {
    const initialDetection = detectDevice();
    updateDeviceDetection(initialDetection);

    // Set up device change listener
    const cleanup = setupDeviceChangeListener(updateDeviceDetection);

    return cleanup;
  }, [updateDeviceDetection]);

  // Generate responsive layout configuration
  const responsiveLayout = useMemo((): ResponsiveLayout => {
    const { deviceDetection } = gridState;
    
    return {
      isMobile: deviceDetection.type === 'mobile',
      isTablet: deviceDetection.type === 'tablet',
      isDesktop: deviceDetection.type === 'desktop',
      screenSize: deviceDetection.screenSize,
      orientation: deviceDetection.orientation,
      touchCapabilities: deviceDetection.touchCapabilities,
      breakpoints: customBreakpoints || {
        mobile: 768,
        tablet: 1024,
        desktop: 1200,
      },
      optimalTouchTargetSize: deviceDetection.type === 'mobile' ? 48 : 
                              deviceDetection.type === 'tablet' ? 44 : 32,
      optimalSpacing: deviceDetection.type === 'mobile' ? 16 : 
                      deviceDetection.type === 'tablet' ? 12 : 8,
    };
  }, [gridState.deviceDetection, customBreakpoints]);

  // Unified edit event processing
  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    if (readOnly) return;

    // Create edit context
    const editContext: EditContext = {
      deviceType: gridState.currentLayout,
      editMode: columnId.startsWith('spec_') ? 'specification' : 
                columnId.startsWith('time_') ? (viewMode === 'cost' ? 'cost' : 'status') : 'specification',
      cellData: {
        rowId,
        columnId,
        currentValue: value,
        dataType: columnId.startsWith('time_') ? (viewMode === 'cost' ? 'cost' : 'status') : 'text',
      },
      onSave: (newValue: any) => {
        // Handle save based on edit mode
        if (editContext.editMode === 'specification' && onSpecificationEdit) {
          const specKey = columnId.replace('spec_', '');
          const item = data.find(d => d.id === rowId);
          if (item) {
            const specIndex = item.specifications?.findIndex(s => s.key === specKey) ?? -1;
            onSpecificationEdit(rowId, specIndex >= 0 ? specIndex : 0, 'value', newValue);
          }
        } else if (onCellEdit) {
          onCellEdit(rowId, columnId, newValue);
        }
        
        // Close edit dialog
        setGridState(prev => ({
          ...prev,
          editDialog: { type: null, open: false, data: null },
          editingCell: null,
        }));
      },
      onCancel: () => {
        // Close edit dialog without saving
        setGridState(prev => ({
          ...prev,
          editDialog: { type: null, open: false, data: null },
          editingCell: null,
        }));
      },
    };

    // Determine if we need to show a dialog based on device type and edit mode
    const shouldShowDialog = (
      gridState.currentLayout !== 'desktop' || 
      editContext.editMode === 'specification' ||
      (editContext.editMode === 'cost' && gridState.currentLayout === 'mobile')
    );

    if (shouldShowDialog) {
      // Show appropriate edit dialog
      setGridState(prev => ({
        ...prev,
        editDialog: {
          type: editContext.editMode,
          open: true,
          data: editContext,
        },
        editingCell: { rowId, columnId },
      }));
    } else {
      // Direct inline editing (desktop only for simple cases)
      editContext.onSave(value);
    }
  }, [readOnly, gridState.currentLayout, viewMode, data, onCellEdit, onSpecificationEdit]);

  // Handle specification editing
  const handleSpecificationEdit = useCallback((rowId: string, specIndex: number, key: string, value: string) => {
    if (readOnly || !onSpecificationEdit) return;

    const editContext: EditContext = {
      deviceType: gridState.currentLayout,
      editMode: 'specification',
      cellData: {
        rowId,
        columnId: `spec_${key}`,
        currentValue: value,
        dataType: 'text',
      },
      onSave: (newValue: any) => {
        onSpecificationEdit(rowId, specIndex, key, newValue);
        setGridState(prev => ({
          ...prev,
          editDialog: { type: null, open: false, data: null },
          editingCell: null,
        }));
      },
      onCancel: () => {
        setGridState(prev => ({
          ...prev,
          editDialog: { type: null, open: false, data: null },
          editingCell: null,
        }));
      },
    };

    // Always show dialog for specification editing
    setGridState(prev => ({
      ...prev,
      editDialog: {
        type: 'specification',
        open: true,
        data: editContext,
      },
      editingCell: { rowId, columnId: `spec_${key}` },
    }));
  }, [readOnly, gridState.currentLayout, onSpecificationEdit]);

  // Performance optimization based on data size and device capabilities
  const shouldUseVirtualScrolling = useMemo(() => {
    if (!enablePerformanceOptimization) return virtualScrolling;
    
    const dataSize = data.length;
    const isLowPowerDevice = gridState.currentLayout === 'mobile';
    
    return virtualScrolling || 
           dataSize > performanceThreshold || 
           (isLowPowerDevice && dataSize > performanceThreshold / 2);
  }, [enablePerformanceOptimization, virtualScrolling, data.length, performanceThreshold, gridState.currentLayout]);

  // Render appropriate layout based on current device detection
  const renderLayout = () => {
    const commonProps = {
      data,
      timeHeaders,
      viewMode,
      showBomCode,
      showCycle,
      onCellEdit: handleCellEdit,
      onSpecificationEdit: handleSpecificationEdit,
      onColumnResize,
      onRowResize,
      onUpdateItem,
      virtualScrolling: shouldUseVirtualScrolling,
      readOnly,
      groupedData,
    };

    switch (gridState.currentLayout) {
      case 'mobile':
        return (
          <MobileGridView
            {...commonProps}
            responsive={responsiveLayout}
          />
        );
      
      case 'tablet':
        return (
          <TabletGridView
            {...commonProps}
            responsive={responsiveLayout}
          />
        );
      
      case 'desktop':
      default:
        return (
          <MaintenanceGridLayout
            {...commonProps}
            columns={columns}
            displayAreaConfig={{
              mode: displayMode,
              fixedColumns: ['task', ...(showBomCode ? ['bomCode'] : []), ...(showCycle ? ['cycle'] : [])],
              scrollableAreas: {
                specifications: {
                  visible: displayMode === 'specifications' || displayMode === 'both',
                  width: 0, // Will be calculated
                  columns: columns.filter(col => col.id.startsWith('spec_')).map(col => col.id),
                },
                maintenance: {
                  visible: displayMode === 'maintenance' || displayMode === 'both',
                  width: 0, // Will be calculated
                  columns: columns.filter(col => col.id.startsWith('time_')).map(col => col.id),
                },
              },
            }}
            gridState={{
              selectedCell: null,
              selectedRange: null,
              editingCell: gridState.editingCell,
              columnWidths: {},
              rowHeights: {},
              scrollPosition: { x: 0, y: 0 },
            }}
            onSelectedCellChange={() => {}}
            onEditingCellChange={(rowId, columnId) => {
              setGridState(prev => ({
                ...prev,
                editingCell: rowId && columnId ? { rowId, columnId } : null,
              }));
            }}
            onSelectedRangeChange={() => {}}
          />
        );
    }
  };

  return (
    <Box
      className={`responsive-grid-manager ${className} ${gridState.currentLayout}-layout`}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Device-specific optimizations
        ...(gridState.currentLayout === 'mobile' && {
          touchAction: 'manipulation', // Optimize touch performance
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        }),
        ...(gridState.touchCapabilities.hasTouch && {
          // Ensure touch targets are large enough
          '& button, & [role="button"]': {
            minHeight: responsiveLayout.optimalTouchTargetSize,
            minWidth: responsiveLayout.optimalTouchTargetSize,
          },
        }),
        // Accessibility enhancements
        ...(enableAccessibility && {
          '&:focus-within': {
            outline: '2px solid #1976d2',
            outlineOffset: '2px',
          },
        }),
      }}
      // Accessibility attributes
      role="grid"
      aria-label="レスポンシブメンテナンスグリッド"
      aria-readonly={readOnly}
      tabIndex={0}
    >
      {renderLayout()}
    </Box>
  );
};

export default ResponsiveGridManager;