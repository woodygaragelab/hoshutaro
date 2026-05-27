import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
} from '@mui/material';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { AuthLayout } from './AuthLayout';
import { isUserNotFoundError, mapAuthError } from './authErrors';
import { isValidEmail } from './passwordValidation';

type Props = {
  onGotoLogin: () => void;
  onResetRequested: (email: string) => void;
};

export function RequestPasswordResetScreen({
  onGotoLogin,
  onResetRequested,
}: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setError(null);

    if (!isValidEmail(email)) {
      setEmailError('有効なメールアドレスを入力してください。');
      return;
    }

    setLoading(true);
    void AmplifyAuthService.requestPasswordReset(email)
      .then(() => {
        onResetRequested(email);
      })
      .catch((err: unknown) => {
        if (isUserNotFoundError(err)) {
          onResetRequested(email);
          return;
        }
        setError(mapAuthError(err));
      })
      .finally(() => setLoading(false));
  }

  return (
    <AuthLayout
      title="パスワードリセット"
      subtitle="登録メールアドレスに確認コードを送信します"
    >
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
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loading ? '送信中…' : 'リセットコードを送信'}
          </Button>
          <Stack direction="row" justifyContent="center">
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={onGotoLogin}
            >
              ログイン画面へ戻る
            </Link>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}

export default RequestPasswordResetScreen;
