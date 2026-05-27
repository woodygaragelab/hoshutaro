import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    confirmPasswordReset: jest.fn(),
  },
}));

import { ResetPasswordWithCodeScreen } from '../ResetPasswordWithCodeScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedConfirm = AmplifyAuthService.confirmPasswordReset as jest.MockedFunction<
  typeof AmplifyAuthService.confirmPasswordReset
>;

function setup(email = 'alice@example.com') {
  const onGotoLogin = jest.fn();
  const onResetSuccess = jest.fn();
  render(
    <ResetPasswordWithCodeScreen
      email={email}
      onGotoLogin={onGotoLogin}
      onResetSuccess={onResetSuccess}
    />,
  );
  return {
    onGotoLogin,
    onResetSuccess,
    passwordInput: screen.getByTestId('reset-password') as HTMLInputElement,
    passwordConfirmInput: screen.getByTestId(
      'reset-password-confirm',
    ) as HTMLInputElement,
  };
}

describe('ResetPasswordWithCodeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects weak passwords and missing code', async () => {
    const user = userEvent.setup();
    const { passwordInput } = setup();
    await user.type(screen.getByLabelText(/確認コード/), '12');
    await user.type(passwordInput, 'weak');
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(screen.getByText(/6 桁の数字を入力/)).toBeInTheDocument();
    expect(screen.getByText(/12 文字以上/)).toBeInTheDocument();
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup();
    const { passwordInput, passwordConfirmInput } = setup();
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByLabelText(/確認コード/), '123456');
    await user.type(passwordInput, strong);
    await user.type(passwordConfirmInput, 'OtherPass1!xyz');
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(screen.getByText(/パスワードが一致しません/)).toBeInTheDocument();
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('calls confirmPasswordReset and fires onResetSuccess', async () => {
    const user = userEvent.setup();
    mockedConfirm.mockResolvedValueOnce(undefined as never);
    const { onResetSuccess, passwordInput, passwordConfirmInput } = setup();
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByLabelText(/確認コード/), '123456');
    await user.type(passwordInput, strong);
    await user.type(passwordConfirmInput, strong);
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    await waitFor(() =>
      expect(mockedConfirm).toHaveBeenCalledWith(
        'alice@example.com',
        '123456',
        strong,
      ),
    );
    expect(onResetSuccess).toHaveBeenCalled();
  });

  it('surfaces ExpiredCodeException via the alert', async () => {
    const user = userEvent.setup();
    mockedConfirm.mockRejectedValueOnce({ name: 'ExpiredCodeException' });
    const { passwordInput, passwordConfirmInput } = setup();
    const strong = 'StrongPass1!xyz';
    await user.type(screen.getByLabelText(/確認コード/), '123456');
    await user.type(passwordInput, strong);
    await user.type(passwordConfirmInput, strong);
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }));
    expect(await screen.findByText(/有効期限が切れ/)).toBeInTheDocument();
  });
});
