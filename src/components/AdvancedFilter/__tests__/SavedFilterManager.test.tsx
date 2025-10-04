import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SavedFilterManager from '../components/SavedFilterManager';
import { SavedFilter, FilterCondition, FilterField } from '../types';

const mockFields: FilterField[] = [
  { key: 'task', label: '機器名', type: 'text' },
  { key: 'cycle', label: '周期', type: 'select', options: [
    { value: '年次', label: '年次' },
    { value: '月次', label: '月次' }
  ]},
];

const mockCurrentFilters: FilterCondition[] = [
  {
    id: '1',
    field: 'task',
    operator: 'contains',
    value: 'ポンプ'
  }
];

const mockSavedFilters: SavedFilter[] = [
  {
    id: 'filter1',
    name: 'ポンプフィルター',
    description: 'ポンプ関連の機器',
    conditions: mockCurrentFilters,
    createdAt: new Date('2024-01-01'),
    lastUsed: new Date('2024-01-02')
  },
  {
    id: 'filter2',
    name: '月次点検',
    description: '月次点検項目',
    conditions: [
      {
        id: '2',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      }
    ],
    createdAt: new Date('2024-01-03')
  }
];

const defaultProps = {
  savedFilters: mockSavedFilters,
  currentFilters: mockCurrentFilters,
  availableFields: mockFields,
  onLoadFilter: jest.fn(),
  onDeleteFilter: jest.fn(),
  onSaveFilter: jest.fn(),
  onUpdateFilter: jest.fn(),
  onDuplicateFilter: jest.fn(),
};

