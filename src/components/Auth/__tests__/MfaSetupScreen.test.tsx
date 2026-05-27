import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setupMfaMock = jest.fn();
const verifyMfaSetupMock = jest.fn();

jest.mock('../../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    setupMfa: () => setupMfaMock(),
    verifyMfaSetup: (code: string) => verifyMfaSetupMock(code),
  },
}));

import { MfaSetupScreen } from '../MfaSetupScreen';

const VALID_URI =
  'otpauth://totp/HOSHUTARO:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=HOSHUTARO';
const VALID_SECRET = 'JBSWY3DPEHPK3PXP';

function makeSetupResult(uri = VALID_URI, secret = VALID_SECRET) {
  return {
    sharedSecret: secret,
    getSetupUri: jest.fn(() => ({
      toString: () => uri,
    })),
  };
}

function setup(opts: { withSkip?: boolean } = {}) {
  const onSetupSuccess = jest.fn();
  const onSkip = opts.withSkip ? jest.fn() : undefined;
  render(
    <MfaSetupScreen
      username="alice@example.com"
      onSetupSuccess={onSetupSuccess}
      onSkip={onSkip}
    />,
  );
  return { onSetupSuccess, onSkip };
}

describe('MfaSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a spinner while setUpTOTP is in flight, then renders QR + secret', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    setup();
    expect(screen.getByTestId('mfa-qr-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    expect(screen.getByTestId('mfa-secret').textContent).toBe(VALID_SECRET);
    expect(screen.queryByTestId('mfa-qr-loading')).not.toBeInTheDocument();
  });

  it('renders an error alert when setUpTOTP fails', async () => {
    setupMfaMock.mockRejectedValueOnce({ name: 'LimitExceededException' });
    setup();
    expect(await screen.findByText(/試行が多すぎます/)).toBeInTheDocument();
    expect(screen.queryByTestId('mfa-qr-svg')).not.toBeInTheDocument();
  });

  it('rejects non-6-digit codes before calling verifyMfaSetup', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/6 桁コード/), '12');
    await user.click(screen.getByRole('button', { name: 'MFA を有効化' }));
    expect(screen.getByText(/6 桁の数字を入力/)).toBeInTheDocument();
    expect(verifyMfaSetupMock).not.toHaveBeenCalled();
  });

  it('strips non-digit characters from the code input', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    const input = screen.getByLabelText(/6 桁コード/) as HTMLInputElement;
    await user.type(input, 'a1b2c3d4e5f6');
    expect(input.value).toBe('123456');
  });

  it('calls verifyMfaSetup and triggers onSetupSuccess on a valid code', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    verifyMfaSetupMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    const { onSetupSuccess } = setup();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/6 桁コード/), '654321');
    await user.click(screen.getByRole('button', { name: 'MFA を有効化' }));
    await waitFor(() => expect(verifyMfaSetupMock).toHaveBeenCalledWith('654321'));
    expect(onSetupSuccess).toHaveBeenCalled();
  });

  it('surfaces verifyMfaSetup errors via the alert', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    verifyMfaSetupMock.mockRejectedValueOnce({ name: 'CodeMismatchException' });
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/6 桁コード/), '111111');
    await user.click(screen.getByRole('button', { name: 'MFA を有効化' }));
    expect(await screen.findByText(/確認コードが正しくありません/)).toBeInTheDocument();
  });

  it('hides the skip link when onSkip is not provided', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    setup();
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /スキップ/ }),
    ).not.toBeInTheDocument();
  });

  it('shows skip link and fires onSkip when provided', async () => {
    setupMfaMock.mockResolvedValueOnce(makeSetupResult());
    const user = userEvent.setup();
    const { onSkip } = setup({ withSkip: true });
    await waitFor(() => expect(screen.getByTestId('mfa-qr-svg')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /スキップ/ }));
    expect(onSkip).toHaveBeenCalled();
  });
});
