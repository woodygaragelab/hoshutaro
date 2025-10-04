import { ErrorHandlingService, errorHandlingService, AIErrorType, AIError } from '../services/ErrorHandlingService';
import { ChatMessage } from '../types';

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;

  beforeEach(() => {
    service = new ErrorHandlingService();
    // Mock console.error to avoid noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleError', () => {
    it('ネットワークエラーを正しく分類する', () => {
      const networkError = new Error('fetch failed');
      networkError.name = 'NetworkError';
      
      const aiError = service.handleError(networkError);
      
      expect(aiError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.message).toContain('通信に失敗');
    });

    it('ファイル処理エラーを正しく分類する', () => {
      const fileError = new Error('Excel file processing failed');
      
      const aiError = service.handleError(fileError);
      
      expect(aiError.type).toBe(AIErrorType.FILE_PROCESSING_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.suggestedActions).toBeDefined();
      expect(aiError.suggestedActions?.length).toBeGreaterThan(0);
    });

    it('統合エラーを正しく分類する', () => {
      const integrationError = new Error('grid integration failed');
      
      const aiError = service.handleError(integrationError);
      
      expect(aiError.type).toBe(AIErrorType.INTEGRATION_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.message).toContain('星取表との統合');
    });

    it('バリデーションエラーを正しく分類する', () => {
      const validationError = new Error('validation failed: invalid data');
      
      const aiError = service.handleError(validationError);
      
      expect(aiError.type).toBe(AIErrorType.VALIDATION_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.message).toContain('検証でエラー');
    });

    it('提案適用エラーを正しく分類する', () => {
      const suggestionError = new Error('suggestion apply failed');
      
      const aiError = service.handleError(suggestionError);
      
      expect(aiError.type).toBe(AIErrorType.SUGGESTION_APPLICATION_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.message).toContain('AI提案の適用');
    });

    it('不明なエラーをデフォルトタイプに分類する', () => {
      const unknownError = new Error('some unknown error');
      
      const aiError = service.handleError(unknownError);
      
      expect(aiError.type).toBe(AIErrorType.UNKNOWN_ERROR);
      expect(aiError.recoverable).toBe(true);
      expect(aiError.message).toBe('some unknown error');
    });

    it('エラーメッセージがない場合のデフォルト処理', () => {
      const errorWithoutMessage = {} as Error;
      
      const aiError = service.handleError(errorWithoutMessage);
      
      expect(aiError.type).toBe(AIErrorType.UNKNOWN_ERROR);
      expect(aiError.message).toContain('予期しないエラー');
    });
  });

  describe('createErrorMessage', () => {
    it('ネットワークエラーメッセージを正しく生成する', () => {
      const aiError: AIError = {
        type: AIErrorType.NETWORK_ERROR,
        message: 'Connection failed',
        recoverable: true
      };
      
      const chatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage.type).toBe('system');
      expect(chatMessage.content).toContain('❌ ネットワークエラー');
      expect(chatMessage.content).toContain('Connection failed');
      expect(chatMessage.content).toContain('🔧 対処方法');
      expect(chatMessage.content).toContain('インターネット接続を確認');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });

    it('ファイル処理エラーメッセージを正しく生成する', () => {
      const aiError: AIError = {
        type: AIErrorType.FILE_PROCESSING_ERROR,
        message: 'Invalid file format',
        details: 'Unsupported file type: .txt',
        recoverable: true
      };
      
      const chatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage.content).toContain('❌ ファイル処理エラー');
      expect(chatMessage.content).toContain('Invalid file format');
      expect(chatMessage.content).toContain('詳細: Unsupported file type: .txt');
      expect(chatMessage.content).toContain('ファイル形式が正しいか確認');
    });

    it('復旧不可能なエラーでは対処方法を表示しない', () => {
      const aiError: AIError = {
        type: AIErrorType.UNKNOWN_ERROR,
        message: 'Critical system error',
        recoverable: false
      };
      
      const chatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage.content).toContain('❌ 不明なエラー');
      expect(chatMessage.content).not.toContain('🔧 対処方法');
    });

    it('推奨アクションが含まれる場合は表示する', () => {
      const aiError: AIError = {
        type: AIErrorType.VALIDATION_ERROR,
        message: 'Data validation failed',
        recoverable: true,
        suggestedActions: ['データを確認してください', '形式を修正してください']
      };
      
      const chatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage.content).toContain('💡 推奨アクション');
      expect(chatMessage.content).toContain('• データを確認してください');
      expect(chatMessage.content).toContain('• 形式を修正してください');
    });

    it('詳細情報がオブジェクトの場合はJSON文字列として表示する', () => {
      const aiError: AIError = {
        type: AIErrorType.INTEGRATION_ERROR,
        message: 'Integration failed',
        details: { equipmentId: 'EQ001', error: 'Not found' },
        recoverable: true
      };
      
      const chatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage.content).toContain('詳細: {"equipmentId":"EQ001","error":"Not found"}');
    });
  });

  describe('createRetryMessage', () => {
    it('再試行メッセージを正しく生成する', () => {
      const originalError: AIError = {
        type: AIErrorType.NETWORK_ERROR,
        message: 'Connection timeout',
        recoverable: true
      };
      
      const retryAction = jest.fn();
      const chatMessage = service.createRetryMessage(originalError, retryAction);
      
      expect(chatMessage.type).toBe('system');
      expect(chatMessage.content).toContain('🔄 エラーが発生しましたが、自動的に再試行します');
      expect(chatMessage.content).toContain('元のエラー: Connection timeout');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createSuccessMessage', () => {
    it('成功メッセージを正しく生成する', () => {
      const action = 'データのインポート';
      const chatMessage = service.createSuccessMessage(action);
      
      expect(chatMessage.type).toBe('system');
      expect(chatMessage.content).toBe('✅ データのインポートが正常に完了しました。');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('logError', () => {
    it('エラーログを正しく出力する', () => {
      const aiError: AIError = {
        type: AIErrorType.FILE_PROCESSING_ERROR,
        message: 'File processing failed',
        details: 'Invalid format',
        recoverable: true
      };
      
      const context = { fileName: 'test.xlsx', action: 'upload' };
      
      service.logError(aiError, context);
      
      expect(console.error).toHaveBeenCalledWith('AI Assistant Error:', {
        type: AIErrorType.FILE_PROCESSING_ERROR,
        message: 'File processing failed',
        details: 'Invalid format',
        recoverable: true,
        context,
        timestamp: expect.any(String)
      });
    });

    it('コンテキストなしでもログを出力する', () => {
      const aiError: AIError = {
        type: AIErrorType.NETWORK_ERROR,
        message: 'Network error',
        recoverable: true
      };
      
      service.logError(aiError);
      
      expect(console.error).toHaveBeenCalledWith('AI Assistant Error:', {
        type: AIErrorType.NETWORK_ERROR,
        message: 'Network error',
        recoverable: true,
        context: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('エラータイプ別メッセージ内容', () => {
    const errorTypes = [
      AIErrorType.NETWORK_ERROR,
      AIErrorType.VALIDATION_ERROR,
      AIErrorType.INTEGRATION_ERROR,
      AIErrorType.FILE_PROCESSING_ERROR,
      AIErrorType.SUGGESTION_APPLICATION_ERROR,
      AIErrorType.UNKNOWN_ERROR
    ];

    errorTypes.forEach(errorType => {
      it(`${errorType}に対して適切なメッセージを生成する`, () => {
        const aiError: AIError = {
          type: errorType,
          message: 'Test error message',
          recoverable: true
        };
        
        const chatMessage = service.createErrorMessage(aiError);
        
        expect(chatMessage.content).toContain('❌');
        expect(chatMessage.content).toContain('Test error message');
        expect(chatMessage.content).toContain('🔧 対処方法');
        expect(chatMessage.type).toBe('system');
        expect(chatMessage.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('singleton instance', () => {
    it('errorHandlingServiceがErrorHandlingServiceのインスタンスである', () => {
      expect(errorHandlingService).toBeInstanceOf(ErrorHandlingService);
    });
  });

  describe('メッセージ形式の検証', () => {
    it('生成されるメッセージがChatMessageインターフェースに準拠する', () => {
      const aiError: AIError = {
        type: AIErrorType.VALIDATION_ERROR,
        message: 'Validation failed',
        recoverable: true
      };
      
      const chatMessage: ChatMessage = service.createErrorMessage(aiError);
      
      expect(chatMessage).toHaveProperty('id');
      expect(chatMessage).toHaveProperty('type');
      expect(chatMessage).toHaveProperty('content');
      expect(chatMessage).toHaveProperty('timestamp');
      
      expect(typeof chatMessage.id).toBe('string');
      expect(chatMessage.type).toBe('system');
      expect(typeof chatMessage.content).toBe('string');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });

    it('成功メッセージがChatMessageインターフェースに準拠する', () => {
      const chatMessage: ChatMessage = service.createSuccessMessage('テスト操作');
      
      expect(chatMessage).toHaveProperty('id');
      expect(chatMessage).toHaveProperty('type');
      expect(chatMessage).toHaveProperty('content');
      expect(chatMessage).toHaveProperty('timestamp');
      
      expect(typeof chatMessage.id).toBe('string');
      expect(chatMessage.type).toBe('system');
      expect(typeof chatMessage.content).toBe('string');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });

    it('再試行メッセージがChatMessageインターフェースに準拠する', () => {
      const aiError: AIError = {
        type: AIErrorType.NETWORK_ERROR,
        message: 'Network error',
        recoverable: true
      };
      
      const chatMessage: ChatMessage = service.createRetryMessage(aiError, () => {});
      
      expect(chatMessage).toHaveProperty('id');
      expect(chatMessage).toHaveProperty('type');
      expect(chatMessage).toHaveProperty('content');
      expect(chatMessage).toHaveProperty('timestamp');
      
      expect(typeof chatMessage.id).toBe('string');
      expect(chatMessage.type).toBe('system');
      expect(typeof chatMessage.content).toBe('string');
      expect(chatMessage.timestamp).toBeInstanceOf(Date);
    });
  });
});