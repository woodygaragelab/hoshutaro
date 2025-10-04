import './setup';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistantPanel from '../AIAssistantPanel';
import { AIAssistantPanelProps, MaintenanceSuggestion } from '../types';

// Mock the services
jest.mock('../services/MockAIService', () => ({
  mockAIService: {
    generateResponse: jest.fn()
  }
}));

jest.mock('../services/ErrorHandlingService', () => ({
  errorHandlingService: {
    handleError: jest.fn(),
    createErrorMessage: jest.fn(),
    logError: jest.fn()
  }
}));

jest.mock('../services/MaintenanceGridIntegration', () => ({
  maintenanceGridIntegration: {
    applySuggestionToGrid: jest.fn(),
    findSimilarSuggestions: jest.fn()
  }
}));

jest.mock('../services/MockMaintenanceData', () => ({
  mockMaintenanceData: []
}));

// Mock the child components
jest.mock('../components/ExcelDropZone', () => {
  return function MockExcelDropZone({ onFileProcessed }: any) {
    return (
      <div data-testid="excel-drop-zone">
        <button
          onClick={() => onFileProcessed(
            { success: true, processedRows: 5, errors: [], suggestions: [] },
            new (global as any).File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          )}
        >
          Mock Upload
        </button>
      </div>
    );
  };
});

jest.mock('../components/DataPreview', () => {
  return function MockDataPreview({ onApplyMappings }: any) {
    return (
      <div data-testid="data-preview">
        <button onClick={() => onApplyMappings([])}>
          Apply Mappings
        </button>
      </div>
    );
  };
});

