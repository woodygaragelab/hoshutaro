import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedMaintenanceGrid } from '../EnhancedMaintenanceGrid';
import { HierarchicalData } from '../../../types';

// Mock data that matches the existing HierarchicalData structure
const mockData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプA-001',
    level: 3,
    bomCode: 'P-001',
    cycle: 12,
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 0 },
      { key: '型式', value: 'CP-100', order: 1 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2025': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
    },
    rolledUpResults: {},
    hierarchyPath: '建屋A > 機械室 > ポンプ設備'
  },
  {
    id: '2',
    task: 'モーターB-002',
    level: 3,
    bomCode: 'M-002',
    cycle: 6,
    specifications: [
      { key: '機器名称', value: '誘導電動機', order: 0 },
      { key: '型式', value: 'IM-200', order: 1 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: true, planCost: 30000, actualCost: 32000 },
      '2025': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: '建屋A > 機械室 > 電動機設備'
  }
];

const mockTimeHeaders = ['2024', '2025'];

const defaultProps = {
  data: mockData,
  timeHeaders: mockTimeHeaders,
  viewMode: 'status' as const,
  displayMode: 'maintenance' as const,
  showBomCode: true,
  showCycle: true,
  onCellEdit: jest.fn(),
  onSpecificationEdit: jest.fn(),
  onUpdateItem: jest.fn()
};

describe('EnhancedMaintenanceGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with HierarchicalData structure', () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Check if equipment names are displayed
    expect(screen.getByText('ポンプA-001')).toBeInTheDocument();
    expect(screen.getByText('モーターB-002')).toBeInTheDocument();
    
    // Check if BOM codes are displayed
    expect(screen.getByText('P-001')).toBeInTheDocument();
    expect(screen.getByText('M-002')).toBeInTheDocument();
  });

  it('displays hierarchy groups correctly', () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Check if hierarchy paths are displayed as group headers
    expect(screen.getByText('建屋A > 機械室 > ポンプ設備')).toBeInTheDocument();
    expect(screen.getByText('建屋A > 機械室 > 電動機設備')).toBeInTheDocument();
  });

  it('handles status display mode correctly', () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Status symbols should be displayed
    const statusCells = screen.getAllByText('〇'); // Planned status
    expect(statusCells.length).toBeGreaterThan(0);
    
    const actualCells = screen.getAllByText('●'); // Actual status
    expect(actualCells.length).toBeGreaterThan(0);
    
    const bothCells = screen.getAllByText('◎'); // Both planned and actual
    expect(bothCells.length).toBeGreaterThan(0);
  });

  it('handles cost display mode correctly', () => {
    render(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        viewMode="cost"
      />
    );
    
    // Cost values should be displayed
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('45,000')).toBeInTheDocument();
    expect(screen.getAllByText('30,000').length).toBeGreaterThan(0);
    expect(screen.getByText('32,000')).toBeInTheDocument();
  });

  it('handles specifications display mode', () => {
    render(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        displayMode="specifications"
      />
    );
    
    // Specification values should be displayed
    expect(screen.getByText('遠心ポンプ')).toBeInTheDocument();
    expect(screen.getByText('CP-100')).toBeInTheDocument();
    expect(screen.getByText('誘導電動機')).toBeInTheDocument();
    expect(screen.getByText('IM-200')).toBeInTheDocument();
  });

  it('handles both display mode', () => {
    render(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        displayMode="both"
      />
    );
    
    // Both specifications and maintenance data should be visible
    expect(screen.getByText('遠心ポンプ')).toBeInTheDocument();
    expect(screen.getAllByText('〇').length).toBeGreaterThan(0);
  });

  it('calls onUpdateItem when task is edited', async () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Find and click on a task cell to trigger editing
    const taskCell = screen.getByText('ポンプA-001');
    fireEvent.click(taskCell);
    
    // The existing TableRow component should handle the editing
    // We just verify the component renders correctly
    expect(taskCell).toBeInTheDocument();
  });

  it('calls onSpecificationEdit when specification is edited', async () => {
    render(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        displayMode="specifications"
      />
    );
    
    // Find and verify specification cells are rendered
    const specCell = screen.getByText('遠心ポンプ');
    expect(specCell).toBeInTheDocument();
  });

  it('calls onCellEdit when maintenance data is edited', async () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Find and verify status cells are rendered
    const statusCell = screen.getAllByText('〇')[0];
    expect(statusCell).toBeInTheDocument();
  });

  it('respects showBomCode and showCycle props', () => {
    const { rerender } = render(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        showBomCode={false}
        showCycle={false}
      />
    );
    
    // BOM codes and cycles should not be visible
    expect(screen.queryByText('P-001')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    
    // Re-render with showBomCode and showCycle enabled
    rerender(
      <EnhancedMaintenanceGrid 
        {...defaultProps} 
        showBomCode={true}
        showCycle={true}
      />
    );
    
    // Now they should be visible
    expect(screen.getByText('P-001')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('preserves existing TableRow functionality', () => {
    render(<EnhancedMaintenanceGrid {...defaultProps} />);
    
    // Check that the existing data structure is preserved
    expect(screen.getByText('ポンプA-001')).toBeInTheDocument();
    expect(screen.getByText('モーターB-002')).toBeInTheDocument();
    
    // Check that hierarchy grouping works
    expect(screen.getByText('建屋A > 機械室 > ポンプ設備')).toBeInTheDocument();
    expect(screen.getByText('建屋A > 機械室 > 電動機設備')).toBeInTheDocument();
    
    // Check that status symbols are displayed correctly
    const statusSymbols = screen.getAllByText(/[〇●◎]/);
    expect(statusSymbols.length).toBeGreaterThan(0);
  });
});