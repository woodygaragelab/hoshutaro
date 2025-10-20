import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SpecificationEditDialog } from '../SpecificationEditDialog';
import { SpecificationValue } from '../../CommonEdit/types';

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

const mockSpecifications: SpecificationValue[] = [
  { key: '型式', value: 'ABC-123', order: 1 },
  { key: '電圧', value: '100V', order: 2 },
];

describe('SpecificationEditDialog - 仕様項目の追加・削除テスト', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnValidationError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('新しい項目を追加機能', () => {
    test('新しい項目を追加ボタンをクリックすると新しい編集フィールドが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      // 新しい項目の編集フィールドが表示される
      await waitFor(() => {
        expect(screen.getByLabelText('項目名')).toBeInTheDocument();
        expect(screen.getByLabelText('値')).toBeInTheDocument();
      });
    });

    test('新しい項目に値を入力して保存できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        // 値を入力
        await user.type(keyInput, '重量');
        await user.type(valueInput, '50kg');

        // 保存
        const saveButton = screen.getByText('保存');
        await user.click(saveButton);

        // 新しい項目が含まれた配列で保存される
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ key: '型式', value: 'ABC-123' }),
            expect.objectContaining({ key: '電圧', value: '100V' }),
            expect.objectContaining({ key: '重量', value: '50kg' }),
          ])
        );
      });
    });

    test('複数の項目を連続して追加できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');

      // 1つ目の項目を追加
      await user.click(addButton);
      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');
        await user.type(keyInput, '重量');
        await user.type(valueInput, '50kg');
        
        // 編集を完了（保存アイコンをクリック）
        const saveIcon = screen.getByRole('button', { name: /save/i });
        await user.click(saveIcon);
      });

      // 2つ目の項目を追加
      await user.click(addButton);
      await waitFor(async () => {
        const keyInputs = screen.getAllByLabelText('項目名');
        const valueInputs = screen.getAllByLabelText('値');
        
        // 最後の入力フィールドに値を入力
        const lastKeyInput = keyInputs[keyInputs.length - 1];
        const lastValueInput = valueInputs[valueInputs.length - 1];
        
        await user.type(lastKeyInput, '寸法');
        await user.type(lastValueInput, '100x200x300mm');
      });

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '重量', value: '50kg' }),
          expect.objectContaining({ key: '寸法', value: '100x200x300mm' }),
        ])
      );
    });

    test('最大項目数に達すると追加ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            maxItems={2} // 既に2項目あるので追加不可
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      expect(addButton).toBeDisabled();
    });

    test('最大項目数を超えて追加しようとするとバリデーションエラーが発生する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            maxItems={1} // 既に2項目あるので上限超過
            onValidationError={mockOnValidationError}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      // バリデーションエラーが呼ばれる
      await waitFor(() => {
        expect(mockOnValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('項目数の上限')
          ])
        );
      });
    });

    test('読み取り専用モードでは新しい項目を追加ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            readOnly={true}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      expect(addButton).toBeDisabled();
    });
  });

  describe('項目削除機能', () => {
    test('削除ボタンをクリックすると項目が削除される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 削除ボタンを探す（DeleteIconを含むボタン）
      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      
      expect(deleteButtons.length).toBeGreaterThan(0);
      
      // 最初の項目を削除
      await user.click(deleteButtons[0]);

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // 削除された項目が含まれていないことを確認
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({ key: '型式', value: 'ABC-123' })
        ])
      );
    });

    test('複数の項目を削除できる', async () => {
      const user = userEvent.setup();
      const threeItemSpecs: SpecificationValue[] = [
        { key: '型式', value: 'ABC-123', order: 1 },
        { key: '電圧', value: '100V', order: 2 },
        { key: '容量', value: '500L', order: 3 },
      ];
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={threeItemSpecs}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      
      // 最初の2つの項目を削除
      await user.click(deleteButtons[0]);
      await user.click(deleteButtons[1]);

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // 削除されなかった項目のみが残る
      expect(mockOnSave).toHaveBeenCalledWith([
        expect.objectContaining({ key: '容量', value: '500L', order: 1 })
      ]);
    });

    test('削除後に順序が正しく再計算される', async () => {
      const user = userEvent.setup();
      const threeItemSpecs: SpecificationValue[] = [
        { key: '型式', value: 'ABC-123', order: 1 },
        { key: '電圧', value: '100V', order: 2 },
        { key: '容量', value: '500L', order: 3 },
      ];
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={threeItemSpecs}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      
      // 中間の項目（電圧）を削除
      await user.click(deleteButtons[1]);

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // 順序が再計算されることを確認
      expect(mockOnSave).toHaveBeenCalledWith([
        expect.objectContaining({ key: '型式', value: 'ABC-123', order: 1 }),
        expect.objectContaining({ key: '容量', value: '500L', order: 2 }),
      ]);
    });

    test('読み取り専用モードでは削除ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            readOnly={true}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      
      deleteButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    test('全ての項目を削除できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      
      // 全ての項目を削除
      for (const button of deleteButtons) {
        await user.click(button);
      }

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      // 空の配列で保存される
      expect(mockOnSave).toHaveBeenCalledWith([]);
    });
  });

  describe('項目編集機能', () => {
    test('編集ボタンをクリックすると編集モードになる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 編集ボタンを探す（EditIconを含むボタン）
      const editButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="EditIcon"]') !== null
      );
      
      expect(editButtons.length).toBeGreaterThan(0);
      
      // 最初の項目を編集
      await user.click(editButtons[0]);

      // 編集フィールドが表示される
      await waitFor(() => {
        expect(screen.getByLabelText('項目名')).toBeInTheDocument();
        expect(screen.getByLabelText('値')).toBeInTheDocument();
      });
    });

    test('編集モードで値を変更して保存できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const editButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="EditIcon"]') !== null
      );
      
      // 最初の項目を編集
      await user.click(editButtons[0]);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        // 既存の値をクリアして新しい値を入力
        await user.clear(keyInput);
        await user.type(keyInput, 'モデル');
        await user.clear(valueInput);
        await user.type(valueInput, 'XYZ-789');

        // 保存アイコンをクリック
        const saveIcon = screen.getByRole('button', { name: /save/i });
        await user.click(saveIcon);
      });

      // 保存して確認
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: 'モデル', value: 'XYZ-789' }),
          expect.objectContaining({ key: '電圧', value: '100V' }),
        ])
      );
    });

    test('編集をキャンセルできる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      const editButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="EditIcon"]') !== null
      );
      
      // 編集開始
      await user.click(editButtons[0]);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        await user.clear(keyInput);
        await user.type(keyInput, '変更されたキー');

        // キャンセルアイコンをクリック
        const cancelIcon = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelIcon);
      });

      // 元の値が表示されることを確認
      expect(screen.getByText('型式')).toBeInTheDocument();
      expect(screen.queryByText('変更されたキー')).not.toBeInTheDocument();
    });

    test('読み取り専用モードでは編集ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            readOnly={true}
          />
        </TestWrapper>
      );

      const editButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="EditIcon"]') !== null
      );
      
      editButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('バリデーション', () => {
    test('空の項目名でバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const valueInput = screen.getByLabelText('値');
        await user.type(valueInput, 'テスト値');
        
        // 項目名を空のままにする
        const saveButton = screen.getByText('保存');
        expect(saveButton).toBeDisabled();
      });
    });

    test('空の値でバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        await user.type(keyInput, 'テストキー');
        
        // 値を空のままにする
        const saveButton = screen.getByText('保存');
        expect(saveButton).toBeDisabled();
      });
    });

    test('重複する項目名でバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        // 既存の項目名と同じ名前を入力
        await user.type(keyInput, '型式');
        await user.type(valueInput, 'DEF-456');

        // 重複エラーが表示される
        await waitFor(() => {
          expect(screen.getByText(/重複しています/)).toBeInTheDocument();
        });
      });
    });

    test('項目名が長すぎる場合のバリデーションエラー', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        // 50文字を超える項目名を入力
        const longKey = 'a'.repeat(51);
        await user.type(keyInput, longKey);
        await user.type(valueInput, 'テスト値');

        // バリデーションエラーが表示される
        await waitFor(() => {
          expect(screen.getByText(/50文字以内で入力してください/)).toBeInTheDocument();
        });
      });
    });

    test('値が長すぎる場合のバリデーションエラー', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </TestWrapper>
      );

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        await user.type(keyInput, 'テストキー');
        
        // 200文字を超える値を入力
        const longValue = 'a'.repeat(201);
        await user.type(valueInput, longValue);

        // バリデーションエラーが表示される
        await waitFor(() => {
          expect(screen.getByText(/200文字以内で入力してください/)).toBeInTheDocument();
        });
      });
    });
  });

  describe('項目数表示', () => {
    test('現在の項目数と最大項目数が表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={document.createElement('div')}
            maxItems={10}
          />
        </TestWrapper>
      );

      // 項目数表示を確認
      expect(screen.getByText('2/10項目')).toBeInTheDocument();
    });

    test('新しい項目を追加後に項目数が更新される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={document.createElement('div')}
            maxItems={10}
          />
        </TestWrapper>
      );

      // 初期状態の確認
      expect(screen.getByText('2/10項目')).toBeInTheDocument();

      // 項目を追加
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      // 項目数が更新される
      await waitFor(() => {
        expect(screen.getByText('3/10項目')).toBeInTheDocument();
      });
    });

    test('項目削除後に項目数が更新される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={document.createElement('div')}
            maxItems={10}
          />
        </TestWrapper>
      );

      // 初期状態の確認
      expect(screen.getByText('2/10項目')).toBeInTheDocument();

      // 項目を削除
      const deleteButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );
      await user.click(deleteButtons[0]);

      // 項目数が更新される
      await waitFor(() => {
        expect(screen.getByText('1/10項目')).toBeInTheDocument();
      });
    });
  });
});
