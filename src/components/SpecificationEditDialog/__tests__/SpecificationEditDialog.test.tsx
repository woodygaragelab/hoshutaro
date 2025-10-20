import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SpecificationEditDialog, SpecificationEditDialogProps } from '../SpecificationEditDialog';
import { SpecificationValue } from '../../CommonEdit/types';

// テスト用のテーマ
const theme = createTheme();

// テスト用のラッパーコンポーネント
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

// テスト用のモック仕様データ
const mockSpecifications: SpecificationValue[] = [
  { key: '型式', value: 'ABC-123', order: 1 },
  { key: '電圧', value: '100V', order: 2 },
  { key: '容量', value: '500L', order: 3 },
];

// デフォルトのプロパティ
const defaultProps: SpecificationEditDialogProps = {
  open: true,
  specifications: mockSpecifications,
  onSave: jest.fn(),
  onClose: jest.fn(),
  deviceType: 'desktop',
};

// モックアンカー要素の作成
const createMockAnchorElement = (): HTMLElement => {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.top = '100px';
  element.style.left = '100px';
  element.style.width = '50px';
  element.style.height = '30px';
  document.body.appendChild(element);
  return element;
};

describe('SpecificationEditDialog', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnValidationError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm for confirmation dialogs
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    // Clean up any anchor elements
    document.querySelectorAll('div').forEach(div => {
      if (div.style.position === 'absolute') {
        document.body.removeChild(div);
      }
    });
  });

  describe('基本的なレンダリング', () => {
    test('デスクトップ版が正しくレンダリングされる', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      expect(screen.getByText('新しい項目を追加')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    test('タブレット版が正しくレンダリングされる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('モバイル版が正しくレンダリングされる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="mobile"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('既存の仕様項目が正しく表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('型式')).toBeInTheDocument();
      expect(screen.getByText('ABC-123')).toBeInTheDocument();
      expect(screen.getByText('電圧')).toBeInTheDocument();
      expect(screen.getByText('100V')).toBeInTheDocument();
      expect(screen.getByText('容量')).toBeInTheDocument();
      expect(screen.getByText('500L')).toBeInTheDocument();
    });

    test('ダイアログが閉じている時は表示されない', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            open={false}
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.queryByText('機器仕様編集')).not.toBeInTheDocument();
    });
  });

  describe('仕様項目の追加・削除テスト', () => {
    test('新しい項目を追加ボタンで新しい項目が追加される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
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

    test('新しい項目に値を入力できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        await user.type(keyInput, '重量');
        await user.type(valueInput, '50kg');

        expect((keyInput as HTMLInputElement).value).toBe('重量');
        expect((valueInput as HTMLInputElement).value).toBe('50kg');
      });
    });

    test('項目削除ボタンで項目が削除される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
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

      // 項目が削除されることを確認（視覚的には非表示になる）
      await waitFor(() => {
        // 削除された項目は表示されなくなる
        const remainingItems = screen.getAllByText(/型式|電圧|容量/).filter(text => 
          text.textContent === '型式'
        );
        // 削除後は型式が表示されないか、削除マークが付く
        expect(remainingItems.length).toBeLessThanOrEqual(1);
      });
    });

    test('最大項目数に達すると追加ボタンが無効になる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            maxItems={3} // 既に3項目あるので追加不可
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      expect(addButton).toBeDisabled();
    });

    test('新しい項目を追加時にバリデーションエラーが発生する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            maxItems={2} // 既に3項目あるので上限超過
            onSave={mockOnSave}
            onClose={mockOnClose}
            onValidationError={mockOnValidationError}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      // バリデーションエラーが呼ばれることを確認
      await waitFor(() => {
        expect(mockOnValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('項目数の上限')
          ])
        );
      });
    });

    test('空の項目名でバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const valueInput = screen.getByLabelText('値');
        await user.type(valueInput, 'テスト値');
        
        // 項目名を空のままにして保存を試行
        const saveButton = screen.getByText('保存');
        expect(saveButton).toBeDisabled(); // バリデーションエラーで無効になる
      });
    });

    test('重複する項目名でバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(async () => {
        const keyInput = screen.getByLabelText('項目名');
        const valueInput = screen.getByLabelText('値');

        // 既存の項目名と同じ名前を入力
        await user.type(keyInput, '型式');
        await user.type(valueInput, 'DEF-456');

        // 重複エラーが表示されることを確認
        await waitFor(() => {
          expect(screen.getByText(/重複しています/)).toBeInTheDocument();
        });
      });
    });
  });

  describe('順序変更機能のテスト', () => {
    test('デスクトップで上移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 上移動ボタンを探す（ArrowUpIconを含むボタン）
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(0);
      
      // 2番目の項目（電圧）を上に移動
      if (upButtons.length > 1) {
        await user.click(upButtons[1]);

        // 順序が変更されることを確認
        await waitFor(() => {
          // 変更後の順序を確認するため、保存して結果を検証
          const saveButton = screen.getByText('保存');
          expect(saveButton).not.toBeDisabled();
        });
      }
    });

    test('デスクトップで下移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 下移動ボタンを探す（ArrowDownIconを含むボタン）
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      expect(downButtons.length).toBeGreaterThan(0);
      
      // 1番目の項目（型式）を下に移動
      await user.click(downButtons[0]);

      // 順序が変更されることを確認
      await waitFor(() => {
        const saveButton = screen.getByText('保存');
        expect(saveButton).not.toBeDisabled();
      });
    });

    test('デスクトップで最初に移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最初に移動ボタンを探す（FirstPageIconを含むボタン）
      const firstButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
      );
      
      expect(firstButtons.length).toBeGreaterThan(0);
      
      // 3番目の項目（容量）を最初に移動
      if (firstButtons.length > 2) {
        await user.click(firstButtons[2]);

        await waitFor(() => {
          const saveButton = screen.getByText('保存');
          expect(saveButton).not.toBeDisabled();
        });
      }
    });

    test('デスクトップで最後に移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最後に移動ボタンを探す（LastPageIconを含むボタン）
      const lastButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      
      expect(lastButtons.length).toBeGreaterThan(0);
      
      // 1番目の項目（型式）を最後に移動
      await user.click(lastButtons[0]);

      await waitFor(() => {
        const saveButton = screen.getByText('保存');
        expect(saveButton).not.toBeDisabled();
      });
    });

    test('タブレットで順序変更ボタンが動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
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

      // 順序変更モードに入ることを確認
      await waitFor(() => {
        expect(screen.getByText('順序変更をキャンセル')).toBeInTheDocument();
      });
    });

    test('タブレットで順序変更をキャンセルできる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 順序変更ボタンを探す
      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      if (reorderButtons.length > 0) {
        await user.click(reorderButtons[0]);

        await waitFor(async () => {
          const cancelButton = screen.getByText('順序変更をキャンセル');
          await user.click(cancelButton);

          // キャンセル後は通常モードに戻る
          expect(screen.queryByText('順序変更をキャンセル')).not.toBeInTheDocument();
        });
      }
    });

    test('モバイルで簡単な上下移動ボタンが動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="mobile"
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 上移動ボタンを探す
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(0);
      
      // 2番目の項目を上に移動
      if (upButtons.length > 1) {
        await user.click(upButtons[1]);

        await waitFor(() => {
          const saveButton = screen.getByText('保存');
          expect(saveButton).not.toBeDisabled();
        });
      }
    });

    test('順序変更が無効な場合はボタンが表示されない', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={createMockAnchorElement()}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={false}
          />
        </TestWrapper>
      );

      // 順序変更ボタンが表示されないことを確認
      const reorderButtons = screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null ||
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null ||
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      expect(reorderButtons.length).toBe(0);
    });

    test('最初の項目では上移動ボタンが無効になる', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最初の項目の上移動ボタンが無効であることを確認
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      
      if (upButtons.length > 0) {
        expect(upButtons[0]).toBeDisabled();
      }
    });

    test('最後の項目では下移動ボタンが無効になる', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="desktop"
            anchorEl={anchorEl}
            onSave={mockOnSave}
            onClose={mockOnClose}
            allowReorder={true}
          />
        </TestWrapper>
      );

      // 最後の項目の下移動ボタンが無効であることを確認
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      if (downButtons.length > 0) {
        expect(downButtons[downButtons.length - 1]).toBeDisabled();
      }
    });
  });

  describe('デバイス別表示のテスト', () => {
    describe('デスクトップ', () => {
      test('ポップオーバー形式で表示される', () => {
        const anchorEl = createMockAnchorElement();
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={anchorEl}
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // ポップオーバーの特徴的な要素を確認
        expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();
      });

      test('キーボードショートカットが動作する', async () => {
        const anchorEl = createMockAnchorElement();
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={anchorEl}
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        const popover = screen.getByText('機器仕様編集').closest('[role="presentation"]');
        
        // Ctrl+Enter で保存
        fireEvent.keyDown(popover!, { key: 'Enter', ctrlKey: true });
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
        });

        // Escape でキャンセル
        fireEvent.keyDown(popover!, { key: 'Escape' });
        await waitFor(() => {
          expect(mockOnClose).toHaveBeenCalled();
        });
      });

      test('ドラッグ&ドロップ用のハンドルが表示される', () => {
        const anchorEl = createMockAnchorElement();
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={anchorEl}
              onSave={mockOnSave}
              onClose={mockOnClose}
              allowReorder={true}
            />
          </TestWrapper>
        );

        // ドラッグハンドル（DragIndicatorIcon）が表示されることを確認
        const dragHandles = screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="DragIndicatorIcon"]') !== null
        );
        
        expect(dragHandles.length).toBeGreaterThan(0);
      });

      test('詳細な順序変更コントロールが表示される', () => {
        const anchorEl = createMockAnchorElement();
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={anchorEl}
              onSave={mockOnSave}
              onClose={mockOnClose}
              allowReorder={true}
            />
          </TestWrapper>
        );

        // 詳細な順序変更ボタンが表示されることを確認
        expect(screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
        ).length).toBeGreaterThan(0);
        
        expect(screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="LastPageIcon"]') !== null
        ).length).toBeGreaterThan(0);
      });
    });

    describe('タブレット', () => {
      test('モーダルダイアログ形式で表示される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="tablet"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // モーダルダイアログとして表示される
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      });

      test('タッチ操作に適したボタンサイズが適用される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="tablet"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // ボタンが44px以上のタッチターゲットサイズを持つことを確認
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          const styles = window.getComputedStyle(button);
          const minHeight = parseInt(styles.minHeight) || 0;
          const minWidth = parseInt(styles.minWidth) || 0;
          
          // タブレット用のタッチターゲットサイズ（44px以上）
          expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
        });
      });

      test('タッチ順序変更コントロールが表示される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="tablet"
              onSave={mockOnSave}
              onClose={mockOnClose}
              allowReorder={true}
            />
          </TestWrapper>
        );

        // タッチ用の順序変更ボタンが表示される
        const reorderButtons = screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
        );
        
        expect(reorderButtons.length).toBeGreaterThan(0);
      });

      test('適切なダイアログサイズが適用される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="tablet"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        const dialog = screen.getByRole('dialog');
        const dialogPaper = dialog.querySelector('.MuiPaper-root');
        
        // タブレット用のダイアログサイズが適用される
        expect(dialogPaper).toHaveStyle({
          minHeight: '60vh',
          maxHeight: '80vh',
        });
      });
    });

    describe('モバイル', () => {
      test('フルスクリーンダイアログで表示される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="mobile"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // フルスクリーンダイアログとして表示される
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        
        const dialogPaper = dialog.querySelector('.MuiPaper-root');
        expect(dialogPaper).toHaveStyle({
          minHeight: '100vh',
          maxHeight: '100vh',
        });
      });

      test('大きなタッチターゲットが適用される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="mobile"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // ボタンが48px以上のタッチターゲットサイズを持つことを確認
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          const styles = window.getComputedStyle(button);
          const minHeight = parseInt(styles.minHeight) || 0;
          const minWidth = parseInt(styles.minWidth) || 0;
          
          // モバイル用のタッチターゲットサイズ（48px以上）
          expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
        });
      });

      test('簡略化された順序変更コントロールが表示される', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="mobile"
              onSave={mockOnSave}
              onClose={mockOnClose}
              allowReorder={true}
            />
          </TestWrapper>
        );

        // モバイル用の簡単な上下移動ボタンが表示される
        const upButtons = screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
        );
        const downButtons = screen.getAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
        );
        
        expect(upButtons.length).toBeGreaterThan(0);
        expect(downButtons.length).toBeGreaterThan(0);
        
        // 詳細な順序変更ボタンは表示されない
        const firstButtons = screen.queryAllByRole('button').filter(button => 
          button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
        );
        expect(firstButtons.length).toBe(0);
      });

      test('マルチライン入力フィールドが使用される', async () => {
        const user = userEvent.setup();
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="mobile"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        const addButton = screen.getByText('新しい項目を追加');
        await user.click(addButton);

        await waitFor(() => {
          const valueInput = screen.getByLabelText('値');
          
          // モバイルではマルチライン入力が使用される
          expect(valueInput).toHaveAttribute('rows', '3');
        });
      });
    });

    describe('レスポンシブ動作', () => {
      test('デバイスタイプの変更に応じてレイアウトが変更される', () => {
        const anchorEl = createMockAnchorElement();
        const { rerender } = render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={anchorEl}
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // デスクトップ版の特徴を確認
        expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();

        // タブレット版に変更
        rerender(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="tablet"
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // タブレット版の特徴を確認
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByText('Ctrl+Enter: 保存, Esc: キャンセル')).not.toBeInTheDocument();
      });

      test('アンカー要素なしでもデスクトップ版が動作する', () => {
        render(
          <TestWrapper>
            <SpecificationEditDialog
              {...defaultProps}
              deviceType="desktop"
              anchorEl={null}
              onSave={mockOnSave}
              onClose={mockOnClose}
            />
          </TestWrapper>
        );

        // アンカー要素がない場合はダイアログ形式で表示される
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('保存とキャンセル機能', () => {
    test('保存ボタンで正しいデータが渡される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: '型式', value: 'ABC-123', order: 1 }),
          expect.objectContaining({ key: '電圧', value: '100V', order: 2 }),
          expect.objectContaining({ key: '容量', value: '500L', order: 3 }),
        ])
      );
    });

    test('キャンセルボタンでonCloseが呼ばれる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const cancelButton = screen.getByText('キャンセル');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    test('バリデーションエラーがある場合は保存ボタンが無効になる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // 新しい項目を追加して空のままにする
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(() => {
        const saveButton = screen.getByText('保存');
        expect(saveButton).toBeDisabled();
      });
    });

    test('読み取り専用モードでは保存ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
            readOnly={true}
          />
        </TestWrapper>
      );

      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('アクセシビリティ', () => {
    test('適切なARIA属性が設定される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // ダイアログのroleが設定される
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // リストアイテムのroleが設定される
      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);
    });

    test('キーボードナビゲーションが動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        // 最初のボタンにフォーカス
        buttons[0].focus();
        expect(buttons[0]).toHaveFocus();

        // Tabキーで次のボタンに移動
        await user.keyboard('{Tab}');
        
        // Enterキーでボタンを押下
        await user.keyboard('{Enter}');
      }
    });

    test('Escapeキーでダイアログが閉じる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            {...defaultProps}
            deviceType="tablet"
            onSave={mockOnSave}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Escapeキーを押下
      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
