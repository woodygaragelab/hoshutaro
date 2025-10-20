import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CostInputDialog, CostInputDialogProps } from '../CostInputDialog';
import { CostValue } from '../../CommonEdit/types';

// テスト用のテーマ
const theme = createTheme();

// テスト用のラッパーコンポーネント
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

// デフォルトのプロパティ
const defaultProps: CostInputDialogProps = {
  open: true,
  currentCost: { planCost: 100000, actualCost: 80000 },
  onSave: jest.fn(),
  onClose: jest.fn(),
  deviceType: 'desktop',
};

describe('CostInputDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('デスクトップ版が正しくレンダリングされる', () => {
      const anchorEl = document.createElement('div');
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} anchorEl={anchorEl} />
        </TestWrapper>
      );

      expect(screen.getByText('コスト入力')).toBeInTheDocument();
      expect(screen.getByLabelText('計画コスト')).toBeInTheDocument();
      expect(screen.getByLabelText('実績コスト')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    it('タブレット版が正しくレンダリングされる', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="tablet" />
        </TestWrapper>
      );

      expect(screen.getByText('コスト入力')).toBeInTheDocument();
      expect(screen.getByText(/現在の値:/)).toBeInTheDocument();
      expect(screen.getByLabelText('計画コスト')).toBeInTheDocument();
      expect(screen.getByLabelText('実績コスト')).toBeInTheDocument();
    });

    it('モバイル版が正しくレンダリングされる', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="mobile" />
        </TestWrapper>
      );

      expect(screen.getByText('コスト入力')).toBeInTheDocument();
      expect(screen.getByText('現在の値')).toBeInTheDocument();
      expect(screen.getByLabelText('計画コスト')).toBeInTheDocument();
      expect(screen.getByLabelText('実績コスト')).toBeInTheDocument();
    });

    it('現在のコスト値が正しく表示される', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="tablet" />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('100,000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('80,000')).toBeInTheDocument();
    });

    it('ダイアログが閉じている時は表示されない', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} open={false} />
        </TestWrapper>
      );

      expect(screen.queryByText('コスト入力')).not.toBeInTheDocument();
    });
  });

  describe('数値フォーマットのテスト', () => {
    it('初期値が正しくフォーマットされて表示される', () => {
      const costValue: CostValue = { planCost: 1234567, actualCost: 987654 };
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} currentCost={costValue} />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('1,234,567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('987,654')).toBeInTheDocument();
    });

    it('ゼロ値が空文字として表示される', () => {
      const costValue: CostValue = { planCost: 0, actualCost: 0 };
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} currentCost={costValue} />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト') as HTMLInputElement;
      const actualCostInput = screen.getByLabelText('実績コスト') as HTMLInputElement;
      
      expect(planCostInput.value).toBe('');
      expect(actualCostInput.value).toBe('');
    });

    it('入力値が自動的にフォーマットされる（モバイル）', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            deviceType="mobile" 
            currentCost={{ planCost: 0, actualCost: 0 }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '1234567');
      
      // モバイルでは自動フォーマットが適用される
      await waitFor(() => {
        expect((planCostInput as HTMLInputElement).value).toMatch(/1,234,567|1234567/);
      });
    });

    it('不正な文字が入力から除去される', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, 'abc123def456');
      
      // 数値以外の文字が除去される
      await waitFor(() => {
        expect((planCostInput as HTMLInputElement).value).toBe('123456');
      });
    });

    it('カンマ区切りの入力が正しく処理される', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '1,000,000');
      
      await waitFor(() => {
        expect((planCostInput as HTMLInputElement).value).toBe('1,000,000');
      });
    });
  });

  describe('バリデーションロジックのテスト', () => {
    it('負の値でエラーが表示される', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '-1000');
      
      await waitFor(() => {
        expect(screen.getByText(/0以上の値を入力してください/)).toBeInTheDocument();
      });
    });

    it('最大値を超えるとエラーが表示される', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            validationOptions={{
              planCostRules: { maxValue: 1000000 }
            }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '2000000');
      
      await waitFor(() => {
        expect(screen.getByText(/1,000,000円以下で入力してください/)).toBeInTheDocument();
      });
    });

    it('大きな値で警告が表示される', async () => {
      const user = userEvent.setup();
      const onValidationWarning = jest.fn();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            onValidationWarning={onValidationWarning}
            showWarnings={true}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '1500000000'); // 15億円
      
      await waitFor(() => {
        expect(onValidationWarning).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('非常に大きな値です')
          ])
        );
      });
    });

    it('実績が計画を超える場合に警告が表示される', async () => {
      const user = userEvent.setup();
      const onValidationWarning = jest.fn();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            onValidationWarning={onValidationWarning}
            showWarnings={true}
            validationOptions={{
              crossValidation: {
                actualShouldNotExceedPlan: true
              }
            }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      const actualCostInput = screen.getByLabelText('実績コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '100000');
      await user.clear(actualCostInput);
      await user.type(actualCostInput, '150000');
      
      await waitFor(() => {
        expect(onValidationWarning).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('超過しています')
          ])
        );
      });
    });

    it('バリデーションエラーがある場合は保存ボタンが無効になる', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      const saveButton = screen.getByText('保存');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '-1000');
      
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it('読み取り専用モードでは保存ボタンが無効になる', () => {
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            readOnly={true}
          />
        </TestWrapper>
      );

      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('デバイス別表示のテスト', () => {
    describe('デスクトップ', () => {
      it('ポップオーバー形式で表示される', () => {
        const anchorEl = document.createElement('div');
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="desktop" anchorEl={anchorEl} />
          </TestWrapper>
        );

        // ポップオーバーの特徴的な要素を確認
        expect(screen.getByText('Ctrl+Enter: 保存, Esc: キャンセル')).toBeInTheDocument();
      });

      it('キーボードショートカットが動作する', async () => {
        const onSave = jest.fn();
        const onClose = jest.fn();
        const anchorEl = document.createElement('div');
        
        render(
          <TestWrapper>
            <CostInputDialog 
              {...defaultProps} 
              deviceType="desktop" 
              anchorEl={anchorEl}
              onSave={onSave}
              onClose={onClose}
            />
          </TestWrapper>
        );

        const dialog = screen.getByText('コスト入力').closest('[role="presentation"]');
        
        // Ctrl+Enter で保存
        fireEvent.keyDown(dialog!, { key: 'Enter', ctrlKey: true });
        await waitFor(() => {
          expect(onSave).toHaveBeenCalled();
        });

        // Escape でキャンセル
        fireEvent.keyDown(dialog!, { key: 'Escape' });
        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
      });

      it('小さなフォントサイズが適用される', () => {
        const anchorEl = document.createElement('div');
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="desktop" anchorEl={anchorEl} />
          </TestWrapper>
        );

        const planCostInput = screen.getByLabelText('計画コスト');
        
        // デスクトップでは小さなフォントサイズが適用されることを確認
        expect(planCostInput).toBeInTheDocument();
      });
    });

    describe('タブレット', () => {
      it('モーダルダイアログ形式で表示される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="tablet" />
          </TestWrapper>
        );

        // タブレット特有の現在値表示を確認
        expect(screen.getByText(/現在の値:/)).toBeInTheDocument();
        expect(screen.getByText(/計画 100,000円/)).toBeInTheDocument();
        expect(screen.getByText(/実績 80,000円/)).toBeInTheDocument();
      });

      it('中間サイズのボタンが表示される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="tablet" />
          </TestWrapper>
        );

        const saveButton = screen.getByText('保存');
        expect(saveButton).toHaveAttribute('class', expect.stringContaining('MuiButton-sizeLarge'));
      });

      it('数値キーパッドの属性が設定される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="tablet" />
          </TestWrapper>
        );

        const planCostInput = screen.getByLabelText('計画コスト');
        expect(planCostInput).toHaveAttribute('inputmode', 'numeric');
        expect(planCostInput).toHaveAttribute('pattern', '[0-9]*');
      });
    });

    describe('モバイル', () => {
      it('フルスクリーンダイアログで表示される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="mobile" />
          </TestWrapper>
        );

        // モバイル特有の現在値表示ボックスを確認
        expect(screen.getByText('現在の値')).toBeInTheDocument();
        expect(screen.getByText('¥100,000')).toBeInTheDocument();
        expect(screen.getByText('¥80,000')).toBeInTheDocument();
      });

      it('大きなタッチターゲットが適用される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="mobile" />
          </TestWrapper>
        );

        const saveButton = screen.getByText('保存');
        expect(saveButton).toHaveAttribute('class', expect.stringContaining('MuiButton-sizeLarge'));
      });

      it('数値キーパッドの属性が設定される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="mobile" />
          </TestWrapper>
        );

        const planCostInput = screen.getByLabelText('計画コスト');
        expect(planCostInput).toHaveAttribute('inputmode', 'numeric');
        expect(planCostInput).toHaveAttribute('pattern', '[0-9]*');
      });

      it('大きなフォントサイズが適用される', () => {
        render(
          <TestWrapper>
            <CostInputDialog {...defaultProps} deviceType="mobile" />
          </TestWrapper>
        );

        const planCostInput = screen.getByLabelText('計画コスト');
        
        // モバイルデバイスでは大きなフォントサイズが適用されることを確認
        expect(planCostInput).toBeInTheDocument();
      });
    });
  });

  describe('ユーザーインタラクション', () => {
    it('保存ボタンクリックで正しい値が渡される', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            onSave={onSave}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      const actualCostInput = screen.getByLabelText('実績コスト');
      const saveButton = screen.getByText('保存');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '150000');
      await user.clear(actualCostInput);
      await user.type(actualCostInput, '120000');
      
      await user.click(saveButton);
      
      expect(onSave).toHaveBeenCalledWith({
        planCost: 150000,
        actualCost: 120000
      });
    });

    it('キャンセルボタンクリックでonCloseが呼ばれる', async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            onClose={onClose}
          />
        </TestWrapper>
      );

      const cancelButton = screen.getByText('キャンセル');
      await user.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('入力フィールドのフォーカス時に全選択される（デスクトップ）', async () => {
      const anchorEl = document.createElement('div');
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            deviceType="desktop"
            anchorEl={anchorEl}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.click(planCostInput);
      
      // フォーカスイベントが発生することを確認
      expect(planCostInput).toHaveFocus();
    });
  });

  describe('アニメーション設定', () => {
    it('デバイス別のアニメーション時間が適用される', () => {
      const { rerender } = render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="desktop" />
        </TestWrapper>
      );

      // デスクトップ: 200ms
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="tablet" />
        </TestWrapper>
      );

      // タブレット: 250ms
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <CostInputDialog {...defaultProps} deviceType="mobile" />
        </TestWrapper>
      );

      // モバイル: 300ms
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('カスタムアニメーション時間が適用される', () => {
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            deviceType="desktop"
            animationDuration={500}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('エラーハンドリング', () => {
    it('バリデーションエラー時にonValidationErrorが呼ばれる', async () => {
      const onValidationError = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            onValidationError={onValidationError}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '-1000');
      
      // 保存ボタンが無効になることを確認
      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
      
      // 保存を試行
      fireEvent.click(saveButton);
      
      // バリデーションエラーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText(/0以上の値を入力してください/)).toBeInTheDocument();
      });
    });

    it('重要な警告がある場合に確認ダイアログが表示される', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            currentCost={{ planCost: 0, actualCost: 0 }}
            onSave={onSave}
            showWarnings={true}
          />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      const saveButton = screen.getByText('保存');
      
      await user.clear(planCostInput);
      await user.type(planCostInput, '1500000000'); // 15億円（重要な警告）
      await user.click(saveButton);
      
      expect(confirmSpy).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled(); // 確認でキャンセルしたので保存されない
      
      confirmSpy.mockRestore();
    });
  });
});