import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  TextField,
} from '@mui/material';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { AuthLayout } from './AuthLayout';
import { isUserNotConfirmedError, mapAuthError } from './authErrors';
import { isValidEmail } from './passwordValidation';

type Props = {
  onGotoSignUp: () => void;
  onGotoForgotPassword: () => void;
  onGotoConfirmEmail: (email: string) => void;
  onLoginSuccess?: () => void;
};

/**
 * aws-amplify v6 `signIn` の戻り値の signInStep 名のうち、本画面が認識するもの。
 * 'DONE' は完了、'CONFIRM_SIGN_IN_WITH_TOTP_CODE' は TOTP MFA challenge。
 * その他 (SMS / select MFA / new password 等) は現時点で未対応として error 表示する。
 */
type SignInNextStep =
  | { signInStep?: string }
  | undefined
  | null;

type SignInResult = {
  isSignedIn?: boolean;
  nextStep?: SignInNextStep;
};

export function LoginScreen({
  onGotoSignUp,
  onGotoForgotPassword,
  onGotoConfirmEmail,
  onLoginSuccess,
}: Props) {
  // ----- credentials stage -----
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ----- MFA challenge stage (Slice 5-B) -----
  const [stage, setStage] = useState<'credentials' | 'mfaChallenge'>(
    'credentials',
  );
  const [mfaCode, setMfaCode] = useState('');
  const [mfaCodeError, setMfaCodeError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setError(null);

    let valid = true;
    if (!isValidEmail(email)) {
      setEmailError('有効なメールアドレスを入力してください。');
      valid = false;
    }
    if (!password) {
      setPasswordError('パスワードを入力してください。');
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    void AmplifyAuthService.signIn(email, password)
      .then((result: SignInResult | undefined) => {
        if (result?.isSignedIn) {
          onLoginSuccess?.();
          return;
        }
        const step = result?.nextStep?.signInStep;
        if (step === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
          setStage('mfaChallenge');
          return;
        }
        // 未対応 challenge (SMS / password reset 強制 / MFA 種類選択 等)
        setError(
          step
            ? `未対応の認証チャレンジ (${step}) が必要です。Sprint 5 以降で対応予定です。`
            : '未対応の認証チャレンジが必要です。',
        );
      })
      .catch((err: unknown) => {
        if (isUserNotConfirmedError(err)) {
          onGotoConfirmEmail(email);
          return;
        }
        setError(mapAuthError(err));
      })
      .finally(() => setLoading(false));
  }

  function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    setMfaCodeError(null);
    setMfaError(null);

    if (!/^\d{6}$/.test(mfaCode)) {
      setMfaCodeError('6 桁の数字を入力してください。');
      return;
    }

    setMfaLoading(true);
    void AmplifyAuthService.confirmMfaSignIn(mfaCode)
      .then((result: SignInResult | undefined) => {
        if (result?.isSignedIn) {
          onLoginSuccess?.();
          return;
        }
        setMfaError('認証に失敗しました。コードを再確認してください。');
      })
      .catch((err: unknown) => {
        setMfaError(mapAuthError(err));
      })
      .finally(() => setMfaLoading(false));
  }

  function handleMfaCancel() {
    setStage('credentials');
    setMfaCode('');
    setMfaCodeError(null);
    setMfaError(null);
    // 認証アプリで生成した古いコードを使い回せないように、credential stage 側も
    // リセットして再ログインから始め直すのが安全。
    setPassword('');
  }

  if (stage === 'mfaChallenge') {
    return (
      <AuthLayout
        title="多要素認証 (MFA)"
        subtitle={`認証アプリで生成した 6 桁コードを入力してください (${email})`}
      >
        <Box component="form" onSubmit={handleMfaSubmit} noValidate>
          {mfaError && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
              {mfaError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="TOTP コード"
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              error={Boolean(mfaCodeError)}
              helperText={mfaCodeError ?? '6 桁の数字'}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                autoFocus: true,
              }}
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={mfaLoading}
              startIcon={
                mfaLoading ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              {mfaLoading ? '認証中…' : 'ログイン'}
            </Button>
            <Stack direction="row" justifyContent="center">
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={handleMfaCancel}
              >
                ログイン情報を再入力する
              </Link>
            </Stack>
          </Stack>
        </Box>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="ログイン" subtitle="メールアドレスとパスワードでログイン">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(emailError)}
            helperText={emailError}
            autoComplete="email"
            required
            fullWidth
          />
          <TextField
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(passwordError)}
            helperText={passwordError}
            autoComplete="current-password"
            required
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            }
            label="ログインを保持する"
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </Button>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mt: 1 }}
          >
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={onGotoForgotPassword}
            >
              パスワードを忘れた方
            </Link>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={onGotoSignUp}
            >
              新規登録
            </Link>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}

export default LoginScreen;
