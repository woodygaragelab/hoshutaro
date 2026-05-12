import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { AuthLayout } from './AuthLayout';
import { mapAuthError } from './authErrors';
import {
  formatPasswordRequirements,
  isValidEmail,
  validatePasswordStrength,
} from './passwordValidation';

type Props = {
  onGotoLogin: () => void;
  onSignUpSuccess: (email: string) => void;
};

export function SignUpScreen({ onGotoLogin, onSignUpSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [givenName, setGivenName] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordConfirmError, setPasswordConfirmError] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setPasswordConfirmError(null);
    setAgreementError(null);
    setError(null);

    let valid = true;
    if (!isValidEmail(email)) {
      setEmailError('有効なメールアドレスを入力してください。');
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
    if (!agreed) {
      setAgreementError('利用規約とプライバシーポリシーへの同意が必要です。');
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    void AmplifyAuthService.signUp(
      email,
      password,
      givenName ? { givenName } : undefined,
    )
      .then(() => {
        onSignUpSuccess(email);
      })
      .catch((err: unknown) => {
        setError(mapAuthError(err));
      })
      .finally(() => setLoading(false));
  }

  return (
    <AuthLayout title="新規登録" subtitle="HOSHUTARO アカウントを作成します">
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
            helperText={passwordError ?? '12 文字以上、英大小・数字・記号を含む'}
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'signup-password' }}
            required
            fullWidth
          />
          <TextField
            label="パスワード (確認)"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            error={Boolean(passwordConfirmError)}
            helperText={passwordConfirmError}
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'signup-password-confirm' }}
            required
            fullWidth
          />
          <TextField
            label="表示名 (任意)"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            autoComplete="given-name"
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                利用規約とプライバシーポリシーに同意します
              </Typography>
            }
          />
          {agreementError && (
            <FormHelperText error sx={{ mt: -1 }}>
              {agreementError}
            </FormHelperText>
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loading ? '登録中…' : '新規登録'}
          </Button>
          <Stack direction="row" justifyContent="center">
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={onGotoLogin}
            >
              既にアカウントをお持ちの方はログイン
            </Link>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}

export default SignUpScreen;
