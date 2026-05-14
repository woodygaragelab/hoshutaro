import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Track D Sprint 4 Slice C - maximo-proxy Lambda handler.
 *
 * 本 Slice では **mock 実装** を提供。実 Maximo REST API 呼出しは Sprint 5 で
 * VPC Lambda + Secrets Manager 経由の credentials 取得を整備した後で実装する。
 *
 * 設計:
 *   - 環境変数 MAXIMO_BASE_URL が空 または MAXIMO_MOCK_ENABLED='true' なら mock
 *   - そうでなければ TODO (Sprint 5 で実装) — 現状は 'NOT_IMPLEMENTED' エラー返却
 *
 * mock データは社内向けの代表的な機器・作業オーダーフォーマットを 1-2 件分用意し、
 * フロント側の Maximo 連携 UI 検証 (ローカル開発) に使えるレベルにする。
 */

type Resource = 'assets' | 'workorders';

type RequestBody = {
  resource: Resource;
  filter?: string;
};

type MockAsset = {
  assetnum: string;
  description: string;
  location: string;
  status: 'OPERATING' | 'NOT READY' | 'DECOMMISSIONED';
};

type MockWorkOrder = {
  wonum: string;
  description: string;
  assetnum: string;
  status: 'WAPPR' | 'INPRG' | 'COMP' | 'CLOSE';
  reportedDate: string;
};

type SuccessResponse =
  | {
      ok: true;
      mock: boolean;
      resource: 'assets';
      count: number;
      items: MockAsset[];
    }
  | {
      ok: true;
      mock: boolean;
      resource: 'workorders';
      count: number;
      items: MockWorkOrder[];
    };

type ErrorResponse = {
  ok: false;
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'NOT_IMPLEMENTED'
    | 'UPSTREAM_FAILED';
  message: string;
};

const MOCK_ASSETS: MockAsset[] = [
  {
    assetnum: 'P-101',
    description: 'メインプロセスポンプ',
    location: 'PLANT-A/UNIT-1',
    status: 'OPERATING',
  },
  {
    assetnum: 'HE-201',
    description: '熱交換器 (シェル&チューブ)',
    location: 'PLANT-A/UNIT-2',
    status: 'OPERATING',
  },
  {
    assetnum: 'V-301',
    description: '反応器スタンバイ',
    location: 'PLANT-B/UNIT-3',
    status: 'NOT READY',
  },
];

const MOCK_WORKORDERS: MockWorkOrder[] = [
  {
    wonum: 'WO-2026-0001',
    description: 'P-101 ベアリング交換',
    assetnum: 'P-101',
    status: 'INPRG',
    reportedDate: '2026-05-10T09:00:00Z',
  },
  {
    wonum: 'WO-2026-0002',
    description: 'HE-201 年次点検',
    assetnum: 'HE-201',
    status: 'WAPPR',
    reportedDate: '2026-05-11T13:30:00Z',
  },
];

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

function isMockMode(): boolean {
  const baseUrl = (process.env.MAXIMO_BASE_URL ?? '').trim();
  const mockFlag = (process.env.MAXIMO_MOCK_ENABLED ?? '').toLowerCase();
  if (mockFlag === 'true' || mockFlag === '1') return true;
  return baseUrl === '';
}

function matchesFilter<T extends Record<string, unknown>>(
  item: T,
  filter: string | undefined,
): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return Object.values(item).some(
    (v) => typeof v === 'string' && v.toLowerCase().includes(needle),
  );
}

function buildMockResponse(body: RequestBody): SuccessResponse {
  if (body.resource === 'assets') {
    const items = MOCK_ASSETS.filter((a) => matchesFilter(a, body.filter));
    return { ok: true, mock: true, resource: 'assets', count: items.length, items };
  }
  const items = MOCK_WORKORDERS.filter((w) => matchesFilter(w, body.filter));
  return {
    ok: true,
    mock: true,
    resource: 'workorders',
    count: items.length,
    items,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(204 as 200, {
      ok: true,
      mock: true,
      resource: 'assets',
      count: 0,
      items: [],
    });
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
  if (!body.resource || (body.resource !== 'assets' && body.resource !== 'workorders')) {
    return jsonResponse(400, {
      ok: false,
      code: 'BAD_REQUEST',
      message: "resource は 'assets' または 'workorders' を指定してください。",
    });
  }

  if (isMockMode()) {
    return jsonResponse(200, buildMockResponse(body));
  }

  // Sprint 5 で実装予定 (VPC Lambda + Secrets Manager + httpx → 実 Maximo REST API)
  return jsonResponse(501, {
    ok: false,
    code: 'NOT_IMPLEMENTED',
    message:
      '実 Maximo REST API 接続は未実装です (Sprint 5 で予定)。MAXIMO_MOCK_ENABLED=true で mock を有効化してください。',
  });
};

// Test seam — production runtime never calls this.
export function __resetMaximoProxyClientsForTest(): void {
  cachedVerifier = null;
}
