# 8. Track D AWS Cloud — Sprint 計画

このドキュメントは Track D (AWS Cloud + 認証 + 繋ぎ層、~4-5 週間規模) の **Sprint 計画と詳細タスク分解** を保持します。

実装着手の前に必ずこのドキュメント + [docs/6_FRONTEND_BACKEND_INTEGRATION.md](6_FRONTEND_BACKEND_INTEGRATION.md) + [docs/7_AUTH_AND_USERS.md](7_AUTH_AND_USERS.md) を読み込んでください。

---

## 1. 設計判断 (確定)

| 項目 | 採用 | 理由 |
|---|---|---|
| IaC ツール | **AWS Amplify Gen2** (= 内部 CDK) | 既にスキャフォルド済 (`amplify/auth`, `amplify/data`, `package.json` 依存)。Amplify Gen2 は CDK + TypeScript なのでマスタープランの "CDK" 要件を満たす。`defineAuth` / `defineData` / `defineFunction` の高レベル抽象でボイラープレート削減 |
| 認証 | **Cognito User Pool + Identity Pool** (Amplify Gen2 経由) | マスタープラン通り。MFA 任意設定 (TOTP) |
| データ層 | **AppSync GraphQL + DynamoDB** (Amplify Gen2 経由) | ユーザー設定同期 (UserSettings)、LLM 設定 (LLMSettings)、同期メタ (SyncMetadata) のみ。HOSHUTARO の業務データ (機器台帳等) は SQLite ローカル保持原則を堅持 |
| Lambda 関数 | **5 つ**: `llm-proxy` / `user-sync` / `user-management` / `post-confirmation-trigger` / `maximo-proxy` | マスタープランの構成。`amplify/functions/<name>/` ディレクトリ単位で `defineFunction` |
| LLM proxy | **AWS Bedrock 経由 Claude / Anthropic Direct API 両対応** | Bedrock を第一候補 (低レイテンシ、IAM 認証)、Anthropic Direct を fallback (Bedrock 未対応モデル用) |
| API 形式 | **AppSync (GraphQL)** + 一部 **Lambda Function URL** (SSE/streaming 専用) | AppSync は通常の CRUD、SSE streaming だけ Function URL Response Streaming |
| 認証ガード | App.tsx に **`<Authenticator>` ラッパ** | aws-amplify/ui-react の Authenticator コンポーネントで 7 画面を一括カバー、必要に応じて custom |
| MFA | **Optional (推奨だが必須ではない)** | エンタープライズ用途で MFA 必須、個人ユーザは optional の判断 |
| 7 画面構成 | (1) ログイン (2) サインアップ (3) メール確認 (4) パスワードリセット要求 (5) リセットコード入力 (6) MFA 設定 (7) プロフィール+サインアウト | 標準構成、Amplify UI Authenticator が大半カバー |

---

## 2. 4-5 週間ロードマップ

### Sprint 0: 設計フェーズ ✅ 完了 (2026-05-11)
- [x] 本 docs ファイル作成
- [x] `docs/6_FRONTEND_BACKEND_INTEGRATION.md` 作成 (アーキテクチャ + データフロー + API spec)
- [x] `docs/7_AUTH_AND_USERS.md` 作成 (認証フロー + 7画面詳細 + ユーザーデータモデル)
- [x] HANDOFF.md に Track D 設計ドキュメント参照を追加

### Sprint 1: 認証基盤 (Week 1)
**目的**: ユーザーがログイン/サインアップ/MFA設定できる状態にする。

タスク:
1. **`amplify/auth/resource.ts` 拡張**
   - パスワードポリシー (最小 12 文字、大小英数記号)
   - MFA optional (TOTP)
   - Email verification 必須
   - `triggers: { postConfirmation: ... }` で Lambda hook
2. **`amplify/functions/post-confirmation-trigger/` 新規作成**
   - 新規ユーザー登録時、DynamoDB `UserSettings` テーブルにデフォルトレコード作成
