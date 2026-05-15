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

### Sprint 1: 認証基盤 (Week 1) ✅ 実装完了 (2026-05-12)
**目的**: ユーザーがログイン/サインアップ/MFA設定できる状態にする。

実装はマスタープランの 6 要素 (Slice A〜D-3) と docs スライス (E) に分割し、合計 7 PR で merge:

| Slice | PR | 内容 |
|---|---:|---|
| A | #57 | amplify バックエンド基盤 (data/auth/functions/backend.ts + CDK overrides) |
| B | #58 | AuthProvider + useAuth + AmplifyAuthService + Hub.listen 自動 refresh |
| C | #59 | 認証画面 5 枚 (Login/SignUp/ConfirmEmail/RequestPasswordReset/ResetPasswordWithCode) + AuthLayout + authErrors + passwordValidation |
| D-1 | #60 | AuthGuard + main.tsx 統合 + AgentBar サインアウト |
| D-2 | #61 | MfaSetupScreen + qrcode.react |
| D-3 | #62 | ProfileScreen + AgentBar Profile/MFA Dialog |
| E | #63 | 本ドキュメント + HANDOFF.md を Sprint 1 完了状態に更新 |

タスク (進捗):
1. ✅ **`amplify/auth/resource.ts` 拡張** (PR #57)
   - ✅ パスワードポリシー (最小 12 文字、大小英数記号) — CDK overrides `cfnUserPool.policies.passwordPolicy`
   - ✅ MFA optional (TOTP) — CDK overrides `mfaConfiguration='OPTIONAL'` + `enabledMfas=['SOFTWARE_TOKEN_MFA']`
   - ✅ Email verification 必須 (日本語メール本文)
   - ✅ `triggers: { postConfirmation }` で Lambda hook
2. ✅ **`amplify/functions/post-confirmation-trigger/` 新規作成** (PR #57)
   - ✅ 新規ユーザー登録時、DynamoDB `UserSettings` テーブルに conditional put (`attribute_not_exists(userId)`)
   - ✅ `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` 経由
   - ✅ デフォルト値: `{theme:'light', language:'ja', mfaEnabled:false, createdAt/updatedAt:now}`
3. ✅ **認証画面 7 枚** (`src/components/Auth/`) (PR #59 + #61 + #62)
   - ✅ `<AuthLayout>` ラッパ (PR #59、`noLayout?` で Dialog 内利用可)
   - ✅ Login / SignUp / ConfirmEmail / RequestPasswordReset / ResetPasswordWithCode (PR #59)
   - ✅ MfaSetup (PR #61、QRCodeSVG + secret 併記)
   - ✅ Profile (PR #62、表示名変更/パスワード変更/MFA リクエスト/サインアウト)
   - **設計判断**: `aws-amplify/ui-react` の `Authenticator` は使わず、MUI 7 で全画面手書き (`Authenticator` の MUI 7 統合困難 + 日本語化要件)
4. ✅ **AuthGuard + main.tsx 統合** (PR #60)
   - ✅ 未認証ユーザは AuthGuard 経由で 5 認証画面を `useState` の state machine で切替
   - ✅ 認証済みユーザは既存 App UI を表示
   - ✅ `useAuth` hook で状態管理、`Hub.listen('auth', ...)` で signedIn/signedOut/tokenRefresh の自動 refresh (PR #58)
5. ✅ **ユニットテスト** (Jest) (PR #58/#59/#60/#61/#62)
   - ✅ 認証状態遷移: AuthProvider 4 件 + AuthGuard 8 件
   - ✅ 各画面: LoginScreen 5 + SignUpScreen 5 + ConfirmEmailScreen 5 + RequestPasswordReset 4 + ResetPasswordWithCode 4 + MfaSetupScreen 8 + ProfileScreen 11 = 42
   - ✅ utilities: authErrors 12 + passwordValidation 18 = 30
   - 合計: **+84 件**、累積 127 → 211 件 全 pass
6. ✅ **AgentBar への "サインアウト" / プロフィールメニュー追加** (PR #60 + #62)
   - ✅ ToolsMenu に「プロフィール」と「サインアウト (email tooltip)」menu-item
   - ✅ Dialog で ProfileScreen ↔ MfaSetupScreen を切替表示

検収条件 (進捗):
- ⏳ `npx ampx sandbox` でデプロイ後、ログイン/サインアップ/パスワードリセット/MFA設定 が全て動作 — **コード実装は完了、実 AWS deploy はユーザー環境で別途実施が残**
- ✅ TypeScript 型エラー無し (`npx tsc -b --noEmit` clean)
- ✅ Jest テスト pass (211/211)
- ✅ `npm run lint` / `npm run build` clean

スコープ外 (本 Sprint で **Sprint 4-5 に移管**):
- データエクスポート / アカウント削除 — `user-management` Lambda 待ち (Sprint 4)
- MFA 無効化 UI (`setPreferredMFA('NOMFA')` + 確認ダイアログ + パスワード再入力) — Sprint 5
- アカウント作成日表示 — Cognito からの取得方法限定的 (Sprint 5)
- 新規登録時の MFA 必須化フロー — `MfaSetupScreen` に `onSkip` prop は用意済、配線は Sprint 5

bundle 影響: aws-amplify v6 SDK 取り込みで `index-*.js` gzip 88 → 128 KB (+40 KB)、qrcode.react で `App-*.js` gzip 128 → 136 KB (+8 KB)。Sprint 5 で code-split を検討。

### Sprint 2: データ基盤 (Week 2) ✅ 実装完了 (2026-05-13)

実装は 3 スライスに分割:
| Slice | PR | 内容 |
|---|---:|---|
| 2-A | #64 | `cloudSync` (generateClient<Schema> lazy + null fallback) + `useUserSettings` (React Query 5) |
| 2-B | #65 | `useLLMSettings` (preferredModel / fallbackModels / mtpEnabled / customApiKeys) |
| 2-C | #66 | `CloudLLMSettingsSection` を `LLMSettingsDialog` 冒頭に統合 (Autocomplete + KNOWN_CLOUD_MODELS) |

タスク (進捗):
1. ✅ `amplify/data/resource.ts` は Sprint 1 (PR #57) で先行実装済 (UserSettings/LLMSettings/SyncMetadata + `allow.owner()`)
2. ⏭️ `amplify/functions/user-sync/` Lambda — **Sprint 4 に移管**。DynamoDB の `attribute_not_exists` condition と AppSync の楽観ロックで last-write-wins が実現でき、Lambda は不要と判断
3. ✅ `src/services/cloudSync.ts` 新規 (PR #64) — `import.meta.glob('../../amplify_outputs.json', { eager: true })` で sandbox 未起動時に null fallback、generateClient を singleton 化
4. ✅ `useUserSettings` / `useLLMSettings` hook (PR #64-#65) — React Query 5 ベース、useAuth().user.userId を queryKey、Hub.listen で自動 invalidate
5. ✅ `LLMSettingsDialog` のクラウド設定セクション統合 (PR #66) — 既存ローカル backend 設定 (adapter / temperature / HF download) はそのまま残し、冒頭に **CloudLLMSettingsSection** を追加。Autocomplete で `cloud_claude_*` を提示、`freeSolo` で他モデル ID も入力可
6. ✅ テスト — cloudSync 4 + useUserSettings 8 + useLLMSettings 9 + CloudLLMSettingsSection 8 = **29 件**

bundle 影響: App-*.js が gzip 136 → 173 KB (+37 KB)。`amplify/data/resource.ts` 実行時 import が `@aws-amplify/backend` を bundle に乗せた。Sprint 5-D で `auth-vendor` chunk 分離 + Slice 5-D 後の整理で改善 (TODO: Schema 型のみ分離は Sprint 6 候補)。

### Sprint 3: LLM 中継 (Week 3) ✅ 実装完了 (2026-05-13)

実装は 4 スライスに分割:
| Slice | PR | 内容 |
|---|---:|---|
| 3-A | #67 | `llm-proxy` Lambda (Bedrock + Anthropic Direct + Cognito JWT + Function URL invokeMode=RESPONSE_STREAM) + CDK 配線 |
| 3-B | #68 | `CloudProxyAdapter` 本実装 (httpx + SSE parser + retries + ping) |
| 3-C | #69 | `registry.py` に `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku` 追加 + env 補完 + UI Autocomplete |
| 3-D | #70 | **真の SSE streaming**: Lambda streamifyResponse + adapter httpx.stream + aiter_lines |

タスク (進捗):
1. ✅ `amplify/functions/llm-proxy/` (PR #67/#70):
   - Function URL `invokeMode: RESPONSE_STREAM` で deploy 時に Streaming 対応
   - BEDROCK_MODEL_MAP で `cloud_claude_3_5_sonnet` → `anthropic.claude-3-5-sonnet-20240620-v1:0`
   - Bedrock 失敗時の Anthropic Direct API fallback (ANTHROPIC_API_KEY env)
   - `aws-jwt-verify` で Cognito access token 検証 (Lambda 内認証、API Gateway 不要)
   - Slice 3-A で buffered 実装、Slice 3-D で `awslambda.streamifyResponse` 化、Slice 5-A で default `handler` export を streaming に切替
2. ✅ `backend/app/llm/adapters/cloud_proxy.py` (PR #68/#70):
   - `LLMAdapter` ABC 準拠で chat/conversational_stream/classify_intent/generate_structured/ping
   - `spec["streaming"]=True` で `httpx.stream` + `aiter_lines` + SSE parser、`event: error/done` を解釈
   - JWT は spec で渡される token または callable `jwt_provider` (毎回再評価)
3. ✅ frontend SSE 受信は Tauri 経由 backend → frontend の既存 SSE パイプラインを利用 (新規 cloudLLMClient.ts は不要)
4. ✅ `registry.py` の LLM_MODELS 拡張 (PR #69):
   - `cloud_claude_3_5_sonnet` (provider='bedrock')
   - `cloud_claude_3_haiku` (provider='bedrock')
   - `get_adapter()` の cloud_proxy 分岐で `LLM_PROXY_URL` / `LLM_PROXY_JWT_TOKEN` env を spec に補完
5. ✅ 設定 UI (PR #69):
   - `CloudLLMSettingsSection.preferredModel` を `Autocomplete` (`freeSolo`) に置換
   - 既知モデル: `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku`
6. ✅ テスト — llm-proxy 12 件 (auth/JSON/Bedrock chunk loop/fallback/502/streaming SSE) + cloud_proxy 17 件 + registry 8 件 = **37 件**

検収条件 (進捗):
- ✅ Skill 定義で `preferred_model: cloud_claude_3_5_sonnet` を指定すると `registry.get_adapter()` が CloudProxyAdapter を返す経路が code-complete
- ✅ Streaming 経路の Jest + Python テストで chunk 単位の yield を検証 (実 AWS deploy で E2E 検証は Sprint 5 残)

### Sprint 4: 連携 + 管理 (Week 4) ✅ 実装完了 (2026-05-13)

実装は 3 スライスに分割 (Slice 4-D は Sprint 5 統合移管):
| Slice | PR | 内容 |
|---|---:|---|
| 4-A | #71 | `user-management` Lambda (Cognito AdminDeleteUser + DynamoDB batch delete + exportData) |
| 4-B | #72 | ProfileScreen に「データをエクスポート」(Blob download) + 「アカウントを削除…」(2 段階 Dialog) |
| 4-C | #73 | `maximo-proxy` Lambda (mock 実装、assets/workorders + filter) |

タスク (進捗):
1. ✅ `maximo-proxy` Lambda (PR #73):
   - mock モード: `MAXIMO_MOCK_ENABLED='true'` または `MAXIMO_BASE_URL` 空で代表的な MOCK_ASSETS (P-101 / HE-201 / V-301) + MOCK_WORKORDERS (WO-2026-0001/0002) を返却。filter は case-insensitive substring
   - 実 API モード: 現状 501 NOT_IMPLEMENTED (Sprint 5 で VPC Lambda + Secrets Manager 経由 basic auth)
   - JWT 検証は他 Lambda と同じ pattern (aws-jwt-verify)
2. ✅ `user-management` Lambda (PR #71):
   - deleteAccount: DynamoDB UserSettings/LLMSettings DeleteCommand → SyncMetadata Query+BatchWrite → Cognito AdminDeleteUser (順序保証で孤児を防止)
   - exportData: 3 テーブルから Promise.all で取得 → { userSettings, llmSettings, syncMetadata } の JSON
   - ProfileScreen 配線 (PR #72): Blob + URL.createObjectURL で JSON download、2 段階 Dialog で削除確認、成功で signOut + AuthGuard が LoginScreen 復帰
3. ⏭️ OpenAPI 型生成 — 省略 (Amplify Gen2 の `ClientSchema<typeof schema>` で十分、独自 codegen 不要)
4. ⏭️ CORS allowlist 絞り込み — Sprint 5 で本番ドメイン確定時に実施 (現状 `*`、code-complete 状態)
5. ⏭️ 統一エラースキーマ — 各 Lambda で `{ ok: false, code, message }` 形式は揃った状態。フロント側統合 ErrorHandler は Sprint 6 候補 (大きい)
6. ⏭️ Sandbox 環境 E2E — ユーザー環境で実施 (実 AWS deploy が必要、Sprint 5 残)

テスト: user-management 10 件 + maximo-proxy 9 件 + ProfileScreen +5 件 (16/16) = **24 件**

検収条件:
- ✅ Maximo mock データ取得経路の code-complete (実 API は Sprint 5)
- ✅ アカウント削除 ボタンクリック → Lambda → Cognito + DynamoDB 一括削除の経路 code-complete (sandbox 検証は残)

### Sprint 5: 本番化 + 残課題 (Week 5) ✅ コード実装完了 (2026-05-14)

実装は 5 スライスに分割 (本番デプロイ系は実 AWS 環境必須のため code/CDK 基盤まで):
| Slice | PR | 内容 |
|---|---:|---|
| 5-A | #74 | Lambda llm-proxy default handler を streaming 版に切替 (buffered は bufferedHandler に保持) |
| 5-B | #75 | LoginScreen に MFA TOTP challenge inline (`confirmSignIn` 連携、2 stage state machine) |
| 5-C | #76 | ProfileScreen に MFA 無効化 UI (`updateMFAPreference({ totp: 'DISABLED' })` + 2 段階確認) |
| 5-D | #77 | bundle 最適化: `auth-vendor` chunk 分離 (aws-amplify + qrcode.react) → index gzip -38 KB / App -12 KB |
| 5-E | #78 | 本 PR: HANDOFF + 本ドキュメントを Sprint 1-5 完了状態に更新 |

タスク (進捗):
1. ⏭️ 本番 Amplify 環境セットアップ — 実 AWS deploy 必須 (ユーザー環境で `ampx pipeline-deploy`)
2. ⏭️ カスタムドメイン (Route 53 + ACM + CloudFront) — 本番ドメイン確定時に実施
3. ⏭️ 観測性 (CloudWatch + X-Ray + SNS) — sandbox 検証後に追加
4. ✅ ドキュメント整備:
   - HANDOFF.md §2 / §5 / §9 を Sprint 1-5 完了状態に更新
   - docs/8 (本ファイル) で全 Sprint タスクに ✅ + PR 番号を反映
   - docs/9_DEPLOYMENT.md は実 AWS deploy 後にユーザー環境固有の手順を加えてから新規予定
5. ⏭️ 負荷テスト — 実 AWS deploy 後
6. ⏭️ 段階リリース計画 — 社内 / 一般 / 公開 の Phase 設計は本番化後

**Sprint 5 で実装した残課題系 UI/コード基盤**:
- ✅ MFA TOTP 後の再ログイン UI (Sprint 1 から移管した最重要項目)
- ✅ MFA 無効化 UI
- ✅ Lambda Streaming entry のデフォルト昇格 (Sprint 3 残)
- ✅ bundle 最適化 (gzip ~50 KB の挙動改善)
- ✅ Sprint 1-5 完了マーク (本ドキュメント更新)

**Sprint 6 以降の候補** (実 AWS 環境必須):
- Maximo 実 API 接続 (VPC Lambda + Secrets Manager basic auth)
- 統一エラースキーマのフロント統合 ErrorHandler
- アカウント作成日表示 (Cognito user attribute 経由)
- CORS allowlist 本番ドメイン絞り込み

検収条件:
- ✅ Track D 全 5 Sprint の **コード実装は完全完了** (PR #57-#78)
- ⏳ 実 AWS deploy + E2E は **ユーザー環境で別途実施が残**

---

### Sprint 6: UI デザイン設計書整備 + 一貫性監査 + Polish 🟡 計画策定済 (2026-05-14)

**位置づけ**: Track E (Tauri Desktop) 着手前に、Track D で追加した UI + 既存 UI 全体の品質を点検する一時 Sprint。実 AWS deploy 不要、ローカル `npm run dev` + `amplify_outputs.json` 不在環境で完結。

**動機**:
- Track D Sprint 1-5 で 7 認証画面 + ProfileScreen + CloudLLMSettingsSection を追加したが、内部用語の漏出 (`"Sprint 5..."` / `"MTP (Speculative Decoding)"` / DynamoDB テーブル名) や dead UI (LoginScreen の `rememberMe`、AgentBar の「外部連携」placeholder) が混入している
- `useUserSettings` (theme/language/mfaEnabled) hook は実装済だが UI 配線がゼロ
- 既存 UI (Plugin Manager / Skill Runner / KnowledgeBase 9 画面) も同種の問題を抱える可能性
- **デザイン設計書 (Single Source of Truth) が存在せず**、新 UI 追加のたびに暗黙ルールが揺らぐリスク

**Phase 構成** (PR は 1 Slice = 1 PR、squash-merge、stack は短く):
| Phase | PR | 内容 | コード変更 |
|---:|---:|---|---|
| 0 | S6-0 | 本ファイルに Sprint 6 を追記 (本 PR) | docs only |
| 1A | S6-1A | `docs/10_UI_DESIGN_SYSTEM.md` 新規作成 — デザイン原則 / トーン / 用語マッピング表 / コンポーネントパターン / アクセシビリティ / 新 UI 追加 checklist を明文化 | docs only |
| 1B | S6-1B | `docs/9_UI_AUDIT.md` 新規作成 — 設計書を判定基準に Track D + 既存 UI を点検、P0/P1/P2 分類 | docs only |
| **🔵 Review** | — | **ユーザーレビューゲート** (設計書・監査結果・用語マッピングを確認、修正方針承認) | — |
| 2A-D | S6-2A〜D | Track D 致命修正 P0 (内部用語言い換え / dead UI 除去 / LLM モデル選択 UX / 過剰文言) | コード |
| 3A | S6-3A | `useUserSettings.theme` を ProfileScreen に配線 (Light/Dark RadioGroup + ThemeProvider 結線) | コード |
| 4A-D | S6-4A〜D | 既存 UI 修正 (PluginManager / SkillRunner / KnowledgeBase / AgentBar・LLMSettingsDialog の構造改善) | コード |
| 5 | S6-5 | HANDOFF / docs/8 / docs/9 / docs/10 を Sprint 6 完了状態に更新 | docs only |

**修正対象** (Phase 2-4 で確定):
- `src/components/Auth/LoginScreen.tsx` — Sprint 5 言及・rememberMe 除去・subtitle 整理
- `src/components/Auth/ProfileScreen.tsx` — 内部用語・MFA 説明・Theme セクション追加
- `src/components/Auth/MfaSetupScreen.tsx` — subtitle 整理
- `src/components/AIAssistant/components/CloudLLMSettingsSection.tsx` — MTP 言い換え・Select 化
- `src/components/AgentBar/AgentBar.tsx` — 「外部連携」placeholder 削除
- 既存 UI: `PluginManager.tsx` / `SkillRunner.tsx` / `KnowledgeBase/*.tsx` / `LLMSettingsDialog.tsx`

**範囲外** (= Track E 以降):
- デスクトップ専用 UX (タイトルバー、ウィンドウサイズ記憶、自動更新通知 UI)
- 実 AWS deploy 検証 / Gemma 4 E2B 実機ベンチ / i18n 本実装

**完了条件**:
- `docs/10_UI_DESIGN_SYSTEM.md` がユーザー承認済
- `docs/9_UI_AUDIT.md` の P0 問題が全て解消
- `useUserSettings.theme` UI 配線完了
- CI green (lint / test / build) 維持

**詳細プラン**: `.claude/plans/hoshutaro-project-curious-flute.md` (worktree 経由のみ、本リポにはコピー無し)

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
| HANDOFF.md §2 §5 §9 Phase 7 | Track D 進捗 (Sprint 単位で更新) | ✅ Sprint 1 完了時 (PR #63, 2026-05-12) |

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

**コード検証** (PR #57-#63 で完了):

```bash
npm run lint           # ✅ clean
npx tsc -b --noEmit    # ✅ clean
npm run build          # ✅ clean (12,906 modules)
npm run test           # ✅ 211/211 pass (新規 84 件)
```

**実 AWS deploy 検証** (ユーザー環境で残作業、Sprint 2 着手前に実施):

```bash
# 0. 前提: AWS アカウント + IAM credentials が必要
aws configure          # IAM access key / secret / region (ap-northeast-1 推奨)

# 1. Sandbox 環境にデプロイ
npx ampx sandbox
# → CloudFormation スタック作成、Cognito User Pool + DynamoDB テーブル + post-confirmation Lambda 作成
# → amplify_outputs.json がリポジトリ root に自動生成される (.gitignored)

# 2. フロント開発サーバ起動
npm run dev
# → http://localhost:5173 で AuthGuard が LoginScreen を表示

# 3. テストアカウントでサインアップ
#    - 「新規登録」リンク → SignUpScreen
#    - メール + 12 文字パスワード + 利用規約同意 → 登録
#    - メール確認コードがメール本文に届く
#    - ConfirmEmailScreen で 6 桁コード入力
#    - **post-confirmation Lambda 実行 → DynamoDB UserSettings テーブルに自動レコード作成** (Console で確認)
#    - 自動で LoginScreen に戻る、再度ログインで成功

# 4. AgentBar → ツール → プロフィール
#    - 表示名変更 → 「保存しました」表示
#    - パスワード変更 → 「更新しました」表示
#    - MFA を設定 → QR スキャン (Google Authenticator 等) → 6 桁コード → 有効化
#    - サインアウト → LoginScreen に戻る

# 5. 再ログイン → MFA 有効ユーザは TOTP コード要求される (Cognito 標準フロー)
#    ⚠️ Slice C の LoginScreen は TOTP challenge を未配線。Sprint 5 で aws-amplify v6 の
#    confirmSignIn('SOFTWARE_TOKEN_MFA', code) を追加するまでは MFA 有効後の再ログイン時
#    aws-amplify が自動的に MFA challenge state を返すが、UI 側で対応する画面なし。
#    暫定: MFA 設定後は再ログイン非対応。Sprint 5 でフォロー。

# 6. パスワードリセットフロー
#    - LoginScreen 「パスワードを忘れた方」→ RequestPasswordResetScreen
#    - メール入力 → 確認コード送信 → ResetPasswordWithCodeScreen
#    - コード + 新パスワード入力 → 「更新しました」→ LoginScreen に戻る
#    - 新パスワードでログイン成功

# 7. Sandbox 停止 (開発終了時、コスト削減)
#    Ctrl-C で `npx ampx sandbox` を停止
```

**Sprint 1 完了の判定**: ステップ 1-4 + 6 が成功すれば Sprint 1 完了。ステップ 5 (MFA 後の再ログイン) は既知の Sprint 5 残課題として許容。

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
