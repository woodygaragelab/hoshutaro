const generateClientMock = jest.fn();

jest.mock('aws-amplify/data', () => ({
  generateClient: (...args: unknown[]) => generateClientMock(...args),
}));

import {
  __resetCloudClientForTest,
  getCloudClient,
} from '../cloudSync';

describe('cloudSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetCloudClientForTest();
  });

  it('returns the same client on repeated calls (singleton)', () => {
    const fakeClient = { models: {} };
    generateClientMock.mockReturnValueOnce(fakeClient);

    const a = getCloudClient();
    const b = getCloudClient();

    expect(a).toBe(fakeClient);
    expect(b).toBe(fakeClient);
    expect(generateClientMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when generateClient throws (Amplify not configured)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    generateClientMock.mockImplementationOnce(() => {
      throw new Error('Amplify has not been configured');
    });

    expect(getCloudClient()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('does not retry generateClient after a failed attempt within the same lifecycle', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    generateClientMock.mockImplementationOnce(() => {
      throw new Error('not configured');
    });

    expect(getCloudClient()).toBeNull();
    expect(getCloudClient()).toBeNull();
    expect(generateClientMock).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('__resetCloudClientForTest clears both the cached client and attempted flag', () => {
    generateClientMock.mockReturnValueOnce({ models: { v: 1 } });
    expect(getCloudClient()).toEqual({ models: { v: 1 } });

    __resetCloudClientForTest();

    generateClientMock.mockReturnValueOnce({ models: { v: 2 } });
    expect(getCloudClient()).toEqual({ models: { v: 2 } });
    expect(generateClientMock).toHaveBeenCalledTimes(2);
  });
});
