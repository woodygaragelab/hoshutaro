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

export function LoginScreen({
  onGotoSignUp,
  onGotoForgotPassword,
  onGotoConfirmEmail,
  onLoginSuccess,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
      .then(() => {
        onLoginSuccess?.();
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
