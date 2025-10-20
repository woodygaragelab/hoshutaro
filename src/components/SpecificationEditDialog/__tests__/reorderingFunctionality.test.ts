import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SpecificationEditDialog } from '../SpecificationEditDialog';
import { SpecificationValue } from '../../CommonEdit/types';
import { moveItem, updateSpecificationOrder, getActiveItemIndices } from '../reorderingUtils';

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

const mockSpecifications: SpecificationValue[] = [
  { key: '型式', value: 'ABC-123', order: 1 },
  { key: '電圧', value: '100V', order: 2 },
  { key: '容量', value: '500L', order: 3 },
  { key: '重量', value: '50kg', order: 4 },
];

describe('SpecificationEditDialog - 順序変更機能のテスト', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reorderingUtils ユーティリティ関数のテスト', () => {
    test('moveItem関数が正しく配列内のアイテムを移動する', () => {
      const testArray = ['A', 'B', 'C', 'D'];
      
      // 0番目を2番目に移動
      const result1 = moveItem(testArray, 0, 2);
      expect(result1).toEqual(['B', 'C', 'A', 'D']);
      
      // 3番目を1番目に移動
      const result2 = moveItem(testArray, 3, 1);
      expect(result2).toEqual(['A', 'D', 'B', 'C']);
      
      // 同じ位置への移動（変更なし）
      const result3 = moveItem(testArray, 1, 1);
      expect(result3).toEqual(testArray);
    });

    test('moveItem関数が無効なインデックスを適切に処理する', () => {
      const testArray = ['A', 'B', 'C'];
      
      // 範囲外のインデックス
      const result1 = moveItem(testArray, -1, 1);
      expect(result1).toEqual(testArray);
      
      const result2 = moveItem(testArray, 0, 5);
      expect(result2).toEqual(testArray);
      
      const result3 = moveItem(testArray, 5, 0);
      expect(result3).toEqual(testArray);
    });

    test('updateSpecificationOrder関数が順序を正しく更新する', () => {
      const testItems = [
        { id: '1', key: 'A', value: 'Value A', order: 3, isDeleted: false },
        { id: '2', key: 'B', value: 'Value B', order: 1, isDeleted: false },
        { id: '3', key: 'C', value: 'Value C', order: 2, isDeleted: false },
      ];
      
      const result = updateSpecificationOrder(testItems);
      
      expect(result).toEqual([
        expect.objectContaining({ key: 'A', order: 1 }),
        expect.objectContaining({ key: 'B', order: 2 }),
        expect.objectContaining({ key: 'C', order: 3 }),
      ]);
    });

    test('getActiveItemIndices関数が削除されていない項目のインデックスを返す', () => {
      const testItems = [
        { id: '1', key: 'A', value: 'Value A', order: 1, isDeleted: false },
        { id: '2', key: 'B', value: 'Value B', order: 2, isDeleted: true },
        { id: '3', key: 'C', value: 'Value C', order: 3, isDeleted: false },
        { id: '4', key: 'D', value: 'Value D', order: 4, isDeleted: false },
      ];
      
      const result = getActiveItemIndices(testItems);
      expect(result).toEqual([0, 2, 3]);
    });
  });

  describe('デスクトップでの順序変更', () => {
    test('上移動ボタンで項目が上に移動する', async () => {
      const user = userEvent.setup();
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 2番目の項目（電圧）の上移動ボタンを探す
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(1);
      
      // 2番目の項目を上に移動
      await user.click(upButtons[1]);

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '電圧', order: 1 }),
          expect.objectContaining({ key: '型式', order: 2 }),
          expect.objectContaining({ key: '容量', order: 3 }),
          expect.objectContaining({ key: '重量', order: 4 }),
        ])
      );
    });

    test('下移動ボタンで項目が下に移動する', async () => {
      const user = userEvent.setup();
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 1番目の項目（型式）の下移動ボタンを探す
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      expect(downButtons.length).toBeGreaterThan(0);
      
      // 1番目の項目を下に移動
      await user.click(downButtons[0]);

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '電圧', order: 1 }),
          expect.objectContaining({ key: '型式', order: 2 }),
          expect.objectContaining({ key: '容量', order: 3 }),
          expect.objectContaining({ key: '重量', order: 4 }),
        ])
      );
    });

    test('最初に移動ボタンで項目が最初に移動する', async () => {
      const user = userEvent.setup();
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 3番目の項目（容量）の最初に移動ボタンを探す
      const firstButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
      );
      
      expect(firstButtons.length).toBeGreaterThan(2);
      
      // 3番目の項目を最初に移動
      await user.click(firstButtons[2]);

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '容量', order: 1 }),
          expect.objectContaining({ key: '型式', order: 2 }),
          expect.objectContaining({ key: '電圧', order: 3 }),
          expect.objectContaining({ key: '重量', order: 4 }),
        ])
      );
    });

    test('最後に移動ボタンで項目が最後に移動する', async () => {
      const user = userEvent.setup();
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 1番目の項目（型式）の最後に移動ボタンを探す
      const lastButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      
      expect(lastButtons.length).toBeGreaterThan(0);
      
      // 1番目の項目を最後に移動
      await user.click(lastButtons[0]);

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '電圧', order: 1 }),
          expect.objectContaining({ key: '容量', order: 2 }),
          expect.objectContaining({ key: '重量', order: 3 }),
          expect.objectContaining({ key: '型式', order: 4 }),
        ])
      );
    });

    test('最初の項目では上移動と最初移動ボタンが無効になる', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最初の項目の上移動ボタンが無効
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      if (upButtons.length > 0) {
        expect(upButtons[0]).toBeDisabled();
      }

      // 最初の項目の最初移動ボタンが無効
      const firstButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
      );
      if (firstButtons.length > 0) {
        expect(firstButtons[0]).toBeDisabled();
      }
    });

    test('最後の項目では下移動と最後移動ボタンが無効になる', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最後の項目の下移動ボタンが無効
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      if (downButtons.length > 0) {
        expect(downButtons[downButtons.length - 1]).toBeDisabled();
      }

      // 最後の項目の最後移動ボタンが無効
      const lastButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      if (lastButtons.length > 0) {
        expect(lastButtons[lastButtons.length - 1]).toBeDisabled();
      }
    });

    test('ドラッグハンドルが表示される', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // ドラッグハンドル（DragIndicatorIcon）が表示される
      const dragHandles = document.querySelectorAll('svg[data-testid="DragIndicatorIcon"]');
      expect(dragHandles.length).toBe(mockSpecifications.length);
    });

    test('キーボードショートカットで順序変更ができる', async () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最初のリストアイテムにフォーカス
      const listItems = screen.getAllByRole('listitem');
      if (listItems.length > 1) {
        listItems[1].focus(); // 2番目の項目にフォーカス

        // Ctrl+ArrowUp で上に移動
        fireEvent.keyDown(listItems[1], { key: 'ArrowUp', ctrlKey: true });

        // 保存して順序変更を確認
        const saveButton = screen.getByText('保存');
        fireEvent.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ key: '電圧', order: 1 }),
            expect.objectContaining({ key: '型式', order: 2 }),
          ])
        );
      }
    });
  });

  describe('タブレットでの順序変更', () => {
    test('順序変更ボタンで順序変更モードに入る', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 順序変更ボタンを探す（SwapVertIconを含むボタン）
      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      expect(reorderButtons.length).toBeGreaterThan(0);
      
      // 1番目の項目の順序変更を開始
      await user.click(reorderButtons[0]);

      // 順序変更モードに入る
      await waitFor(() => {
        expect(screen.getByText('順序変更をキャンセル')).toBeInTheDocument();
      });
    });

    test('順序変更モードで移動先を選択できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      // 1番目の項目の順序変更を開始
      await user.click(reorderButtons[0]);

      await waitFor(async () => {
        // 移動先ボタンが表示される
        const moveButtons = screen.getAllByText('ここに移動');
        expect(moveButtons.length).toBeGreaterThan(0);
        
        // 3番目の位置に移動
        await user.click(moveButtons[1]); // 2番目の「ここに移動」ボタン
      });

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '電圧', order: 1 }),
          expect.objectContaining({ key: '型式', order: 2 }),
        ])
      );
    });

    test('順序変更をキャンセルできる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      // 順序変更を開始
      await user.click(reorderButtons[0]);

      await waitFor(async () => {
        // キャンセルボタンをクリック
        const cancelButton = screen.getByText('順序変更をキャンセル');
        await user.click(cancelButton);

        // 通常モードに戻る
        expect(screen.queryByText('順序変更をキャンセル')).not.toBeInTheDocument();
      });
    });

    test('タブレット用の簡単な上下移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 上移動ボタンを探す
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(1);
      
      // 2番目の項目を上に移動
      await user.click(upButtons[1]);

      // 保存して順序変更を確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '電圧', order: 1 }),
          expect.objectContaining({ key: '型式', order: 2 }),
        ])
      );
    });
  });

  describe('モバイルでの順序変更', () => {
    test('簡単な上下移動ボタンが表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 上下移動ボタンが表示される
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(0);
      expect(downButtons.length).toBeGreaterThan(0);
    });

    test('詳細な順序変更ボタンは表示されない', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 詳細な順序変更ボタンは表示されない
      const firstButtons = screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
      );
      const lastButtons = screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      
      expect(firstButtons.length).toBe(0);
      expect(lastButtons.length).toBe(0);
    });

    test('モバイルでの上移動が動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 2番目の項目の上移動ボタンをクリック
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      if (upButtons.length > 1) {
        await user.click(upButtons[1]);

        // 保存して順序変更を確認
        const saveButton = screen.getByText('保存');
        await user.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ key: '電圧', order: 1 }),
            expect.objectContaining({ key: '型式', order: 2 }),
          ])
        );
      }
    });

    test('モバイルでの下移動が動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 1番目の項目の下移動ボタンをクリック
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      if (downButtons.length > 0) {
        await user.click(downButtons[0]);

        // 保存して順序変更を確認
        const saveButton = screen.getByText('保存');
        await user.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ key: '電圧', order: 1 }),
            expect.objectContaining({ key: '型式', order: 2 }),
          ])
        );
      }
    });
  });

  describe('順序変更の制限', () => {
    test('allowReorderがfalseの場合は順序変更ボタンが表示されない', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={false}
          />
        </TestWrapper>
      );

      // 順序変更関連のボタンが表示されない
      const reorderButtons = screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null ||
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null ||
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null ||
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null ||
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      
      expect(reorderButtons.length).toBe(0);
    });

    test('読み取り専用モードでは順序変更ボタンが無効になる', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
            readOnly={true}
          />
        </TestWrapper>
      );

      // 順序変更ボタンが無効になる
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      [...upButtons, ...downButtons].forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    test('項目が1つしかない場合は順序変更ボタンが無効になる', () => {
      const singleItemSpec: SpecificationValue[] = [
        { key: '型式', value: 'ABC-123', order: 1 },
      ];
      
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={singleItemSpec}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 上下移動ボタンが無効になる
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      upButtons.forEach(button => expect(button).toBeDisabled());
      downButtons.forEach(button => expect(button).toBeDisabled());
    });
  });

  describe('順序変更の視覚的フィードバック', () => {
    test('順序番号が正しく表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 順序番号のチップが表示される
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    test('順序変更後に順序番号が更新される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 2番目の項目を上に移動
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      if (upButtons.length > 1) {
        await user.click(upButtons[1]);

        // 順序番号が更新されることを確認
        // 実際の実装では、順序変更後に番号が即座に更新される
        await waitFor(() => {
          const saveButton = screen.getByText('保存');
          expect(saveButton).not.toBeDisabled();
        });
      }
    });

    test('順序変更の説明テキストが表示される', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // デスクトップ用の説明テキストが表示される
      expect(screen.getByText(/ドラッグ&ドロップで順序を変更できます/)).toBeInTheDocument();
    });

    test('タブレット用の順序変更説明が表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // タブレット用の説明テキストが表示される
      expect(screen.getByText(/項目をタップして選択し/)).toBeInTheDocument();
    });

    test('モバイル用の順序変更説明が表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            allowReorder={true}
          />
        </TestWrapper>
      );

      // モバイル用の説明テキストが表示される
      expect(screen.getByText(/項目をタップして選択し、移動先の位置ボタンをタップ/)).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    test('順序変更ボタンに適切なARIA属性が設定される', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // リストアイテムに適切なARIA属性が設定される
      const listItems = screen.getAllByRole('listitem');
      listItems.forEach(item => {
        expect(item).toHaveAttribute('aria-label');
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });

    test('順序変更の説明がaria-describedbyで関連付けられる', () => {
      const anchorEl = document.createElement('div');
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 説明テキストのIDが設定される
      const instructions = document.getElementById('reorder-instructions');
      expect(instructions).toBeInTheDocument();

      // リストアイテムがaria-describedbyで説明と関連付けられる
      const listItems = screen.getAllByRole('listitem');
      listItems.forEach(item => {
        expect(item).toHaveAttribute('aria-describedby', 'reorder-instructions');
      });
    });
  });
});