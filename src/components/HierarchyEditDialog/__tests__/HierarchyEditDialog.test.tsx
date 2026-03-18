import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HierarchyEditDialog } from '../HierarchyEditDialog';
import { HierarchyDefinition } from '../../../types/maintenanceTask';

describe('HierarchyEditDialog', () => {
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
        values: ['原油蒸留ユニット', '接触改質ユニット'],
      },
    ],
  };

  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render dialog when open', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('階層構造の編集')).toBeInTheDocument();
      expect(screen.getByText(/階層レベル数: 3\/10/)).toBeInTheDocument();
      expect(screen.getByText(/機器数: 10件/)).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      render(
        <HierarchyEditDialog
          open={false}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('階層構造の編集')).not.toBeInTheDocument();
    });

    it('should display all hierarchy levels', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('製油所')).toBeInTheDocument();
      expect(screen.getByText('エリア')).toBeInTheDocument();
      expect(screen.getByText('ユニット')).toBeInTheDocument();
    });

    it('should display hierarchy values', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('第一製油所')).toBeInTheDocument();
      expect(screen.getByText('Aエリア')).toBeInTheDocument();
      expect(screen.getByText('原油蒸留ユニット')).toBeInTheDocument();
    });
  });

  describe('Adding Hierarchy Levels', () => {
    it('should show input for adding new hierarchy level', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText(/階層レベルのキー/);
      expect(input).toBeInTheDocument();
    });

    it('should show add level section', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('新しい階層レベルを追加')).toBeInTheDocument();
    });

    it('should add a new hierarchy level when add button is clicked', async () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText(/階層レベルのキー/);
      // Get all add buttons and select the first one (the one for adding levels, not values)
      const addButtons = screen.getAllByRole('button', { name: /追加/ });
      const addLevelButton = addButtons[0]; // First button is for adding levels

      // Type new level key
      fireEvent.change(input, { target: { value: '設備' } });
      fireEvent.click(addLevelButton);

      // Should show the new level
      await waitFor(() => {
        expect(screen.getByText('設備')).toBeInTheDocument();
      });

      // Should show "新規" chip
      expect(screen.getByText('新規')).toBeInTheDocument();

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /保存/ });
      expect(saveButton).not.toBeDisabled();
    });

    it('should show error when adding duplicate level key', async () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByPlaceholderText(/階層レベルのキー/);
      // Get all add buttons and select the first one (the one for adding levels, not values)
      const addButtons = screen.getAllByRole('button', { name: /追加/ });
      const addLevelButton = addButtons[0]; // First button is for adding levels

      // Try to add existing level
      fireEvent.change(input, { target: { value: '製油所' } });
      fireEvent.click(addLevelButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/既に存在します/)).toBeInTheDocument();
      });
    });
  });

  describe('Hierarchy Level Management', () => {
    it('should display hierarchy levels with their values', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Check that level values are displayed (use getAllByText since there are multiple)
      const twoValueLabels = screen.getAllByText(/値 \(2件\)/);
      expect(twoValueLabels.length).toBeGreaterThan(0); // 製油所 and ユニット both have 2 values
      
      const threeValueLabels = screen.getAllByText(/値 \(3件\)/);
      expect(threeValueLabels.length).toBeGreaterThan(0); // エリア has 3 values
    });
  });

  describe('Deleting Hierarchy Levels', () => {
    it('should show delete buttons for each level', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Should have delete icons (DeleteIcon)
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Each level has delete button for itself and for its values
      expect(deleteIcons.length).toBeGreaterThanOrEqual(3);
    });

    it('should disable delete button when only one level remains', () => {
      const singleLevelHierarchy: HierarchyDefinition = {
        levels: [
          {
            key: '製油所',
            order: 1,
            values: ['第一製油所'],
          },
        ],
      };

      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={singleLevelHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Find the delete button by looking for the parent button of DeleteIcon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const deleteButton = deleteIcons[0].closest('button');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Reordering Hierarchy Levels', () => {
    it('should show up and down buttons for reordering', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Should have up and down arrow icons
      const upIcons = screen.getAllByTestId('ArrowUpwardIcon');
      const downIcons = screen.getAllByTestId('ArrowDownwardIcon');
      
      expect(upIcons.length).toBe(3);
      expect(downIcons.length).toBe(3);
    });

    it('should disable up button for first level', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const upIcons = screen.getAllByTestId('ArrowUpwardIcon');
      const firstUpButton = upIcons[0].closest('button');
      // First level's up button should be disabled
      expect(firstUpButton).toBeDisabled();
    });

    it('should disable down button for last level', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const downIcons = screen.getAllByTestId('ArrowDownwardIcon');
      const lastDownButton = downIcons[downIcons.length - 1].closest('button');
      // Last level's down button should be disabled
      expect(lastDownButton).toBeDisabled();
    });
  });

  describe('Hierarchy Level Display', () => {
    it('should display order chips for each level', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Check that order chips are displayed
      expect(screen.getByText('順序: 1')).toBeInTheDocument();
      expect(screen.getByText('順序: 2')).toBeInTheDocument();
      expect(screen.getByText('順序: 3')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should display level count correctly', async () => {
      const singleLevelHierarchy: HierarchyDefinition = {
        levels: [
          {
            key: '製油所',
            order: 1,
            values: ['第一製油所'],
          },
        ],
      };

      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={singleLevelHierarchy}
          assetCount={0}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // Check that level count is displayed correctly
      expect(screen.getByText(/階層レベル数: 1\/10/)).toBeInTheDocument();
    });
  });

  describe('Save and Cancel', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should disable save button when no changes', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const saveButton = screen.getByRole('button', { name: /保存/ });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Read-only Mode', () => {
    it('should hide edit controls in read-only mode', () => {
      render(
        <HierarchyEditDialog
          open={true}
          hierarchy={mockHierarchy}
          assetCount={10}
          onSave={mockOnSave}
          onClose={mockOnClose}
          readOnly={true}
        />
      );

      // Should not show add level input
      expect(screen.queryByPlaceholderText(/階層レベルのキー/)).not.toBeInTheDocument();
      
      // Should not show add level section
      expect(screen.queryByText('新しい階層レベルを追加')).not.toBeInTheDocument();
    });
  });
});
