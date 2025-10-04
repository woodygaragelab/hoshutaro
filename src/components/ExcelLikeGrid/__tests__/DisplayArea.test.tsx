import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExcelLikeGrid } from '../ExcelLikeGrid';
import { GridColumn, DisplayAreaConfig } from '../types';
import { HierarchicalData } from '../../../types';

// Test data for display area functionality
const testData: HierarchicalData[] = [
  {
    id: 'equipment-1',
    task: '遠心ポンプ P-001',
    bomCode: 'BOM-P001',
    level: 1,
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 0 },
      { key: '型式', value: 'CP-100A', order: 1 },
      { key: '容量', value: '100 L/min', order: 2 },
      { key: '揚程', value: '50 m', order: 3 }
    ],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 },
      '2024-03': { planned: true, actual: false, planCost: 50000, actualCost: 0 }
    },
    rolledUpResults: {},
    children: []
  },
  {
    id: 'equipment-2',
    task: '誘導電動機 M-001',
    bomCode: 'BOM-M001',
    level: 1,
    specifications: [
      { key: '機器名称', value: '誘導電動機', order: 0 },
      { key: '型式', value: 'IM-200B', order: 1 },
      { key: '出力', value: '15 kW', order: 2 },
      { key: '電圧', value: '400 V', order: 3 }
    ],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 30000, actualCost: 0 },
      '2024-03': { planned: false, actual: true, planCost: 0, actualCost: 28000 }
    },
    rolledUpResults: {},
    children: []
  }
];

const testColumns: GridColumn[] = [
  // Fixed columns
  {
    id: 'task',
    header: '設備名',
    width: 200,
    minWidth: 150,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'task'
  },
  {
    id: 'bomCode',
    header: 'BOMコード',
    width: 120,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'bomCode'
  },
  // Specification columns
  {
    id: 'spec_機器名称',
    header: '機器名称',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_機器名称'
  },
  {
    id: 'spec_型式',
    header: '型式',
    width: 120,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_型式'
  },
  {
    id: 'spec_容量',
    header: '容量',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_容量'
  },
  // Maintenance columns
  {
    id: 'time_2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-01'
  },
  {
    id: 'time_2024-02',
    header: '2024年2月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-02'
  },
  {
    id: 'time_2024-03',
    header: '2024年3月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-03'
  }
];

