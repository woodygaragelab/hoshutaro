import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { AuthLayout } from './AuthLayout';
import { mapAuthError } from './authErrors';

/**
 * HOSHUTARO Track D Sprint 1 - MFA (TOTP) セットアップ画面 (Slice D-2)。
 *
 * フロー:
 *  1. マウント時 setUpTOTP() を呼び、{ sharedSecret, getSetupUri } を取得
 *  2. otpauth:// URL を QR コードで表示 + 手動入力用 secret も併記
 *  3. ユーザが認証アプリで読み取り、生成された 6 桁コードを入力
 *  4. verifyTOTPSetup({ code }) → 成功で onSetupSuccess()
 *
 * 起動コンテキスト:
 *  - 新規登録フローでは `onSkip` を渡してスキップ可能にする
 *  - ProfileScreen から呼ぶ場合は `onSkip` を渡さず必須化する (Slice D-3 で配線)
 */
type Props = {
  username: string;
  onSetupSuccess: () => void;
  onSkip?: () => void;
  /**
   * Dialog の中など、すでに外側でタイトル/レイアウトを持っている場合は
   * AuthLayout (中央寄せ Card + ロゴ) をスキップしてフォーム本体だけを返す。
   */
  noLayout?: boolean;
};

export function MfaSetupScreen({ username, onSetupSuccess, onSkip, noLayout }: Props) {
  const [setupUri, setSetupUri] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void AmplifyAuthService.setupMfa()
      .then((result) => {
        if (cancelled) return;
        const uri = result.getSetupUri('HOSHUTARO', username).toString();
        setSetupUri(uri);
        setSecret(result.sharedSecret);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(mapAuthError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError('6 桁の数字を入力してください。');
      return;
    }
    setVerifying(true);
    void AmplifyAuthService.verifyMfaSetup(code)
      .then(() => onSetupSuccess())
      .catch((err: unknown) => setError(mapAuthError(err)))
      .finally(() => setVerifying(false));
  }

  const body = (
    <Box component="form" onSubmit={handleVerify} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Google Authenticator、Microsoft Authenticator、1Password、Authy などの
            TOTP 対応アプリを使用してください。
          </Typography>

          {loading ? (
            <Box
              sx={{ display: 'flex', justifyContent: 'center', py: 3 }}
              data-testid="mfa-qr-loading"
            >
              <CircularProgress aria-label="QR コードを生成中" />
            </Box>
          ) : setupUri ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                p: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <QRCodeSVG
                value={setupUri}
                size={180}
                aria-label="MFA QR コード"
                data-testid="mfa-qr-svg"
              />
              <Box sx={{ width: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  手動入力用キー (アプリで QR が読めない場合):
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    userSelect: 'all',
                  }}
                  data-testid="mfa-secret"
                >
                  {secret}
                </Typography>
              </Box>
            </Box>
          ) : null}

          <TextField
            label="認証アプリの 6 桁コード"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            error={Boolean(codeError)}
            helperText={codeError ?? '6 桁の数字'}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            disabled={loading}
            required
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || verifying || !setupUri}
            startIcon={
              verifying ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {verifying ? '検証中…' : 'MFA を有効化'}
          </Button>

          {onSkip && (
            <Stack direction="row" justifyContent="center">
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={onSkip}
              >
                スキップ (後で設定)
              </Link>
            </Stack>
          )}
        </Stack>
      </Box>
  );

  if (noLayout) {
    return body;
  }

  return (
    <AuthLayout
      title="多要素認証 (MFA) の設定"
      subtitle="認証アプリで QR コードをスキャンして 6 桁コードを入力してください"
    >
      {body}
    </AuthLayout>
  );
}

export default MfaSetupScreen;
