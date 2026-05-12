import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    signUp: jest.fn(),
  },
}));

import { SignUpScreen } from '../SignUpScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedSignUp = AmplifyAuthService.signUp as jest.MockedFunction<
  typeof AmplifyAuthService.signUp
>;

function setup() {
  const onGotoLogin = jest.fn();
  const onSignUpSuccess = jest.fn();
  render(<SignUpScreen onGotoLogin={onGotoLogin} onSignUpSuccess={onSignUpSuccess} />);
  return {
    onGotoLogin,
    onSignUpSuccess,
    passwordInput: screen.getByTestId('signup-password') as HTMLInputElement,
    passwordConfirmInput: screen.getByTestId(
      'signup-password-confirm',
    ) as HTMLInputElement,
  };
}

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all required fields and the agreement checkbox', () => {
    setup();
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument();
    expect(screen.getByTestId('signup-password')).toBeInTheDocument();
    expect(screen.getByTestId('signup-password-confirm')).toBeInTheDocument();
    expect(screen.getByLabelText(/利用規約/)).toBeInTheDocument();
  });

  it('flags weak passwords and mismatched confirmation', async () => {
    const user = userEvent.setup();
    const { passwordInput, passwordConfirmInput } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    await user.type(passwordInput, 'weak');
    await user.type(passwordConfirmInput, 'mismatch');
    await user.click(screen.getByLabelText(/利用規約/));
    await user.click(screen.getByRole('button', { name: '新規登録' }));
    expect(screen.getByText(/12 文字以上/)).toBeInTheDocument();
    expect(screen.getByText(/パスワードが一致しません/)).toBeInTheDocument();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('requires terms agreement', async () => {
    const user = userEvent.setup();
    const { passwordInput, passwordConfirmInput } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    const strong = 'StrongPass1!xyz';
    await user.type(passwordInput, strong);
    await user.type(passwordConfirmInput, strong);
    await user.click(screen.getByRole('button', { name: '新規登録' }));
    expect(screen.getByText(/同意が必要です/)).toBeInTheDocument();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('calls signUp with email/password and triggers onSignUpSuccess', async () => {
    const user = userEvent.setup();
    mockedSignUp.mockResolvedValueOnce(undefined as never);
    const { onSignUpSuccess, passwordInput, passwordConfirmInput } = setup();
    const email = 'new@example.com';
    const password = 'StrongPass1!xyz';
    await user.type(screen.getByLabelText(/メールアドレス/), email);
    await user.type(passwordInput, password);
    await user.type(passwordConfirmInput, password);
    await user.click(screen.getByLabelText(/利用規約/));
    await user.click(screen.getByRole('button', { name: '新規登録' }));
    await waitFor(() =>
      expect(mockedSignUp).toHaveBeenCalledWith(email, password, undefined),
    );
    expect(onSignUpSuccess).toHaveBeenCalledWith(email);
  });

  it('surfaces UsernameExistsException as a Japanese error message', async () => {
    const user = userEvent.setup();
    mockedSignUp.mockRejectedValueOnce({ name: 'UsernameExistsException' });
    const { passwordInput, passwordConfirmInput } = setup();
    const password = 'StrongPass1!xyz';
    await user.type(screen.getByLabelText(/メールアドレス/), 'dup@example.com');
    await user.type(passwordInput, password);
    await user.type(passwordConfirmInput, password);
    await user.click(screen.getByLabelText(/利用規約/));
    await user.click(screen.getByRole('button', { name: '新規登録' }));
    expect(await screen.findByText(/既に登録されています/)).toBeInTheDocument();
  });
});
