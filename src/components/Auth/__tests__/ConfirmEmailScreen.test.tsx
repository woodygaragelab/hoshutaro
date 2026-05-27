import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    confirmSignUp: jest.fn(),
    resendConfirmationCode: jest.fn(),
  },
}));

import { ConfirmEmailScreen } from '../ConfirmEmailScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedConfirm = AmplifyAuthService.confirmSignUp as jest.MockedFunction<
  typeof AmplifyAuthService.confirmSignUp
>;
const mockedResend = AmplifyAuthService.resendConfirmationCode as jest.MockedFunction<
  typeof AmplifyAuthService.resendConfirmationCode
>;

function setup(email = 'alice@example.com') {
  const onGotoLogin = jest.fn();
  const onConfirmSuccess = jest.fn();
  render(
    <ConfirmEmailScreen
      email={email}
      onGotoLogin={onGotoLogin}
      onConfirmSuccess={onConfirmSuccess}
    />,
  );
  return { onGotoLogin, onConfirmSuccess };
}

describe('ConfirmEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the target email in the subtitle', () => {
    setup('bob@example.com');
    expect(screen.getByText(/bob@example\.com に送信した/)).toBeInTheDocument();
  });

  it('rejects non-6-digit codes', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/確認コード/), '12');
    await user.click(screen.getByRole('button', { name: '確認' }));
    expect(screen.getByText(/6 桁の数字を入力/)).toBeInTheDocument();
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('strips non-digit characters from the code input', async () => {
    const user = userEvent.setup();
    setup();
    const codeInput = screen.getByLabelText(/確認コード/) as HTMLInputElement;
    await user.type(codeInput, 'ab12cd34ef56');
    expect(codeInput.value).toBe('123456');
  });

  it('calls confirmSignUp and triggers onConfirmSuccess', async () => {
    const user = userEvent.setup();
    mockedConfirm.mockResolvedValueOnce(undefined as never);
    const { onConfirmSuccess } = setup();
    await user.type(screen.getByLabelText(/確認コード/), '123456');
    await user.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() =>
      expect(mockedConfirm).toHaveBeenCalledWith('alice@example.com', '123456'),
    );
    expect(onConfirmSuccess).toHaveBeenCalled();
  });

  it('resends code and shows success message', async () => {
    const user = userEvent.setup();
    mockedResend.mockResolvedValueOnce(undefined as never);
    setup();
    await user.click(screen.getByRole('button', { name: 'コードを再送信' }));
    await waitFor(() =>
      expect(mockedResend).toHaveBeenCalledWith('alice@example.com'),
    );
    expect(await screen.findByText(/確認コードを再送信しました/)).toBeInTheDocument();
  });
});
