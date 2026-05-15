import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = jest.fn();
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

const updateProfileMock = jest.fn();
const updateUserPasswordMock = jest.fn();
const callUserManagementMock = jest.fn();
const fetchMfaStatusMock = jest.fn();
const disableMfaMock = jest.fn();
jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    updateProfile: (attrs: { givenName?: string }) => updateProfileMock(attrs),
    updateUserPassword: (oldPassword: string, newPassword: string) =>
      updateUserPasswordMock(oldPassword, newPassword),
    callUserManagement: (action: 'deleteAccount' | 'exportData') =>
      callUserManagementMock(action),
    fetchMfaStatus: () => fetchMfaStatusMock(),
    disableMfa: () => disableMfaMock(),
  },
}));

import { ProfileScreen } from '../ProfileScreen';

const SIGNED_IN_USER = {
  userId: 'u-1',
  username: 'alice@example.com',
  email: 'alice@example.com',
  givenName: 'Alice',
};

function setup(authOverrides: Partial<ReturnType<typeof useAuthMock>> = {}) {
  const signOut = jest.fn();
  useAuthMock.mockReturnValue({
    user: SIGNED_IN_USER,
    loading: false,
    signOut,
    refresh: jest.fn(),
    ...authOverrides,
  });
  const onMfaSetupRequested = jest.fn();
  const onClose = jest.fn();
  render(
    <ProfileScreen
      onMfaSetupRequested={onMfaSetupRequested}
      onClose={onClose}
    />,
  );
  return { onMfaSetupRequested, onClose, signOut };
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: MFA disabled (most existing tests are for non-MFA flows)
    fetchMfaStatusMock.mockResolvedValue({ enabled: false, preferred: null });
  });

  it('renders the user email and pre-fills given name', () => {
    setup();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/表示名/)).toHaveValue('Alice');
  });

  it('shows an error placeholder when AuthProvider has no user', () => {
    setup({ user: null });
    expect(
      screen.getByText(/ユーザー情報を取得できません/),
    ).toBeInTheDocument();
  });

  it('updates display name and shows success message', async () => {
    updateProfileMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    setup();
    const nameInput = screen.getByLabelText(/表示名/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Alicia');
    await user.click(screen.getByRole('button', { name: '表示名を更新' }));
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ givenName: 'Alicia' }),
    );
    expect(await screen.findByText(/表示名を更新しました/)).toBeInTheDocument();
  });

  it('surfaces updateProfile errors via the alert', async () => {
    updateProfileMock.mockRejectedValueOnce({ name: 'LimitExceededException' });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: '表示名を更新' }));
    expect(await screen.findByText(/試行が多すぎます/)).toBeInTheDocument();
  });

  it('blocks password change on weak / mismatched / empty fields', async () => {
    const user = userEvent.setup();
    setup();
    // All three fields untouched: should hit "現在のパスワード未入力" + weak new password
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(
      screen.getByText(/現在のパスワードを入力してください/),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 文字以上/)).toBeInTheDocument();
    expect(updateUserPasswordMock).not.toHaveBeenCalled();
  });

  it('blocks password change when confirmation does not match', async () => {
    const user = userEvent.setup();
    setup();
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByTestId('profile-old-password'), 'OldPass1!aaaa');
    await user.type(screen.getByTestId('profile-new-password'), strong);
    await user.type(
      screen.getByTestId('profile-new-password-confirm'),
      'Different1!xyz',
    );
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(screen.getByText(/パスワードが一致しません/)).toBeInTheDocument();
    expect(updateUserPasswordMock).not.toHaveBeenCalled();
  });

  it('calls updateUserPassword on a valid change and clears fields', async () => {
    updateUserPasswordMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    setup();
    const old = 'OldPass1!aaaa';
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByTestId('profile-old-password'), old);
    await user.type(screen.getByTestId('profile-new-password'), strong);
    await user.type(screen.getByTestId('profile-new-password-confirm'), strong);
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    await waitFor(() =>
      expect(updateUserPasswordMock).toHaveBeenCalledWith(old, strong),
    );
    expect(await screen.findByText(/パスワードを更新しました/)).toBeInTheDocument();
    // fields cleared after success
    expect(
      (screen.getByTestId('profile-old-password') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('profile-new-password') as HTMLInputElement).value,
    ).toBe('');
  });

  it('surfaces updatePassword errors (NotAuthorized) via the alert', async () => {
    updateUserPasswordMock.mockRejectedValueOnce({
      name: 'NotAuthorizedException',
    });
    const user = userEvent.setup();
    setup();
    const old = 'WrongPass1!aaa';
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByTestId('profile-old-password'), old);
    await user.type(screen.getByTestId('profile-new-password'), strong);
    await user.type(screen.getByTestId('profile-new-password-confirm'), strong);
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(
      await screen.findByText(/メールまたはパスワードが正しくありません/),
    ).toBeInTheDocument();
  });

  it('fires onMfaSetupRequested when the MFA button is clicked', async () => {
    const user = userEvent.setup();
    const { onMfaSetupRequested } = setup();
    // MFA 状態 fetch 完了 (= 「MFA を設定」ボタン出現) を待ってからクリック
    await user.click(
      await screen.findByRole('button', { name: 'MFA を設定' }),
    );
    expect(onMfaSetupRequested).toHaveBeenCalled();
  });

  it('signs the user out and closes the dialog when サインアウト is clicked', async () => {
    const user = userEvent.setup();
    const { signOut, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'サインアウト' }));
    expect(signOut).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes the dialog when 閉じる is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalled();
  });

  // -------------------------------------------------------------- data export

  it('exports data as a JSON download and shows the resulting filename', async () => {
    const exportResult = {
      ok: true,
      action: 'exportData',
      exportedAt: '2026-05-13T00:00:00Z',
      data: { userSettings: { theme: 'dark' }, llmSettings: null, syncMetadata: [] },
    };
    callUserManagementMock.mockResolvedValueOnce(exportResult);

    // Stub the URL + anchor APIs touched by handleExport
    const createObjectURL = jest.fn(() => 'blob:fake');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'データをエクスポート' }));

    await waitFor(() =>
      expect(callUserManagementMock).toHaveBeenCalledWith('exportData'),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(
      await screen.findByText(/hoshutaro-user-data-.*\.json.*ダウンロード/),
    ).toBeInTheDocument();

    clickSpy.mockRestore();
  });

  it('surfaces export errors via the alert', async () => {
    callUserManagementMock.mockRejectedValueOnce({ name: 'LimitExceededException' });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'データをエクスポート' }));
    expect(await screen.findByText(/試行が多すぎます/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------- account deletion

  it('walks through the 2-step delete confirmation and calls user-management', async () => {
    callUserManagementMock.mockResolvedValueOnce({ ok: true, action: 'deleteAccount' });
    const user = userEvent.setup();
    const { signOut, onClose } = setup();

    // Step 0 → step 1
    await user.click(screen.getByRole('button', { name: 'アカウントを削除…' }));
    expect(
      await screen.findByText(/アカウント削除の確認 \(1\/2\)/),
    ).toBeInTheDocument();

    // Step 1 → step 2
    await user.click(screen.getByRole('button', { name: '次へ' }));
    expect(
      await screen.findByText(/アカウント削除の最終確認 \(2\/2\)/),
    ).toBeInTheDocument();

    // Step 2 → confirm
    await user.click(screen.getByRole('button', { name: 'アカウントを削除する' }));

    await waitFor(() =>
      expect(callUserManagementMock).toHaveBeenCalledWith('deleteAccount'),
    );
    expect(signOut).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error and stays on step 2 if delete fails', async () => {
    callUserManagementMock.mockRejectedValueOnce(
      new Error('user-management deleteAccount HTTP 502'),
    );
    const user = userEvent.setup();
    const { signOut, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'アカウントを削除…' }));
    await user.click(screen.getByRole('button', { name: '次へ' }));
    await user.click(screen.getByRole('button', { name: 'アカウントを削除する' }));

    expect(
      await screen.findByText(/user-management deleteAccount HTTP 502/),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows the user to cancel from the 2-step delete dialog', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'アカウントを削除…' }));
    const cancelButtons = screen.getAllByRole('button', { name: 'キャンセル' });
    await user.click(cancelButtons[0]);
    expect(callUserManagementMock).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------- MFA status (Slice 5-C)

  it('shows "MFA を設定" button when MFA is disabled', async () => {
    fetchMfaStatusMock.mockResolvedValueOnce({ enabled: false, preferred: null });
    setup();
    expect(
      await screen.findByRole('button', { name: 'MFA を設定' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('profile-disable-mfa')).not.toBeInTheDocument();
  });

  it('shows "MFA を無効化…" button when MFA is enabled', async () => {
    fetchMfaStatusMock.mockResolvedValueOnce({ enabled: true, preferred: 'TOTP' });
    setup();
    expect(await screen.findByTestId('profile-disable-mfa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'MFA を設定' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/ログイン時に認証アプリの 6 桁コードが必要/),
    ).toBeInTheDocument();
  });

  it('shows a warning when fetchMfaStatus fails, falling back to disabled state', async () => {
    fetchMfaStatusMock.mockRejectedValueOnce({ name: 'LimitExceededException' });
    setup();
    expect(
      await screen.findByText(/MFA 状態の取得に失敗しました/),
    ).toBeInTheDocument();
    // フォールバックで「MFA を設定」ボタンを表示 (再有効化を試せるように)
    expect(screen.getByRole('button', { name: 'MFA を設定' })).toBeInTheDocument();
  });

  it('walks through the 2-step MFA disable confirmation and calls disableMfa', async () => {
    fetchMfaStatusMock.mockResolvedValueOnce({ enabled: true, preferred: 'TOTP' });
    disableMfaMock.mockResolvedValueOnce(undefined);
    // 無効化後の再 fetch で disabled に切り替わる
    fetchMfaStatusMock.mockResolvedValueOnce({ enabled: false, preferred: null });

    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByTestId('profile-disable-mfa'));
    expect(
      await screen.findByText(/MFA 無効化の確認 \(1\/2\)/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '次へ' }));
    expect(
      await screen.findByText(/MFA 無効化の最終確認 \(2\/2\)/),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('profile-disable-mfa-confirm'));

    await waitFor(() => expect(disableMfaMock).toHaveBeenCalled());
    expect(
      await screen.findByText(/MFA を無効化しました/),
    ).toBeInTheDocument();
    // UI が disabled 状態に切替: 「MFA を設定」ボタンが現れる
    expect(
      await screen.findByRole('button', { name: 'MFA を設定' }),
    ).toBeInTheDocument();
  });

  it('shows an error and stays on step 2 when disableMfa fails', async () => {
    fetchMfaStatusMock.mockResolvedValueOnce({ enabled: true, preferred: 'TOTP' });
    disableMfaMock.mockRejectedValueOnce({ name: 'NotAuthorizedException' });

    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByTestId('profile-disable-mfa'));
    await user.click(await screen.findByRole('button', { name: '次へ' }));
    await user.click(screen.getByTestId('profile-disable-mfa-confirm'));

    expect(
      await screen.findByText(/メールまたはパスワードが正しくありません/),
    ).toBeInTheDocument();
    // ボタンはまだ disable できる状態 (= 2/2 タイトルが残っている)
    expect(screen.getByText(/MFA 無効化の最終確認 \(2\/2\)/)).toBeInTheDocument();
  });
});
