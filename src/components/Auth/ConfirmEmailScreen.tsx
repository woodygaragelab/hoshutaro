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
import { mapAuthError } from './authErrors';

type Props = {
  email: string;
  onGotoLogin: () => void;
  onConfirmSuccess: () => void;
};

export function ConfirmEmailScreen({
  email,
  onGotoLogin,
  onConfirmSuccess,
}: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCodeError(null);

    if (!/^\d{6}$/.test(code)) {
      setCodeError('6 桁の数字を入力してください。');
      return;
    }

    setLoading(true);
    void AmplifyAuthService.confirmSignUp(email, code)
      .then(() => {
        onConfirmSuccess();
      })
      .catch((err: unknown) => {
        setError(mapAuthError(err));
      })
      .finally(() => setLoading(false));
  }

  function handleResend() {
    setError(null);
    setSuccess(null);
    setResendLoading(true);
    void AmplifyAuthService.resendConfirmationCode(email)
      .then(() => {
        setSuccess('確認コードを再送信しました。メールをご確認ください。');
      })
      .catch((err: unknown) => {
        setError(mapAuthError(err));
      })
      .finally(() => setResendLoading(false));
  }

  return (
    <AuthLayout
      title="メール確認"
      subtitle={`${email} に送信した 6 桁のコードを入力してください`}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
            {success}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label="確認コード"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            error={Boolean(codeError)}
            helperText={codeError ?? '6 桁の数字'}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
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
            {loading ? '確認中…' : '確認'}
          </Button>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={1}
          >
            <Button
              variant="text"
              size="small"
              onClick={handleResend}
              disabled={resendLoading}
              startIcon={
                resendLoading ? <CircularProgress size={14} color="inherit" /> : null
              }
            >
              {resendLoading ? '送信中…' : 'コードを再送信'}
            </Button>
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

export default ConfirmEmailScreen;
