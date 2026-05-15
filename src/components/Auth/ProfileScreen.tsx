import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../providers/ThemeProvider';
import { useUserSettings } from '../../hooks/useUserSettings';
import { mapAuthError } from './authErrors';
import {
  formatPasswordRequirements,
  validatePasswordStrength,
} from './passwordValidation';

/**
 * HOSHUTARO Track D Sprint 1 - プロフィール画面 (Slice D-3)。
 *
 * AgentBar の「プロフィール」メニューから Dialog 内に表示される form コンテナ。
 * AuthLayout は使わず、外側の Dialog (DialogTitle / DialogContent) を流用する。
 *
 * 本 Slice での操作範囲:
 *  - 表示名 (givenName) 変更 → updateUserAttributes
 *  - パスワード変更 (現+新+確認) → updatePassword
 *  - MFA 設定 → onMfaSetupRequested() callback で外側に切替依頼
 *  - サインアウト → useAuth().signOut()
 *
 * 以下は本 Slice スコープ外 (Sprint 4 で user-management Lambda 実装後に追加):
 *  - データエクスポート
 *  - アカウント削除
 *  - MFA 無効化 (setPreferredMFA('NOMFA'))
 *  - アカウント作成日表示 (Cognito 側の取得手段が limited)
 */
type Props = {
  onMfaSetupRequested: () => void;
  onClose: () => void;
};