3. **認証画面 7枚** (`src/components/Auth/`)
   - `<AuthLayout>` ラッパ (背景、ロゴ、エラー表示)
   - Login / SignUp / ConfirmEmail / RequestPasswordReset / ResetPasswordWithCode / MfaSetup / Profile
   - aws-amplify/ui-react の `Authenticator` を base にカスタマイズ (日本語化、HOSHUTARO ブランディング)
4. **App.tsx に AuthGuard 追加**
   - 未認証ユーザは `<Authenticator>` UI のみ表示
   - 認証済みユーザは既存 App UI を表示
   - `useAuthenticator()` hook で状態管理
5. **ユニットテスト** (Jest)
   - 認証状態遷移のテスト
   - 各画面のレンダリングテスト
6. **AgentBar への "サインアウト" メニュー追加**

検収条件:
- `npx ampx sandbox` でデプロイ後、ログイン/サインアップ/パスワードリセット/MFA設定 が全て動作
- TypeScript 型エラー無し、Jest テスト pass

### Sprint 2: データ基盤 (Week 2)
**目的**: ユーザー設定をクラウド DynamoDB に保存/同期する。

タスク:
1. **`amplify/data/resource.ts` 書き換え**
   - 既存の `Todo` モデルを削除
   - `UserSettings` モデル追加 (theme, language, llmDefaults, etc.)
   - `LLMSettings` モデル追加 (preferredModel, apiKeys [SecretString], 等)
   - `SyncMetadata` モデル追加 (lastSyncedAt, deviceId 等)
   - 認可ルール: `allow.owner()` (オーナーのみアクセス)
2. **`amplify/functions/user-sync/` 新規作成**
   - フロント側ローカル設定 (localStorage 等) と DynamoDB を双方向同期
   - Conflict resolution (last-write-wins、または手動マージ)
3. **`src/services/cloudSync.ts` 新規作成**
   - `generateClient<Schema>()` で AppSync 接続
   - `useUserSettings` / `useLLMSettings` hook 提供
4. **既存 LLMSettingsDialog の修正**
   - ローカル state → `useLLMSettings` (クラウド同期付き) に置換
5. **テスト**
   - cloudSync の sync 動作テスト (mock DynamoDB)
   - LLMSettings 保存→reload→読込のラウンドトリップテスト

検収条件:
- ユーザーが LLM 設定を変更 → 別デバイスで同じアカウントログイン → 設定が反映されている

### Sprint 3: LLM 中継 (Week 3)
**目的**: クラウド大規模 LLM (Claude 等) を Lambda 経由で呼び出せるようにする。

タスク:
1. **`amplify/functions/llm-proxy/` 新規作成**
   - Lambda Function URL (Response Streaming 有効)
   - AWS Bedrock Runtime API 経由 Claude 3.5 Sonnet / Claude 3 Haiku 呼び出し
   - Anthropic Direct API fallback (Bedrock 未対応モデル用)
   - JWT Authorizer で Cognito 認証チェック (Lambda 内で `jose` ライブラリで検証、または API Gateway 前段で Authorizer)
2. **`backend/app/llm/adapters/cloud_proxy.py` の実装**
   - 既存スタブを実装に。`LLMAdapter` ABC 準拠
   - Cognito JWT を取得してから Lambda Function URL を fetch
   - SSE streaming response を `yield` する非同期 generator
3. **frontend 側 SSE 受信**
   - 既存 `services/sseClient.ts` を再利用 (もしくは新規 cloudLLMClient.ts)
4. **`registry.py` の `LLM_MODELS` 拡張**
   - `cloud_claude_3_5_sonnet`, `cloud_claude_3_haiku` 等の cloud LLM エントリ追加
   - `role: "target"`, `provider: "cloud"`
5. **設定 UI**
   - LLMSettingsDialog でクラウド LLM を選択可能に
6. **テスト**
   - llm-proxy Lambda の unit test (mocked Bedrock)
   - 認証失敗時の 401 応答テスト
   - SSE streaming のテスト

