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

import { useLLMSettings } from '../useLLMSettings';

const SIGNED_IN_USER = {
  userId: 'u-1',
  username: 'alice@example.com',
  email: 'alice@example.com',
};

function makeFakeClient() {
  return {
    models: {
      LLMSettings: {
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

describe('useLLMSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCloudClientMock.mockReturnValue(makeFakeClient());
  });

  it('does not fetch when there is no signed-in user', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.settings).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes a sensible DEFAULTS object regardless of fetch state', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    expect(result.current.DEFAULTS).toEqual({
      preferredModel: null,
      fallbackModels: [],
      mtpEnabled: false,
      customApiKeys: null,
    });
  });

  it('fetches and normalizes LLMSettings for the signed-in user', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: {
        preferredModel: 'cloud_claude_3_5_sonnet',
        fallbackModels: ['cloud_claude_3_haiku', null, 'gemma-4-E2B-it'],
        mtpEnabled: true,
        customApiKeys: 'enc:xxx',
      },
      errors: null,
    });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMock).toHaveBeenCalledWith({ userId: 'u-1' });
    expect(result.current.settings).toEqual({
      preferredModel: 'cloud_claude_3_5_sonnet',
      fallbackModels: ['cloud_claude_3_haiku', 'gemma-4-E2B-it'],
      mtpEnabled: true,
      customApiKeys: 'enc:xxx',
    });
  });

  it('falls back to safe defaults when fields are missing/null', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: {
        preferredModel: null,
        fallbackModels: null,
        mtpEnabled: null,
        customApiKeys: null,
      },
      errors: null,
    });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());
    expect(result.current.settings).toEqual({
      preferredModel: null,
      fallbackModels: [],
      mtpEnabled: false,
      customApiKeys: null,
    });
  });

  it('returns settings=null when the cloud record does not exist yet', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({ data: null, errors: null });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toBeNull();
  });

  it('surfaces AppSync errors via query.error', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: null,
      errors: [{ message: 'Unauthorized' }],
    });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/Unauthorized/);
  });

  it('returns null and skips queryFn body when cloud client is unavailable', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getCloudClientMock.mockReturnValueOnce(null);
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.settings).toBeNull();
  });

  it('updates LLMSettings via the mutation with userId payload', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValue({
      data: {
        preferredModel: null,
        fallbackModels: [],
        mtpEnabled: false,
        customApiKeys: null,
      },
      errors: null,
    });
    updateMock.mockResolvedValueOnce({
      data: {
        preferredModel: 'cloud_claude_3_5_sonnet',
        fallbackModels: ['cloud_claude_3_haiku'],
        mtpEnabled: true,
        customApiKeys: null,
      },
      errors: null,
    });

    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(async () => {
      await result.current.updateAsync({
        preferredModel: 'cloud_claude_3_5_sonnet',
        fallbackModels: ['cloud_claude_3_haiku'],
        mtpEnabled: true,
      });
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        preferredModel: 'cloud_claude_3_5_sonnet',
        fallbackModels: ['cloud_claude_3_haiku'],
        mtpEnabled: true,
      }),
    );
  });

  it('rejects update mutations when cloud client is unavailable', async () => {
    useAuthMock.mockReturnValue({ user: SIGNED_IN_USER });
    getMock.mockResolvedValueOnce({
      data: { preferredModel: null, fallbackModels: [], mtpEnabled: false, customApiKeys: null },
      errors: null,
    });
    const { result } = renderHook(() => useLLMSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.settings).toBeDefined());

    getCloudClientMock.mockReturnValue(null);
    await expect(
      act(async () => {
        await result.current.updateAsync({ mtpEnabled: true });
      }),
    ).rejects.toThrow(/Cloud client unavailable/);
  });
});
