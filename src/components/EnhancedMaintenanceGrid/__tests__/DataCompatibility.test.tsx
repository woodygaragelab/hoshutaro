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

describe('EnhancedMaintenanceGrid Data Compatibility Tests', () => {
  describe('Legacy Data Structure Compatibility', () => {
    it('should handle data from original App.tsx structure', () => {
      // Simulate data structure from the original App.tsx
      const legacyData: HierarchicalData[] = [
        {
          id: 'legacy-1',
          task: 'Legacy Task 1',
          level: 2,
          bomCode: 'LEG001',
          cycle: 6,
          specifications: [
            { key: 'Name', value: 'Legacy Equipment', order: 0 }
          ],
          children: [],
          results: {
            '2024': { planned: true, actual: false, planCost: 10000, actualCost: 0 }
          },
          rolledUpResults: {
            '2024': { planned: true, actual: false, planCost: 10000, actualCost: 0 }
          },
          hierarchyPath: 'Root > Level1 > Level2'
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={legacyData}
          timeHeaders={['2024']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByText('Legacy Task 1')).toBeInTheDocument();
      expect(screen.getByText('LEG001')).toBeInTheDocument();
    });

    it('should handle transformed data from dataTransformer utility', () => {
      // Simulate data that would come from transformData function
      const transformedData: HierarchicalData[] = [
        {
          id: 'transformed-1',
          task: 'Transformed Task',
          level: 3,
          bomCode: 'TRANS001',
          cycle: 12,
          specifications: [
            { key: '機器名称', value: '変換済み機器', order: 0 },
            { key: '型式', value: 'TRANS-MODEL', order: 1 }
          ],
          children: [],
          results: {
            '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
            '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
          },
          rolledUpResults: {
            '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
            '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
          },
          hierarchyPath: 'プラント > エリアA > 設備群1'
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={transformedData}
          timeHeaders={['2024-01', '2024-02']}
          viewMode="cost"
          displayMode="both"
          showBomCode={true}
          showCycle={true}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByText('Transformed Task')).toBeInTheDocument();
      expect(screen.getByText('変換済み機器')).toBeInTheDocument();
      expect(screen.getByText('2024-01')).toBeInTheDocument();
      expect(screen.getByText('2024-02')).toBeInTheDocument();
    });

    it('should handle different time scale formats', () => {
      const data: HierarchicalData[] = [
        {
          id: 'time-test-1',
          task: 'Time Scale Test',
          level: 1,
          bomCode: 'TIME001',
          specifications: [],
          children: [],
          results: {
            // Year format
            '2024': { planned: true, actual: false, planCost: 1000, actualCost: 0 },
            // Month format
            '2024-01': { planned: false, actual: true, planCost: 0, actualCost: 1200 },
            // Week format
            '2024-W01': { planned: true, actual: true, planCost: 500, actualCost: 600 },
            // Day format
            '2024-01-01': { planned: false, actual: false, planCost: 0, actualCost: 0 }
          },
          rolledUpResults: {
            '2024': { planned: true, actual: false, planCost: 1000, actualCost: 0 },
            '2024-01': { planned: false, actual: true, planCost: 0, actualCost: 1200 },
            '2024-W01': { planned: true, actual: true, planCost: 500, actualCost: 600 },
            '2024-01-01': { planned: false, actual: false, planCost: 0, actualCost: 0 }
          }
        }
      ];

      const timeHeaders = ['2024', '2024-01', '2024-W01', '2024-01-01'];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={data}
          timeHeaders={timeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      // All time formats should be displayed
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2024-01')).toBeInTheDocument();
      expect(screen.getByText('2024-W01')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });
  });

  describe('Specification Data Compatibility', () => {
    it('should handle varying specification array lengths', () => {
      const dataWithVaryingSpecs: HierarchicalData[] = [
        {
          id: 'spec-1',
          task: 'Task with many specs',
          level: 1,
          bomCode: 'SPEC001',
          specifications: [
            { key: '機器名称', value: '多仕様機器', order: 0 },
            { key: '型式', value: 'MULTI-001', order: 1 },
            { key: '容量', value: '100L', order: 2 },
            { key: '電圧', value: '200V', order: 3 },
            { key: '製造年', value: '2020', order: 4 }
          ],
          children: [],
          results: {},
          rolledUpResults: {}
        },
        {
          id: 'spec-2',
          task: 'Task with few specs',
          level: 1,
          bomCode: 'SPEC002',
          specifications: [
            { key: '機器名称', value: '少仕様機器', order: 0 }
          ],
          children: [],
          results: {},
          rolledUpResults: {}
        },
        {
          id: 'spec-3',
          task: 'Task with no specs',
          level: 1,
          bomCode: 'SPEC003',
          specifications: [],
          children: [],
          results: {},
          rolledUpResults: {}
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={dataWithVaryingSpecs}
          timeHeaders={[]}
          viewMode="status"
          displayMode="specifications"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      // Should handle all specification variations
      expect(screen.getByText('Task with many specs')).toBeInTheDocument();
      expect(screen.getByText('Task with few specs')).toBeInTheDocument();
      expect(screen.getByText('Task with no specs')).toBeInTheDocument();
      expect(screen.getByText('多仕様機器')).toBeInTheDocument();
      expect(screen.getByText('少仕様機器')).toBeInTheDocument();
    });

    it('should handle specification order changes', async () => {
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      const dataWithSpecs: HierarchicalData[] = [
        {
          id: 'order-test',
          task: 'Order Test Task',
          level: 1,
          bomCode: 'ORDER001',
          specifications: [
            { key: '機器名称', value: 'テスト機器', order: 0 },
            { key: '型式', value: 'TEST-001', order: 1 }
          ],
          children: [],
          results: {},
          rolledUpResults: {}
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={dataWithSpecs}
          timeHeaders={[]}
          viewMode="status"
          displayMode="specifications"
          showBomCode={false}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          readOnly={false}
        />
      );

      // Specifications should be displayed in order
      expect(screen.getByText('テスト機器')).toBeInTheDocument();
      expect(screen.getByText('TEST-001')).toBeInTheDocument();
    });
  });

  describe('Results Data Compatibility', () => {
    it('should handle missing result fields gracefully', () => {
      const dataWithIncompleteResults: HierarchicalData[] = [
        {
          id: 'incomplete-1',
          task: 'Incomplete Results Task',
          level: 1,
          bomCode: 'INC001',
          specifications: [],
          children: [],
          results: {
            '2024': { 
              planned: true, 
              actual: false, 
              planCost: 1000, 
              actualCost: 0 
            },
            '2025': { 
              // Missing some fields
              planned: false, 
              actual: true,
              planCost: 0,
              actualCost: 1200
            }
          },
          rolledUpResults: {
            '2024': { planned: true, actual: false, planCost: 1000, actualCost: 0 },
            '2025': { planned: false, actual: true, planCost: 0, actualCost: 1200 }
          }
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={dataWithIncompleteResults}
          timeHeaders={['2024', '2025']}
          viewMode="cost"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByText('Incomplete Results Task')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    it('should handle null and undefined values in results', () => {
      const dataWithNullValues: HierarchicalData[] = [
        {
          id: 'null-test',
          task: 'Null Values Task',
          level: 1,
          bomCode: 'NULL001',
          specifications: [],
          children: [],
          results: {
            '2024': { 
              planned: true, 
              actual: false, 
              planCost: 0, 
              actualCost: 0 
            }
          },
          rolledUpResults: {
            '2024': { planned: true, actual: false, planCost: 0, actualCost: 0 }
          }
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={dataWithNullValues}
          timeHeaders={['2024']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByText('Null Values Task')).toBeInTheDocument();
    });
  });

  describe('Cross-Component Data Flow', () => {
    it('should maintain data consistency between specification and maintenance areas', async () => {
      const mockOnUpdateItem = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnCellEdit = jest.fn();

      const testData: HierarchicalData[] = [
        {
          id: 'cross-test',
          task: 'Cross Area Test',
          level: 1,
          bomCode: 'CROSS001',
          specifications: [
            { key: '機器名称', value: 'クロステスト機器', order: 0 }
          ],
          children: [],
          results: {
            '2024': { planned: true, actual: false, planCost: 5000, actualCost: 0 }
          },
          rolledUpResults: {
            '2024': { planned: true, actual: false, planCost: 5000, actualCost: 0 }
          }
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={testData}
          timeHeaders={['2024']}
          viewMode="status"
          displayMode="both"
          showBomCode={true}
          showCycle={false}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          readOnly={false}
        />
      );

      // Both areas should show the same item
      expect(screen.getByText('Cross Area Test')).toBeInTheDocument();
      expect(screen.getByText('クロステスト機器')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
    });

    it('should handle data updates from App.tsx integration', async () => {
      const mockOnUpdateItem = jest.fn();
      
      const initialData: HierarchicalData[] = [
        {
          id: 'update-test',
          task: 'Update Test Task',
          level: 1,
          bomCode: 'UPD001',
          specifications: [
            { key: '機器名称', value: '更新テスト機器', order: 0 }
          ],
          children: [],
          results: {
            '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 }
          },
          rolledUpResults: {
            '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 }
          }
        }
      ];

      const { rerender } = renderWithTheme(
        <EnhancedMaintenanceGrid
          data={initialData}
          timeHeaders={['2024']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={mockOnUpdateItem}
          readOnly={false}
        />
      );

      expect(screen.getByText('Update Test Task')).toBeInTheDocument();

      // Simulate data update from App.tsx
      const updatedData: HierarchicalData[] = [
        {
          ...initialData[0],
          task: 'Updated Task Name',
          results: {
            '2024': { planned: true, actual: false, planCost: 1000, actualCost: 0 }
          }
        }
      ];

      rerender(
        <ThemeProvider theme={theme}>
          <EnhancedMaintenanceGrid
            data={updatedData}
            timeHeaders={['2024']}
            viewMode="status"
            displayMode="maintenance"
            showBomCode={true}
            showCycle={false}
            onCellEdit={jest.fn()}
            onSpecificationEdit={jest.fn()}
            onUpdateItem={mockOnUpdateItem}
            readOnly={false}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Updated Task Name')).toBeInTheDocument();
    });

    it('should handle grouped data structure from App.tsx', () => {
      const testData: HierarchicalData[] = [
        {
          id: 'group-1',
          task: 'Group Test 1',
          level: 1,
          bomCode: 'GRP001',
          specifications: [],
          children: [],
          results: {},
          rolledUpResults: {},
          hierarchyPath: 'Group A > Subgroup 1'
        },
        {
          id: 'group-2',
          task: 'Group Test 2',
          level: 1,
          bomCode: 'GRP002',
          specifications: [],
          children: [],
          results: {},
          rolledUpResults: {},
          hierarchyPath: 'Group A > Subgroup 2'
        }
      ];

      const groupedData = {
        'Group A > Subgroup 1': [testData[0]],
        'Group A > Subgroup 2': [testData[1]]
      };

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={testData}
          timeHeaders={[]}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          groupedData={groupedData}
          readOnly={false}
        />
      );

      expect(screen.getByText('Group Test 1')).toBeInTheDocument();
      expect(screen.getByText('Group Test 2')).toBeInTheDocument();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = [
        {
          id: 'malformed-1',
          task: 'Malformed Task',
          level: 1,
          bomCode: 'MAL001',
          specifications: null, // Should be array
          children: [],
          results: {},
          rolledUpResults: {}
        }
      ] as any;

      // Should not crash with malformed data
      expect(() => {
        renderWithTheme(
          <EnhancedMaintenanceGrid
            data={malformedData}
            timeHeaders={[]}
            viewMode="status"
            displayMode="maintenance"
            showBomCode={true}
            showCycle={false}
            onCellEdit={jest.fn()}
            onSpecificationEdit={jest.fn()}
            onUpdateItem={jest.fn()}
            readOnly={false}
          />
        );
      }).not.toThrow();
    });

    it('should handle data type mismatches', () => {
      const typeMismatchData: HierarchicalData[] = [
        {
          id: 'type-test',
          task: 'Type Test Task',
          level: 1,
          bomCode: 'TYPE001',
          cycle: 'invalid' as any, // Should be number
          specifications: [],
          children: [],
          results: {},
          rolledUpResults: {}
        }
      ];

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={typeMismatchData}
          timeHeaders={[]}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          readOnly={false}
        />
      );

      expect(screen.getByText('Type Test Task')).toBeInTheDocument();
    });

    it('should maintain performance with large datasets', () => {
      const largeDataset: HierarchicalData[] = Array.from({ length: 500 }, (_, i) => ({
        id: `large-${i}`,
        task: `Large Dataset Task ${i}`,
        level: 1,
        bomCode: `LARGE${i.toString().padStart(3, '0')}`,
        specifications: [
          { key: '機器名称', value: `大規模データ機器${i}`, order: 0 }
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
          data={largeDataset}
          timeHeaders={['2024']}
          viewMode="status"
          displayMode="both"
          showBomCode={true}
          showCycle={false}
          onCellEdit={jest.fn()}
          onSpecificationEdit={jest.fn()}
          onUpdateItem={jest.fn()}
          virtualScrolling={true}
          readOnly={false}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByText('Large Dataset Task 0')).toBeInTheDocument();
    });
  });
});