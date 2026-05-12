import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = jest.fn();
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

const updateProfileMock = jest.fn();
const updateUserPasswordMock = jest.fn();
jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    updateProfile: (attrs: { givenName?: string }) => updateProfileMock(attrs),
    updateUserPassword: (oldPassword: string, newPassword: string) =>
      updateUserPasswordMock(oldPassword, newPassword),
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
    await user.click(screen.getByRole('button', { name: 'MFA を設定' }));
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
});