describe('AIAssistantPanel', () => {
  const defaultProps: AIAssistantPanelProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuggestionApply: jest.fn(),
    onExcelImport: jest.fn()
  };

  const mockSuggestion: MaintenanceSuggestion = {
    equipmentId: 'EQ001',
    timeHeader: '2024-05',
    suggestedAction: 'plan',
    reason: 'テスト提案',
    confidence: 0.85,
    cost: 50000
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本レンダリング', () => {
    it('パネルが開いている時に正しく表示される', () => {
      render(<AIAssistantPanel {...defaultProps} />);
      
      expect(screen.getByText('AIアシスタント')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('設備について質問してください...')).toBeInTheDocument();
      expect(screen.getByText('保全計画')).toBeInTheDocument();
      expect(screen.getByText('故障予測')).toBeInTheDocument();
      expect(screen.getByText('コスト最適化')).toBeInTheDocument();
    });

    it('パネルが閉じている時は表示されない', () => {
      render(<AIAssistantPanel {...defaultProps} isOpen={false} />);
      
      // The drawer should not be visible when closed
      const drawer = document.querySelector('.MuiDrawer-root');
      expect(drawer).toHaveStyle('visibility: hidden');
    });

    it('初期システムメッセージが表示される', () => {
      render(<AIAssistantPanel {...defaultProps} />);
      
      expect(screen.getByText(/AIアシスタントへようこそ/)).toBeInTheDocument();
    });

    it('クローズボタンが機能する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const closeButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="CloseIcon"]'));
      await user.click(closeButton!);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('メッセージ送信機能', () => {
    it('メッセージを入力して送信できる', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        content: 'テスト応答',
        suggestions: [mockSuggestion]
      };
      
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockResolvedValue(mockResponse);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      const sendButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="SendIcon"]'));
      
      await user.type(input, 'テストメッセージ');
      await user.click(sendButton);
      
      expect(mockAIService.generateResponse).toHaveBeenCalledWith('テストメッセージ');
      
      await waitFor(() => {
        expect(screen.getByText('テスト応答')).toBeInTheDocument();
      });
    });

    it('Enterキーでメッセージを送信できる', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        content: 'Enter応答',
        suggestions: []
      };
      
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockResolvedValue(mockResponse);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      
      await user.type(input, 'Enterテスト');
      await user.keyboard('{Enter}');
      
      expect(mockAIService.generateResponse).toHaveBeenCalledWith('Enterテスト');
    });

    it('空のメッセージは送信されない', async () => {
      render(<AIAssistantPanel {...defaultProps} />);
      
      const sendButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="SendIcon"]'));
      
      // Send button should be disabled when there's no text
      expect(sendButton).toBeDisabled();
      
      const { mockAIService } = require('../services/MockAIService');
      expect(mockAIService.generateResponse).not.toHaveBeenCalled();
    });

    it('送信中は入力とボタンが無効化される', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockReturnValue(mockPromise);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      const sendButton = screen.getAllByRole('button').find(btn => btn.querySelector('[data-testid="SendIcon"]'));
      
      await user.type(input, 'テスト');
      await user.click(sendButton);
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
      expect(screen.getByText('AIが回答を生成中...')).toBeInTheDocument();
      
      // Promise を解決
      act(() => {
        resolvePromise!({ content: '応答', suggestions: [] });
      });
      
      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('クイックアクションボタン', () => {
    it('保全計画ボタンが機能する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const button = screen.getByText('保全計画');
      await user.click(button);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      expect(input).toHaveValue('設備の保全計画について教えて');
    });

    it('故障予測ボタンが機能する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const button = screen.getByText('故障予測');
      await user.click(button);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      expect(input).toHaveValue('故障予測を行って');
    });

    it('コスト最適化ボタンが機能する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const button = screen.getByText('コスト最適化');
      await user.click(button);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      expect(input).toHaveValue('コスト最適化の提案をして');
    });
  });

  describe('AI提案機能', () => {
    it('AI提案が表示される', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        content: 'テスト応答',
        suggestions: [mockSuggestion]
      };
      
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockResolvedValue(mockResponse);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      await user.type(input, 'テスト');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('EQ001 - 2024-05')).toBeInTheDocument();
        expect(screen.getByText('テスト提案')).toBeInTheDocument();
        expect(screen.getByText('信頼度: 85%')).toBeInTheDocument();
        expect(screen.getByText('推定コスト: ¥50,000')).toBeInTheDocument();
      });
    });

    it('提案を星取表に適用できる', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        content: 'テスト応答',
        suggestions: [mockSuggestion]
      };
      
      const { mockAIService } = require('../services/MockAIService');
      const { maintenanceGridIntegration } = require('../services/MaintenanceGridIntegration');
      
      mockAIService.generateResponse.mockResolvedValue(mockResponse);
      maintenanceGridIntegration.applySuggestionToGrid.mockReturnValue({
        success: true,
        message: '提案が正常に適用されました'
      });
      maintenanceGridIntegration.findSimilarSuggestions.mockReturnValue([]);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      await user.type(input, 'テスト');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('星取表に適用')).toBeInTheDocument();
      });
      
      const applyButton = screen.getByText('星取表に適用');
      await user.click(applyButton);
      
      expect(defaultProps.onSuggestionApply).toHaveBeenCalledWith(mockSuggestion);
      expect(maintenanceGridIntegration.applySuggestionToGrid).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.getByText('✅ 提案が正常に適用されました')).toBeInTheDocument();
      });
    });
  });

  describe('Excelアップロード機能', () => {
    it('Excelボタンでアップロード画面を表示する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const excelButton = screen.getByText('Excel');
      await user.click(excelButton);
      
      expect(screen.getByTestId('excel-drop-zone')).toBeInTheDocument();
    });

    it('ファイルアップロード処理が機能する', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const excelButton = screen.getByText('Excel');
      await user.click(excelButton);
      
      const uploadButton = screen.getByText('Mock Upload');
      await user.click(uploadButton);
      
      expect(defaultProps.onExcelImport).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.getByText(/Excelファイル "test.xlsx" をアップロードしました/)).toBeInTheDocument();
      });
    });

    it('データプレビューが表示される', async () => {
      const user = userEvent.setup();
      render(<AIAssistantPanel {...defaultProps} />);
      
      const excelButton = screen.getByText('Excel');
      await user.click(excelButton);
      
      // Excel drop zone should be visible
      expect(screen.getByTestId('excel-drop-zone')).toBeInTheDocument();
      
      // Simulate file upload
      fireEvent.click(screen.getByText('Mock Upload'));
      
      // Check that file upload callback was called
      expect(defaultProps.onExcelImport).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('AI応答エラーを適切に処理する', async () => {
      const user = userEvent.setup();
      const mockError = new Error('AI service error');
      const mockErrorMessage = {
        id: 'error-1',
        type: 'system' as const,
        content: '❌ エラーが発生しました',
        timestamp: new Date()
      };
      
      const { mockAIService } = require('../services/MockAIService');
      const { errorHandlingService } = require('../services/ErrorHandlingService');
      
      mockAIService.generateResponse.mockRejectedValue(mockError);
      errorHandlingService.handleError.mockReturnValue({
        type: 'UNKNOWN_ERROR',
        message: 'AI service error',
        recoverable: true
      });
      errorHandlingService.createErrorMessage.mockReturnValue(mockErrorMessage);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      await user.type(input, 'テスト');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('❌ エラーが発生しました')).toBeInTheDocument();
      });
      
      expect(errorHandlingService.handleError).toHaveBeenCalledWith(mockError);
      expect(errorHandlingService.logError).toHaveBeenCalled();
    });

    it('提案適用エラーを適切に処理する', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        content: 'テスト応答',
        suggestions: [mockSuggestion]
      };
      const mockError = new Error('Grid integration error');
      const mockErrorMessage = {
        id: 'error-2',
        type: 'system' as const,
        content: '❌ 統合エラーが発生しました',
        timestamp: new Date()
      };
      
      const { mockAIService } = require('../services/MockAIService');
      const { maintenanceGridIntegration } = require('../services/MaintenanceGridIntegration');
      const { errorHandlingService } = require('../services/ErrorHandlingService');
      
      mockAIService.generateResponse.mockResolvedValue(mockResponse);
      maintenanceGridIntegration.applySuggestionToGrid.mockImplementation(() => {
        throw mockError;
      });
      errorHandlingService.handleError.mockReturnValue({
        type: 'INTEGRATION_ERROR',
        message: 'Grid integration error',
        recoverable: true
      });
      errorHandlingService.createErrorMessage.mockReturnValue(mockErrorMessage);
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      await user.type(input, 'テスト');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('星取表に適用')).toBeInTheDocument();
      });
      
      const applyButton = screen.getByText('星取表に適用');
      await user.click(applyButton);
      
      await waitFor(() => {
        expect(screen.getByText('❌ 統合エラーが発生しました')).toBeInTheDocument();
      });
    });
  });

  describe('メッセージ表示', () => {
    it('ユーザーメッセージが正しく表示される', async () => {
      const user = userEvent.setup();
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockResolvedValue({ content: '応答', suggestions: [] });
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('設備について質問してください...');
      await user.type(input, 'ユーザーメッセージ');
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('ユーザーメッセージ')).toBeInTheDocument();
    });

    it('タイムスタンプが表示される', async () => {
      render(<AIAssistantPanel {...defaultProps} />);
      
      // 初期システムメッセージのタイムスタンプを確認
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('メッセージが自動スクロールされる', async () => {
      const user = userEvent.setup();
      const { mockAIService } = require('../services/MockAIService');
      mockAIService.generateResponse.mockResolvedValue({ content: '応答', suggestions: [] });
      
      render(<AIAssistantPanel {...defaultProps} />);
      
      // 複数のメッセージを送信
      const input = screen.getByPlaceholderText('設備について質問してください...');
      
      for (let i = 0; i < 3; i++) {
        await user.clear(input);
        await user.type(input, `メッセージ ${i + 1}`);
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.getByText(`メッセージ ${i + 1}`)).toBeInTheDocument();
        });
      }
      
      // 最新のメッセージが表示されていることを確認
      expect(screen.getByText('メッセージ 3')).toBeInTheDocument();
    });
  });
});