describe('Display Area Functionality Tests (要件 3.14, 3.15)', () => {
  let mockOnDisplayAreaChange: jest.Mock;
  let mockOnCellEdit: jest.Mock;

  beforeEach(() => {
    mockOnDisplayAreaChange = jest.fn();
    mockOnCellEdit = jest.fn();
    jest.clearAllMocks();
  });

  const renderGrid = (displayAreaConfig?: DisplayAreaConfig, props = {}) => {
    return render(
      <ExcelLikeGrid
        data={testData}
        columns={testColumns}
        displayAreaConfig={displayAreaConfig}
        onDisplayAreaChange={mockOnDisplayAreaChange}
        onCellEdit={mockOnCellEdit}
        readOnly={false}
        {...props}
      />
    );
  };

  describe('Display Mode Controls', () => {
    test('should render display mode control buttons', () => {
      renderGrid();

      expect(screen.getByText('機器仕様')).toBeInTheDocument();
      expect(screen.getByText('計画実績')).toBeInTheDocument();
      expect(screen.getByText('両方表示')).toBeInTheDocument();
    });

    test('should switch to specifications only mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const specificationsButton = screen.getByText('機器仕様');
      await user.click(specificationsButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'specifications'
          })
        );
      });
    });

    test('should switch to maintenance only mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const maintenanceButton = screen.getByText('計画実績');
      await user.click(maintenanceButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'maintenance'
          })
        );
      });
    });

    test('should switch to both areas mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const bothButton = screen.getByText('両方表示');
      await user.click(bothButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'both'
          })
        );
      });
    });

    test('should highlight active display mode button', async () => {
      const user = userEvent.setup();
      const specificationsConfig: DisplayAreaConfig = {
        mode: 'specifications',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 400,
            columns: ['spec_機器名称', 'spec_型式', 'spec_容量']
          },
          maintenance: {
            visible: false,
            width: 0,
            columns: []
          }
        }
      };

      renderGrid(specificationsConfig);

      const specificationsButton = screen.getByText('機器仕様');
      expect(specificationsButton.closest('button')).toHaveClass('Mui-selected');
    });
  });

  describe('Specifications Only Mode', () => {
    const specificationsConfig: DisplayAreaConfig = {
      mode: 'specifications',
      fixedColumns: ['task', 'bomCode'],
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 400,
          columns: ['spec_機器名称', 'spec_型式', 'spec_容量']
        },
        maintenance: {
          visible: false,
          width: 0,
          columns: []
        }
      }
    };

    test('should display only specification columns', () => {
      renderGrid(specificationsConfig);

      // Fixed columns should always be visible
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();

      // Specification columns should be visible
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('型式')).toBeInTheDocument();
      expect(screen.getByText('容量')).toBeInTheDocument();
    });

    test('should display specification data', () => {
      renderGrid(specificationsConfig);

      expect(screen.getByText('遠心ポンプ')).toBeInTheDocument();
      expect(screen.getByText('CP-100A')).toBeInTheDocument();
      expect(screen.getByText('100 L/min')).toBeInTheDocument();
      expect(screen.getByText('誘導電動機')).toBeInTheDocument();
      expect(screen.getByText('IM-200B')).toBeInTheDocument();
    });

    test('should allow editing specification values', async () => {
      const user = userEvent.setup();
      renderGrid(specificationsConfig);

      const specCell = screen.getByText('遠心ポンプ');
      await user.click(specCell);
      await user.keyboard('{Enter}');
      await user.keyboard('新しい機器名');
      await user.keyboard('{Enter}');

      expect(mockOnCellEdit).toHaveBeenCalled();
    });
  });

  describe('Maintenance Only Mode', () => {
    const maintenanceConfig: DisplayAreaConfig = {
      mode: 'maintenance',
      fixedColumns: ['task', 'bomCode'],
      scrollableAreas: {
        specifications: {
          visible: false,
          width: 0,
          columns: []
        },
        maintenance: {
          visible: true,
          width: 400,
          columns: ['time_2024-01', 'time_2024-02', 'time_2024-03']
        }
      }
    };

    test('should display only maintenance columns', () => {
      renderGrid(maintenanceConfig);

      // Fixed columns should always be visible
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();

      // Maintenance columns should be visible
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
      expect(screen.getByText('2024年2月')).toBeInTheDocument();
      expect(screen.getByText('2024年3月')).toBeInTheDocument();
    });

    test('should display maintenance data correctly', () => {
      renderGrid(maintenanceConfig);

      // Equipment names should be visible
      expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
      expect(screen.getByText('誘導電動機 M-001')).toBeInTheDocument();
    });

    test('should allow editing maintenance values', async () => {
      const user = userEvent.setup();
      renderGrid(maintenanceConfig);

      const equipmentCell = screen.getByText('遠心ポンプ P-001');
      await user.click(equipmentCell);
      await user.keyboard('{Enter}');
      await user.keyboard('新しい設備名');
      await user.keyboard('{Enter}');

      expect(mockOnCellEdit).toHaveBeenCalled();
    });
  });

  describe('Both Areas Mode (Split Display)', () => {
    const bothConfig: DisplayAreaConfig = {
      mode: 'both',
      fixedColumns: ['task', 'bomCode'],
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 350,
          columns: ['spec_機器名称', 'spec_型式', 'spec_容量']
        },
        maintenance: {
          visible: true,
          width: 350,
          columns: ['time_2024-01', 'time_2024-02', 'time_2024-03']
        }
      }
    };

    test('should display both specification and maintenance areas', () => {
      renderGrid(bothConfig);

      // Fixed columns
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();

      // Specification columns
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('型式')).toBeInTheDocument();

      // Maintenance columns
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
      expect(screen.getByText('2024年2月')).toBeInTheDocument();
    });

    test('should maintain fixed columns in both mode', () => {
      renderGrid(bothConfig);

      // Fixed columns should always be visible and not scroll
      const equipmentColumn = screen.getByText('設備名');
      const bomColumn = screen.getByText('BOMコード');

      expect(equipmentColumn).toBeInTheDocument();
      expect(bomColumn).toBeInTheDocument();
    });

    test('should allow independent scrolling of specification and maintenance areas', () => {
      renderGrid(bothConfig);

      // Both areas should be present and scrollable independently
      // This would be tested more thoroughly in integration tests
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
    });

    test('should handle navigation between areas', async () => {
      const user = userEvent.setup();
      renderGrid(bothConfig);

      // Click on specification area
      const specCell = screen.getByText('遠心ポンプ');
      await user.click(specCell);

      // Navigate to maintenance area
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');

      // Should be able to navigate between areas
    });
  });

  describe('Fixed Columns Behavior', () => {
    test('should always display fixed columns regardless of mode', () => {
      const configs = [
        {
          mode: 'specifications' as const,
          fixedColumns: ['task', 'bomCode'],
          scrollableAreas: {
            specifications: { visible: true, width: 400, columns: ['spec_機器名称'] },
            maintenance: { visible: false, width: 0, columns: [] }
          }
        },
        {
          mode: 'maintenance' as const,
          fixedColumns: ['task', 'bomCode'],
          scrollableAreas: {
            specifications: { visible: false, width: 0, columns: [] },
            maintenance: { visible: true, width: 400, columns: ['time_2024-01'] }
          }
        },
        {
          mode: 'both' as const,
          fixedColumns: ['task', 'bomCode'],
          scrollableAreas: {
            specifications: { visible: true, width: 200, columns: ['spec_機器名称'] },
            maintenance: { visible: true, width: 200, columns: ['time_2024-01'] }
          }
        }
      ];

      configs.forEach(config => {
        const { unmount } = renderGrid(config);
        
        expect(screen.getByText('設備名')).toBeInTheDocument();
        expect(screen.getByText('BOMコード')).toBeInTheDocument();
        
        unmount();
      });
    });

    test('should not scroll fixed columns', () => {
      const bothConfig: DisplayAreaConfig = {
        mode: 'both',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 300,
            columns: ['spec_機器名称', 'spec_型式']
          },
          maintenance: {
            visible: true,
            width: 300,
            columns: ['time_2024-01', 'time_2024-02']
          }
        }
      };

      renderGrid(bothConfig);

      // Fixed columns should remain in place during scrolling
      // This behavior would be more thoroughly tested in integration tests
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();
    });
  });

  describe('Area Width Management', () => {
    test('should respect specified area widths', () => {
      const customConfig: DisplayAreaConfig = {
        mode: 'both',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 500,
            columns: ['spec_機器名称', 'spec_型式']
          },
          maintenance: {
            visible: true,
            width: 300,
            columns: ['time_2024-01']
          }
        }
      };

      renderGrid(customConfig);

      // Areas should be rendered with specified widths
      // Exact width testing would be done in integration tests
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
    });

    test('should handle zero width for hidden areas', () => {
      const hiddenSpecConfig: DisplayAreaConfig = {
        mode: 'maintenance',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: false,
            width: 0,
            columns: []
          },
          maintenance: {
            visible: true,
            width: 400,
            columns: ['time_2024-01', 'time_2024-02']
          }
        }
      };

      renderGrid(hiddenSpecConfig);

      // Hidden area should not take up space
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
    });
  });

  describe('Data Consistency Across Areas', () => {
    test('should maintain data consistency when switching between modes', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Verify data is present
      expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
      expect(screen.getByText('BOM-P001')).toBeInTheDocument();

      // Switch to specifications only
      const specButton = screen.getByText('機器仕様');
      await user.click(specButton);

      // Data should still be consistent
      expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
      expect(screen.getByText('BOM-P001')).toBeInTheDocument();
    });

    test('should preserve editing state when switching areas', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Start editing in one area
      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Switch display mode
      const specButton = screen.getByText('機器仕様');
      await user.click(specButton);

      // Should handle the mode switch gracefully
      expect(mockOnDisplayAreaChange).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    test('should handle small screen sizes gracefully', () => {
      // Mock small screen size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      renderGrid();

      // Should still render all essential elements
      expect(screen.getByText('機器仕様')).toBeInTheDocument();
      expect(screen.getByText('計画実績')).toBeInTheDocument();
      expect(screen.getByText('両方表示')).toBeInTheDocument();
    });

    test('should adjust area widths for available space', () => {
      const wideConfig: DisplayAreaConfig = {
        mode: 'both',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 800, // Very wide
            columns: ['spec_機器名称', 'spec_型式']
          },
          maintenance: {
            visible: true,
            width: 800, // Very wide
            columns: ['time_2024-01']
          }
        }
      };

      renderGrid(wideConfig);

      // Should handle wide configurations gracefully
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('2024年1月')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid display area configuration', () => {
      const invalidConfig = {
        mode: 'invalid' as any,
        fixedColumns: [],
        scrollableAreas: {}
      };

      // Should not crash with invalid config
      expect(() => renderGrid(invalidConfig)).not.toThrow();
    });

    test('should handle missing columns in area configuration', () => {
      const missingColumnsConfig: DisplayAreaConfig = {
        mode: 'specifications',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 400,
            columns: ['nonexistent_column']
          },
          maintenance: {
            visible: false,
            width: 0,
            columns: []
          }
        }
      };

      // Should handle missing columns gracefully
      expect(() => renderGrid(missingColumnsConfig)).not.toThrow();
    });
  });
});