import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    requestPasswordReset: jest.fn(),
  },
}));

import { RequestPasswordResetScreen } from '../RequestPasswordResetScreen';
import { AmplifyAuthService } from '../../../services/AmplifyAuthService';

const mockedRequest = AmplifyAuthService.requestPasswordReset as jest.MockedFunction<
  typeof AmplifyAuthService.requestPasswordReset
>;

function setup() {
  const onGotoLogin = jest.fn();
  const onResetRequested = jest.fn();
  render(
    <RequestPasswordResetScreen
      onGotoLogin={onGotoLogin}
      onResetRequested={onResetRequested}
    />,
  );
  return { onGotoLogin, onResetRequested };
}

describe('RequestPasswordResetScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty / invalid emails before calling the service', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'リセットコードを送信' }));
    expect(screen.getByText(/有効なメールアドレス/)).toBeInTheDocument();
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('calls requestPasswordReset and forwards to the next screen', async () => {
    const user = userEvent.setup();
    mockedRequest.mockResolvedValueOnce(undefined as never);
    const { onResetRequested } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'リセットコードを送信' }));
    await waitFor(() =>
      expect(mockedRequest).toHaveBeenCalledWith('alice@example.com'),
    );
    expect(onResetRequested).toHaveBeenCalledWith('alice@example.com');
  });

  it('hides UserNotFoundException and pretends the request succeeded', async () => {
    const user = userEvent.setup();
    mockedRequest.mockRejectedValueOnce({ name: 'UserNotFoundException' });
    const { onResetRequested } = setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: 'リセットコードを送信' }));
    await waitFor(() =>
      expect(onResetRequested).toHaveBeenCalledWith('ghost@example.com'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces other Cognito errors via the alert banner', async () => {
    const user = userEvent.setup();
    mockedRequest.mockRejectedValueOnce({ name: 'LimitExceededException' });
    setup();
    await user.type(screen.getByLabelText(/メールアドレス/), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'リセットコードを送信' }));
    expect(await screen.findByText(/試行が多すぎます/)).toBeInTheDocument();
  });
});