検収条件:
- Skill 定義で `preferred_model: cloud_claude_3_5_sonnet` を指定すると、Lambda 経由 Bedrock から応答が返る
- ストリーミング応答 (token-by-token) が動作

### Sprint 4: 連携 + 管理 (Week 4)
**目的**: Maximo 連携と高度なユーザー管理機能。

タスク:
1. **`amplify/functions/maximo-proxy/` 新規作成**
   - Maximo REST API の中継 (社内ネットワーク経由が必要なら VPC Lambda)
   - 認証情報は Secrets Manager
2. **`amplify/functions/user-management/` 新規作成**
   - アカウント削除 (Cognito user + DynamoDB レコード一括削除)
   - データエクスポート (UserSettings/LLMSettings/SyncMetadata を JSON でダウンロード)
   - GDPR 対応的なオペレーション
3. **OpenAPI 型生成パイプライン** (オプション、後回し可)
   - `tools/generate-api-client/` (もしくは codegen with appsync-codegen)
   - Amplify が自動生成する型で十分なら省略可
4. **CORS 設定**
   - Function URL CORS allowlist 設定
   - 開発環境 (localhost:5173) と本番ドメインを許可
5. **統一エラースキーマ**
   - Lambda の error response を共通形式に: `{ code: string, message: string, details?: unknown }`
   - フロント側でグローバルエラーハンドラ
6. **Sandbox 環境での E2E テスト**

検収条件:
- Maximo データの取得が Lambda 経由で動作 (社内環境想定、ローカルでは mock)
- アカウント削除後、DynamoDB に該当ユーザー データが残らない

### Sprint 5: 本番化 (Week 5)
**目的**: 本番デプロイ準備、ドキュメント整備、段階リリース計画。

タスク:
1. **本番 Amplify 環境セットアップ**
   - `ampx pipeline-deploy` で GitHub Actions と連携
   - 環境変数の Secrets Manager 移行
2. **カスタムドメイン (任意)**
   - Route 53 + ACM 証明書 + CloudFront
3. **観測性**
   - CloudWatch Logs 集約
   - X-Ray (オプション)
   - エラーアラート (SNS → Email or Slack)
4. **ドキュメント整備**
   - `docs/6_FRONTEND_BACKEND_INTEGRATION.md` を実装ベースで更新
   - `docs/7_AUTH_AND_USERS.md` を実装ベースで更新
   - `docs/9_DEPLOYMENT.md` 新規 (本番デプロイ手順)
5. **負荷テスト**
   - llm-proxy の同時実行数 / cold start 計測
   - DynamoDB の RCU/WCU 確認
6. **段階リリース計画**
   - Phase 1: 社内ベータ (5-10 名)
   - Phase 2: 制限付き一般ユーザー (50 名)
   - Phase 3: 一般公開

検収条件:
- 本番デプロイ成功、エンドツーエンドフロー動作
- ロールバック手順がドキュメント化されている

---

## 3. Sprint 1 詳細タスク分解 (実装着手用)

### Task 1.1: `amplify/auth/resource.ts` 拡張

**実装内容**:
```typescript
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from '../functions/post-confirmation-trigger/resource';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'HOSHUTARO への登録 — メール確認',
      verificationEmailBody: (createCode) =>
        `下記の確認コードを入力してください: ${createCode()}`,
    },
  },
  userAttributes: {
    email: { mutable: true, required: true },
    givenName: { mutable: true, required: false },
    familyName: { mutable: true, required: false },
  },
  triggers: {
    postConfirmation,
  },
});

// パスワードポリシー / MFA は CDK overrides で:
// (backend.ts で `backend.auth.resources.cfnResources.cfnUserPool.policies` を上書き)
```

**注意点**:
- Amplify Gen2 で MFA を強制したい場合、Cognito User Pool レベルで CDK overrides が必要
- パスワードポリシーも同様に overrides

