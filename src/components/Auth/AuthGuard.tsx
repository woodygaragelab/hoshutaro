import { useState, type ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmEmailScreen } from './ConfirmEmailScreen';
import { LoginScreen } from './LoginScreen';
import { RequestPasswordResetScreen } from './RequestPasswordResetScreen';
import { ResetPasswordWithCodeScreen } from './ResetPasswordWithCodeScreen';
import { SignUpScreen } from './SignUpScreen';

/**
 * HOSHUTARO Track D Sprint 1 - 認証ガード (Slice D-1)。
 *
 * - loading: AuthProvider が getCurrentUser を解決するまでスピナを表示
 * - user あり: children (=既存アプリ) をそのまま render
 * - user なし: 5 つの認証画面間を useState で切り替える
 *
 * Slice C で各画面は props callbacks で navigation を受け取る設計にしてあるので、
 * 本ガードは単なる state machine としてそれらを束ねるだけで済む。
 *
 * サインイン/パスワードリセット成功時の自動再評価は AuthProvider 側の
 * Hub.listen('auth', ...) が拾うため、ここで refresh を呼ぶ必要はない。
 */
type AuthScreen =
  | 'login'
  | 'signUp'
  | 'confirmEmail'
  | 'requestPasswordReset'
  | 'resetPasswordWithCode';

type Props = { children: ReactNode };

export function AuthGuard({ children }: Props) {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [pendingEmail, setPendingEmail] = useState<string>('');

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-testid="auth-guard-loading"
      >
        <CircularProgress aria-label="認証情報を確認中" />
      </Box>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  switch (screen) {
    case 'login':
      return (
        <LoginScreen
          onGotoSignUp={() => setScreen('signUp')}
          onGotoForgotPassword={() => setScreen('requestPasswordReset')}
          onGotoConfirmEmail={(email) => {
            setPendingEmail(email);
            setScreen('confirmEmail');
          }}
        />
      );
    case 'signUp':
      return (
        <SignUpScreen
          onGotoLogin={() => setScreen('login')}
          onSignUpSuccess={(email) => {
            setPendingEmail(email);
            setScreen('confirmEmail');
          }}
        />
      );
    case 'confirmEmail':
      return (
        <ConfirmEmailScreen
          email={pendingEmail}
          onGotoLogin={() => setScreen('login')}
          onConfirmSuccess={() => setScreen('login')}
        />
      );
    case 'requestPasswordReset':
      return (
        <RequestPasswordResetScreen
          onGotoLogin={() => setScreen('login')}
          onResetRequested={(email) => {
            setPendingEmail(email);
            setScreen('resetPasswordWithCode');
          }}
        />
      );
    case 'resetPasswordWithCode':
      return (
        <ResetPasswordWithCodeScreen
          email={pendingEmail}
          onGotoLogin={() => setScreen('login')}
          onResetSuccess={() => setScreen('login')}
        />
      );
    default:
      return null;
  }
}

export default AuthGuard;
