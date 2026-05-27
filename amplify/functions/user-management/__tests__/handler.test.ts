/**
 * user-management Lambda handler unit tests (Track D Sprint 4 Slice A)。
 *
 * Cognito + DynamoDB SDK + aws-jwt-verify を全 mock。jest config / tsconfig.test の
 * amplify 拡張は Sprint 3-A で済んでいるのでそのまま使う。
 */

const verifyMock = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: (token: string) => verifyMock(token) })),
  },
}));

const cognitoSendMock = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest
    .fn()
    .mockImplementation(() => ({ send: (cmd: unknown) => cognitoSendMock(cmd) })),
  AdminDeleteUserCommand: jest.fn().mockImplementation((input: unknown) => ({
    __cmd: 'AdminDeleteUser',
    __input: input,
  })),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

const dynamoSendMock = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: (cmd: unknown) => dynamoSendMock(cmd) })),
  },
  DeleteCommand: jest.fn().mockImplementation((input: unknown) => ({
    __cmd: 'Delete',
    __input: input,
  })),
  GetCommand: jest.fn().mockImplementation((input: unknown) => ({
    __cmd: 'Get',
    __input: input,
  })),
  QueryCommand: jest.fn().mockImplementation((input: unknown) => ({
    __cmd: 'Query',
    __input: input,
  })),
  BatchWriteCommand: jest.fn().mockImplementation((input: unknown) => ({
    __cmd: 'BatchWrite',
    __input: input,
  })),
}));

import {
  handler,
  __resetUserManagementClientsForTest,
} from '../handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ORIGINAL_ENV = { ...process.env };

function makeEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {},
  body?: unknown,
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
  __resetUserManagementClientsForTest();
  process.env = {
    ...ORIGINAL_ENV,
    USER_POOL_ID: 'us-west-2_pool',
    USER_POOL_CLIENT_ID: 'client123',
    USER_SETTINGS_TABLE: 'UserSettings-prod',
    LLM_SETTINGS_TABLE: 'LLMSettings-prod',
    SYNC_METADATA_TABLE: 'SyncMetadata-prod',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('user-management handler', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const result = await handler(
      makeEvent({ headers: {} }, { action: 'exportData' }),
    );
    expect(result).toMatchObject({ statusCode: 401 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT verification fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('invalid signature'));
    const result = await handler(makeEvent({}, { action: 'exportData' }));
    expect(result).toMatchObject({ statusCode: 401 });
  });

  it('returns 400 when body is not valid JSON', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent({ body: '{not json' }));
    expect(result).toMatchObject({ statusCode: 400 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when action is missing or unknown', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await handler(makeEvent({}, { action: 'nope' }));
    expect(result).toMatchObject({ statusCode: 400 });
  });

  // ----------------------------------------------------- exportData

  it('exportData returns userSettings/llmSettings/syncMetadata under the authenticated sub', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    // Promise.all で 3 つの SDK 呼び出し: get(UserSettings), get(LLMSettings), query(SyncMetadata)
    dynamoSendMock.mockImplementation((cmd: { __cmd: string; __input: { TableName: string } }) => {
      if (cmd.__cmd === 'Get' && cmd.__input.TableName === 'UserSettings-prod') {
        return Promise.resolve({ Item: { userId: 'u-1', theme: 'dark' } });
      }
      if (cmd.__cmd === 'Get' && cmd.__input.TableName === 'LLMSettings-prod') {
        return Promise.resolve({ Item: { userId: 'u-1', preferredModel: 'cloud_claude_3_5_sonnet' } });
      }
      if (cmd.__cmd === 'Query' && cmd.__input.TableName === 'SyncMetadata-prod') {
        return Promise.resolve({
          Items: [
            { userId: 'u-1', deviceId: 'd-1', lastSyncedAt: '2026-01-01T00:00:00Z' },
            { userId: 'u-1', deviceId: 'd-2', lastSyncedAt: '2026-01-02T00:00:00Z' },
          ],
        });
      }
      return Promise.resolve({});
    });

    const result = await handler(makeEvent({}, { action: 'exportData' }));
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.ok).toBe(true);
    expect(body.action).toBe('exportData');
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.data.userSettings).toEqual({ userId: 'u-1', theme: 'dark' });
    expect(body.data.llmSettings.preferredModel).toBe('cloud_claude_3_5_sonnet');
    expect(body.data.syncMetadata).toHaveLength(2);
    expect(cognitoSendMock).not.toHaveBeenCalled();
  });

  it('exportData returns nulls for missing records and 502 on Dynamo error', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    dynamoSendMock.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const result = await handler(makeEvent({}, { action: 'exportData' }));
    expect(result).toMatchObject({ statusCode: 502 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('DYNAMO_QUERY_FAILED');
  });

  // ----------------------------------------------------- deleteAccount

  it('deleteAccount runs DynamoDB deletes then Cognito AdminDeleteUser', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const callLog: string[] = [];
    dynamoSendMock.mockImplementation(
      (cmd: { __cmd: string; __input: { TableName?: string } }) => {
        callLog.push(`${cmd.__cmd}:${cmd.__input.TableName ?? '-'}`);
        if (cmd.__cmd === 'Query') {
          return Promise.resolve({
            Items: [
              { userId: 'u-1', deviceId: 'd-1' },
              { userId: 'u-1', deviceId: 'd-2' },
            ],
          });
        }
        return Promise.resolve({});
      },
    );
    cognitoSendMock.mockImplementation((cmd: { __cmd: string }) => {
      callLog.push(`Cognito:${cmd.__cmd}`);
      return Promise.resolve({});
    });

    const result = await handler(makeEvent({}, { action: 'deleteAccount' }));
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toEqual({ ok: true, action: 'deleteAccount' });

    // Order: Delete(UserSettings) → Delete(LLMSettings) → Query(SyncMetadata) → BatchWrite → Cognito
    expect(callLog).toEqual([
      'Delete:UserSettings-prod',
      'Delete:LLMSettings-prod',
      'Query:SyncMetadata-prod',
      'BatchWrite:-',
      'Cognito:AdminDeleteUser',
    ]);
  });

  it('deleteAccount skips BatchWrite when SyncMetadata is empty', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-2' });
    let batchWriteCalled = false;
    dynamoSendMock.mockImplementation(
      (cmd: { __cmd: string }) => {
        if (cmd.__cmd === 'BatchWrite') {
          batchWriteCalled = true;
        }
        if (cmd.__cmd === 'Query') {
          return Promise.resolve({ Items: [] });
        }
        return Promise.resolve({});
      },
    );
    cognitoSendMock.mockResolvedValue({});

    const result = await handler(makeEvent({}, { action: 'deleteAccount' }));
    expect(result).toMatchObject({ statusCode: 200 });
    expect(batchWriteCalled).toBe(false);
  });

  it('deleteAccount returns 502 with COGNITO_DELETE_FAILED when AdminDeleteUser fails', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-3' });
    dynamoSendMock.mockImplementation(
      (cmd: { __cmd: string }) => {
        if (cmd.__cmd === 'Query') return Promise.resolve({ Items: [] });
        return Promise.resolve({});
      },
    );
    cognitoSendMock.mockRejectedValueOnce(
      new Error('AdminDeleteUserException: user not found'),
    );

    const result = await handler(makeEvent({}, { action: 'deleteAccount' }));
    expect(result).toMatchObject({ statusCode: 502 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('COGNITO_DELETE_FAILED');
    expect(body.message).toMatch(/AdminDeleteUser/);
  });

  it('deleteAccount returns 502 with DYNAMO_DELETE_FAILED for generic Dynamo error', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-4' });
    dynamoSendMock.mockRejectedValueOnce(new Error('ConditionalCheckFailedException'));

    const result = await handler(makeEvent({}, { action: 'deleteAccount' }));
    expect(result).toMatchObject({ statusCode: 502 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('DYNAMO_DELETE_FAILED');
  });
});