### Task 1.2: `post-confirmation-trigger` Lambda

**ファイル**: `amplify/functions/post-confirmation-trigger/{resource,handler}.ts`

```typescript
// resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation-trigger',
});
```

```typescript
// handler.ts
import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  await ddb.send(new PutItemCommand({
    TableName: process.env.USER_SETTINGS_TABLE!,
    Item: {
      userId: { S: userId },
      email: { S: email },
      theme: { S: 'light' },
      language: { S: 'ja' },
      createdAt: { S: new Date().toISOString() },
    },
  }));

  return event;
};
```

**注意点**:
- DynamoDB テーブル名は環境変数で受け取る (`amplify/data/resource.ts` の出力を `defineFunction` の env で渡す)
- 失敗時 retry 設定 (Amplify Gen2 デフォルトで Lambda retry あり)

### Task 1.3: 認証画面 7枚 (`src/components/Auth/`)

**ディレクトリ構成**:
```
src/components/Auth/
├── AuthLayout.tsx          # 共通ラッパ (ロゴ、背景、エラー表示)
├── AuthProvider.tsx        # useAuthenticator 統合、認証ガード
├── LoginScreen.tsx         # (1) ログイン
├── SignUpScreen.tsx        # (2) サインアップ
├── ConfirmEmailScreen.tsx  # (3) メール確認コード入力
├── RequestResetScreen.tsx  # (4) パスワードリセット要求
├── ResetPasswordScreen.tsx # (5) リセットコード + 新パスワード
├── MfaSetupScreen.tsx      # (6) MFA TOTP 設定 (QR + コード)
├── ProfileScreen.tsx       # (7) プロフィール表示 + サインアウト
├── index.ts                # エクスポート
└── __tests__/
    └── *.test.tsx
```

**依存**:
- `aws-amplify/ui-react` の `Authenticator` をベースに、各画面を `components` prop でカスタマイズ
- 日本語 dictionary を `I18n` で設定
- MUI 7 で UI 構築 (baseline-ui 制約遵守)

**カスタマイズの例**:
```typescript
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';

<Authenticator
  components={{
    SignIn: { Header: () => <AuthLayout title="ログイン" /> },
    SignUp: { /* ... */ },
    ConfirmSignUp: { /* ... */ },
    ResetPassword: { /* ... */ },
    ConfirmResetPassword: { /* ... */ },
    SetupTotp: { /* ... */ },
  }}
  formFields={{
    signIn: {
      username: { label: 'メールアドレス', placeholder: 'you@example.com' },
    },
  }}
>
  {({ signOut, user }) => (
    <App user={user} signOut={signOut} />
  )}
</Authenticator>
```

### Task 1.4: App.tsx に AuthGuard 追加

**実装内容**:
```typescript
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json'; // Amplify Gen2 生成

Amplify.configure(outputs);

export default function AppWithAuth() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <App user={user} signOut={signOut} />
      )}
    </Authenticator>
  );
}
```

### Task 1.5: AgentBar への "サインアウト" メニュー追加

`src/components/AgentBar/AgentBar.tsx` のツールメニューに「アカウント」セクション追加:
- プロフィール表示
- サインアウト
- パスワード変更

### Task 1.6: テスト追加

`src/components/Auth/__tests__/*.test.tsx`:
- `LoginScreen.test.tsx`: ログインフォームのレンダリング、バリデーション
- `SignUpScreen.test.tsx`: サインアップフロー、パスワード強度チェック
- `AuthProvider.test.tsx`: 未認証/認証済みの分岐

---

## 4. Sprint 1 ブロッカー / リスク

