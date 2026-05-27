/**
 * llm-proxy Lambda handler unit tests.
 *
 * AWS SDK / Anthropic SDK / aws-jwt-verify を全 mock し、JWT 検証、Bedrock 成功、
 * Anthropic Direct fallback、両方失敗時の 502 を検証する。
 */

import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

// jsdom test 環境では TextEncoder/TextDecoder が global にないことがあるため polyfill
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = NodeTextDecoder as unknown as typeof globalThis.TextDecoder;
}

const verifyMock = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: (token: string) => verifyMock(token) })),
  },
}));

const bedrockSendMock = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: (cmd: unknown) => bedrockSendMock(cmd),
  })),
  InvokeModelWithResponseStreamCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __input: input })),
}));

const anthropicCreateMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({
    messages: { create: (args: unknown) => anthropicCreateMock(args) },
  }));
  return { __esModule: true, default: Anthropic };
});

import {
  bufferedHandler,
  __resetLlmProxyClientsForTest,
} from '../handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ORIGINAL_ENV = { ...process.env };

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
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
    body: JSON.stringify({
      model: 'cloud_claude_3_5_sonnet',
      messages: [{ role: 'user', content: 'hello' }],
    }),
    ...overrides,
  } as APIGatewayProxyEventV2;
}

function makeBedrockChunks(text: string, stopReason = 'end_turn') {
  const chunks: { chunk: { bytes: Uint8Array } }[] = [
    {
      chunk: {
        bytes: new TextEncoder().encode(
          JSON.stringify({ type: 'content_block_delta', delta: { text } }),
        ),
      },
    },
    {
      chunk: {
        bytes: new TextEncoder().encode(
          JSON.stringify({ type: 'message_delta', delta: { stop_reason: stopReason } }),
        ),
      },
    },
  ];
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetLlmProxyClientsForTest();
  process.env = {
    ...ORIGINAL_ENV,
    USER_POOL_ID: 'us-west-2_pool',
    USER_POOL_CLIENT_ID: 'client123',
    BEDROCK_REGION: 'us-west-2',
    ANTHROPIC_API_KEY: 'sk-test',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('llm-proxy bufferedHandler (legacy)', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const event = makeEvent({ headers: {} });
    const result = await bufferedHandler(event);
    expect(result).toMatchObject({ statusCode: 401 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toEqual({
      ok: false,
      code: 'UNAUTHORIZED',
      message: expect.stringMatching(/認証トークン/),
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT verification fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('invalid signature'));
    const result = await bufferedHandler(makeEvent());
    expect(result).toMatchObject({ statusCode: 401 });
  });

  it('returns 400 when body is not valid JSON', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await bufferedHandler(makeEvent({ body: '{not json' }));
    expect(result).toMatchObject({ statusCode: 400 });
    expect(JSON.parse((result as { body: string }).body).code).toBe('BAD_REQUEST');
  });

  it('returns 400 when model or messages are missing', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const result = await bufferedHandler(
      makeEvent({ body: JSON.stringify({ messages: [] }) }),
    );
    expect(result).toMatchObject({ statusCode: 400 });
  });

  it('invokes Bedrock and returns aggregated content + stopReason on success', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    bedrockSendMock.mockResolvedValueOnce({
      body: makeBedrockChunks('Hello, world!', 'end_turn'),
    });

    const result = await bufferedHandler(makeEvent());

    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toEqual({
      ok: true,
      model: 'cloud_claude_3_5_sonnet',
      provider: 'bedrock',
      content: 'Hello, world!',
      stopReason: 'end_turn',
    });
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it('falls back to Anthropic Direct when Bedrock fails', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    bedrockSendMock.mockRejectedValueOnce(new Error('AccessDeniedException'));
    anthropicCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hi from anthropic' }],
      stop_reason: 'end_turn',
    });

    const result = await bufferedHandler(makeEvent());
    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body).toEqual({
      ok: true,
      model: 'cloud_claude_3_5_sonnet',
      provider: 'anthropic',
      content: 'Hi from anthropic',
      stopReason: 'end_turn',
    });
  });

  it('returns 502 when both Bedrock and Anthropic fail', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    bedrockSendMock.mockRejectedValueOnce(new Error('Throttled'));
    anthropicCreateMock.mockRejectedValueOnce(new Error('Rate limit'));

    const result = await bufferedHandler(makeEvent());
    expect(result).toMatchObject({ statusCode: 502 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.code).toBe('BEDROCK_AND_FALLBACK_FAILED');
    expect(body.message).toMatch(/Throttled/);
    expect(body.message).toMatch(/Rate limit/);
  });

  it('rejects unknown model IDs before calling either provider when both fail to resolve', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    // Both providers will throw "Unknown model" since the map doesn't contain it.
    const result = await bufferedHandler(
      makeEvent({
        body: JSON.stringify({
          model: 'not_a_model',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      }),
    );
    expect(result).toMatchObject({ statusCode: 502 });
    const body = JSON.parse((result as { body: string }).body);
    expect(body.message).toMatch(/Unknown bedrock model/);
    expect(body.message).toMatch(/Unknown anthropic model/);
  });
});

// ============================================================================
// Slice 3-D: streamingHandlerImpl テスト
// ============================================================================

