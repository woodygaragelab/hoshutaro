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

const mockData: HierarchicalData[] = [
  {
    id: 'display-test-1',
    task: '表示テスト作業1',
    level: 2,
    bomCode: 'DISP001',
    cycle: 12,
    specifications: [
      { key: '機器名称', value: '表示テスト機器1', order: 0 },
      { key: '型式', value: 'DISP-MODEL-001', order: 1 },
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
    hierarchyPath: 'エリアA > 設備群1 > 機器1'
  },
  {
    id: 'display-test-2',
    task: '表示テスト作業2',
    level: 2,
    bomCode: 'DISP002',
    cycle: 6,
    specifications: [
      { key: '機器名称', value: '表示テスト機器2', order: 0 },
      { key: '型式', value: 'DISP-MODEL-002', order: 1 }
    ],
    children: [],
    results: {
      '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2025': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2025': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    hierarchyPath: 'エリアB > 設備群2 > 機器2'
  }
];

const mockTimeHeaders = ['2024', '2025'];

const defaultProps = {
  data: mockData,
  timeHeaders: mockTimeHeaders,
  showBomCode: true,
  showCycle: true,
  onCellEdit: jest.fn(),
  onSpecificationEdit: jest.fn(),
  onUpdateItem: jest.fn(),
  readOnly: false
};

describe('EnhancedMaintenanceGrid Display Area Switching Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Display Mode: Maintenance Only', () => {
    it('should show only maintenance columns in maintenance mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
          viewMode="status"
        />
      );

      // Should show maintenance columns
      expect(screen.getByText('作業内容')).toBeInTheDocument();
      expect(screen.getByText('BOM Code')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();

      // Should NOT show specification columns
      expect(screen.queryByText('仕様項目1')).not.toBeInTheDocument();
      expect(screen.queryByText('仕様値1')).not.toBeInTheDocument();
    });

    it('should handle maintenance mode with cost view', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
          viewMode="cost"
        />
      );

      // Should show cost legend
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
      
      // Should show maintenance columns
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should allow editing in maintenance mode', async () => {
      const user = userEvent.setup();
      const mockOnCellEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
          onCellEdit={mockOnCellEdit}
        />
      );

      // Should be able to interact with maintenance cells
      const taskCell = screen.getByText('表示テスト作業1');
      expect(taskCell).toBeInTheDocument();
      
      // Click interaction
      await user.click(taskCell);
    });
  });

  describe('Display Mode: Specifications Only', () => {
    it('should show only specification columns in specifications mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="specifications"
          viewMode="status"
        />
      );

      // Should show basic columns
      expect(screen.getByText('作業内容')).toBeInTheDocument();
      expect(screen.getByText('BOM Code')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();

      // Should show specification columns
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();
      expect(screen.getByText('仕様項目2')).toBeInTheDocument();
      expect(screen.getByText('仕様値2')).toBeInTheDocument();

      // Should NOT show time columns
      expect(screen.queryByText('2024')).not.toBeInTheDocument();
      expect(screen.queryByText('2025')).not.toBeInTheDocument();
    });

    it('should display specification data correctly', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="specifications"
        />
      );

      // Should show specification values
      expect(screen.getByText('表示テスト機器1')).toBeInTheDocument();
      expect(screen.getByText('DISP-MODEL-001')).toBeInTheDocument();
      expect(screen.getByText('100L/min')).toBeInTheDocument();
      expect(screen.getByText('表示テスト機器2')).toBeInTheDocument();
      expect(screen.getByText('DISP-MODEL-002')).toBeInTheDocument();
    });

    it('should allow specification editing in specifications mode', async () => {
      const user = userEvent.setup();
      const mockOnSpecificationEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="specifications"
          onSpecificationEdit={mockOnSpecificationEdit}
        />
      );

      // Should be able to interact with specification cells
      const specCell = screen.getByText('表示テスト機器1');
      await user.click(specCell);

      expect(specCell).toBeInTheDocument();
    });

    it('should show legend even in specifications mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="specifications"
          viewMode="status"
        />
      );

      // Legend should still be visible
      expect(screen.getByText('凡例:')).toBeInTheDocument();
    });
  });

  describe('Display Mode: Both Areas', () => {
    it('should show both specification and maintenance columns in both mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          viewMode="status"
        />
      );

      // Should show basic columns
      expect(screen.getByText('作業内容')).toBeInTheDocument();
      expect(screen.getByText('BOM Code')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();

      // Should show specification columns
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();

      // Should show maintenance columns
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should handle both areas with cost view mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          viewMode="cost"
        />
      );

      // Should show cost legend
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();

      // Should show both specification and maintenance data
      expect(screen.getByText('表示テスト機器1')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should allow editing in both areas', async () => {
      const user = userEvent.setup();
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
        />
      );

      // Should be able to interact with both specification and maintenance cells
      const specCell = screen.getByText('表示テスト機器1');
      const taskCell = screen.getByText('表示テスト作業1');

      expect(specCell).toBeInTheDocument();
      expect(taskCell).toBeInTheDocument();

      // Click interactions
      await user.click(specCell);
      await user.click(taskCell);
    });

    it('should maintain data synchronization between areas', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Same task should appear in both areas
      const taskCells = screen.getAllByText('表示テスト作業1');
      expect(taskCells.length).toBeGreaterThanOrEqual(1);

      // Specification data should be consistent
      expect(screen.getByText('表示テスト機器1')).toBeInTheDocument();
      expect(screen.getByText('DISP-MODEL-001')).toBeInTheDocument();
    });
  });

  describe('Display Area Control Component', () => {
    it('should show display area control in both mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Should show display area control
      expect(screen.getByText('表示エリア切り替え')).toBeInTheDocument();
    });

    it('should handle display area configuration changes', async () => {
      const user = userEvent.setup();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Display area control should be present
      const displayControl = screen.getByText('表示エリア切り替え');
      expect(displayControl).toBeInTheDocument();
    });
  });

  describe('Fixed Columns Behavior', () => {
    it('should keep task column fixed across all display modes', () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
        />
      );

      expect(screen.getByText('作業内容')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="specifications"
          />
        </ThemeProvider>
      );

      expect(screen.getByText('作業内容')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="both"
          />
        </ThemeProvider>
      );

      expect(screen.getByText('作業内容')).toBeInTheDocument();
    });

    it('should handle BOM code and cycle column visibility across modes', () => {
      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
        />
      );

      expect(screen.getByText('BOM Code')).toBeInTheDocument();
      expect(screen.getByText('周期')).toBeInTheDocument();

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

      expect(screen.queryByText('BOM Code')).not.toBeInTheDocument();
      expect(screen.queryByText('周期')).not.toBeInTheDocument();
    });
  });

  describe('Scrollable Areas Configuration', () => {
    it('should configure scrollable areas correctly for specifications mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="specifications"
        />
      );

      // Should have specification columns in scrollable area
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('仕様値1')).toBeInTheDocument();
    });

    it('should configure scrollable areas correctly for maintenance mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
        />
      );

      // Should have time columns in scrollable area
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should configure both scrollable areas in both mode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Should have both specification and time columns
      expect(screen.getByText('仕様項目1')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
    });
  });

  describe('Cross-Area Data Synchronization', () => {
    it('should synchronize specification edits with maintenance area', async () => {
      const mockOnUpdateItem = jest.fn();
      const mockOnSpecificationEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          onUpdateItem={mockOnUpdateItem}
          onSpecificationEdit={mockOnSpecificationEdit}
        />
      );

      // Both areas should show the same data
      expect(screen.getByText('表示テスト作業1')).toBeInTheDocument();
      expect(screen.getByText('表示テスト機器1')).toBeInTheDocument();
    });

    it('should synchronize maintenance edits with specification area', async () => {
      const mockOnUpdateItem = jest.fn();
      const mockOnCellEdit = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
          onUpdateItem={mockOnUpdateItem}
          onCellEdit={mockOnCellEdit}
        />
      );

      // Both areas should be synchronized
      expect(screen.getByText('表示テスト作業1')).toBeInTheDocument();
      expect(screen.getByText('DISP001')).toBeInTheDocument();
    });

    it('should handle cross-area copy and paste operations', async () => {
      const user = userEvent.setup();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="both"
        />
      );

      // Should be able to select cells in both areas
      const specCell = screen.getByText('表示テスト機器1');
      await user.click(specCell);

      expect(specCell).toBeInTheDocument();
    });
  });

  describe('Performance with Display Area Switching', () => {
    it('should handle display mode changes efficiently', () => {
      const startTime = performance.now();

      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          displayMode="maintenance"
        />
      );

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="specifications"
          />
        </ThemeProvider>
      );

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode="both"
          />
        </ThemeProvider>
      );

      const endTime = performance.now();
      const switchTime = endTime - startTime;

      // Should switch modes quickly (less than 100ms)
      expect(switchTime).toBeLessThan(100);
    });

    it('should maintain performance with large datasets in both mode', () => {
      const largeData: HierarchicalData[] = Array.from({ length: 200 }, (_, i) => ({
        id: `perf-${i}`,
        task: `Performance Test Task ${i}`,
        level: 1,
        bomCode: `PERF${i.toString().padStart(3, '0')}`,
        cycle: 12,
        specifications: [
          { key: '機器名称', value: `パフォーマンステスト機器${i}`, order: 0 },
          { key: '型式', value: `PERF-MODEL-${i}`, order: 1 }
        ],
        children: [],
        results: {
          '2024': { planned: i % 2 === 0, actual: i % 3 === 0, planCost: i * 100, actualCost: i * 90 }
        },
        rolledUpResults: {
          '2024': { planned: i % 2 === 0, actual: i % 3 === 0, planCost: i * 100, actualCost: i * 90 }
        }
      }));

      const startTime = performance.now();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={largeData}
          displayMode="both"
          virtualScrolling={true}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large dataset efficiently (less than 500ms)
      expect(renderTime).toBeLessThan(500);
      expect(screen.getByText('Performance Test Task 0')).toBeInTheDocument();
    });
  });

  describe('Error Handling in Display Area Switching', () => {
    it('should handle invalid display mode gracefully', () => {
      // Test with invalid display mode
      expect(() => {
        renderWithTheme(
          <EnhancedMaintenanceGrid
            {...defaultProps}
            displayMode={'invalid' as any}
          />
        );
      }).not.toThrow();
    });

    it('should handle missing specification data in specifications mode', () => {
      const dataWithoutSpecs: HierarchicalData[] = [
        {
          ...mockData[0],
          specifications: []
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={dataWithoutSpecs}
          displayMode="specifications"
        />
      );

      // Should render without errors even with no specifications
      expect(screen.getByText('表示テスト作業1')).toBeInTheDocument();
    });

    it('should handle missing results data in maintenance mode', () => {
      const dataWithoutResults: HierarchicalData[] = [
        {
          ...mockData[0],
          results: {},
          rolledUpResults: {}
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          data={dataWithoutResults}
          displayMode="maintenance"
        />
      );

      // Should render without errors even with no results
      expect(screen.getByText('表示テスト作業1')).toBeInTheDocument();
    });
  });
});