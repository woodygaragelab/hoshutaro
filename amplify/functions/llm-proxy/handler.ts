import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * HOSHUTARO Track D Sprint 3 - LLM 中継 Lambda handler。
 *
 * 認証 → モデル解決 → Bedrock 優先 / Anthropic Direct fallback の順で
 * トークンストリームを返す。Function URL の `InvokeMode.RESPONSE_STREAM` で
 * `awslambda.streamifyResponse(...)` を使うのが本来の Streaming パターンだが、
 * Amplify Gen2 の TS 環境では `awslambda` global の型が無いため、本 Slice では
 * バッファした最終 JSON を返す buffered response として実装する。streaming への
 * 切替は Slice 3-D で `cloud_proxy.py` の SSE 受信側と一緒に整備する。
 */

type RequestBody = {
  /** クラウド LLM のモデル ID (例: 'cloud_claude_3_5_sonnet') */
  model: string;
  /** OpenAI/Claude 互換 messages */
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  /** 温度 0.0-1.0 */
  temperature?: number;
  /** 最大出力トークン */
  maxTokens?: number;
};

type ResponseBody =
  | {
      ok: true;
      model: string;
      provider: 'bedrock' | 'anthropic';
      content: string;
      stopReason?: string;
      inputTokens?: number;
      outputTokens?: number;
    }
  | {
      ok: false;
      code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'BEDROCK_AND_FALLBACK_FAILED' | 'INTERNAL';
      message: string;
    };

const BEDROCK_MODEL_MAP: Record<string, string> = {
  cloud_claude_3_5_sonnet: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  cloud_claude_3_haiku: 'anthropic.claude-3-haiku-20240307-v1:0',
};

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  cloud_claude_3_5_sonnet: 'claude-3-5-sonnet-latest',
  cloud_claude_3_haiku: 'claude-3-haiku-20240307',
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

let cachedBedrock: BedrockRuntimeClient | null = null;
function getBedrockClient(): BedrockRuntimeClient {
  if (cachedBedrock) return cachedBedrock;
  cachedBedrock = new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION || 'us-west-2',
  });
  return cachedBedrock;
}

let cachedAnthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedAnthropic = new Anthropic({ apiKey });
  return cachedAnthropic;
}

function jsonResponse(status: number, body: ResponseBody): APIGatewayProxyResultV2 {
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

async function verifyJwt(event: APIGatewayProxyEventV2): Promise<{ sub: string } | null> {
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

async function invokeBedrock(
  body: RequestBody,
): Promise<{ provider: 'bedrock'; content: string; stopReason?: string }> {
  const bedrockModelId = BEDROCK_MODEL_MAP[body.model];
  if (!bedrockModelId) {
    throw new Error(`Unknown bedrock model: ${body.model}`);
  }

  const claudeBody = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: body.maxTokens ?? 1024,
    temperature: body.temperature ?? 0.1,
    messages: body.messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role,
      content: m.content,
    })),
    system: body.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n') || undefined,
  });

  const client = getBedrockClient();
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: bedrockModelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: claudeBody,
  });

  const response = await client.send(command);
  let content = '';
  let stopReason: string | undefined;

  if (response.body) {
    for await (const event of response.body) {
      if (!event.chunk?.bytes) continue;
      const decoded = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      if (decoded.type === 'content_block_delta' && decoded.delta?.text) {
        content += decoded.delta.text;
      }
      if (decoded.type === 'message_delta' && decoded.delta?.stop_reason) {
        stopReason = decoded.delta.stop_reason;
      }
    }
  }

  return { provider: 'bedrock', content, stopReason };
}

async function invokeAnthropic(
  body: RequestBody,
): Promise<{ provider: 'anthropic'; content: string; stopReason?: string }> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  const anthropicModelId = ANTHROPIC_MODEL_MAP[body.model];
  if (!anthropicModelId) {
    throw new Error(`Unknown anthropic model: ${body.model}`);
  }

  const message = await client.messages.create({
    model: anthropicModelId,
    max_tokens: body.maxTokens ?? 1024,
    temperature: body.temperature ?? 0.1,
    messages: body.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    system: body.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n') || undefined,
  });

  const content = message.content
    .map((b) => (b.type === 'text' && 'text' in b ? b.text : ''))
    .join('');

  return { provider: 'anthropic', content, stopReason: message.stop_reason ?? undefined };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  // CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(204 as 200, { ok: true, model: '', provider: 'bedrock', content: '' });
  }

  // 1. Cognito JWT 検証
  const auth = await verifyJwt(event);
  if (!auth) {
    return jsonResponse(401, {
      ok: false,
      code: 'UNAUTHORIZED',
      message: '認証トークンが無効です。',
    });
  }

  // 2. リクエスト body パース
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
  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse(400, {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'model と messages は必須です。',
    });
  }

  // 3. Bedrock 優先 → Anthropic Direct fallback
  try {
    const bedrockResult = await invokeBedrock(body);
    return jsonResponse(200, {
      ok: true,
      model: body.model,
      provider: bedrockResult.provider,
      content: bedrockResult.content,
      stopReason: bedrockResult.stopReason,
    });
  } catch (bedrockErr) {
    try {
      const anthropicResult = await invokeAnthropic(body);
      return jsonResponse(200, {
        ok: true,
        model: body.model,
        provider: anthropicResult.provider,
        content: anthropicResult.content,
        stopReason: anthropicResult.stopReason,
      });
    } catch (anthropicErr) {
      const bedrockMsg =
        bedrockErr instanceof Error ? bedrockErr.message : String(bedrockErr);
      const anthropicMsg =
        anthropicErr instanceof Error ? anthropicErr.message : String(anthropicErr);
      return jsonResponse(502, {
        ok: false,
        code: 'BEDROCK_AND_FALLBACK_FAILED',
        message: `Bedrock failed (${bedrockMsg}) and Anthropic Direct fallback also failed (${anthropicMsg})`,
      });
    }
  }
};

// Test seam — production runtime never calls this.
export function __resetLlmProxyClientsForTest(): void {
  cachedVerifier = null;
  cachedBedrock = null;
  cachedAnthropic = null;
}
