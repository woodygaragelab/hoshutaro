import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { ErrorBoundaryProps } from '../types';

// Mock device detection
jest.mock('../../CommonEdit/deviceDetection', () => ({
  detectDevice: jest.fn(() => ({
    type: 'desktop',
    screenSize: { width: 1920, height: 1080 },
    orientation: 'landscape',
    touchCapabilities: {
      hasTouch: false,
      hasHover: true,
      hasPointerEvents: true,
      maxTouchPoints: 0,
    },
    userAgent: 'test-agent',
  })),
}));

// Mock device optimizations
jest.mock('../../ResponsiveGridManager/deviceOptimizations', () => ({
  generateDeviceErrorMessages: jest.fn(() => ({
    networkError: 'ネットワークエラーが発生しました',
    validationError: '入力値が正しくありません',
    saveError: '保存に失敗しました',
  })),
}));

// Mock error recovery manager
jest.mock('../ErrorRecoveryManager', () => ({
  ErrorRecoveryManager: jest.fn().mockImplementation(() => ({
    attemptRecovery: jest.fn().mockResolvedValue(true),
  })),
}));

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  const defaultProps: ErrorBoundaryProps = {
    children: <ThrowError shouldThrow={false} />,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(<ErrorBoundary {...defaultProps} />);
      
      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should not show error UI when no error occurs', () => {
      render(<ErrorBoundary {...defaultProps} />);
      
      expect(screen.queryByText(/エラーが発生しました/)).not.toBeInTheDocument();
      expect(screen.queryByText('再試行')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display error', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      expect(screen.getByText('再試行')).toBeInTheDocument();
    });

    it('should display error message', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should show retry button', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const retryButton = screen.getByText('再試行');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).not.toBeDisabled();
    });
  });

  describe('Error Recovery', () => {
    it('should attempt auto recovery when enabled', async () => {
      const onRecovery = jest.fn();
      
      render(
        <ErrorBoundary 
          {...defaultProps} 
          enableAutoRecovery={true}
          onRecovery={onRecovery}
        >
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      // Auto recovery should be attempted
      await waitFor(() => {
        expect(screen.queryByText(/自動復旧を試行中/)).toBeInTheDocument();
      }, { timeout: 100 });
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = jest.fn();
      
      render(
        <ErrorBoundary {...defaultProps} onRetry={onRetry}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByText('再試行'));
      
      expect(onRetry).toHaveBeenCalled();
    });

    it('should reset error state when retry is clicked', () => {
      const { rerender } = render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('再試行'));
      
      // Re-render with no error
      rerender(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText(/エラーが発生しました/)).not.toBeInTheDocument();
    });
  });

  describe('Error Reporting', () => {
    it('should show feedback button when error reporting is enabled', () => {
      render(
        <ErrorBoundary {...defaultProps} enableErrorReporting={true}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('フィードバック送信')).toBeInTheDocument();
    });

    it('should not show feedback button when error reporting is disabled', () => {
      render(
        <ErrorBoundary {...defaultProps} enableErrorReporting={false}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.queryByText('フィードバック送信')).not.toBeInTheDocument();
    });

    it('should call onErrorReport when error occurs', () => {
      const onErrorReport = jest.fn();
      
      render(
        <ErrorBoundary 
          {...defaultProps} 
          enableErrorReporting={true}
          onErrorReport={onErrorReport}
        >
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(onErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          deviceType: 'desktop',
        })
      );
    });

    it('should call onFeedback when feedback button is clicked', () => {
      const onFeedback = jest.fn();
      
      render(
        <ErrorBoundary 
          {...defaultProps} 
          enableErrorReporting={true}
          onFeedback={onFeedback}
        >
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByText('フィードバック送信'));
      
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Test error',
          deviceType: 'desktop',
        })
      );
    });
  });

  describe('Error Details', () => {
    it('should show details toggle button', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('詳細情報')).toBeInTheDocument();
    });

    it('should toggle error details when clicked', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      const detailsButton = screen.getByText('詳細情報');
      
      // Details should be hidden initially
      expect(screen.queryByText('エラーメッセージ:')).not.toBeInTheDocument();
      
      // Click to show details
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('エラーメッセージ:')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Device-specific Behavior', () => {
    it('should show mobile-specific error message', () => {
      const mockDetectDevice = require('../../CommonEdit/deviceDetection').detectDevice;
      mockDetectDevice.mockReturnValue({
        type: 'mobile',
        screenSize: { width: 375, height: 667 },
        orientation: 'portrait',
        touchCapabilities: {
          hasTouch: true,
          hasHover: false,
          hasPointerEvents: true,
          maxTouchPoints: 5,
        },
        userAgent: 'mobile-agent',
      });

      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('エラー')).toBeInTheDocument();
      expect(screen.getByText(/アプリを再起動するか/)).toBeInTheDocument();
    });

    it('should show tablet-specific error message', () => {
      const mockDetectDevice = require('../../CommonEdit/deviceDetection').detectDevice;
      mockDetectDevice.mockReturnValue({
        type: 'tablet',
        screenSize: { width: 768, height: 1024 },
        orientation: 'portrait',
        touchCapabilities: {
          hasTouch: true,
          hasHover: false,
          hasPointerEvents: true,
          maxTouchPoints: 10,
        },
        userAgent: 'tablet-agent',
      });

      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/画面を回転させるか/)).toBeInTheDocument();
    });

    it('should show desktop-specific error message', () => {
      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText(/ページを再読み込みするか/)).toBeInTheDocument();
    });
  });

  describe('Custom Fallback Component', () => {
    it('should render custom fallback component when provided', () => {
      const customFallback = (error: Error | null, retry: () => void) => (
        <div>
          <p>Custom error: {error?.message}</p>
          <button onClick={retry}>Custom Retry</button>
        </div>
      );

      render(
        <ErrorBoundary {...defaultProps} fallbackComponent={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
      expect(screen.getByText('Custom Retry')).toBeInTheDocument();
      expect(screen.queryByText('再試行')).not.toBeInTheDocument();
    });
  });

  describe('Error Types', () => {
    it('should display network error message for network errors', () => {
      const NetworkError: React.FC = () => {
        throw new Error('Network request failed');
      };

      render(
        <ErrorBoundary {...defaultProps}>
          <NetworkError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    });

    it('should display memory error message for memory errors', () => {
      const MemoryError: React.FC = () => {
        throw new Error('Memory allocation failed');
      };

      render(
        <ErrorBoundary {...defaultProps}>
          <MemoryError />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Memory allocation failed')).toBeInTheDocument();
    });
  });
});