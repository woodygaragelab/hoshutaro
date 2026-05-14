/**
 * maximo-proxy Lambda handler unit tests (Track D Sprint 4 Slice C)。
 *
 * aws-jwt-verify を mock し、JWT 検証パス + mock データ返却 + バリデーション +
 * NOT_IMPLEMENTED (実 API モード) を検証する。
 */

const verifyMock = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: (token: string) => verifyMock(token) })),
  },
}));

import {
  handler,
  __resetMaximoProxyClientsForTest,
} from '../handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ORIGINAL_ENV = { ...process.env };

function makeEvent(
  body?: unknown,
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: { authorization: 'Bearer fake.jwt.token' },
    requestContext: {
      accountId: '123',
      apiId: 'api',
      domainName: 'd',
      domainPrefix: 'd',
      http: {
        method: 'POST',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'r',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: body !== undefined ? JSON.stringify(body) : '',
    ...overrides,
  } as APIGatewayProxyEventV2;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetMaximoProxyClientsForTest();
  process.env = {
    ...ORIGINAL_ENV,
    USER_POOL_ID: 'us-west-2_pool',
    USER_POOL_CLIENT_ID: 'client123',
    MAXIMO_BASE_URL: '',
    MAXIMO_MOCK_ENABLED: 'true',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('maximo-proxy handler', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const result = await handler(
      makeEvent({ resource: 'assets' }, { headers: {} }),
    );
    expect(result).toMatchObject({ statusCode: 401 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT verification fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('invalid signature'));
    const result = await handler(makeEvent({ resource: 'assets' }));
    expect(result).toMatchObject({ statusCode: 401 });
  });

  it('returns 400 when body is not valid JSON', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent(undefined, { body: '{not json' }));
    expect(result).toMatchObject({ statusCode: 400 });
    expect(JSON.parse((result as { body: string }).body).code).toBe('BAD_REQUEST');
  });

  it('returns 400 when resource is missing or invalid', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent({ resource: 'unknown' }));
    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('returns mock assets when MAXIMO_MOCK_ENABLED is true', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent({ resource: 'assets' }));
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.ok).toBe(true);
    expect(body.mock).toBe(true);
    expect(body.resource).toBe('assets');
    expect(body.count).toBeGreaterThan(0);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        assetnum: expect.any(String),
        description: expect.any(String),
      }),
    );
  });

  it('returns mock workorders with reportedDate field', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent({ resource: 'workorders' }));
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.resource).toBe('workorders');
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        wonum: expect.any(String),
        assetnum: expect.any(String),
        reportedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('filters mock results case-insensitively across all string fields', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(
      makeEvent({ resource: 'assets', filter: 'p-101' }),
    );
    const body = JSON.parse((result as { body: string }).body);
    expect(body.count).toBe(1);
    expect(body.items[0].assetnum).toBe('P-101');
  });

  it('uses mock mode when MAXIMO_BASE_URL is empty even without MAXIMO_MOCK_ENABLED', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    process.env.MAXIMO_MOCK_ENABLED = '';
    process.env.MAXIMO_BASE_URL = '';
    const result = await handler(makeEvent({ resource: 'assets' }));
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.mock).toBe(true);
  });

  it('returns 501 NOT_IMPLEMENTED when MAXIMO_BASE_URL is set but mock is disabled', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    process.env.MAXIMO_MOCK_ENABLED = 'false';
    process.env.MAXIMO_BASE_URL = 'https://maximo.example.com/api';
    const result = await handler(makeEvent({ resource: 'assets' }));
    expect(result).toMatchObject({ statusCode: 501 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('NOT_IMPLEMENTED');
    expect(body.message).toMatch(/Sprint 5/);
  });
});