import { streamingHandlerImpl, type ResponseStream } from '../handler';

function makeFakeStream() {
  const chunks: string[] = [];
  let contentType: string | undefined;
  let ended = false;
  const stream: ResponseStream = {
    write: (c) => {
      chunks.push(c);
    },
    end: () => {
      ended = true;
    },
    setContentType: (ct) => {
      contentType = ct;
    },
  };
  return { stream, chunks, getContentType: () => contentType, isEnded: () => ended };
}

function parseSseChunks(chunks: string[]) {
  // Each chunk is either `data: {...}\n\n` or `event: X\ndata: {...}\n\n`.
  return chunks.map((c) => {
    const eventMatch = /^event:\s*(.+?)\n/.exec(c);
    const dataMatch = /data:\s*(.+?)\n\n/s.exec(c);
    return {
      event: eventMatch ? eventMatch[1].trim() : 'message',
      data: dataMatch ? JSON.parse(dataMatch[1]) : null,
    };
  });
}

describe('llm-proxy streamingHandlerImpl', () => {
  it('emits an error SSE event and ends when authorization fails', async () => {
    const { stream, chunks, isEnded, getContentType } = makeFakeStream();
    await streamingHandlerImpl(makeEvent({ headers: {} }), stream);
    expect(getContentType()).toBe('text/event-stream');
    expect(isEnded()).toBe(true);
    const parsed = parseSseChunks(chunks);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].event).toBe('error');
    expect(parsed[0].data).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('emits BAD_REQUEST error when body is invalid JSON', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const { stream, chunks, isEnded } = makeFakeStream();
    await streamingHandlerImpl(makeEvent({ body: '{nope' }), stream);
    expect(isEnded()).toBe(true);
    const parsed = parseSseChunks(chunks);
    expect(parsed[0].event).toBe('error');
    expect(parsed[0].data.code).toBe('BAD_REQUEST');
  });

  it('streams Bedrock chunks then a done event with stopReason', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    const enc = new TextEncoder();
    bedrockSendMock.mockResolvedValueOnce({
      body: (async function* () {
        yield {
          chunk: {
            bytes: enc.encode(
              JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hel' } }),
            ),
          },
        };
        yield {
          chunk: {
            bytes: enc.encode(
              JSON.stringify({ type: 'content_block_delta', delta: { text: 'lo' } }),
            ),
          },
        };
        yield {
          chunk: {
            bytes: enc.encode(
              JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
            ),
          },
        };
      })(),
    });

    const { stream, chunks, isEnded } = makeFakeStream();
    await streamingHandlerImpl(makeEvent(), stream);
    expect(isEnded()).toBe(true);

    const parsed = parseSseChunks(chunks);
    expect(parsed[0]).toEqual({ event: 'message', data: { type: 'chunk', text: 'Hel' } });
    expect(parsed[1]).toEqual({ event: 'message', data: { type: 'chunk', text: 'lo' } });
    expect(parsed[2].event).toBe('done');
    expect(parsed[2].data).toMatchObject({
      ok: true,
      model: 'cloud_claude_3_5_sonnet',
      provider: 'bedrock',
      stopReason: 'end_turn',
    });
  });

  it('emits BEDROCK_STREAM_FAILED error event when Bedrock throws mid-stream', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    bedrockSendMock.mockRejectedValueOnce(new Error('AccessDeniedException'));

    const { stream, chunks, isEnded } = makeFakeStream();
    await streamingHandlerImpl(makeEvent(), stream);
    expect(isEnded()).toBe(true);

    const parsed = parseSseChunks(chunks);
    const errors = parsed.filter((p) => p.event === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].data.code).toBe('BEDROCK_STREAM_FAILED');
    expect(errors[0].data.message).toMatch(/AccessDeniedException/);
  });
});

// Slice 5-A: Lambda の default `handler` export が streaming 版に解決されることを確認
import { handler, streamingHandler } from '../handler';

describe('llm-proxy default handler export (Slice 5-A)', () => {
  it('handler resolves to streamingHandler (default entry switched to streaming)', () => {
    expect(handler).toBe(streamingHandler);
  });

  it('default handler is callable with a ResponseStream (delegates to streamingHandlerImpl in tests)', async () => {
    verifyMock.mockResolvedValueOnce({ sub: 'u-1' });
    bedrockSendMock.mockResolvedValueOnce({
      body: (async function* () {
        yield {
          chunk: {
            bytes: new TextEncoder().encode(
              JSON.stringify({ type: 'content_block_delta', delta: { text: 'ok' } }),
            ),
          },
        };
        yield {
          chunk: {
            bytes: new TextEncoder().encode(
              JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
            ),
          },
        };
      })(),
    });

    const { stream, chunks, isEnded } = makeFakeStream();
    // awslambda が undefined のローカル/Jest 環境では handler === streamingHandlerImpl
    // (= 通常の async function) を呼べる
    await (handler as unknown as typeof streamingHandlerImpl)(makeEvent(), stream);

    expect(isEnded()).toBe(true);
    const parsed = parseSseChunks(chunks);
    expect(parsed[0].data).toEqual({ type: 'chunk', text: 'ok' });
  });
});
