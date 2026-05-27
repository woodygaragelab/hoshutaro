import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = jest.fn();
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

// Each auth screen is mocked to a minimal stub that exposes its props so we can
// assert that AuthGuard wires the navigation callbacks correctly without
// reaching into Amplify mocks.
jest.mock('../LoginScreen', () => ({
  LoginScreen: (props: {
    onGotoSignUp: () => void;
    onGotoForgotPassword: () => void;
    onGotoConfirmEmail: (email: string) => void;
  }) => (
    <div data-testid="login-screen">
      <button onClick={props.onGotoSignUp}>goto-signup</button>
      <button onClick={props.onGotoForgotPassword}>goto-forgot</button>
      <button onClick={() => props.onGotoConfirmEmail('forced@example.com')}>
        goto-confirm
      </button>
    </div>
  ),
}));

jest.mock('../SignUpScreen', () => ({
  SignUpScreen: (props: {
    onGotoLogin: () => void;
    onSignUpSuccess: (email: string) => void;
  }) => (
    <div data-testid="signup-screen">
      <button onClick={props.onGotoLogin}>goto-login</button>
      <button onClick={() => props.onSignUpSuccess('new@example.com')}>
        signup-success
      </button>
    </div>
  ),
}));

jest.mock('../ConfirmEmailScreen', () => ({
  ConfirmEmailScreen: (props: {
    email: string;
    onGotoLogin: () => void;
    onConfirmSuccess: () => void;
  }) => (
    <div data-testid="confirm-email-screen">
      <span data-testid="confirm-email-prop">{props.email}</span>
      <button onClick={props.onGotoLogin}>goto-login</button>
      <button onClick={props.onConfirmSuccess}>confirm-success</button>
    </div>
  ),
}));

jest.mock('../RequestPasswordResetScreen', () => ({
  RequestPasswordResetScreen: (props: {
    onGotoLogin: () => void;
    onResetRequested: (email: string) => void;
  }) => (
    <div data-testid="request-reset-screen">
      <button onClick={props.onGotoLogin}>goto-login</button>
      <button onClick={() => props.onResetRequested('reset@example.com')}>
        reset-requested
      </button>
    </div>
  ),
}));

jest.mock('../ResetPasswordWithCodeScreen', () => ({
  ResetPasswordWithCodeScreen: (props: {
    email: string;
    onGotoLogin: () => void;
    onResetSuccess: () => void;
  }) => (
    <div data-testid="reset-password-screen">
      <span data-testid="reset-email-prop">{props.email}</span>
      <button onClick={props.onGotoLogin}>goto-login</button>
      <button onClick={props.onResetSuccess}>reset-success</button>
    </div>
  ),
}));

import { AuthGuard } from '../AuthGuard';

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading spinner while AuthProvider is resolving', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    render(
      <AuthGuard>
        <div data-testid="app-content">APP</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });

  it('renders children when a user is signed in', () => {
    useAuthMock.mockReturnValue({
      user: { userId: 'u1', username: 'a@b.com', email: 'a@b.com' },
      loading: false,
      authAvailable: true,
    });
    render(
      <AuthGuard>
        <div data-testid="app-content">APP</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('renders children in offline mode when cloud auth is unavailable', () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      authAvailable: false,
    });
    render(
      <AuthGuard>
        <div data-testid="app-content">APP</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('renders LoginScreen by default when unauthenticated', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('navigates from login to sign-up and back', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    await user.click(screen.getByText('goto-signup'));
    expect(screen.getByTestId('signup-screen')).toBeInTheDocument();
    await user.click(screen.getByText('goto-login'));
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('carries pendingEmail from signUp success into ConfirmEmail', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    await user.click(screen.getByText('goto-signup'));
    await user.click(screen.getByText('signup-success'));
    expect(screen.getByTestId('confirm-email-screen')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-email-prop').textContent).toBe(
      'new@example.com',
    );
  });

  it('routes UserNotConfirmed-triggered onGotoConfirmEmail with email', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    await user.click(screen.getByText('goto-confirm'));
    expect(screen.getByTestId('confirm-email-screen')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-email-prop').textContent).toBe(
      'forced@example.com',
    );
  });

  it('carries pendingEmail from password reset request into ResetPasswordWithCode', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    await user.click(screen.getByText('goto-forgot'));
    await user.click(screen.getByText('reset-requested'));
    expect(screen.getByTestId('reset-password-screen')).toBeInTheDocument();
    expect(screen.getByTestId('reset-email-prop').textContent).toBe(
      'reset@example.com',
    );
  });

  it('returns to login after a successful password reset', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, loading: false, authAvailable: true });
    render(
      <AuthGuard>
        <div>APP</div>
      </AuthGuard>,
    );
    await user.click(screen.getByText('goto-forgot'));
    await user.click(screen.getByText('reset-requested'));
    await user.click(screen.getByText('reset-success'));
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });
});
