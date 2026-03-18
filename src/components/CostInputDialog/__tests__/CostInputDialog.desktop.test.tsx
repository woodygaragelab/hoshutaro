import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CostInputDialog, CostInputDialogProps } from '../CostInputDialog';
import { CostValue } from '../../CommonEdit/types';
import '@testing-library/jest-dom';

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
};

describe('CostInputDialog - デスクトップ専用', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('ポップオーバー形式で正しくレンダリングされる', () => {
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

    it('現在のコスト値が正しく表示される', () => {
      const anchorEl = document.createElement('div');
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} anchorEl={anchorEl} />
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

  describe('キーボード操作', () => {
    it('Escapeキーで閉じることができる', async () => {
      const onClose = jest.fn();
      const anchorEl = document.createElement('div');
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} onClose={onClose} anchorEl={anchorEl} />
        </TestWrapper>
      );

      const dialog = screen.getByText('コスト入力').closest('[role="presentation"]');
      fireEvent.keyDown(dialog!, { key: 'Escape' });
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('Ctrl+Enterで保存できる', async () => {
      const onSave = jest.fn();
      const anchorEl = document.createElement('div');
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} onSave={onSave} anchorEl={anchorEl} />
        </TestWrapper>
      );

      const dialog = screen.getByText('コスト入力').closest('[role="presentation"]');
      fireEvent.keyDown(dialog!, { key: 'Enter', ctrlKey: true });
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
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

    it('キャンセルボタンクリックでダイアログが閉じる', async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} onClose={onClose} />
        </TestWrapper>
      );

      const cancelButton = screen.getByText('キャンセル');
      await user.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('数値フォーマット', () => {
    it('大きな数値が正しくフォーマットされる', () => {
      const costValue: CostValue = { planCost: 1234567, actualCost: 987654 };
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} currentCost={costValue} />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('1,234,567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('987,654')).toBeInTheDocument();
    });

    it('ゼロ値が正しく表示される', () => {
      const costValue: CostValue = { planCost: 0, actualCost: 0 };
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} currentCost={costValue} />
        </TestWrapper>
      );

      const inputs = screen.getAllByDisplayValue('0');
      expect(inputs).toHaveLength(2);
    });
  });

  describe('バリデーション', () => {
    it('負の値を入力できない', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} onSave={onSave} />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      await user.clear(planCostInput);
      await user.type(planCostInput, '-1000');
      
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);
      
      // 負の値は保存されない
      expect(onSave).not.toHaveBeenCalled();
    });

    it('非数値文字が入力できない', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      await user.clear(planCostInput);
      await user.type(planCostInput, 'abc');
      
      // 数値以外は入力されない
      expect(planCostInput).toHaveValue('');
    });
  });

  describe('アニメーション設定', () => {
    it('カスタムアニメーション時間が適用される', () => {
      const anchorEl = document.createElement('div');
      render(
        <TestWrapper>
          <CostInputDialog 
            {...defaultProps} 
            anchorEl={anchorEl}
            animationDuration={500}
          />
        </TestWrapper>
      );

      expect(screen.getByText('コスト入力')).toBeInTheDocument();
    });
  });

  describe('読み取り専用モード', () => {
    it('読み取り専用モードで入力が無効化される', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} readOnly={true} />
        </TestWrapper>
      );

      const planCostInput = screen.getByLabelText('計画コスト');
      const actualCostInput = screen.getByLabelText('実績コスト');
      
      expect(planCostInput).toBeDisabled();
      expect(actualCostInput).toBeDisabled();
    });

    it('読み取り専用モードで保存ボタンが無効化される', () => {
      render(
        <TestWrapper>
          <CostInputDialog {...defaultProps} readOnly={true} />
        </TestWrapper>
      );

      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
    });
  });
});
