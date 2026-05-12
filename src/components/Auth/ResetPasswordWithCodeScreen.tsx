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
import {
  formatPasswordRequirements,
  validatePasswordStrength,
} from './passwordValidation';

type Props = {
  email: string;
  onGotoLogin: () => void;
  onResetSuccess: () => void;
};

export function ResetPasswordWithCodeScreen({
  email,
  onGotoLogin,
  onResetSuccess,
}: Props) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordConfirmError, setPasswordConfirmError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCodeError(null);
    setPasswordError(null);
    setPasswordConfirmError(null);

    let valid = true;
    if (!/^\d{6}$/.test(code)) {
      setCodeError('6 桁の数字を入力してください。');
      valid = false;
    }
    const issues = validatePasswordStrength(password);
    if (issues.length > 0) {
      setPasswordError(formatPasswordRequirements(issues));
      valid = false;
    }
    if (password !== passwordConfirm) {
      setPasswordConfirmError('パスワードが一致しません。');
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    void AmplifyAuthService.confirmPasswordReset(email, code, password)
      .then(() => {
        onResetSuccess();
      })
      .catch((err: unknown) => {
        setError(mapAuthError(err));
      })
      .finally(() => setLoading(false));
  }

  return (
    <AuthLayout
      title="新しいパスワード"
      subtitle={`${email} 宛の確認コードと新しいパスワードを入力してください`}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {error}
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
          <TextField
            label="新しいパスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(passwordError)}
            helperText={passwordError ?? '12 文字以上、英大小・数字・記号を含む'}
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'reset-password' }}
            required
            fullWidth
          />
          <TextField
            label="新しいパスワード (確認)"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            error={Boolean(passwordConfirmError)}
            helperText={passwordConfirmError}
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'reset-password-confirm' }}
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
            {loading ? '更新中…' : 'パスワードを更新'}
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

export default ResetPasswordWithCodeScreen;
