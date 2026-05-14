import { useState, type FormEvent } from 'react';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AmplifyAuthService } from '../../services/AmplifyAuthService';
import { useAuth } from '../../hooks/useAuth';
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          TOTP 対応の認証アプリ (Google Authenticator など) を使ったログイン時の
          追加認証を有効化できます。
        </Typography>
        <Button variant="outlined" onClick={onMfaSetupRequested}>
          MFA を設定
        </Button>
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
          UserSettings / LLMSettings / SyncMetadata のクラウド保存内容を JSON で
          ダウンロードします。
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
          Cognito アカウントと、クラウドに保存されている全データを完全に削除します。
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
                UserSettings / LLMSettings / SyncMetadata は <strong>すべて完全に削除</strong>
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
    </Stack>
  );
}

export default ProfileScreen;