export function ProfileScreen({ onMfaSetupRequested, onClose }: Props) {
  const { user, signOut } = useAuth();

  // Display-name section
  const [givenName, setGivenName] = useState(user?.givenName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);

  // Password-change section
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [oldPasswordError, setOldPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [newPasswordConfirmError, setNewPasswordConfirmError] = useState<
    string | null
  >(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Data export
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Account deletion (2-step confirmation)
  const [deleteStage, setDeleteStage] = useState<'idle' | 'confirm1' | 'confirm2'>(
    'idle',
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // MFA status (Slice 5-C)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
  const [mfaDisableStage, setMfaDisableStage] = useState<
    'idle' | 'confirm1' | 'confirm2'
  >('idle');
  const [mfaDisabling, setMfaDisabling] = useState(false);
  const [mfaDisableError, setMfaDisableError] = useState<string | null>(null);
  const [mfaDisableSuccess, setMfaDisableSuccess] = useState<string | null>(null);

  // Theme (Sprint 6 Phase 3A): ローカル ThemeProvider と DynamoDB UserSettings を結線。
  // 認証済みの ProfileScreen からのみ操作可能、未認証時の localStorage 切替は
  // ThemeProvider 単独で処理される。
  const { mode, setTheme } = useTheme();
  const {
    settings: userSettings,
    updateAsync: updateUserSettings,
    isUpdating: isThemeSaving,
    updateError: themeUpdateError,
  } = useUserSettings();
  const [themeSyncedFromCloud, setThemeSyncedFromCloud] = useState(false);

  // 初回 fetch: クラウド側 theme が現在の mode と異なる場合、クラウド側を採用
  // (cross-device 同期)。一度だけ実行、以後はユーザー操作のみで更新する。
  useEffect(() => {
    if (themeSyncedFromCloud) return;
    if (userSettings === undefined) return; // fetch 中
    if (userSettings && userSettings.theme !== mode) {
      setTheme(userSettings.theme);
    }
    setThemeSyncedFromCloud(true);
  }, [userSettings, mode, setTheme, themeSyncedFromCloud]);

  useEffect(() => {
    let cancelled = false;
    void AmplifyAuthService.fetchMfaStatus()
      .then((status) => {
        if (cancelled) return;
        setMfaEnabled(status.enabled);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMfaStatusError(mapAuthError(err));
        setMfaEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <Alert severity="error">
        ユーザー情報を取得できません。一度サインアウトしてからやり直してください。
      </Alert>
    );
  }

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);
    setNameSaving(true);
    void AmplifyAuthService.updateProfile({ givenName })
      .then(() => {
        setNameSuccess('表示名を更新しました。');
      })
      .catch((err: unknown) => {
        setNameError(mapAuthError(err));
      })
      .finally(() => setNameSaving(false));
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setOldPasswordError(null);
    setNewPasswordError(null);
    setNewPasswordConfirmError(null);
    setPasswordSuccess(null);

    let valid = true;
    if (!oldPassword) {
      setOldPasswordError('現在のパスワードを入力してください。');
      valid = false;
    }
    const issues = validatePasswordStrength(newPassword);
    if (issues.length > 0) {
      setNewPasswordError(formatPasswordRequirements(issues));
      valid = false;
    }
    if (newPassword !== newPasswordConfirm) {
      setNewPasswordConfirmError('パスワードが一致しません。');
      valid = false;
    }
    if (!valid) return;

    setPasswordSaving(true);
    void AmplifyAuthService.updateUserPassword(oldPassword, newPassword)
      .then(() => {
        setPasswordSuccess('パスワードを更新しました。');
        setOldPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      })
      .catch((err: unknown) => {
        setPasswordError(mapAuthError(err));
      })
      .finally(() => setPasswordSaving(false));
  }

  function handleExport() {
    setExportError(null);
    setExportSuccess(null);
    setExporting(true);
    void AmplifyAuthService.callUserManagement('exportData')
      .then((result) => {
        // Trigger a browser download of the JSON payload.
        const filename = `hoshutaro-user-data-${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}.json`;
        const blob = new Blob([JSON.stringify(result, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportSuccess(`データを ${filename} としてダウンロードしました。`);
      })
      .catch((err: unknown) => {
        setExportError(mapAuthError(err));
      })
      .finally(() => setExporting(false));
  }

  function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    void AmplifyAuthService.callUserManagement('deleteAccount')
      .then(() => {
        // Cognito user は削除済。サインアウトでローカル session を破棄し、
        // AuthGuard が LoginScreen に切替える。
        setDeleteStage('idle');
        void signOut();
        onClose();
      })
      .catch((err: unknown) => {
        setDeleteError(mapAuthError(err));
      })
      .finally(() => setDeleting(false));
  }

  function handleDisableMfa() {
    setMfaDisableError(null);
    setMfaDisableSuccess(null);
    setMfaDisabling(true);
    void AmplifyAuthService.disableMfa()
      .then(() => AmplifyAuthService.fetchMfaStatus())
      .then((status) => {
        setMfaEnabled(status.enabled);
        setMfaDisableStage('idle');
        setMfaDisableSuccess('MFA を無効化しました。次回ログイン時から TOTP コードは不要です。');
      })
      .catch((err: unknown) => {
        setMfaDisableError(mapAuthError(err));
      })
      .finally(() => setMfaDisabling(false));
  }

  // テーマ切替: ローカル ThemeProvider (即時視覚反映 + localStorage) と
  // DynamoDB UserSettings (cross-device 同期) の両方を更新する。
  // クラウド側書込みは失敗しても視覚切替は維持する (再ログイン時に再 sync 可能)。
  function handleThemeChange(next: 'light' | 'dark') {
    if (next === mode) return;
    setTheme(next);
    void updateUserSettings({ theme: next }).catch(() => {
      // updateError は useUserSettings.updateError として Alert 表示済
    });
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          メールアドレス
        </Typography>
        <Typography variant="body1">{user.email}</Typography>
      </Box>

      <Divider />

      <Box component="form" onSubmit={handleNameSubmit} noValidate>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          表示名の変更
        </Typography>
        {nameError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {nameError}
          </Alert>
        )}
        {nameSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
            {nameSuccess}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label="表示名"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            autoComplete="given-name"
            fullWidth
            size="small"
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={nameSaving}
            startIcon={
              nameSaving ? <CircularProgress size={14} color="inherit" /> : null
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            {nameSaving ? '保存中…' : '表示名を更新'}
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box component="form" onSubmit={handlePasswordSubmit} noValidate>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          パスワード変更
        </Typography>
        {passwordError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {passwordError}
          </Alert>
        )}
        {passwordSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            role="status"
            aria-live="polite"
          >
            {passwordSuccess}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label="現在のパスワード"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            error={Boolean(oldPasswordError)}
            helperText={oldPasswordError}
            autoComplete="current-password"
            fullWidth
            size="small"
            inputProps={{ 'data-testid': 'profile-old-password' }}
          />
          <TextField
            label="新しいパスワード"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={Boolean(newPasswordError)}
            helperText={newPasswordError ?? '12 文字以上、英大小・数字・記号を含む'}
            autoComplete="new-password"
            fullWidth
            size="small"
            inputProps={{ 'data-testid': 'profile-new-password' }}
          />
          <TextField
            label="新しいパスワード (確認)"
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            error={Boolean(newPasswordConfirmError)}
            helperText={newPasswordConfirmError}
            autoComplete="new-password"
            fullWidth
            size="small"
            inputProps={{ 'data-testid': 'profile-new-password-confirm' }}
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={passwordSaving}
            startIcon={
              passwordSaving ? <CircularProgress size={14} color="inherit" /> : null
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            {passwordSaving ? '更新中…' : 'パスワードを更新'}
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          多要素認証 (MFA)
        </Typography>
        {mfaStatusError && (
          <Alert severity="warning" sx={{ mb: 2 }} role="alert" aria-live="polite">
            MFA 状態の取得に失敗しました: {mfaStatusError}
          </Alert>
        )}
        {mfaDisableSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
            {mfaDisableSuccess}
          </Alert>
        )}
        {mfaEnabled === null ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              MFA 状態を確認中…
            </Typography>
          </Box>
        ) : mfaEnabled ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              現在の状態: <strong>有効</strong>。ログイン時に認証アプリの 6 桁コードが必要です。
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                setMfaDisableError(null);
                setMfaDisableSuccess(null);
                setMfaDisableStage('confirm1');
              }}
              data-testid="profile-disable-mfa"
            >
              MFA を無効化…
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              現在の状態: <strong>無効</strong>。ログイン時の追加認証を有効化できます。
            </Typography>
            <Button variant="outlined" onClick={onMfaSetupRequested}>
              MFA を設定
            </Button>
          </>
        )}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          外観 (Theme)
        </Typography>
        {themeUpdateError && (
          <Alert severity="warning" sx={{ mb: 2 }} role="alert" aria-live="polite">
            クラウドへの保存に失敗しました: {themeUpdateError.message}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          表示テーマを切り替えます。ログイン中はアカウント全体に同期されます。
        </Typography>
        <FormControl>
          <RadioGroup
            row
            aria-label="表示テーマ"
            value={mode}
            onChange={(e) =>
              handleThemeChange(e.target.value === 'dark' ? 'dark' : 'light')
            }
          >
            <FormControlLabel
              value="light"
              control={<Radio size="small" />}
              label="ライト"
              disabled={isThemeSaving}
              data-testid="profile-theme-light"
            />
            <FormControlLabel
              value="dark"
              control={<Radio size="small" />}
              label="ダーク"
              disabled={isThemeSaving}
              data-testid="profile-theme-dark"
            />
          </RadioGroup>
        </FormControl>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          データ管理
        </Typography>
        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
            {exportError}
          </Alert>
        )}
        {exportSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
            {exportSuccess}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          アカウント設定とクラウド同期データを JSON でダウンロードします。
        </Typography>
        <Button
          variant="outlined"
          onClick={handleExport}
          disabled={exporting}
          startIcon={
            exporting ? <CircularProgress size={14} color="inherit" /> : null
          }
        >
          {exporting ? 'エクスポート中…' : 'データをエクスポート'}
        </Button>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }} color="error">
          アカウント削除
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          アカウントと、クラウドに保存されている全データを完全に削除します。
          この操作は取り消せません。
        </Typography>
        <Button
          variant="outlined"
          color="error"
          onClick={() => {
            setDeleteError(null);
            setDeleteStage('confirm1');
          }}
        >
          アカウントを削除…
        </Button>
      </Box>

      <Divider />

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Button
          variant="text"
          color="error"
          onClick={() => {
            void signOut();
            onClose();
          }}
        >
          サインアウト
        </Button>
        <Button variant="contained" onClick={onClose}>
          閉じる
        </Button>
      </Stack>

      <Dialog
        open={deleteStage !== 'idle'}
        onClose={() => {
          if (!deleting) setDeleteStage('idle');
        }}
        maxWidth="xs"
        fullWidth
      >
        {deleteStage === 'confirm1' && (
          <>
            <DialogTitle>アカウント削除の確認 (1/2)</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {user.email} のアカウントを削除しようとしています。クラウド上の
                アカウント設定とクラウド同期データは <strong>すべて完全に削除</strong>
                され、復元できません。本当に続行しますか?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteStage('idle')}>キャンセル</Button>
              <Button
                color="error"
                onClick={() => setDeleteStage('confirm2')}
              >
                次へ
              </Button>
            </DialogActions>
          </>
        )}
        {deleteStage === 'confirm2' && (
          <>
            <DialogTitle>アカウント削除の最終確認 (2/2)</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                これが最終確認です。「アカウントを削除する」を押すと即座に削除処理が
                実行されます。
              </DialogContentText>
              {deleteError && (
                <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
                  {deleteError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteStage('idle')} disabled={deleting}>
                キャンセル
              </Button>
              <Button
                color="error"
                onClick={handleDelete}
                disabled={deleting}
                startIcon={
                  deleting ? <CircularProgress size={14} color="inherit" /> : null
                }
              >
                {deleting ? '削除中…' : 'アカウントを削除する'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={mfaDisableStage !== 'idle'}
        onClose={() => {
          if (!mfaDisabling) setMfaDisableStage('idle');
        }}
        maxWidth="xs"
        fullWidth
      >
        {mfaDisableStage === 'confirm1' && (
          <>
            <DialogTitle>MFA 無効化の確認 (1/2)</DialogTitle>
            <DialogContent>
              <DialogContentText>
                MFA を無効化すると、次回ログインから TOTP コードの入力なしでサイン
                インできるようになります。アカウントのセキュリティが**低下**します。
                続行しますか?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMfaDisableStage('idle')}>キャンセル</Button>
              <Button
                color="warning"
                onClick={() => setMfaDisableStage('confirm2')}
              >
                次へ
              </Button>
            </DialogActions>
          </>
        )}
        {mfaDisableStage === 'confirm2' && (
          <>
            <DialogTitle>MFA 無効化の最終確認 (2/2)</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                これが最終確認です。「MFA を無効化する」を押すと TOTP 設定が削除
                されます。あとから再度有効化することもできます。
              </DialogContentText>
              {mfaDisableError && (
                <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
                  {mfaDisableError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setMfaDisableStage('idle')}
                disabled={mfaDisabling}
              >
                キャンセル
              </Button>
              <Button
                color="warning"
                onClick={handleDisableMfa}
                disabled={mfaDisabling}
                startIcon={
                  mfaDisabling ? <CircularProgress size={14} color="inherit" /> : null
                }
                data-testid="profile-disable-mfa-confirm"
              >
                {mfaDisabling ? '無効化中…' : 'MFA を無効化する'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}

export default ProfileScreen;
