import { defineFunction } from '@aws-amplify/backend';

/**
 * HOSHUTARO Track D Sprint 3 - LLM 中継 Lambda (Slice 3-A)。
 *
 * - Function URL Response Streaming で SSE-like なトークン単位送出
 * - Cognito JWT を Lambda 内で検証 (Function URL の authType は NONE、認証は
 *   Lambda 内で完結)
 * - AWS Bedrock Runtime API 経由で Claude 3.5 Sonnet / Claude 3 Haiku を呼び出し、
 *   Bedrock 未対応モデルや Bedrock 障害時には Anthropic Direct API に fallback
 * - 環境変数:
 *     USER_POOL_ID         — Cognito User Pool ID (JWT verifier 用)
 *     USER_POOL_CLIENT_ID  — Cognito App Client ID
 *     BEDROCK_REGION       — Bedrock を呼ぶ region (例: us-west-2)
 *     ANTHROPIC_API_KEY    — Anthropic Direct fallback 用 (Secrets Manager から)
 *
 * timeoutSeconds は LLM レスポンス完了まで耐える必要があるため 5 分に拡張。
 * memoryMB は SDK と JSON 処理メインなので 512 で十分。
 */
export const llmProxy = defineFunction({
  name: 'llm-proxy',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
});
