import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography, Alert, Collapse, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess, Refresh, BugReport } from '@mui/icons-material';
import { ErrorBoundaryProps, ErrorBoundaryState, ErrorDetails } from './types';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';
import { generateDeviceErrorMessages } from '../ResponsiveGridManager/deviceOptimizations';
import { detectDevice } from '../CommonEdit/deviceDetection';

/**
 * エラーバウンダリコンポーネント
 * デバイス別エラー表示と自動リカバリ機能を提供
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private recoveryManager: ErrorRecoveryManager;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      showDetails: false,
      deviceType: 'desktop',
      errorMessages: {},
    };

    this.recoveryManager = new ErrorRecoveryManager({
      enableAutoRecovery: props.enableAutoRecovery ?? true,
      enableOfflineMode: props.enableOfflineMode ?? false,
      enableErrorReporting: props.enableErrorReporting ?? true,
      retryAttempts: props.retryAttempts ?? 3,
      retryDelay: props.retryDelay ?? 1000,
      fallbackBehavior: props.fallbackBehavior ?? 'graceful',
    });
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const deviceDetection = detectDevice();
    const errorMessages = generateDeviceErrorMessages(deviceDetection.type);
    
    return {
      hasError: true,
      error,
      deviceType: deviceDetection.type,
      errorMessages,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // エラーレポート送信
    if (this.props.enableErrorReporting) {
      this.reportError(error, errorInfo);
    }

    // 自動リカバリ試行
    if (this.props.enableAutoRecovery && this.retryCount < this.maxRetries) {
      this.attemptAutoRecovery(error);
    }

    // エラーコールバック実行
    this.props.onError?.(error, errorInfo);
  }

  /**
   * エラーレポートを送信
   */
  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack,
      deviceType: this.state.deviceType,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userId: this.props.userId,
      sessionId: this.props.sessionId,
    };

    // エラーレポート送信（実装は環境に依存）
    console.error('Error Report:', errorDetails);
    
    // 外部エラー追跡サービスに送信
    this.props.onErrorReport?.(errorDetails);
  };

  /**
   * 自動リカバリを試行
   */
  private attemptAutoRecovery = async (error: Error) => {
    this.retryCount++;
    this.setState({ isRecovering: true });

    try {
      await this.recoveryManager.attemptRecovery(error, {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        deviceType: this.state.deviceType,
      });

      // リカバリ成功
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
      });

      this.retryCount = 0;
      this.props.onRecovery?.();
    } catch (recoveryError) {
      // リカバリ失敗
      this.setState({ isRecovering: false });
      console.error('Auto recovery failed:', recoveryError);
    }
  };

  /**
   * 手動リトライ
   */
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    
    this.retryCount = 0;
    this.props.onRetry?.();
  };

  /**
   * 詳細表示切り替え
   */
  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  /**
   * フィードバック送信
   */
  private handleFeedback = () => {
    const { error, errorInfo, deviceType } = this.state;
    
    const feedbackData = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      deviceType,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    this.props.onFeedback?.(feedbackData);
  };

  /**
   * デバイス別エラーメッセージを取得
   */
  private getErrorMessage = (): string => {
    const { error, errorMessages } = this.state;
    
    if (!error) return 'エラーが発生しました';

    // エラータイプに基づいてメッセージを選択
    if (error.message.includes('Network')) {
      return errorMessages.networkError || 'ネットワークエラーが発生しました';
    }
    
    if (error.message.includes('Memory')) {
      return errorMessages.memoryError || 'メモリエラーが発生しました';
    }
    
    if (error.message.includes('Touch')) {
      return errorMessages.touchError || 'タッチ操作エラーが発生しました';
    }
    
    if (error.message.includes('Keyboard')) {
      return errorMessages.keyboardError || 'キーボード操作エラーが発生しました';
    }

    return error.message || 'エラーが発生しました';
  };

  /**
   * デバイス別レイアウトを取得
   */
  private getDeviceLayout = () => {
    const { deviceType } = this.state;
    
    switch (deviceType) {
      case 'mobile':
        return {
          maxWidth: '100vw',
          padding: 2,
          margin: 1,
          fontSize: '1rem',
        };
      case 'tablet':
        return {
          maxWidth: '80vw',
          padding: 3,
          margin: 2,
          fontSize: '0.95rem',
        };
      case 'desktop':
      default:
        return {
          maxWidth: '600px',
          padding: 4,
          margin: 'auto',
          fontSize: '0.875rem',
        };
    }
  };

  render() {
    const { hasError, error, errorInfo, isRecovering, showDetails, deviceType } = this.state;
    const { children, fallbackComponent } = this.props;

    if (!hasError) {
      return children;
    }

    // カスタムフォールバックコンポーネントがある場合
    if (fallbackComponent) {
      return fallbackComponent(error, this.handleRetry);
    }

    const deviceLayout = this.getDeviceLayout();
    const errorMessage = this.getErrorMessage();

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          ...deviceLayout,
          textAlign: 'center',
        }}
      >
        {/* エラーアラート */}
        <Alert 
          severity="error" 
          sx={{ 
            width: '100%', 
            mb: 2,
            fontSize: deviceLayout.fontSize,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {deviceType === 'mobile' ? 'エラー' : 'エラーが発生しました'}
          </Typography>
          <Typography variant="body2">
            {errorMessage}
          </Typography>
        </Alert>

        {/* リカバリ中表示 */}
        {isRecovering && (
          <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
            <Typography variant="body2">
              自動復旧を試行中です...
            </Typography>
          </Alert>
        )}

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={this.handleRetry}
            disabled={isRecovering}
            startIcon={<Refresh />}
            size={deviceType === 'mobile' ? 'large' : 'medium'}
          >
            再試行
          </Button>
          
          {this.props.enableErrorReporting && (
            <Button
              variant="outlined"
              onClick={this.handleFeedback}
              startIcon={<BugReport />}
              size={deviceType === 'mobile' ? 'large' : 'medium'}
            >
              フィードバック送信
            </Button>
          )}
        </Box>

        {/* 詳細表示 */}
        {(error || errorInfo) && (
          <Box sx={{ width: '100%' }}>
            <Button
              onClick={this.toggleDetails}
              endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
              size="small"
            >
              詳細情報
            </Button>
            
            <Collapse in={showDetails}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}
              >
                {error && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      エラーメッセージ:
                    </Typography>
                    <Typography variant="body2" component="pre">
                      {error.message}
                    </Typography>
                  </Box>
                )}
                
                {error?.stack && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      スタックトレース:
                    </Typography>
                    <Typography variant="body2" component="pre">
                      {error.stack}
                    </Typography>
                  </Box>
                )}
                
                {errorInfo?.componentStack && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      コンポーネントスタック:
                    </Typography>
                    <Typography variant="body2" component="pre">
                      {errorInfo.componentStack}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* デバイス別ヘルプテキスト */}
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 2, maxWidth: '80%' }}
        >
          {deviceType === 'mobile' 
            ? 'アプリを再起動するか、ネットワーク接続を確認してください。'
            : deviceType === 'tablet'
            ? '画面を回転させるか、アプリを再起動してみてください。'
            : 'ページを再読み込みするか、ブラウザを再起動してみてください。'
          }
        </Typography>
      </Box>
    );
  }
}

export default ErrorBoundary;