| リスク | 対策 |
|---|---|
| Amplify Gen2 の Cognito MFA 設定が docs では明確でない | CDK overrides で対応、`backend.auth.resources.cfnResources` 経由 |
| `aws-amplify/ui-react` のカスタマイズが MUI 7 と統合しづらい | `Authenticator` の components prop でほぼ全画面差し替え可能。最悪 Authenticator を使わず手書き |
| post-confirmation Lambda の cold start が遅い | Provisioned Concurrency を本番で設定 (Sprint 5) |
| HOSHUTARO 既存の `useUserSettings` 系 hook と衝突 | Sprint 2 で統合、Sprint 1 では認証 UI のみ |
| Sandbox 環境のコスト | 個人開発は基本的に無料枠内、CloudWatch Logs 等は最小ログレベルに |

---

## 5. ドキュメント成果物

| ファイル | 役割 | 作成タイミング |
|---|---|---|
| `docs/8_TRACK_D_SPRINT_PLAN.md` | 本ドキュメント、Sprint 計画 + 詳細タスク | ✅ Sprint 0 (2026-05-12) |
| `docs/6_FRONTEND_BACKEND_INTEGRATION.md` | アーキテクチャ + API spec + データフロー | ✅ Sprint 0 (2026-05-11) |
| `docs/7_AUTH_AND_USERS.md` | 認証フロー + 7画面詳細 + ユーザーデータモデル | ✅ Sprint 0 (2026-05-11) |
| `docs/9_DEPLOYMENT.md` | 本番デプロイ手順 | Sprint 5 で作成 |
| HANDOFF.md §12 (新規) | Track D 進捗 (Sprint 単位で更新) | Sprint 1 完了時 |

---

## 6. 環境変数 (Sprint 1 で必要)

```env
# .env.local (フロント、Vite)
VITE_AWS_REGION=ap-northeast-1
# amplify_outputs.json から自動読み込まれるので明示不要な場合もある

# Amplify backend (Sandbox/Production)
# Amplify が自動で AWS リソース ARN を Lambda env に注入
```

---

## 7. 検証 (Sprint 1 完了時)

```bash
# 1. Sandbox 環境にデプロイ
npx ampx sandbox

# 2. amplify_outputs.json が生成される

# 3. フロント開発サーバ起動
npm run dev

# 4. ブラウザで http://localhost:5173 にアクセス
#    認証画面が表示される

# 5. テストアカウントでサインアップ
#    - メール確認コードが届く
#    - コード入力で確認完了
#    - DynamoDB UserSettings テーブルにレコードが入る
#    - MFA 設定 (オプション) — QR コード読み取り → TOTP コード入力
#    - ログイン成功 → 既存 HOSHUTARO UI 表示

# 6. ログアウト → 再ログイン → MFA コード入力 → 成功

# 7. パスワードリセットフロー確認

# 8. lint / typecheck / build / jest 全 clean
npm run lint
npx tsc -b --noEmit
npm run build
npm run test
```

---

## 8. 修正対象ファイル (Sprint 1)

| ファイル | 操作 |
|---|---|
| `amplify/auth/resource.ts` | 拡張 (MFA、password policy、postConfirmation trigger) |
| `amplify/backend.ts` | CDK overrides (パスワードポリシー、MFA) |
| `amplify/functions/post-confirmation-trigger/{resource,handler}.ts` | 新規 |
| `src/components/Auth/*.tsx` (10+ ファイル) | 新規 |
| `src/App.tsx` | `<Authenticator>` ラッパ追加 |
| `src/components/AgentBar/AgentBar.tsx` | サインアウト/プロフィールメニュー追加 |
| `src/components/Auth/__tests__/*.test.tsx` | 新規 (Jest) |
| `package.json` | `@aws-amplify/ui-react` 依存追加 |

---

## 9. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ
- [docs/6_FRONTEND_BACKEND_INTEGRATION.md](6_FRONTEND_BACKEND_INTEGRATION.md) — フロント-バックエンド統合アーキテクチャ
- [docs/7_AUTH_AND_USERS.md](7_AUTH_AND_USERS.md) — 認証フロー詳細、7 画面、ユーザーデータモデル
- マスタープラン: `.claude/plans/aws-qwen3-6-35b-deepseek-v4-gemma4-30b-staged-kay.md` (worktree 経由のみ参照可)
