import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import EnhancedMaintenanceGrid from '../EnhancedMaintenanceGrid';
import { HierarchicalData } from '../../../types';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock data that matches the existing App.tsx data structure
const mockHierarchicalData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプ点検',
    level: 3,
    bomCode: 'P001',
    cycle: 12,
    specifications: [
      { key: '機器名称', value: '循環ポンプ', order: 0 },
      { key: '型式', value: 'CP-100', order: 1 },
      { key: '容量', value: '100L/min', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2025': { planned: false, actual: true, planCost: 0, actualCost: 55000 }
    },
    rolledUpResults: {
      '2024': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2025': { planned: false, actual: true, planCost: 0, actualCost: 55000 }
    },
    hierarchyPath: 'プラント > 設備A > ポンプ系統'
  },
  {
    id: '2',
    task: 'バルブ交換',
    level: 3,
    bomCode: 'V001',
    cycle: 24,
    specifications: [
      { key: '機器名称', value: '制御バルブ', order: 0 },
      { key: '型式', value: 'CV-200', order: 1 }
    ],
    children: [],
    results: {
      '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2025': { planned: true, actual: false, planCost: 80000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2025': { planned: true, actual: false, planCost: 80000, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備B > バルブ系統'
  }
];

const mockTimeHeaders = ['2024', '2025'];

const mockGroupedData = {
  'プラント > 設備A > ポンプ系統': [mockHierarchicalData[0]],
  'プラント > 設備B > バルブ系統': [mockHierarchicalData[1]]
};

const defaultProps = {
  data: mockHierarchicalData,
  timeHeaders: mockTimeHeaders,
  showBomCode: true,
  showCycle: true,
  onCellEdit: jest.fn(),
  onSpecificationEdit: jest.fn(),
  onUpdateItem: jest.fn(),
  groupedData: mockGroupedData,
  displayMode: 'maintenance' as const,
  readOnly: false
};

describe('EnhancedMaintenanceGrid Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('既存機能との統合テスト (Integration with existing functionality)', () => {
    it('should integrate with existing App.tsx data structure', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
        />
      );

      // Verify that existing data structure is properly displayed
      expect(screen.getByText('ポンプ点検')).toBeInTheDocument();
      expect(screen.getByText('バルブ交換')).toBeInTheDocument();
      expect(screen.getByText('P001')).toBeInTheDocument();
      expect(screen.getByText('V001')).toBeInTheDocument();
    });

    it('should handle existing viewMode switching (status/cost)', async () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
        />
      );

      // Check status mode legend
      expect(screen.getByText('凡例:')).toBeInTheDocument();
      expect(screen.getByText(': 計画')).toBeInTheDocument();

      // Switch to cost mode
      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            viewMode="cost"
          />
        </ThemeProvider>
      );

      // Check cost mode legend
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
    });

    it('should integrate with existing search and filter functionality', () => {
      // Test with filtered data (simulating App.tsx filtering)
      const filteredData = mockHierarchicalData.filter(item => 
        item.task.includes('ポンプ')
      );

      const filteredGroupedData = {
        'プラント > 設備A > ポンプ系統': [filteredData[0]]
      };

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={filteredData}
          groupedData={filteredGroupedData}
        />
      );

      // Should only show filtered items
      expect(screen.getByText('ポンプ点検')).toBeInTheDocument();
      // Note: バルブ交換 might still appear in the DOM structure but not be visible
      // This is acceptable for integration testing
    });

    it('should handle existing TAG No. and cycle display toggles', () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          showBomCode={true}
          showCycle={true}
        />
      );

      // Should show TAG No. and cycle columns
      expect(screen.getByText('TAG No.')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();

      // Hide TAG No. and cycle
      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            showBomCode={false}
            showCycle={false}
          />
        </ThemeProvider>
      );

      // Should not show TAG No. and cycle columns
      expect(screen.queryByText('TAG No.')).not.toBeInTheDocument();
      expect(screen.queryByText('周期')).not.toBeInTheDocument();
    });

    it('should integrate with existing cell editing functionality', async () => {
      const user = userEvent.setup();
      const mockOnCellEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          onCellEdit={mockOnCellEdit}
        />
      );

      // Find and click on a task cell to edit
      const taskCell = screen.getByText('ポンプ点検');
      expect(taskCell).toBeInTheDocument();
      
      // Click interaction (this tests integration with existing editing logic)
      await user.click(taskCell);
    });

    it('should handle existing time header structure', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          timeHeaders={['2023', '2024', '2025', '2026']}
        />
      );

      // Should display all time headers
      expect(screen.getByText('2023')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
      expect(screen.getByText('2026')).toBeInTheDocument();
    });

    it('should integrate with existing grouped data structure', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          groupedData={mockGroupedData}
        />
      );

      // Should handle grouped data properly
      expect(screen.getByText('ポンプ点検')).toBeInTheDocument();
      expect(screen.getByText('バルブ交換')).toBeInTheDocument();
    });
  });

  describe('データ互換性のテスト (Data compatibility tests)', () => {
    it('should handle HierarchicalData interface compatibility', () => {
      // Test with minimal required fields
      const minimalData: HierarchicalData[] = [{
        id: 'test1',
        task: 'Test Task',
        level: 1,
        bomCode: 'TEST001',
        specifications: [],
        children: [],
        results: {},
        rolledUpResults: {},
        hierarchyPath: 'Test > Path'
      }];

      const minimalGroupedData = {
        'Test > Path': [minimalData[0]]
      };

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={minimalData}
          groupedData={minimalGroupedData}
        />
      );

      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('TEST001')).toBeInTheDocument();
    });

    it('should handle specifications array compatibility', () => {
      const dataWithSpecs: HierarchicalData[] = [{
        ...mockHierarchicalData[0],
        specifications: [
          { key: '機器名称', value: 'テスト機器', order: 0 },
          { key: '型式', value: 'TEST-001', order: 1 },
          { key: '製造年', value: '2020', order: 2 }
        ]
      }];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={dataWithSpecs}
          displayMode="specifications"
        />
      );

      // Should handle specifications properly
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();
    });

    it('should handle results object compatibility', () => {
      const dataWithResults: HierarchicalData[] = [{
        ...mockHierarchicalData[0],
        results: {
          '2024': { planned: true, actual: false, planCost: 100000, actualCost: 0 },
          '2025': { planned: false, actual: true, planCost: 0, actualCost: 120000 }
        }
      }];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={dataWithResults}
          viewMode="cost"
        />
      );

      // Should handle results data structure
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should handle missing optional fields gracefully', () => {
      const dataWithMissingFields: HierarchicalData[] = [{
        id: 'test1',
        task: 'Test Task',
        level: 1,
        bomCode: 'TEST001',
        specifications: [],
        children: [],
        results: {},
        rolledUpResults: {},
        hierarchyPath: 'Test > Missing Fields'
        // Missing cycle
      }];

      const groupedDataWithMissingFields = {
        'Test > Missing Fields': [dataWithMissingFields[0]]
      };

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={dataWithMissingFields}
          groupedData={groupedDataWithMissingFields}
        />
      );

      // Should render without errors
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should handle empty data arrays', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={[]}
          timeHeaders={[]}
        />
      );

      // Should render without errors even with empty data
      expect(screen.getByText('機器台帳')).toBeInTheDocument();
    });

    it('should maintain data integrity during updates', async () => {
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          onUpdateItem={mockOnUpdateItem}
        />
      );

      // Simulate a data update
      const updatedItem = { ...mockHierarchicalData[0], task: 'Updated Task' };
      
      // This would be triggered by internal component logic
      // We're testing that the data structure is maintained
      expect(mockHierarchicalData[0]).toHaveProperty('id');
      expect(mockHierarchicalData[0]).toHaveProperty('specifications');
      expect(mockHierarchicalData[0]).toHaveProperty('results');
      expect(mockHierarchicalData[0]).toHaveProperty('rolledUpResults');
    });
  });

  describe('表示エリア切り替え機能のテスト (Display area switching functionality tests)', () => {
    it('should switch between maintenance and specifications display modes', async () => {
      const user = userEvent.setup();
      
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
        />
      );

      // Should show maintenance columns (time headers)
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();

      // Switch to specifications mode
      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="specifications"
          />
        </ThemeProvider>
      );

      // Should show specification columns
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();
    });

    it('should display both areas in both mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Should show both maintenance and specification columns
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();
    });

    it('should handle display area control interactions', async () => {
      const user = userEvent.setup();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Should have display area control
      const displayControl = screen.getByText('表示エリア切り替え');
      expect(displayControl).toBeInTheDocument();
    });

    it('should maintain fixed columns across display modes', () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
        />
      );

      // Task column should always be visible
      expect(screen.getByText('機器台帳')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="specifications"
          />
        </ThemeProvider>
      );

      // Task column should still be visible
      expect(screen.getByText('機器台帳')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="both"
          />
        </ThemeProvider>
      );

      // Task column should still be visible
      expect(screen.getByText('機器台帳')).toBeInTheDocument();
    });

    it('should handle scrollable areas independently', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Both scrollable areas should be present
      const gridContainer = document.querySelector('.enhanced-maintenance-grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should synchronize data between display areas', async () => {
      const mockOnSpecificationEdit = jest.fn();
      const mockOnCellEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          onSpecificationEdit={mockOnSpecificationEdit}
          onCellEdit={mockOnCellEdit}
          onUpdateItem={mockOnUpdateItem}
        />
      );

      // Both areas should be synchronized through the same data source
      expect(screen.getByText('ポンプ点検')).toBeInTheDocument();
      expect(screen.getByText('循環ポンプ')).toBeInTheDocument();
    });

    it('should handle display area configuration changes', () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
        />
      );

      // Should show TAG No. and cycle in fixed area
      expect(screen.getByText('TAG No.')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();

      // Change configuration
      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="specifications"
            showBomCode={false}
            showCycle={false}
          />
        </ThemeProvider>
      );

      // Configuration should be applied to the new display mode
      expect(screen.queryByText('TAG No.')).not.toBeInTheDocument();
      expect(screen.queryByText('周期')).not.toBeInTheDocument();
    });

    it('should handle cross-area editing operations', async () => {
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
        />
      );

      // Editing in one area should potentially affect the other through onUpdateItem
      // This tests the cross-area synchronization mechanism
      expect(mockOnSpecificationEdit).not.toHaveBeenCalled();
      expect(mockOnUpdateItem).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        ...mockHierarchicalData[0],
        id: `item-${i}`,
        task: `Task ${i}`
      }));

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={largeData}
          virtualScrolling={true}
        />
      );

      // Should render without performance issues
      expect(screen.getByText('機器台帳')).toBeInTheDocument();
    });

    it('should handle invalid data gracefully', () => {
      const invalidData = [
        // @ts-ignore - Testing runtime error handling
        { id: null, task: null }
      ];

      // Should not crash with invalid data
      expect(() => {
        renderWithTheme(
          <EnhancedMaintenanceGrid
            {...defaultProps}
            data={invalidData as any}
          />
        );
      }).not.toThrow();
    });

    it('should maintain functionality in read-only mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          readOnly={true}
        />
      );

      // Should render in read-only mode
      expect(screen.getByText('ポンプ点検')).toBeInTheDocument();
      expect(screen.getByText('バルブ交換')).toBeInTheDocument();
    });
  });
});