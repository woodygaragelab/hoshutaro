import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Track D Sprint 4 Slice A - user-management Lambda handler.
 *
 * 対応アクション:
 *   - deleteAccount: Cognito user + DynamoDB の UserSettings / LLMSettings /
 *     SyncMetadata から該当ユーザーの全レコードを削除
 *   - exportData: 上記 3 テーブルから該当ユーザーのレコードを取得し JSON で返却
 *
 * Sprint 5 で監査ログを CloudWatch に記録する予定 (GDPR 対応: 削除/エクスポート
 * 操作を 30 日以上保持)。
 */

type RequestBody =
  | { action: 'deleteAccount' }
  | { action: 'exportData' };

type SuccessResponse =
  | { ok: true; action: 'deleteAccount' }
  | {
      ok: true;
      action: 'exportData';
      exportedAt: string;
      data: {
        userSettings: Record<string, unknown> | null;
        llmSettings: Record<string, unknown> | null;
        syncMetadata: Record<string, unknown>[];
      };
    };

type ErrorResponse = {
  ok: false;
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'COGNITO_DELETE_FAILED'
    | 'DYNAMO_DELETE_FAILED'
    | 'DYNAMO_QUERY_FAILED'
    | 'INTERNAL';
  message: string;
};

let cachedVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
function getJwtVerifier() {
  if (cachedVerifier) return cachedVerifier;
  const userPoolId = process.env.USER_POOL_ID;
  const clientId = process.env.USER_POOL_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error('USER_POOL_ID / USER_POOL_CLIENT_ID env vars not configured');
  }
  cachedVerifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId,
  });
  return cachedVerifier;
}

let cachedCognito: CognitoIdentityProviderClient | null = null;
function getCognitoClient(): CognitoIdentityProviderClient {
  if (cachedCognito) return cachedCognito;
  cachedCognito = new CognitoIdentityProviderClient({});
  return cachedCognito;
}

let cachedDynamo: DynamoDBDocumentClient | null = null;
function getDynamoClient(): DynamoDBDocumentClient {
  if (cachedDynamo) return cachedDynamo;
  cachedDynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return cachedDynamo;
}

function jsonResponse(
  status: number,
  body: SuccessResponse | ErrorResponse,
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
    body: JSON.stringify(body),
  };
}

async function verifyJwt(
  event: APIGatewayProxyEventV2,
): Promise<{ sub: string } | null> {
  const authHeader =
    event.headers?.authorization ?? event.headers?.Authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;
  try {
    const payload = await getJwtVerifier().verify(match[1]);
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

async function deleteUserData(userId: string): Promise<void> {
  const userPoolId = process.env.USER_POOL_ID!;
  const userSettingsTable = process.env.USER_SETTINGS_TABLE;
  const llmSettingsTable = process.env.LLM_SETTINGS_TABLE;
  const syncMetadataTable = process.env.SYNC_METADATA_TABLE;
  if (!userSettingsTable || !llmSettingsTable || !syncMetadataTable) {
    throw new Error(
      '*_TABLE env vars not fully configured (UserSettings/LLMSettings/SyncMetadata)',
    );
  }

  const dynamo = getDynamoClient();

  // 1) UserSettings — 単一レコード
  await dynamo.send(
    new DeleteCommand({ TableName: userSettingsTable, Key: { userId } }),
  );

  // 2) LLMSettings — 単一レコード
  await dynamo.send(
    new DeleteCommand({ TableName: llmSettingsTable, Key: { userId } }),
  );

  // 3) SyncMetadata — 複合 PK (userId, deviceId)、全 device 削除
  const queryResult = await dynamo.send(
    new QueryCommand({
      TableName: syncMetadataTable,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ProjectionExpression: 'userId, deviceId',
    }),
  );
  const items = queryResult.Items ?? [];
  if (items.length > 0) {
    // BatchWriteCommand は 25 件まで、それを超える場合は分割
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await dynamo.send(
        new BatchWriteCommand({
          RequestItems: {
            [syncMetadataTable]: batch.map((it) => ({
              DeleteRequest: {
                Key: { userId: it.userId, deviceId: it.deviceId },
              },
            })),
          },
        }),
      );
    }
  }

  // 4) Cognito user 削除 (最後に。順序を逆にすると DynamoDB に孤児が残る可能性)
  await getCognitoClient().send(
    new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: userId,
    }),
  );
}

async function exportUserData(userId: string): Promise<{
  userSettings: Record<string, unknown> | null;
  llmSettings: Record<string, unknown> | null;
  syncMetadata: Record<string, unknown>[];
}> {
  const userSettingsTable = process.env.USER_SETTINGS_TABLE;
  const llmSettingsTable = process.env.LLM_SETTINGS_TABLE;
  const syncMetadataTable = process.env.SYNC_METADATA_TABLE;
  if (!userSettingsTable || !llmSettingsTable || !syncMetadataTable) {
    throw new Error('*_TABLE env vars not fully configured');
  }
  const dynamo = getDynamoClient();

  const [userRes, llmRes, syncRes] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: userSettingsTable, Key: { userId } })),
    dynamo.send(new GetCommand({ TableName: llmSettingsTable, Key: { userId } })),
    dynamo.send(
      new QueryCommand({
        TableName: syncMetadataTable,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }),
    ),
  ]);

  return {
    userSettings: (userRes.Item as Record<string, unknown> | undefined) ?? null,
    llmSettings: (llmRes.Item as Record<string, unknown> | undefined) ?? null,
    syncMetadata: (syncRes.Items as Record<string, unknown>[] | undefined) ?? [],
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(204 as 200, { ok: true, action: 'deleteAccount' });
  }

  const auth = await verifyJwt(event);
  if (!auth) {
    return jsonResponse(401, {
      ok: false,
      code: 'UNAUTHORIZED',
      message: '認証トークンが無効です。',
    });
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body ?? '{}') as RequestBody;
  } catch {
    return jsonResponse(400, {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'リクエスト body が JSON ではありません。',
    });
  }
  if (!body.action || (body.action !== 'deleteAccount' && body.action !== 'exportData')) {
    return jsonResponse(400, {
      ok: false,
      code: 'BAD_REQUEST',
      message: "action は 'deleteAccount' または 'exportData' を指定してください。",
    });
  }

  if (body.action === 'deleteAccount') {
    try {
      await deleteUserData(auth.sub);
      return jsonResponse(200, { ok: true, action: 'deleteAccount' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Cognito の AdminDeleteUser 失敗を区別する
      const isCognitoError = /AdminDeleteUser|UserPool|Cognito/i.test(msg);
      return jsonResponse(502, {
        ok: false,
        code: isCognitoError ? 'COGNITO_DELETE_FAILED' : 'DYNAMO_DELETE_FAILED',
        message: msg,
      });
    }
  }

  // action === 'exportData'
  try {
    const data = await exportUserData(auth.sub);
    return jsonResponse(200, {
      ok: true,
      action: 'exportData',
      exportedAt: new Date().toISOString(),
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse(502, {
      ok: false,
      code: 'DYNAMO_QUERY_FAILED',
      message: msg,
    });
  }
};

// Test seam — production runtime never calls this.
export function __resetUserManagementClientsForTest(): void {
  cachedVerifier = null;
  cachedCognito = null;
  cachedDynamo = null;
}
