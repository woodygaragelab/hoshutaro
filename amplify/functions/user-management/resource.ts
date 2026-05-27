import { defineFunction } from '@aws-amplify/backend';

/**
 * HOSHUTARO Track D Sprint 4 - User Management Lambda (Slice 4-A)。
 *
 * Sprint 1 で ProfileScreen のスコープ外にしていた **アカウント削除** と
 * **データエクスポート** を提供する。Function URL + Cognito JWT 認証で
 * `{ action: "deleteAccount" | "exportData" }` をリクエスト body で受ける。
 *
 * 環境変数:
 *   USER_POOL_ID         — Cognito User Pool ID (JWT verifier + AdminDeleteUser 用)
 *   USER_POOL_CLIENT_ID  — Cognito App Client ID (JWT verifier 用)
 *   USER_SETTINGS_TABLE  — DynamoDB UserSettings テーブル名
 *   LLM_SETTINGS_TABLE   — DynamoDB LLMSettings テーブル名
 *   SYNC_METADATA_TABLE  — DynamoDB SyncMetadata テーブル名
 *
 * deleteAccount 完了後はクライアント側で localStorage クリア + LoginScreen 遷移する
 * (Lambda 側は Cognito user 削除 + DynamoDB レコード削除のみ。サインアウトトークンは
 * 削除されたユーザーで自然に無効化)。
 */
export const userManagement = defineFunction({
  name: 'user-management',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 256,
});
