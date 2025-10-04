import { ChatMessage } from '../types';

export enum AIErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  SUGGESTION_APPLICATION_ERROR = 'SUGGESTION_APPLICATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AIError {
  type: AIErrorType;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestedActions?: string[];
}

export class ErrorHandlingService {
  private errorMessages = {
    [AIErrorType.NETWORK_ERROR]: {
      title: 'ネットワークエラー',
      message: 'AIサービスとの通信に失敗しました。',
      actions: [
        'インターネット接続を確認してください',
        'しばらく時間をおいて再試行してください',
        'システム管理者にお問い合わせください'
      ]
    },
    [AIErrorType.VALIDATION_ERROR]: {
      title: 'データ検証エラー',
      message: '入力データに問題があります。',
      actions: [
        '入力内容を確認してください',
        '必須項目が入力されているか確認してください',
        'データ形式が正しいか確認してください'
      ]
    },
    [AIErrorType.INTEGRATION_ERROR]: {
      title: '星取表統合エラー',
      message: '星取表との統合処理でエラーが発生しました。',
      actions: [
        '対象の設備が存在するか確認してください',
        '時間ヘッダーが正しいか確認してください',
        'データの整合性を確認してください'
      ]
    },
    [AIErrorType.FILE_PROCESSING_ERROR]: {
      title: 'ファイル処理エラー',
      message: 'Excelファイルの処理中にエラーが発生しました。',
      actions: [
        'ファイル形式が正しいか確認してください（.xlsx, .xls, .csv）',
        'ファイルサイズが10MB以下か確認してください',
        'ファイルが破損していないか確認してください'
      ]
    },
    [AIErrorType.SUGGESTION_APPLICATION_ERROR]: {
      title: '提案適用エラー',
      message: 'AI提案の適用中にエラーが発生しました。',
      actions: [
        '提案内容を確認してください',
        '対象設備のデータを確認してください',
        '権限があるか確認してください'
      ]
    },
    [AIErrorType.UNKNOWN_ERROR]: {
      title: '不明なエラー',
      message: '予期しないエラーが発生しました。',
      actions: [
        'ページを再読み込みしてください',
        'ブラウザのキャッシュをクリアしてください',
        'システム管理者にお問い合わせください'
      ]
    }
  };

  createErrorMessage(error: AIError): ChatMessage {
    const errorInfo = this.errorMessages[error.type];
    
    let content = `❌ ${errorInfo.title}\n\n${error.message}`;
    
    if (error.details) {
      content += `\n\n詳細: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}`;
    }

    if (error.recoverable && errorInfo.actions.length > 0) {
      content += '\n\n🔧 対処方法:';
      errorInfo.actions.forEach((action, index) => {
        content += `\n${index + 1}. ${action}`;
      });
    }

    if (error.suggestedActions && error.suggestedActions.length > 0) {
      content += '\n\n💡 推奨アクション:';
      error.suggestedActions.forEach((action, index) => {
        content += `\n• ${action}`;
      });
    }

    return {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
  }

  handleError(error: any): AIError {
    // ネットワークエラーの検出
    if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
      return {
        type: AIErrorType.NETWORK_ERROR,
        message: 'AIサービスとの通信に失敗しました。',
        details: error.message,
        recoverable: true
      };
    }

    // ファイル処理エラーの検出
    if (error.message?.includes('file') || error.message?.includes('Excel')) {
      return {
        type: AIErrorType.FILE_PROCESSING_ERROR,
        message: 'ファイル処理中にエラーが発生しました。',
        details: error.message,
        recoverable: true,
        suggestedActions: [
          'ファイル形式を確認してください',
          '別のファイルで試してください'
        ]
      };
    }

    // 統合エラーの検出
    if (error.message?.includes('integration') || error.message?.includes('grid')) {
      return {
        type: AIErrorType.INTEGRATION_ERROR,
        message: '星取表との統合でエラーが発生しました。',
        details: error.message,
        recoverable: true,
        suggestedActions: [
          '設備IDを確認してください',
          'データの整合性を確認してください'
        ]
      };
    }

    // バリデーションエラーの検出
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return {
        type: AIErrorType.VALIDATION_ERROR,
        message: 'データの検証でエラーが発生しました。',
        details: error.message,
        recoverable: true,
        suggestedActions: [
          '入力データを確認してください',
          '必須項目を確認してください'
        ]
      };
    }

    // 提案適用エラーの検出
    if (error.message?.includes('suggestion') || error.message?.includes('apply')) {
      return {
        type: AIErrorType.SUGGESTION_APPLICATION_ERROR,
        message: 'AI提案の適用でエラーが発生しました。',
        details: error.message,
        recoverable: true,
        suggestedActions: [
          '提案内容を確認してください',
          '対象設備を確認してください'
        ]
      };
    }

    // デフォルトエラー
    return {
      type: AIErrorType.UNKNOWN_ERROR,
      message: error.message || '予期しないエラーが発生しました。',
      details: error.stack || error.toString(),
      recoverable: true,
      suggestedActions: [
        'ページを再読み込みしてください',
        'システム管理者にお問い合わせください'
      ]
    };
  }

  createRetryMessage(originalError: AIError, retryAction: () => void): ChatMessage {
    return {
      id: Date.now().toString(),
      type: 'system',
      content: `🔄 エラーが発生しましたが、自動的に再試行します...\n\n元のエラー: ${originalError.message}`,
      timestamp: new Date()
    };
  }

  createSuccessMessage(action: string): ChatMessage {
    return {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ ${action}が正常に完了しました。`,
      timestamp: new Date()
    };
  }

  logError(error: AIError, context?: any): void {
    console.error('AI Assistant Error:', {
      type: error.type,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable,
      context,
      timestamp: new Date().toISOString()
    });

    // 実際のアプリケーションでは、ここでエラーログをサーバーに送信
    // this.sendErrorToServer(error, context);
  }

  private sendErrorToServer(error: AIError, context?: any): void {
    // エラーログをサーバーに送信する実装
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ error, context, timestamp: new Date().toISOString() })
    // });
  }
}

export const errorHandlingService = new ErrorHandlingService();