import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    signIn: jest.fn(),
  },
}));

import { LoginScreen } from '../LoginScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedSignIn = AmplifyAuthService.signIn as jest.MockedFunction<
  typeof AmplifyAuthService.signIn
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
    mockedSignIn.mockResolvedValueOnce(undefined as never);
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
});