describe('SavedFilterManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders saved filters correctly', () => {
    render(<SavedFilterManager {...defaultProps} />);
    
    expect(screen.getByText('保存済みフィルター')).toBeInTheDocument();
    expect(screen.getByText('ポンプフィルター')).toBeInTheDocument();
    expect(screen.getByText('月次点検')).toBeInTheDocument();
    expect(screen.getByText('現在の条件を保存')).toBeInTheDocument();
  });

  test('shows empty state when no saved filters', () => {
    render(<SavedFilterManager {...defaultProps} savedFilters={[]} />);
    
    expect(screen.getByText('保存されたフィルターはありません')).toBeInTheDocument();
  });

  test('disables save button when no current filters', () => {
    render(<SavedFilterManager {...defaultProps} currentFilters={[]} />);
    
    const saveButton = screen.getByText('現在の条件を保存');
    expect(saveButton).toBeDisabled();
  });

  test('opens save dialog when save button clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    const saveButton = screen.getByText('現在の条件を保存');
    await user.click(saveButton);
    
    expect(screen.getByText('フィルターを保存')).toBeInTheDocument();
    expect(screen.getByLabelText('フィルター名')).toBeInTheDocument();
    expect(screen.getByLabelText('説明（任意）')).toBeInTheDocument();
  });

  test('saves new filter correctly', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open save dialog
    const saveButton = screen.getByText('現在の条件を保存');
    await user.click(saveButton);
    
    // Fill in form
    const nameInput = screen.getByLabelText('フィルター名');
    const descriptionInput = screen.getByLabelText('説明（任意）');
    
    await user.type(nameInput, 'テストフィルター');
    await user.type(descriptionInput, 'テスト用の説明');
    
    // Save
    const confirmButton = screen.getByRole('button', { name: '保存' });
    await user.click(confirmButton);
    
    expect(defaultProps.onSaveFilter).toHaveBeenCalledWith(
      'テストフィルター',
      'テスト用の説明',
      mockCurrentFilters
    );
  });

  test('validates filter name is required', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open save dialog
    const saveButton = screen.getByText('現在の条件を保存');
    await user.click(saveButton);
    
    // Try to save without name
    const confirmButton = screen.getByRole('button', { name: '保存' });
    await user.click(confirmButton);
    
    expect(screen.getByText('フィルター名を入力してください')).toBeInTheDocument();
    expect(defaultProps.onSaveFilter).not.toHaveBeenCalled();
  });

  test('loads saved filter when restore button clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Find and click restore button for first filter
    const restoreButtons = screen.getAllByLabelText('フィルターを適用');
    await user.click(restoreButtons[0]);
    
    expect(defaultProps.onLoadFilter).toHaveBeenCalledWith('filter1');
  });

  test('opens context menu when more button clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Click more button (find by MoreVertIcon)
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      await waitFor(() => {
        expect(screen.getByText('編集')).toBeInTheDocument();
        expect(screen.getByText('複製')).toBeInTheDocument();
        expect(screen.getByText('削除')).toBeInTheDocument();
      });
    }
  });

  test('deletes filter when delete menu item clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open context menu
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      await waitFor(async () => {
        const deleteButton = screen.getByText('削除');
        await user.click(deleteButton);
      });
      
      expect(defaultProps.onDeleteFilter).toHaveBeenCalledWith('filter1');
    }
  });

  test('duplicates filter when duplicate menu item clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open context menu
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      await waitFor(async () => {
        const duplicateButton = screen.getByText('複製');
        await user.click(duplicateButton);
      });
      
      expect(defaultProps.onDuplicateFilter).toHaveBeenCalledWith('filter1');
    }
  });

  test('opens edit dialog when edit menu item clicked', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open context menu
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      await waitFor(async () => {
        const editButton = screen.getByText('編集');
        await user.click(editButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('フィルターを編集')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ポンプフィルター')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ポンプ関連の機器')).toBeInTheDocument();
      });
    }
  });

  test('updates filter when edit dialog confirmed', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Open context menu and edit
    const moreButton = screen.getByTestId('MoreVertIcon').closest('button');
    
    if (moreButton) {
      await user.click(moreButton);
      
      await waitFor(async () => {
        const editButton = screen.getByText('編集');
        await user.click(editButton);
      });
      
      // Wait for dialog to open and modify name and description
      await waitFor(async () => {
        const nameInput = screen.getByDisplayValue('ポンプフィルター');
        const descriptionInput = screen.getByDisplayValue('ポンプ関連の機器');
        
        await user.clear(nameInput);
        await user.type(nameInput, '更新されたポンプフィルター');
        
        await user.clear(descriptionInput);
        await user.type(descriptionInput, '更新された説明');
        
        // Confirm update
        const updateButton = screen.getByRole('button', { name: '更新' });
        await user.click(updateButton);
      });
      
      expect(defaultProps.onUpdateFilter).toHaveBeenCalledWith(
        'filter1',
        '更新されたポンプフィルター',
        '更新された説明',
        mockCurrentFilters
      );
    }
  });

  test('shows filter condition summary correctly', () => {
    render(<SavedFilterManager {...defaultProps} />);
    
    expect(screen.getAllByText('1つの条件')).toHaveLength(2); // Two filters with 1 condition each
  });

  test('expands accordion to show filter details', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Find and click accordion expand button (ExpandMoreIcon)
    const expandButton = screen.getByTestId('ExpandMoreIcon').closest('button');
    if (expandButton) {
      await user.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText('フィルター条件:')).toBeInTheDocument();
      });
    }
  });

  test('formats dates correctly', async () => {
    const user = userEvent.setup();
    render(<SavedFilterManager {...defaultProps} />);
    
    // Expand accordion to see dates
    const expandButton = screen.getByTestId('ExpandMoreIcon').closest('button');
    if (expandButton) {
      await user.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText(/作成:/)).toBeInTheDocument();
        expect(screen.getByText(/最終使用:/)).toBeInTheDocument();
      });
    }
  });

  test('handles filters without optional properties', () => {
    const filtersWithoutOptional: SavedFilter[] = [
      {
        id: 'filter3',
        name: 'シンプルフィルター',
        conditions: [],
        createdAt: new Date('2024-01-01')
      }
    ];

    render(<SavedFilterManager {...defaultProps} savedFilters={filtersWithoutOptional} />);
    
    expect(screen.getByText('シンプルフィルター')).toBeInTheDocument();
    expect(screen.getByText('条件なし')).toBeInTheDocument();
  });
});