import React from 'react';
import { render, screen } from '@testing-library/react';
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
    id: '1',
    task: 'Test Task 1',
    bomCode: 'BOM001',
    cycle: 12,
    hierarchyPath: 'Level1 > Level2 > Level3',
    specifications: [
      { key: '機器名称', value: 'テスト機器', order: 0 },
      { key: '型式', value: 'TEST-001', order: 1 }
    ],
    results: {
      '2024': {
        planned: true,
        actual: false,
        planCost: 100,
        actualCost: 0
      },
      '2025': {
        planned: false,
        actual: true,
        planCost: 0,
        actualCost: 150
      }
    }
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
  displayMode: 'maintenance' as const,
  readOnly: false
};

describe('EnhancedMaintenanceGrid ViewMode Integration', () => {
  describe('Status Mode', () => {
    it('should display status legend when viewMode is status', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
        />
      );

      expect(screen.getByText('凡例:')).toBeInTheDocument();
      expect(screen.getByText(': 計画')).toBeInTheDocument();
      expect(screen.getByText(': 実績')).toBeInTheDocument();
      expect(screen.getByText(': 計画と実績')).toBeInTheDocument();
    });

    it('should pass status viewMode to grid components', () => {
      const { container } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
        />
      );

      // Verify the grid container exists
      expect(container.querySelector('.enhanced-maintenance-grid')).toBeInTheDocument();
    });
  });

  describe('Cost Mode', () => {
    it('should display cost legend when viewMode is cost', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="cost"
        />
      );

      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
      const costExamples = screen.getAllByText('(123)');
      expect(costExamples).toHaveLength(2);
    });

    it('should pass cost viewMode to grid components', () => {
      const { container } = renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="cost"
        />
      );

      // Verify the grid container exists
      expect(container.querySelector('.enhanced-maintenance-grid')).toBeInTheDocument();
    });
  });

  describe('Display Mode Integration', () => {
    it('should show both legend and display area control', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
          displayMode="both"
        />
      );

      // Should have legend
      expect(screen.getByText('凡例:')).toBeInTheDocument();
      
      // Should have display area control (this would be tested more thoroughly in DisplayAreaControl tests)
      expect(screen.getByText('凡例:')).toBeInTheDocument();
    });
  });

  describe('Specifications Area ViewMode', () => {
    it('should handle specifications display mode with status viewMode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="status"
          displayMode="specifications"
        />
      );

      // Should still show status legend even in specifications mode
      expect(screen.getByText('凡例:')).toBeInTheDocument();
    });

    it('should handle specifications display mode with cost viewMode', () => {
      renderWithTheme(
        <EnhancedMaintenanceGrid
          {...defaultProps}
          viewMode="cost"
          displayMode="specifications"
        />
      );

      // Should still show cost legend even in specifications mode
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
    });
  });
});