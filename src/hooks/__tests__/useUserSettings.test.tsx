import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const useAuthMock = jest.fn();
jest.mock('../useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

const getMock = jest.fn();
const updateMock = jest.fn();
const getCloudClientMock = jest.fn();

jest.mock('../../services/cloudSync', () => ({
  getCloudClient: () => getCloudClientMock(),
}));

import { useUserSettings } from '../useUserSettings';

const SIGNED_IN_USER = {
  userId: 'u-1',
  username: 'alice@example.com',
  email: 'alice@example.com',
};

function makeFakeClient() {
  return {
    models: {
      UserSettings: {
        get: (...args: unknown[]) => getMock(...args),
        update: (...args: unknown[]) => updateMock(...args),
      },
    },
  };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useUserSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCloudClientMock.mockReturnValue(makeFakeClient());
  });

  it('does not fetch when there is no signed-in user', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.settings).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches and normalizes UserSettings for the signed-in user', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: { theme: 'dark', language: 'en', mfaEnabled: true },
      errors: null,
    });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMock).toHaveBeenCalledWith({ userId: 'u-1' });
    expect(result.current.settings).toEqual({
      theme: 'dark',
      language: 'en',
      mfaEnabled: true,
    });
  });

  it('falls back to safe defaults when the record has missing/unknown values', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: { theme: 'mauve', language: null, mfaEnabled: null },
      errors: null,
    });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());
    expect(result.current.settings).toEqual({
      theme: 'light',
      language: 'ja',
      mfaEnabled: false,
    });
  });

  it('returns settings=null when the cloud record does not exist yet', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({ data: null, errors: null });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });

  it('surfaces AppSync errors via query.error', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: null,
      errors: [{ message: 'Unauthorized' }],
    });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/Unauthorized/);
  });

  it('returns null and skips queryFn body when cloud client is unavailable', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getCloudClientMock.mockReturnValueOnce(null);
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.settings).toBeNull();
  });

  it('updates UserSettings via the mutation', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValue({
      data: { theme: 'light', language: 'ja', mfaEnabled: false },
      errors: null,
    });
    updateMock.mockResolvedValueOnce({
      data: { theme: 'dark', language: 'ja', mfaEnabled: false },
      errors: null,
    });

    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(async () => {
      await result.current.updateAsync({ theme: 'dark' });
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', theme: 'dark', updatedAt: expect.any(String) }),
    );
  });

  it('rejects update mutations when cloud client is unavailable', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    // First fetch succeeds
    getMock.mockResolvedValueOnce({
      data: { theme: 'light', language: 'ja', mfaEnabled: false },
      errors: null,
    });
    const { result } = renderHook(() => useUserSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());

    // Now make the cloud client disappear and trigger update.
    getCloudClientMock.mockReturnValue(null);
    await expect(
      act(async () => {
        await result.current.updateAsync({ theme: 'dark' });
      }),
    ).rejects.toThrow(/Cloud client unavailable/);
  });
});
