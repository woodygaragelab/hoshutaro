# 6. フロントエンドとバックエンドの統合 (AWS Cloud 連携)

このガイドは保守太郎 (HOSHUTARO 次世代版 / Project Mu) における **フロントエンド ↔ AWS Cloud バックエンド** の繋ぎ層のアーキテクチャ、API 仕様、データフロー、Lambda 関数の責務を定義します。

Track D (AWS Cloud + 認証 + 繋ぎ層) の設計ドキュメント。実装ロードマップは `.claude/plans/track-d-aws-cloud.md` 参照。

---

## 1. 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│ ユーザー端末 (Tauri Desktop / Web)                          │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Frontend (React + MUI 7 + aws-amplify)               │  │
│   │  - Authenticator UI (Cognito)                        │  │
│   │  - useUserSettings / useLLMSettings (AppSync hook)   │  │
│   │  - cloudLLMClient (SSE stream)                       │  │
│   └─────────────────┬────────────────────────────────────┘  │
│                     │ HTTPS                                  │
│   ┌─────────────────┴────────────────────────────────────┐  │
│   │ Backend Local (FastAPI 127.0.0.1:8000)               │  │
│   │  - Project Mu Engine (SQLite + LoRA)                 │  │
│   │  - MCP Hub / Plugin Manager / Skill Engine           │  │
│   │  - LLM Adapter: local (OpenVINO) / cloud_proxy       │  │
│   └─────────────────┬────────────────────────────────────┘  │
│                     │ HTTPS (Cognito JWT)                    │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ AWS Cloud (Cognito + AppSync + Lambda + DynamoDB + S3)       │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Cognito User Pool                                     │  │
│   │  - email login, MFA optional (TOTP)                   │  │
│   │  - post-confirmation trigger → user-sync             │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ AppSync GraphQL API                                   │  │
│   │  - UserSettings / LLMSettings / SyncMetadata models   │  │
│   │  - allow.owner() 認可                                  │  │
│   └─────────────────┬────────────────────────────────────┘  │
│                     │                                        │
│   ┌─────────────────┴────────────────────────────────────┐  │
│   │ DynamoDB                                              │  │
│   │  - UserSettings / LLMSettings / SyncMetadata tables  │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Lambda Functions (Function URL with Response Stream)  │  │
│   │  - llm-proxy       : Bedrock/Anthropic 中継 (SSE)    │  │
│   │  - user-sync       : 設定同期                         │  │
│   │  - user-management : アカウント削除/エクスポート       │  │
│   │  - post-confirm    : Cognito trigger                  │  │
│   │  - maximo-proxy    : Maximo REST API 中継             │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ S3 (オプション)                                       │  │
│   │  - 暗号化バックアップ (SQLite 全体スナップショット)   │  │
│   │  - 添付ファイル                                       │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 「クラウド最小」原則

HOSHUTARO はオフライン・エッジコンピューティングが基本原則。AWS Cloud は以下の **限定用途のみ**:

| 用途 | 仕組み | 必要性 |
|---|---|---|
| **認証** | Cognito User Pool | 必須 (ユーザー識別、デバイス間連携) |
| **ユーザー設定同期** | AppSync + DynamoDB | 必須 (テーマ・言語・LLM 既定値等を端末間で共通化) |
| **クラウド LLM 中継** | Lambda llm-proxy (Bedrock) | オプション (大規模 LLM が必要な Skill のみ、Skill 定義の `preferred_model` で指定) |
| **Maximo 連携** | Lambda maximo-proxy | オプション (社内システム連携時のみ) |
| **バックアップ** | S3 (任意) | オプション (ユーザーが明示的に有効化した場合のみ) |

業務データ (機器台帳・WorkOrder・LoRA 学習データ等) は **クラウドに送らない**。すべて SQLite ローカル保持。これはプライバシー要件 + オフライン動作保証のため。

---

## 3. AWS Amplify Gen2 を採用する理由

Track D 実装は **AWS Amplify Gen2** (内部的に CDK + TypeScript) を採用:

- すでに `amplify/` ディレクトリにスキャフォルド済 (`auth/resource.ts`, `data/resource.ts`, `backend.ts`)
- `package.json` に `@aws-amplify/backend`, `aws-cdk-lib` 等の依存追加済
- 高レベル抽象 (`defineAuth`, `defineData`, `defineFunction`, `defineStorage`) で CDK のボイラープレートを削減
- Amplify CLI (`npx ampx sandbox`) で個人 Sandbox 環境を即座にデプロイ可能
- 内部的に CDK の同等構成 (CloudFormation Stack) を生成するため、より柔軟な制御が必要になれば `auth.resources.cfnResources.cfnUserPool` 等で CDK overrides 可

