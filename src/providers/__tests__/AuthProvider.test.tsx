import { render, screen, waitFor } from '@testing-library/react';

const ensureAmplifyConfiguredMock = jest.fn<boolean, []>(() => true);
jest.mock('../../services/amplifyConfig', () => ({
  ensureAmplifyConfigured: () => ensureAmplifyConfiguredMock(),
}));

const getCurrentUserDetailsMock = jest.fn();
const signOutMock = jest.fn();
jest.mock('../../services/AmplifyAuthService', () => ({
  AmplifyAuthService: {
    getCurrentUserDetails: () => getCurrentUserDetailsMock(),
    signOut: () => signOutMock(),
  },
}));

const hubListenMock = jest.fn(() => () => {});
jest.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: (...args: unknown[]) => hubListenMock(...args),
  },
}));

import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../../hooks/useAuth';

function Probe() {
  const { user, loading, authAvailable } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <span data-testid="auth-available">{String(authAvailable)}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureAmplifyConfiguredMock.mockReturnValue(true);
  });

  it('starts in loading state and resolves to no user when not signed in', async () => {
    getCurrentUserDetailsMock.mockResolvedValueOnce(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(hubListenMock).toHaveBeenCalledWith('auth', expect.any(Function));
  });

  it('populates the user when AmplifyAuthService returns details', async () => {
    getCurrentUserDetailsMock.mockResolvedValueOnce({
      userId: 'u1',
      username: 'alice@example.com',
      email: 'alice@example.com',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('user').textContent).toBe('alice@example.com'),
    );
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('skips Amplify calls and exits loading when configuration is unavailable', async () => {
    ensureAmplifyConfiguredMock.mockReturnValueOnce(false);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(getCurrentUserDetailsMock).not.toHaveBeenCalled();
    expect(hubListenMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-available').textContent).toBe('false');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useAuth must be used within an <AuthProvider>/,
    );
    spy.mockRestore();
  });
});
