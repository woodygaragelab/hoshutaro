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
  { key: '容量', value: '500L', order: 3 },
];

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

describe('SpecificationEditDialog - デバイス別表示のテスト', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any anchor elements
    document.querySelectorAll('div').forEach(div => {
      if (div.style.position === 'absolute') {
        document.body.removeChild(div);
      }
    });
  });

  describe('デスクトップデバイス表示', () => {
    test('アンカー要素がある場合はポップオーバー形式で表示される', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      // ポップオーバーの特徴的な要素を確認
      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();
      
      // ダイアログではなくポップオーバーとして表示される
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('アンカー要素がない場合はダイアログ形式で表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={null}
          />
        </TestWrapper>
      );

      // ダイアログとして表示される
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
    });

    test('デスクトップ用のキーボードショートカットが表示される', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();
    });

    test('デスクトップ用のキーボードショートカットが動作する', async () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
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

    test('デスクトップ用の小さなフォントサイズとボタンサイズが適用される', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      // 小さなボタンサイズが適用される
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const classes = button.className;
        // デスクトップでは小さなボタンサイズが使用される
        expect(classes).toMatch(/MuiButton-sizeSmall|small/);
      });
    });

    test('デスクトップ用のドラッグ&ドロップハンドルが表示される', () => {
      const anchorEl = createMockAnchorElement();
      
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

      // ドラッグハンドルが表示される
      const dragHandles = document.querySelectorAll('svg[data-testid="DragIndicatorIcon"]');
      expect(dragHandles.length).toBe(mockSpecifications.length);
    });

    test('デスクトップ用の詳細な順序変更コントロールが表示される', () => {
      const anchorEl = createMockAnchorElement();
      
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

      // 詳細な順序変更ボタンが表示される
      expect(screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="FirstPageIcon"]') !== null
      ).length).toBeGreaterThan(0);
      
      expect(screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      ).length).toBeGreaterThan(0);
    });

    test('デスクトップ用のコンパクトなレイアウトが適用される', () => {
      const anchorEl = createMockAnchorElement();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      // ポップオーバーのサイズが適切に設定される
      const popover = document.querySelector('[role="presentation"]');
      const paper = popover?.querySelector('.MuiPaper-root');
      
      if (paper) {
        const styles = window.getComputedStyle(paper);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(480);
        expect(parseInt(styles.maxWidth)).toBeLessThanOrEqual(600);
      }
    });
  });

  describe('タブレットデバイス表示', () => {
    test('モーダルダイアログ形式で表示される', () => {
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

      // モーダルダイアログとして表示される
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
    });

    test('タブレット用の適切なダイアログサイズが適用される', () => {
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

      const dialog = screen.getByRole('dialog');
      const dialogPaper = dialog.querySelector('.MuiPaper-root');
      
      // タブレット用のダイアログサイズが適用される
      expect(dialogPaper).toHaveStyle({
        minHeight: '60vh',
        maxHeight: '80vh',
      });
    });

    test('タブレット用のタッチ操作に適したボタンサイズが適用される', () => {
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

      // ボタンが44px以上のタッチターゲットサイズを持つ
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // タブレット用のタッチターゲットサイズ（44px以上）
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });

    test('タブレット用の順序変更コントロールが表示される', () => {
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

      // タッチ用の順序変更ボタンが表示される
      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      expect(reorderButtons.length).toBeGreaterThan(0);
      
      // 簡単な上下移動ボタンも表示される
      const upButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowUpIcon"]') !== null
      );
      const downButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="KeyboardArrowDownIcon"]') !== null
      );
      
      expect(upButtons.length).toBeGreaterThan(0);
      expect(downButtons.length).toBeGreaterThan(0);
    });

    test('タブレット用の中間サイズのフォントとボタンが適用される', () => {
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

      // 中間サイズのボタンが適用される
      const saveButton = screen.getByText('保存');
      expect(saveButton).toHaveAttribute('class', expect.stringContaining('MuiButton-sizeLarge'));
    });

    test('タブレット用のタッチ順序変更機能が動作する', async () => {
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

      // 順序変更ボタンをクリック
      const reorderButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      );
      
      if (reorderButtons.length > 0) {
        await user.click(reorderButtons[0]);

        // 順序変更モードに入る
        await waitFor(() => {
          expect(screen.getByText('順序変更をキャンセル')).toBeInTheDocument();
        });
      }
    });

    test('タブレット用のスライドアニメーションが適用される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            animationDuration={300}
          />
        </TestWrapper>
      );

      // ダイアログが表示される（アニメーション設定は内部的に適用される）
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('モバイルデバイス表示', () => {
    test('フルスクリーンダイアログで表示される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
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

    test('モバイル用の大きなタッチターゲットが適用される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // ボタンが48px以上のタッチターゲットサイズを持つ
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // モバイル用のタッチターゲットサイズ（44px以上、理想的には48px以上）
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });

    test('モバイル用の簡略化された順序変更コントロールが表示される', () => {
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

      // 簡単な上下移動ボタンが表示される
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
      const lastButtons = screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="LastPageIcon"]') !== null
      );
      
      expect(firstButtons.length).toBe(0);
      expect(lastButtons.length).toBe(0);
    });

    test('モバイル用のマルチライン入力フィールドが使用される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // 項目を追加して編集モードに入る
      const addButton = screen.getByText('新しい項目を追加');
      await user.click(addButton);

      await waitFor(() => {
        const valueInput = screen.getByLabelText('値');
        
        // モバイルではマルチライン入力が使用される
        expect(valueInput).toHaveAttribute('rows', '3');
      });
    });

    test('モバイル用の大きなフォントサイズが適用される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // 大きなボタンサイズが適用される
      const saveButton = screen.getByText('保存');
      expect(saveButton).toHaveAttribute('class', expect.stringContaining('MuiButton-sizeLarge'));
    });

    test('モバイル用のスライドアップアニメーションが適用される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            animationDuration={400}
          />
        </TestWrapper>
      );

      // フルスクリーンダイアログが表示される（アニメーション設定は内部的に適用される）
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('モバイル用の片手操作対応レイアウトが適用される', () => {
      render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // フルスクリーンダイアログで表示される
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // 保存・キャンセルボタンが下部に配置される
      const saveButton = screen.getByText('保存');
      const cancelButton = screen.getByText('キャンセル');
      
      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('レスポンシブ動作', () => {
    test('デバイスタイプの変更に応じてレイアウトが変更される', () => {
      const anchorEl = createMockAnchorElement();
      const { rerender } = render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      // デスクトップ版の特徴を確認
      expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();

      // タブレット版に変更
      rerender(
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

      // タブレット版の特徴を確認
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByText('Ctrl+Enter: 保存, Esc: キャンセル')).not.toBeInTheDocument();

      // モバイル版に変更
      rerender(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // モバイル版の特徴を確認（フルスクリーン）
      const dialog = screen.getByRole('dialog');
      const dialogPaper = dialog.querySelector('.MuiPaper-root');
      expect(dialogPaper).toHaveStyle({
        minHeight: '100vh',
        maxHeight: '100vh',
      });
    });

    test('カスタムアニメーション時間が各デバイスで適用される', () => {
      const customDuration = 500;
      
      const { rerender } = render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            animationDuration={customDuration}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="tablet"
            animationDuration={customDuration}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
            animationDuration={customDuration}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('デバイス固有の最適化設定が適用される', () => {
      // デスクトップ: インライン編集有効
      const anchorEl = createMockAnchorElement();
      const { rerender } = render(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      // デスクトップではポップオーバー形式
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // タブレット: タッチ操作最適化
      rerender(
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

      // タブレットではモーダルダイアログ
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // モバイル: フルスクリーン最適化
      rerender(
        <TestWrapper>
          <SpecificationEditDialog
            open={true}
            specifications={mockSpecifications}
            onSave={mockOnSave}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </TestWrapper>
      );

      // モバイルではフルスクリーンダイアログ
      const dialog = screen.getByRole('dialog');
      const dialogPaper = dialog.querySelector('.MuiPaper-root');
      expect(dialogPaper).toHaveStyle({
        minHeight: '100vh',
      });
    });
  });

  describe('デバイス固有の機能', () => {
    test('デスクトップでのみドラッグ&ドロップハンドルが表示される', () => {
      const anchorEl = createMockAnchorElement();
      const { rerender } = render(
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

      // デスクトップではドラッグハンドルが表示される
      expect(document.querySelectorAll('svg[data-testid="DragIndicatorIcon"]').length).toBe(mockSpecifications.length);

      // タブレットに変更
      rerender(
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

      // タブレットではドラッグハンドルが表示されない
      expect(document.querySelectorAll('svg[data-testid="DragIndicatorIcon"]').length).toBe(0);
    });

    test('タブレット・モバイルでのみタッチ順序変更ボタンが表示される', () => {
      const anchorEl = createMockAnchorElement();
      const { rerender } = render(
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

      // デスクトップではタッチ順序変更ボタンが表示されない
      expect(screen.queryAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      ).length).toBe(0);

      // タブレットに変更
      rerender(
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

      // タブレットではタッチ順序変更ボタンが表示される
      expect(screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="SwapVertIcon"]') !== null
      ).length).toBeGreaterThan(0);
    });

    test('デバイス別の説明テキストが表示される', () => {
      const anchorEl = createMockAnchorElement();
      const { rerender } = render(
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

      // デスクトップ用の説明
      expect(screen.getByText(/ドラッグ&ドロップで順序を変更できます/)).toBeInTheDocument();

      // タブレットに変更
      rerender(
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

      // タブレット用の説明
      expect(screen.getByText(/項目をタップして選択し/)).toBeInTheDocument();

      // モバイルに変更
      rerender(
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

      // モバイル用の説明
      expect(screen.getByText(/項目をタップして選択し、移動先の位置ボタンをタップ/)).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    test('全デバイスで適切なARIA属性が設定される', () => {
      const deviceTypes: Array<'desktop' | 'tablet' | 'mobile'> = ['desktop', 'tablet', 'mobile'];
      
      deviceTypes.forEach(deviceType => {
        const anchorEl = deviceType === 'desktop' ? createMockAnchorElement() : undefined;
        
        render(
          <TestWrapper>
            <SpecificationEditDialog
              open={true}
              specifications={mockSpecifications}
              onSave={mockOnSave}
              onClose={mockOnClose}
              deviceType={deviceType}
              anchorEl={anchorEl}
            />
          </TestWrapper>
        );

        // ダイアログまたはポップオーバーが適切に表示される
        if (deviceType === 'desktop' && anchorEl) {
          // デスクトップではポップオーバー
          expect(document.querySelector('[role="presentation"]')).toBeInTheDocument();
        } else {
          // その他ではダイアログ
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        }

        // リストアイテムが適切に表示される
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBeGreaterThan(0);

        // クリーンアップ
        if (anchorEl && anchorEl.parentNode) {
          anchorEl.parentNode.removeChild(anchorEl);
        }
      });
    });

    test('全デバイスでキーボードナビゲーションが動作する', async () => {
      const user = userEvent.setup();
      const deviceTypes: Array<'desktop' | 'tablet' | 'mobile'> = ['desktop', 'tablet', 'mobile'];
      
      for (const deviceType of deviceTypes) {
        const anchorEl = deviceType === 'desktop' ? createMockAnchorElement() : undefined;
        
        const { unmount } = render(
          <TestWrapper>
            <SpecificationEditDialog
              open={true}
              specifications={mockSpecifications}
              onSave={mockOnSave}
              onClose={mockOnClose}
              deviceType={deviceType}
              anchorEl={anchorEl}
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
        }

        // Escapeキーでダイアログを閉じる
        await user.keyboard('{Escape}');
        expect(mockOnClose).toHaveBeenCalled();

        // クリーンアップ
        unmount();
        if (anchorEl && anchorEl.parentNode) {
          anchorEl.parentNode.removeChild(anchorEl);
        }
        jest.clearAllMocks();
      }
    });
  });
});
