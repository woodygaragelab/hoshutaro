import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    signIn: jest.fn(),
    confirmMfaSignIn: jest.fn(),
  },
}));

import { LoginScreen } from '../LoginScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedSignIn = AmplifyAuthService.signIn as jest.MockedFunction<
  typeof AmplifyAuthService.signIn
>;
const mockedConfirmMfaSignIn = AmplifyAuthService.confirmMfaSignIn as jest.MockedFunction<
  typeof AmplifyAuthService.confirmMfaSignIn
>;

function setup() {
  const onGotoSignUp = jest.fn();
  const onGotoForgotPassword = jest.fn();
  const onGotoConfirmEmail = jest.fn();
  const onLoginSuccess = jest.fn();
  render(
    <LoginScreen
      onGotoSignUp={onGotoSignUp}
      onGotoForgotPassword={onGotoForgotPassword}
      onGotoConfirmEmail={onGotoConfirmEmail}
      onLoginSuccess={onLoginSuccess}
    />,
  );
  return { onGotoSignUp, onGotoForgotPassword, onGotoConfirmEmail, onLoginSuccess };
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form fields and primary actions', () => {
    setup();
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'パスワードを忘れた方' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeInTheDocument();
  });

  it('blocks submission and shows validation errors for invalid email', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'not-an-email');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByText(/有効なメールアドレス/)).toBeInTheDocument();
    expect(mockedSignIn).not.toHaveBeenCalled();
  });

  it('calls signIn and triggers onLoginSuccess on success', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValueOnce({ isSignedIn: true, nextStep: { signInStep: 'DONE' } } as never);
    const { onLoginSuccess } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() =>
      expect(mockedSignIn).toHaveBeenCalledWith('alice@example.com', 'AnyPass1!aaaa'),
    );
    expect(onLoginSuccess).toHaveBeenCalled();
  });

  it('redirects to ConfirmEmail when UserNotConfirmedException is thrown', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockRejectedValueOnce({ name: 'UserNotConfirmedException' });
    const { onGotoConfirmEmail } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'bob@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() =>
      expect(onGotoConfirmEmail).toHaveBeenCalledWith('bob@example.com'),
    );
  });

  it('shows a Japanese error message on NotAuthorizedException', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockRejectedValueOnce({ name: 'NotAuthorizedException' });
    setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(
      await screen.findByText(/メールまたはパスワードが正しくありません/),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------- MFA challenge (Slice 5-B)

  async function signInTillMfaStage(user: ReturnType<typeof userEvent.setup>) {
    mockedSignIn.mockResolvedValueOnce({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' },
    } as never);
    await user.type(screen.getByLabelText(/メールアドレス/), 'mfa@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
  }

  it('switches to MFA challenge UI when signIn requires TOTP', async () => {
    const user = userEvent.setup();
    setup();
    await signInTillMfaStage(user);
    expect(
      await screen.findByText(/認証アプリで生成した 6 桁コード/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/TOTP コード/)).toBeInTheDocument();
    // 元の credentials フォームは消える
    expect(
      screen.queryByLabelText(/パスワードを忘れた方/),
    ).not.toBeInTheDocument();
  });

  it('rejects TOTP codes that are not 6 digits', async () => {
    const user = userEvent.setup();
    setup();
    await signInTillMfaStage(user);
    await user.type(await screen.findByLabelText(/TOTP コード/), '12');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByText(/6 桁の数字を入力/)).toBeInTheDocument();
    expect(mockedConfirmMfaSignIn).not.toHaveBeenCalled();
  });

  it('calls confirmMfaSignIn and onLoginSuccess on valid TOTP code', async () => {
    const user = userEvent.setup();
    mockedConfirmMfaSignIn.mockResolvedValueOnce({ isSignedIn: true } as never);
    const { onLoginSuccess } = setup();
    await signInTillMfaStage(user);
    await user.type(await screen.findByLabelText(/TOTP コード/), '123456');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() =>
      expect(mockedConfirmMfaSignIn).toHaveBeenCalledWith('123456'),
    );
    expect(onLoginSuccess).toHaveBeenCalled();
  });

  it('surfaces CodeMismatchException on TOTP rejection', async () => {
    const user = userEvent.setup();
    mockedConfirmMfaSignIn.mockRejectedValueOnce({ name: 'CodeMismatchException' });
    setup();
    await signInTillMfaStage(user);
    await user.type(await screen.findByLabelText(/TOTP コード/), '111111');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(
      await screen.findByText(/確認コードが正しくありません/),
    ).toBeInTheDocument();
  });

  it('returns to credentials stage when user clicks ログイン情報を再入力する', async () => {
    const user = userEvent.setup();
    setup();
    await signInTillMfaStage(user);
    await user.click(
      await screen.findByRole('button', { name: 'ログイン情報を再入力する' }),
    );
    // credentials フォームが復活
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'パスワードを忘れた方' }),
    ).toBeInTheDocument();
    // email は保持、password はクリア
    expect(screen.getByLabelText(/メールアドレス/)).toHaveValue('mfa@example.com');
    expect(screen.getByLabelText(/パスワード/)).toHaveValue('');
  });

  it('shows an unsupported-challenge error for unknown signInStep', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValueOnce({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_SMS_CODE' },
    } as never);
    setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'sms@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'AnyPass1!aaaa');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(
      await screen.findByText(/未対応の認証チャレンジ.*CONFIRM_SIGN_IN_WITH_SMS_CODE/),
    ).toBeInTheDocument();
  });
});