「素の CDK で書く方が柔軟性が高い」という意見もあるが、本プロジェクトは「クラウド最小」原則の通り構成要素が限定的なため、Amplify Gen2 の高レベル抽象で十分カバー可能。

---

## 4. データフロー (代表ケース)

### 4.1 起動時の認証フロー

```
1. ユーザーがアプリ起動
   ↓
2. <Authenticator> が現在のセッションを Cognito に確認
   ├─ セッション有効 → 既存 UI 表示
   └─ セッション無効 / 未認証 → 7 認証画面の流れ (→ docs/7_AUTH_AND_USERS.md)
   ↓
3. ログイン成功時:
   ├─ Cognito JWT を localStorage に保存 (aws-amplify が自動管理)
   ├─ useUserSettings hook が AppSync 経由で DynamoDB から設定 fetch
   └─ App.tsx が user settings に従って初期化
```

### 4.2 LLM 設定変更時の同期

```
1. ユーザーが LLMSettingsDialog で「Claude 3.5 Sonnet を既定モデルに」を選択
   ↓
2. useLLMSettings.updateSetting('preferredModel', 'cloud_claude_3_5_sonnet')
   ↓
3. AppSync mutation: updateLLMSettings(input: { ... })
   ├─ owner-only 認可ルールチェック (Cognito user.sub と一致するレコードのみ更新可)
   └─ DynamoDB に書き込み
   ↓
4. 別デバイスで同アカウントログイン → useLLMSettings の subscription で即座に反映
```

### 4.3 クラウド LLM 呼び出し (SSE streaming)

```
1. Skill 実行 (Skill 定義の preferred_model: cloud_claude_3_5_sonnet)
   ↓
2. backend/app/services/skill_engine.py が registry.resolve() で LLM Adapter 取得
   → cloud_proxy_adapter.py
   ↓
3. cloud_proxy_adapter.py:
   ├─ Cognito JWT を取得 (frontend から渡される / Tauri keyring に保存)
   ├─ Lambda Function URL に fetch (Authorization: Bearer <JWT>)
   └─ Response stream を SSE 形式で yield
   ↓
4. Lambda llm-proxy/handler.ts:
   ├─ JWT を `jose` で検証 (Cognito JWKS から公開鍵取得)
   ├─ AWS Bedrock InvokeModelWithResponseStream API 呼び出し
   └─ Bedrock の stream を SSE で逐次返却
   ↓
5. backend が SSE chunk を Skill の output へ逐次 yield
   ↓
6. Frontend が SSE で受信し、UI に逐次表示
```

---

## 5. API 仕様

### 5.1 AppSync GraphQL Schema (概略)

```graphql
# amplify/data/resource.ts で a.schema() による定義
type UserSettings @model @auth(rules: [{ allow: owner }]) {
  id: ID!
  userId: String! @index   # Cognito user.sub
  theme: String            # 'light' | 'dark'
  language: String         # 'ja' | 'en'
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type LLMSettings @model @auth(rules: [{ allow: owner }]) {
  id: ID!
  userId: String! @index
  preferredModel: String   # e.g. "cloud_claude_3_5_sonnet"
  fallbackModels: [String]
  mtpEnabled: Boolean
  apiKeys: AWSJSON         # { [provider: string]: string (SecretsManager ARN) }
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type SyncMetadata @model @auth(rules: [{ allow: owner }]) {
  id: ID!
  userId: String! @index
  deviceId: String!
  lastSyncedAt: AWSDateTime!
  syncVersion: Int
}
```

### 5.2 Lambda Function URL (LLM Proxy)

**Endpoint**: `https://<function-url-id>.lambda-url.<region>.on.aws/v1/chat/completions`

**Request** (POST):
```json
{
  "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true,
  "max_tokens": 4096,
  "temperature": 0.7
}
```

**Headers**:
- `Authorization: Bearer <Cognito JWT>` — 必須
- `Content-Type: application/json`

**Response** (stream=true):
- `Content-Type: text/event-stream`
- SSE 形式: `data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "..." }}\n\n`

### 5.3 統一エラースキーマ

すべての Lambda 関数のエラー応答は以下の形式で統一:

```json
{
  "error": {
    "code": "AUTH_FAILED" | "BEDROCK_THROTTLED" | "VALIDATION_FAILED" | "INTERNAL_ERROR" | ...,
    "message": "ユーザー向け説明 (日本語可)",
    "details": { ... }   // オプション、デバッグ用
  }
}
```

フロント側は `cloudLLMClient.ts` でグローバルエラーハンドラを設定し、トースト/ダイアログで表示。

---

## 6. Lambda 関数の責務分担

