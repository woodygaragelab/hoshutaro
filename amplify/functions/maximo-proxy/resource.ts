import { defineFunction } from '@aws-amplify/backend';

/**
 * HOSHUTARO Track D Sprint 4 - Maximo Proxy Lambda (Slice 4-C)。
 *
 * Maximo REST API への中継 Lambda。本 Slice では **mock 実装のみ** を提供し、
 * 実 Maximo 接続は Sprint 5 (社内 VPC 環境セットアップ後) で行う。
 *
 * 環境変数:
 *   USER_POOL_ID            — Cognito User Pool ID (JWT verifier)
 *   USER_POOL_CLIENT_ID     — Cognito App Client ID
 *   MAXIMO_BASE_URL         — 実 Maximo API URL (空文字 / 未設定なら mock 動作)
 *   MAXIMO_CREDENTIALS_ARN  — Secrets Manager ARN (Maximo basic auth credentials)
 *   MAXIMO_MOCK_ENABLED     — 'true' なら強制的に mock 動作 (sandbox / 開発用)
 *
 * リクエスト body:
 *   { resource: 'assets' | 'workorders', filter?: string }
 *
 * レスポンス:
 *   { ok: true, mock: boolean, resource, count, items: [...] }
 */
export const maximoProxy = defineFunction({
  name: 'maximo-proxy',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 256,
});
