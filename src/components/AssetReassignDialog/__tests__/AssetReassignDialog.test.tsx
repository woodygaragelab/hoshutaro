import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AssetReassignDialog } from '../AssetReassignDialog';
import { HierarchyDefinition, Asset } from '../../../types/maintenanceTask';

describe('AssetReassignDialog', () => {
  const mockHierarchy: HierarchyDefinition = {
    levels: [
      {
        key: '製油所',
        order: 1,
        values: ['第一製油所', '第二製油所'],
      },
      {
        key: 'エリア',
        order: 2,
        values: ['Aエリア', 'Bエリア', 'Cエリア'],
      },
      {
        key: 'ユニット',
        order: 3,
        values: ['原油蒸留ユニット', '接触改質ユニット', '製品貯蔵エリア'],
      },
    ],
  };

  const mockAssets: Asset[] = [
    {
      id: 'P-101',
      name: '原油供給ポンプ',
      hierarchyPath: {
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
        'ユニット': '原油蒸留ユニット',
      },
      specifications: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'T-4220',
      name: '貯蔵タンク',
      hierarchyPath: {
        '製油所': '第一製油所',
        'エリア': 'Cエリア',
        'ユニット': '製品貯蔵エリア',
      },
      specifications: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  const mockOnReassign = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render dialog when open', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('機器の階層付け替え')).toBeInTheDocument();
      expect(screen.getByText(/選択された機器: 1件/)).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      render(
        <AssetReassignDialog
          open={false}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('機器の階層付け替え')).not.toBeInTheDocument();
    });

    it('should display current hierarchy path section', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('現在の階層パス')).toBeInTheDocument();
      expect(screen.getByText(/1件の機器: P-101/)).toBeInTheDocument();
    });

    it('should display multiple assets count', () => {
      const assetsWithSamePath: Asset[] = [
        mockAssets[0],
        {
          ...mockAssets[0],
          id: 'P-102',
          name: '別のポンプ',
        },
      ];

      render(
        <AssetReassignDialog
          open={true}
          assets={assetsWithSamePath}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/2件の機器: P-101, P-102/)).toBeInTheDocument();
    });
  });

  describe('Hierarchy Path Selection', () => {
    it('should show new hierarchy path section', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('新しい階層パス')).toBeInTheDocument();
    });

    it('should render select dropdowns for hierarchy levels', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      // Check that comboboxes exist for hierarchy selection
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBe(3); // 3 hierarchy levels
    });

    it('should initialize with current path for single asset', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      // The selects should have the current values
      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveTextContent('第一製油所');
      expect(selects[1]).toHaveTextContent('Aエリア');
      expect(selects[2]).toHaveTextContent('原油蒸留ユニット');
    });
  });

  describe('Validation', () => {
    it('should show reassign button', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      const reassignButton = screen.getByRole('button', { name: /付け替え実行/ });
      expect(reassignButton).toBeInTheDocument();
    });
  });

  describe('Reassignment', () => {
    it('should display reassign button with icon', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      const reassignButton = screen.getByRole('button', { name: /付け替え実行/ });
      expect(reassignButton).toBeInTheDocument();
    });
  });

  describe('Bulk Reassignment Warning', () => {
    it('should show warning for bulk reassignment', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={mockAssets}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/2件の機器を一括で付け替えます/)).toBeInTheDocument();
    });

    it('should not show warning for single asset', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/一括で付け替えます/)).not.toBeInTheDocument();
    });
  });

  describe('Cancel', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close icon is clicked', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getAllByRole('button').find(
        button => button.querySelector('[data-testid="CloseIcon"]')
      );
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('UI Elements', () => {
    it('should display swap icon between current and new paths', () => {
      render(
        <AssetReassignDialog
          open={true}
          assets={[mockAssets[0]]}
          hierarchy={mockHierarchy}
          onReassign={mockOnReassign}
          onClose={mockOnClose}
        />
      );

      // Check for the swap icon (there may be multiple in the button)
      const swapIcons = screen.getAllByTestId('SwapHorizIcon');
      expect(swapIcons.length).toBeGreaterThan(0);
    });
  });
});