### 6.1 `llm-proxy`
- **トリガー**: Lambda Function URL (Response Streaming 有効)
- **認証**: Cognito JWT 検証 (`jose` ライブラリで JWKS 検証)
- **責務**:
  - AWS Bedrock Runtime: `InvokeModelWithResponseStream`
  - Anthropic Direct API fallback
- **環境変数**:
  - `BEDROCK_REGION`
  - `ANTHROPIC_API_KEY_SECRET_ARN` (Secrets Manager)
- **エラーハンドリング**: ThrottlingException → 統一スキーマで返却

### 6.2 `user-sync`
- **トリガー**: AppSync resolver (custom mutation `syncUserData`)
- **責務**:
  - フロント側 localStorage と DynamoDB の双方向同期
  - Conflict resolution: 楽観ロック (syncVersion incremental check)、競合時は last-write-wins デフォルト、UI で明示的選択
- **環境変数**: テーブル名 (Amplify が自動注入)

### 6.3 `user-management`
- **トリガー**: AppSync resolver (custom mutations)
- **責務**:
  - `deleteAccount`: Cognito user + DynamoDB レコード一括削除
  - `exportUserData`: UserSettings/LLMSettings/SyncMetadata を JSON 形式でダウンロード (GDPR 対応)
- **環境変数**: Cognito User Pool ID、テーブル名

### 6.4 `post-confirmation-trigger`
- **トリガー**: Cognito post-confirmation event
- **責務**:
  - 新規ユーザー登録時、DynamoDB UserSettings レコード作成 (デフォルト値)
- **環境変数**: テーブル名

### 6.5 `maximo-proxy`
- **トリガー**: Lambda Function URL (社内 VPC オプション)
- **認証**: Cognito JWT + 追加の Maximo 認証
- **責務**:
  - Maximo REST API の中継 (機器マスタ取得、WorkOrder CRUD)
- **環境変数**: `MAXIMO_BASE_URL`, `MAXIMO_API_KEY_SECRET_ARN`
- **注意**: 社内ネットワーク内でしか Maximo にアクセスできない場合、VPC Lambda として構成

---

## 7. 認可ルール

すべての DynamoDB モデルは `@auth(rules: [{ allow: owner }])` で **所有者のみアクセス可**。Cognito の `user.sub` がレコードの `userId` と一致するものだけ R/W 可能。

Lambda 関数の認証:
- `llm-proxy`, `maximo-proxy`: Lambda 内で `Authorization` ヘッダーの JWT を検証
- `user-sync`, `user-management`: AppSync resolver なので AppSync が自動的に Cognito user context を Lambda に渡す
- `post-confirmation-trigger`: Cognito から内部呼出しなので認証不要

---

## 8. SSE Streaming の実装注意点

- **Lambda Function URL の Response Streaming**: 2023 年から GA、長時間レスポンスを SSE 形式で返せる
- **タイムアウト**: Function URL のデフォルトは 15 分、LLM 応答には十分
- **CORS**: Function URL の CORS allowlist に開発環境 (`http://localhost:5173`) と本番ドメインを追加
- **エラーリカバリ**: SSE 接続中に Bedrock がエラーを返した場合、特殊な `data: {"type": "error", "error": {...}}\n\n` イベントで通知し、フロント側で接続を閉じる

実装サンプル: `amplify/functions/llm-proxy/handler.ts` (Sprint 3 で実装)

---

## 9. CORS 設定

| Origin | 用途 | 環境変数 |
|---|---|---|
| `http://localhost:5173` | 開発 (Vite) | `ALLOWED_ORIGINS_DEV` |
| `https://<本番ドメイン>` | 本番 | `ALLOWED_ORIGINS_PROD` |
| `tauri://localhost` | Tauri Desktop | `ALLOWED_ORIGINS_TAURI` |

Function URL の `cors` 設定で許可。

---

## 10. 観測性

- **CloudWatch Logs**: 各 Lambda 関数の log group 自動生成
- **メトリクス**: 各 Lambda の Invocations / Errors / Duration / Throttles をモニタリング
- **アラーム**: SNS Topic → Email / Slack (本番のみ)
- **X-Ray**: トレース有効化 (Sprint 5 で導入、必要に応じて)
- **コスト監視**: AWS Budgets で月次予算アラート

---

## 11. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 仕様
- [docs/CONCEPTS.md](CONCEPTS.md) — 用語定義
- [docs/7_AUTH_AND_USERS.md](7_AUTH_AND_USERS.md) — 認証フロー詳細、7 画面、ユーザーデータモデル
- `.claude/plans/track-d-aws-cloud.md` — Sprint 1-5 実装計画 (worktree 経由のみ参照可)
