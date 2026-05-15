# HANDOFF — 次セッション引き継ぎ

> このドキュメントは前セッションで実装した内容を、別端末・別セッション（スマホ含む）で
> Claude に再開させるための引き継ぎノート。**最初にこのファイルを読み込ませてから指示を出す**。

---

## 1. プロジェクト要約（30秒で把握）

**HOSHUTARO 次世代版**（コードネーム **Project Mu** / 別名 **KASE**）：
非構造化な機器台帳（Excel/CSV）を **Gemma 4 E2B-it + MTP drafter（Speculative Decoding）+ SQLite 長期メモリ + LoRA 自律進化** で高精度・高速に JSON 化するオフライン・エッジエンジン。

### 核となる4つのコア価値
1. **インテリジェントマージ** (Maximo × Excel) — AI 支援判定 + 自己進化する長期メモリ
2. **過去履歴からの計画立案** — 統計 + LLM ハイブリッド
3. **最高の UX** — 操作最小、瞬時応答、プライバシー
4. **メンテナンス性 → 迅速なアップデート提供** — 責務分離、用語統一、プラグイン拡張、自動更新

### 主要設計判断（合意済、変更時はこの章を更新）
- 配布: **Tauri Desktop 一本化**（Web 版は廃止予定）
- バックエンド: **クラウド最小（サーバレス）** — Cognito + Lambda + DynamoDB + S3 のみ
- データ: **ローカル SQLite が主**、クラウドは認証 + ユーザー設定同期 + LLM 中継のみ
- LLM: **`google/gemma-4-E2B-it`（target）+ `google/gemma-4-E2B-it-assistant`（MTP drafter）**
  - MTP デフォルト ON、最大 3x 高速化、出力品質劣化なし
  - 配布: **初回起動時ダウンロード**（Tauri 本体 ~50MB、モデル ~1.8GB）
  - クラウド大規模 LLM は計画立案など限定用途のみ（Lambda 経由従量課金）
- LoRA: training_cache に user_confirmed=1 が 100件超で自動学習、PEFT + Intel Arc GPU
- 用語: ユーザー対外は **Plugin / Skill の 2 概念のみ**、内部詳細（MCP / Adapter / Orchestrator）は隠す

詳細仕様: [docs/PROJECT_MU.md](docs/PROJECT_MU.md)、[docs/CONCEPTS.md](docs/CONCEPTS.md)、[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/DATA_MODEL.md](docs/DATA_MODEL.md)、[docs/4_SKILL_RECIPES.md](docs/4_SKILL_RECIPES.md)
Track D 設計: [docs/6_FRONTEND_BACKEND_INTEGRATION.md](docs/6_FRONTEND_BACKEND_INTEGRATION.md)、[docs/7_AUTH_AND_USERS.md](docs/7_AUTH_AND_USERS.md)、[docs/8_TRACK_D_SPRINT_PLAN.md](docs/8_TRACK_D_SPRINT_PLAN.md)
完全な実装計画: `.claude/plans/aws-qwen3-6-35b-deepseek-v4-gemma4-30b-staged-kay.md`（worktree 経由でのみ参照可、本リポにはコピー無し。必要なら最初に読み込み）

---

## 2. 実装ステータス（このコミット時点）

### ✅ 完了
| Track | 範囲 |
|---|---|
| **A: Project Mu Engine** | memory CRUD（rules / master_map / training_cache / lora_adapters / prompt_cache / vector_search）、embeddings、cache、3フェーズパイプライン、sql_context_resolver、learning メタ管理、API ルーター 13 endpoints、**LoRA トレーナー本体（PEFT + transformers、graceful degradation）** |
| **B-1: LLM Adapter** | `OpenVinoGemmaAdapter` を transformers + optimum-intel ベースで実装、MTP `assistant_model` 連携、Thinking Mode 抽出、ストリーミング、デバイス自動検出（NPU > GPU > CPU）、依存未インストール時 graceful |
| **B-2: モデル取得・配置** | `tools/quantize-models/download_and_quantize.py`、`backend/app/mu/setup/downloader.py`、`backend/app/routers/setup.py`（SSE progress） |
| **B-3: Plugin / MCP プラットフォーム** | `backend/app/services/mcp_hub.py`（MCP プロトコルブリッジ）、`plugin_manager.py`、`skill_engine.py`、`licensing.py`、`update_checker.py`。組込 Plugin: `ollama-adapter` / `openvino-adapter`。組込 Skill 3 種（`data_summary` / `maximo_export` / `maximo_import`）。フロント UI: `PluginManager.tsx` / `SkillRunner.tsx` / `UpdateNotification.tsx`、`src/services/integration/pluginApi.ts` + `types.ts`。AgentBar に Plugin 起動メニュー統合済 |
| **UI: Knowledge Base 9画面** | `src/components/KnowledgeBase/`：Dashboard / RuleEditor / MasterMapView / MappingSimilaritySearch / Location & Classification PatternViews / LoRAAdapterManager / TrainingCacheView / LearningHistoryView + KnowledgeBasePage（親 Tabs）+ hooks + common 基盤。**baseline-ui 制約遵守**、`tsc --noEmit` クリーン |
| **UI: Plugin/Skill Runner** | `PluginManager.tsx`（プラグイン一覧 / インストール / 設定）、`SkillRunner.tsx`（Skill 実行）、`UpdateNotification.tsx`（自動更新通知） |
| **App 統合** | KnowledgeBasePage / PluginManager / SkillRunner を AgentBar ツールメニュー → fullScreen Dialog で起動可能に組み込み済（PR #1 + Plugin/MCP 系コミット） |
| **CI / 品質** | `npm run lint` 0 errors / `npm run build` 0 errors / `npm run test` exit 0（PR #2 で main の pre-existing 45 件型エラー + 597 件 lint + test exit-1 を解消、CI green 化済） |
| **検証** | 5 テスト（`backend/tests/test_mu_smoke.py`：memory CRUD / sql_context_resolver / scheduler 閾値 / lora_trainer graceful degradation / FastAPI dashboard）、TypeScript エラーなし |
| **Z: 技術負債削減** | `eslint-disable` 562 → 2 件、Jest テスト 0 → **127 件**（7 suites）、`no-explicit-any` 全体 175件以上削減（App.tsx 68 → 0、EnhancedMaintenanceGrid.tsx 31 → 0、MaintenanceGridLayout.tsx 22 → 0）、`HierarchyDefinition` / `TreeDefinition` 二重型を統合、`WorkOrderBasedRow.type` を canonical `'workOrder' \| 'assetChild'` 2 値にスリム化、`children: any[]` → `HierarchicalData[]`、`aggregatedSchedule: any` → `{ [k]: AggregatedStatus }`、副次バグ修正 10+ 件（`HierarchyPath`/`string` 不整合 = `[object Object]` レンダリングバグ、`React.unstable_batchedUpdates` dead conditional [React 19 自動 batching]、`spec.name` 死フィールド、`handleValidationError` / `handleViewModeChange` 等の dead handlers、`performance.memory` 非Chromiumブラウザ crash） |
| **Track D: Sprint 1 認証基盤** | **Slice A-E (PR #57-#63) 完了**。amplify Gen2 バックエンド (UserSettings/LLMSettings/SyncMetadata + post-confirmation Lambda + MFA OPTIONAL TOTP + passwordPolicy 12 文字)、AuthProvider + useAuth + AmplifyAuthService + Hub.listen 自動 refresh、認証画面 **7 枚完成** (Login/SignUp/ConfirmEmail/RequestPasswordReset/ResetPasswordWithCode/MfaSetup/Profile) + AuthLayout/authErrors/passwordValidation 共通基盤、AuthGuard + `main.tsx` 統合、AgentBar からのプロフィール/MFA Dialog + サインアウト。**Jest 127 → 211 件 (+84)** |
| **Track D: Sprint 2 データ基盤** | **Slice A-C (PR #64-#66) 完了**。`cloudSync` (generateClient<Schema> lazy + null fallback)、`useUserSettings` / `useLLMSettings` hook (React Query 5 + Hub auto-refresh)、`CloudLLMSettingsSection` を `LLMSettingsDialog` の冒頭に統合 (Autocomplete + KNOWN_CLOUD_MODELS)。**Jest +29 件 (211 → 240)**。`user-sync` Lambda は当初計画から Sprint 4 に移管 (DynamoDB condition expression で last-write-wins 可、Lambda 不要) |
| **Track D: Sprint 3 LLM 中継** | **Slice A-D (PR #67-#70) 完了**。`llm-proxy` Lambda (Bedrock Runtime + Anthropic Direct fallback + Cognito JWT)、`CloudProxyAdapter` 本実装 (httpx + SSE parser + retries)、registry.py に `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku` 追加、**真の SSE streaming** (Lambda streamifyResponse + adapter aiter_lines)。**Jest +24 件 (240 → 252)、Python +21 件** |
| **Track D: Sprint 4 連携 + 管理** | **Slice A-C (PR #71-#73) 完了**。`user-management` Lambda (アカウント削除 + データエクスポート、Cognito AdminDeleteUser + DynamoDB batch delete)、ProfileScreen に「データをエクスポート」(Blob download) + 「アカウントを削除…」(2 段階 Dialog) を配線、`maximo-proxy` Lambda (mock 実装、実 API 接続は Sprint 5 NOT_IMPLEMENTED で残)。**Jest +24 件 (252 → 276)** |
| **Track D: Sprint 5 本番化 + 残課題** | **Slice A-E (PR #74-#78) 完了**。Lambda llm-proxy default handler を streaming 版に切替 (buffered は bufferedHandler として ロールバック用に保持)、LoginScreen に MFA TOTP challenge flow (confirmSignIn 連携、2 stage inline)、ProfileScreen に MFA 無効化 UI (2 段階確認、`updateMFAPreference({ totp: 'DISABLED' })`)、bundle 最適化 (`auth-vendor` chunk 分離、index -38 KB / App -12 KB gzip)、HANDOFF / docs/8 ドキュメント更新 (本 PR #78)。**Jest +13 件 (276 → 289)**。**Track D 全 5 Sprint コード実装完了** |

### ❌ 未着手 / 重い依存待ち
| 項目 | ブロッカー |
|---|---|
| **B-Verify**: Track A LoRA 学習の実機動作確認（Gemma 4 E2B 実 SFT・loss 推移・delta 計測） | PEFT + PyTorch + Intel Arc GPU 推奨。コードは実装済み（依存未インストール時 NotImplementedError） |
| **B-Verify**: Track B 実モデル動作確認（Gemma 4 E2B 推論ベンチマーク・MTP accept rate 測定） | OpenVINO 依存 + モデルダウンロード + HuggingFace Token |
| **Track D 実 AWS deploy 検証**: `npx ampx sandbox` で Cognito User Pool / DynamoDB / 4 Lambda (post-confirmation / llm-proxy streaming / user-management / maximo-proxy mock) を実環境で動かし E2E 確認 | AWS アカウント + IAM credentials。コードは Sprint 1-5 で完全実装済 (PR #57-#78) |
| **Track D 本番化** (Sprint 5 残): カスタムドメイン (Route 53 + ACM + CloudFront)、CORS 本番ドメイン絞り込み、observability (CloudWatch + X-Ray + SNS alert)、本番 Amplify pipeline-deploy、Maximo 実 API 接続 (VPC Lambda + Secrets Manager)、段階リリース計画 | 実 AWS 環境 + Maximo 社内ネットワーク。コード基盤は揃っている (CDK overrides + IAM ポリシー stub 配置済) |
| Track E: Tauri Desktop（PyOxidizer + 自動更新 + CodeSigning） | Rust、各 OS 証明書、~3-4週間 |
| Track C: モノレポ化（pnpm workspace） | 大規模リファクタ。**Track D/E が走り始めて 2 つ目以降の app/lambda/desktop が出てから** が合理的（早すぎる package 境界は手戻り発生）。~4-6週間 |

### ⚠️ 残技術負債（小規模、優先度低）
本セッションで 562 → **2 件**まで削減完了。残りは意図的保留:

| ファイル | 件数 | 保留理由 |
|---|---:|---|
| `src/utils/loadingOptimization.ts` | 1 | `React.ComponentType<any>` は React 公式の generic constraint **標準パターン**。`unknown` / `Record` で置換すると createElement の IntrinsicAttributes 比較が壊れる |
| `src/components/EnhancedMaintenanceGrid/MaintenanceCell.tsx` | 1 | `value: any` を狭めると body 内 30+ 箇所の `value?.planned` / `value?.planCost` / spread が全部 narrow 必要。リファクタは別 PR で（オプション 5） |

### スタブ（NotImplementedError）
- `backend/app/mu/learning/model_merger.py` — OpenVINO IR マージ
- `backend/app/llm/adapters/cloud_proxy.py` — Lambda llm-proxy 経由（Track D）※ MCP Hub 移行で旧 `factory.py` / `openai_compat.py` / `openvino_genai.py` は削除済
- `backend/app/llm/adapters/sagemaker.py` — SageMaker（オンデマンド代替）
- `OpenVinoGemmaAdapter` の chat/stream/classify/generate は依存未インストール時のみ `HARD_FAIL`
- `backend/app/mu/learning/lora_trainer.train_lora` は依存未インストール時のみ `NotImplementedError`
  （torch/transformers/peft/datasets が揃った環境では実 SFT を実行）

---

## 3. ディレクトリ地図（迷わないため）

```
backend/app/
├── llm/                    # LLM 抽象層
│   ├── base.py             # LLMAdapter ABC
│   ├── registry.py         # LLM_MODELS + resolve() + MTP target/drafter
│   └── adapters/           # gemini / mcp_relay / openvino_gemma / cloud_proxy / sagemaker
├── mu/                     # Project Mu Engine（中核）
│   ├── memory/             # SQLite CRUD（rules/master_map/training_cache/lora_adapters/prompt_cache/vector_search）
│   ├── pipeline/           # 3フェーズ（distillation/transformation/enrichment）
│   ├── learning/           # LoRA メタ管理（trainer は依存未インストール時スタブ）
│   ├── embeddings/         # multilingual-e5-small ラッパ
│   ├── cache/              # KV キャッシュマネージャ
│   └── setup/              # 初回モデルダウンロードマネージャ
├── services/               # Plugin/MCP プラットフォーム（Track B-3）
│   ├── mcp_hub.py          # MCP プロトコル経由で LLM とやり取りするハブ
│   ├── plugin_manager.py   # プラグイン管理
│   ├── skill_engine.py     # Skill 実行エンジン
│   ├── licensing.py        # ライセンス管理
│   ├── update_checker.py   # プラグイン自動更新
│   ├── gemini_client.py    # Gemini API クライアント
│   └── llm_shim.py         # LLM shim（後方互換）
├── skills/
│   └── sql_context_resolver.py  # Skill の sql_context → 実 SQL/ベクトル検索
└── routers/
    ├── mu.py               # Knowledge Base UI 用 13 endpoints
    ├── plugins.py          # Plugin Manager API
    ├── skills.py           # Skill 実行 API
    ├── updater.py          # 自動更新 API
    └── setup.py            # モデル DL（status / download / SSE progress）

backend/plugins/             # 組込 Plugin
├── ollama-adapter/         # Ollama LLM 経由
└── openvino-adapter/       # OpenVINO LLM 経由

backend/skills/builtin/      # 組込 Skill
├── data_summary.yaml
├── maximo_export.yaml
└── maximo_import.yaml

src/
├── components/
│   ├── KnowledgeBase/      # UI 9画面 + hooks + common
│   ├── PluginManager/      # プラグイン管理 UI
│   ├── SkillRunner/        # Skill 実行 UI
│   ├── UpdateNotification/ # 自動更新通知 UI
│   ├── EnhancedMaintenanceGrid/  # 保全グリッド（技術負債解消済の中核 UI）
│   ├── AIAssistant/        # AI チャット系
│   ├── AgentBar/           # 上部ツールメニュー（KnowledgeBase/PluginManager/SkillRunner 起動）
│   └── ...
├── services/
│   ├── integration/
│   │   ├── pluginApi.ts    # プラグイン API クライアント
│   │   └── types.ts        # 共通型
│   └── muApi.ts            # Knowledge Base API クライアント + SSE
└── types.ts                # HierarchicalData 等の中核型

tools/quantize-models/       # HF → OpenVINO INT4/INT8 量子化 CLI

docs/                        # 全 10 ファイル
├── README.md
├── PROJECT_MU.md           # Project Mu (KASE) 正式仕様
├── CONCEPTS.md             # 用語定義（Plugin/Skill/MCP/Adapter/MTP/KASE）
├── ARCHITECTURE.md         # 全体アーキテクチャ
├── DATA_MODEL.md           # DataModel v3.0.0
├── 1_GETTING_STARTED.md
├── 2_CONNECTOR_DEVELOPMENT.md  # Plugin 開発（connector 系）
├── 3_LLM_ADAPTER_DEVELOPMENT.md # Plugin 開発（LLM Adapter 系）
├── 4_SKILL_RECIPES.md      # Skill レシピ集
└── 5_PUBLISH_GUIDE.md      # Plugin 公開フロー

backend/tests/test_mu_smoke.py     # スモークテスト
src/**/__tests__/*.test.ts(x)      # Jest テスト 127 件（7 suites）
```

---

## 4. 動作確認コマンド

```bash
# Python 構文 + import + DB スキーマ + memory CRUD + Router 統合
cd backend && python tests/test_mu_smoke.py

# TypeScript 型チェック
npx tsc -b --noEmit

# 開発サーバ起動（FastAPI + Vite を並行）
npm run dev
# → http://localhost:5173 (Vite) と http://localhost:8000 (FastAPI)
# Knowledge Base UI は AgentBar 右側ツールメニュー → 「ナレッジベース」で開く
# PluginManager / SkillRunner も同じく AgentBar から起動

# Lint / Test / Build（CI で実行されるもの全部）
npm run lint    # eslint .
npm run test    # jest（127 件 PASS、7 suites）
npm run build   # tsc -b && vite build
```

> 注: worktree が `C:\Users\kazuh\hoshutaro\.claude\worktrees\<name>` 配下にあると、Jest の `<rootDir>` パスの `.claude` 部分が micromatch のエスケープと衝突して `testMatch` が 0 件になる現象がある。回避策として `testRegex` ベースの ad-hoc config で実行可能（HANDOFF §9 PR #36 の経緯参照）。

---

## 5. 続きを進める優先候補（最新）

完了済（直近の大きな成果）:
- ✅ KnowledgeBasePage を App.tsx に統合（PR #1）
- ✅ LoRA トレーナー本体実装（PR #1, PEFT + transformers + graceful degradation）
- ✅ main の pre-existing 型 / lint / test 失敗を解消（PR #2, CI green 化）
- ✅ **Plugin/MCP プラットフォーム全面導入**（mcp_hub.py / plugin_manager.py / skill_engine.py / OllamaAdapter / OpenVINOAdapter / 組込 Skill 3 種 / PluginManager UI / SkillRunner UI / UpdateNotification）
- ✅ **技術負債削減完了**: 562 → 2 件、Jest 0 → 127 件、副次バグ修正 10+ 件、3 大ファイル（App.tsx / EMG / MGL）で `no-explicit-any` 完全 0 達成
- ✅ **Track D 全 5 Sprint コード実装完了** (PR #57-#78): 認証 (Sprint 1) → データ (Sprint 2) → LLM 中継 (Sprint 3) → 連携・管理 (Sprint 4) → 本番化・残課題 (Sprint 5)。**Jest 127 → 289 件 (+162)**

次の候補:

1. **🥇 Sprint 6: UI デザイン設計書整備 + 一貫性監査 + Polish** — Track E (Tauri) 着手前の UI 品質保証。Track D の認証画面で内部用語 (`"Sprint 5..."` / `"MTP"` / DynamoDB テーブル名) や dead UI (LoginScreen の `rememberMe`、AgentBar の「外部連携」placeholder)、`useUserSettings` hook の UI 未配線 など 12+ 件の問題が顕在化済。
   - 構成: Phase 0 (docs 同期) → Phase 1A (`docs/10_UI_DESIGN_SYSTEM.md`) → Phase 1B (`docs/9_UI_AUDIT.md`) → **🔵 ユーザーレビュー** → Phase 2-4 (修正 PR) → Phase 5 (docs 更新)
   - 詳細: [docs/8_TRACK_D_SPRINT_PLAN.md §Sprint 6](docs/8_TRACK_D_SPRINT_PLAN.md)、`.claude/plans/hoshutaro-project-curious-flute.md` (worktree)
   - ブロッカー: なし (実 AWS deploy 不要、ローカル `npm run dev` で完結)

2. **Track D 実 AWS deploy 検証** — コードは Sprint 1-5 で完全実装済だが、`npx ampx sandbox` での実 AWS deploy は未実施。ユーザー環境で AWS credential + `ampx sandbox` 起動 → Cognito User Pool / DynamoDB / 4 Lambda (post-confirmation / llm-proxy streaming / user-management / maximo-proxy mock) を実環境で動かし、ブラウザでサインアップ→確認→ログイン→MFA→クラウド LLM 呼出→エクスポート→削除の一連を E2E 確認。
   - 作業: `aws configure` で IAM credentials 設定、`npx ampx sandbox`、`amplify_outputs.json` 生成、テストアカウントで全機能手動確認
   - ブロッカー: AWS アカウント (個人開発は無料枠内、Bedrock のみ region 制約あり)

3. **Track B-Verify: 実機動作確認** — コードは完全に揃っているが、Gemma 4 E2B モデルでの実推論 / MTP accept rate / LoRA SFT が**一度も動かされていない**。
   - 作業: PEFT + PyTorch + transformers + datasets 依存インストール、Gemma 4 E2B-it / -it-assistant モデル DL + 量子化、OpenVINO 経由 MTP ベンチマーク、LoRA SFT 動作確認（100ペア × 1epoch）
   - ブロッカー: HuggingFace Token 取得、Intel Arc GPU 推奨（CPU だと遅い）

4. **Track D 本番化** (Sprint 5 残作業): カスタムドメイン (Route 53 + ACM + CloudFront)、CORS 本番ドメイン絞り込み、observability (CloudWatch Logs + X-Ray + SNS alert)、本番 Amplify pipeline-deploy、Maximo 実 API 接続 (VPC Lambda + Secrets Manager 経由 basic auth)、段階リリース計画 (社内ベータ → 制限付き一般 → 公開)。
   - すべて実 AWS 環境必須。コード基盤は CDK overrides + IAM ポリシー stub で揃っている。

5. **Track E: Tauri Desktop** — ~3-4週間。PyOxidizer + 自動更新 + CodeSigning。配布形態として一本化必須。**Sprint 6 で UI 設計書を整備してから着手することで Tauri パッケージ化後の手戻りを回避**。

6. **Plugin/Skill 機能拡張**（中粒度、軽量） — 既存の Plugin/Skill プラットフォーム上で新コネクタ Plugin（Maximo / SAP / Excel 別系統）、新 LLM Adapter（Anthropic Claude / OpenAI / Mistral 経由クラウド）、新組込 Skill（運転履歴分析 / 設備故障予測）等を追加。

7. **Track C: モノレポ化**（pnpm workspace）— **Track D/E 着手後** が合理的（package 境界の手戻り回避）

8. **残技術負債 2 件**（優先度低） — `MaintenanceCell.tsx` の `value: any` cascade refactor、`loadingOptimization.ts` は React 標準パターンなので保留

---

## 6. 新セッション開始時の指示テンプレ（コピペ用）

> ⚠️ **新セッション開始前に §11 "新セッション開始チェックリスト" の手順を必ず実行してください**。`mushitaro/hoshutaro-mu` リモートが設定されていない／main が古い state を tracking しているとドキュメントが見つけられず詰みます。

新しい Claude Code / Claude.ai セッションで以下を貼り付け：

```
このリポジトリは HOSHUTARO 次世代版（Project Mu / KASE）です。

最初に以下を実行してリモートと main を最新化してください:

  git remote -v                                # mushitaro が無ければ
  git remote add mushitaro https://github.com/mushitaro/hoshutaro-mu.git
  git fetch mushitaro main
  git checkout main || git checkout -b main mushitaro/main
  git reset --hard mushitaro/main              # 古い state なら最新化

その後 HANDOFF.md を読み、次に docs/PROJECT_MU.md と docs/CONCEPTS.md を確認してください。
.claude/plans/ に過去の実装計画があります（任意、最低限 HANDOFF.md + docs/ で進められる）。

現在の状況:
- Track A/B-1/B-2/B-3 全コード完了（Project Mu Engine + LLM Adapter + Plugin/MCP プラットフォーム）
- LoRA トレーナー本体実装済（依存未インストール時 graceful）
- UI 9画面（KnowledgeBase）+ PluginManager + SkillRunner + UpdateNotification + AgentBar 統合完了
- 技術負債削減完了（eslint-disable 562 → 2、Jest 127 件、no-explicit-any 175件削減、副次バグ修正 10+ 件）
- **Track D 全 5 Sprint コード実装完了** (PR #57-#78、Jest 127 → 289):
  - Sprint 1: amplify バックエンド + 認証画面 7 枚 + AuthGuard
  - Sprint 2: cloudSync + useUserSettings/useLLMSettings + LLMSettingsDialog 統合
  - Sprint 3: llm-proxy Lambda + CloudProxyAdapter + 真の SSE streaming
  - Sprint 4: user-management + maximo-proxy (mock) + ProfileScreen 配線
  - Sprint 5: streaming entry 切替 + MFA challenge/disable UI + auth-vendor chunk 分離
- 実 AWS deploy 検証はユーザー環境で残あり (sandbox/aws configure 必要)
- CI green（lint/build/test all pass）

次の作業: <ここに今回の依頼内容を書く。例: "Track D を sandbox で検証して" "Track B-Verify を進めて" "Track E (Tauri) を進めて" >

制約:
- 既存の MUI 7 + React Query 5 を使う（baseline-ui スキルの制約遵守）
- 用語は Plugin / Skill 中心（CONCEPTS.md 参照）
- LLM ターゲットは google/gemma-4-E2B-it、drafter は -it-assistant、MTP デフォルト ON
- データは SQLite 主、クラウドは Cognito + Lambda + DynamoDB の最小サーバレスのみ
- リポジトリは mushitaro/hoshutaro-mu (PRIVATE) が「真の main」。woodygaragelab/hoshutaro は現在 PUBLIC のため push 厳禁
```

---

## 7. リポジトリと規約

- **真の Origin**: <https://github.com/mushitaro/hoshutaro-mu>（PRIVATE）— 全開発はここで行う
- **アップストリーム**: <https://github.com/woodygaragelab/hoshutaro>（**現在 PUBLIC**）— mushitaro 側の作業が成功した時点でのみ integrate する想定。**ユーザーの権限は WRITE のみで visibility 変更不可**（admin 権限なし）。所有者に PRIVATE 化を依頼すべき。**意図しない push は厳禁**。
- ローカル git remote 名: `mushitaro` = 真の origin、`origin` = woodygaragelab（PUBLIC、push 注意）
- **デフォルトブランチ**: `main`
- **コミットメッセージ**: 日本語可、`feat:` `fix:` `docs:` `chore(tech-debt):` `refactor(types):` 等のプレフィックス推奨
- **テスト前提**:
  - Python: `python tests/test_mu_smoke.py` が pass
  - TypeScript: `npx tsc -b --noEmit` がエラー無し
  - Jest: `npm run test` で 127 件 PASS
- **コミット時**: `git add` は対象ファイルを明示（`-A` 禁止、秘密情報混入予防）
- **PR スタイル**: 1 PR あたり ~50〜100 行 / 1 機能スコープを目安。連鎖 PR スタックは squash-merge の SHA 不一致で下流が CONFLICTING になる落とし穴があるため、stack は短く（§9 PR #20-#35 の教訓）

---

## 8. 既知の注意点

- **Windows 開発環境では sqlite-vec 拡張がロードできない場合がある** → `db.py` で graceful 無効化
- **HuggingFace の `gemma-4` は利用規約同意必須**、`HUGGINGFACE_HUB_TOKEN` 環境変数で取得
- **Gemma 4 ファミリーは 2026 年に release**：base 版（無印）は使わず `it`（instruction-tuned）必須
- **MTP drafter は target と同ファミリー固定** — `gemma-4-E2B-it` ↔ `gemma-4-E2B-it-assistant` のペアをまたがない
- **`woodygaragelab/hoshutaro` への push は意図せずやらないこと**（PUBLIC のため漏洩リスク。本リポは独立フォーク）
- **連鎖 PR スタックでの squash-merge は SHA 不一致を引き起こす** — 下流 PR が CONFLICTING になる。stack 短く保つ、もしくは local で cherry-pick rebase してから push（§9 参照）
- **Jest の worktree path 問題** — `.claude/worktrees/<name>` 配下では `<rootDir>` の `.claude` 部分が micromatch エスケープと衝突。`testRegex` ベース ad-hoc config で回避可

---

## 9. PR 時系列と整流履歴

本リポは複数の Claude セッションを経て築かれており、PR 番号には欠番・重複・置換が多い。次セッションで「PR スタックがなぜ無いのか」を迷わないための地図。

### Phase 1: 既存 HOSHUTARO 機能（古い、Project Mu 以前）
グリッド / WorkOrderLineDialog / time scale / cost trend graph / 機器分類マスター等 (約 14 commits)

### Phase 2: Plugin/MCP プラットフォーム移行（Track B-3）
- `069288f` feat(plugin-core): MCP Plugin Engine + Adapters + LLM（+2128 行）
- `a3d87dd` feat(plugin-ui): PluginManager + SkillRunner + UpdateNotification + Grid UI（+2171 行）
- `272427d` refactor(llm): backend を MCP Hub 経由に移行（旧 `factory.py` / `openai_compat.py` / `openvino_genai.py` 削除）
- `a5ab9fe` feat: PluginManager/SkillRunner MUI 化 + OpenVINO adapter 追加
- `2dd9f0d` / `3a89773` / `8ae99d7` / `34fe17e` docs + config

→ ここまでが `woodygaragelab/hoshutaro` の main HEAD = `34fe17e` と一致（共通祖先）。

### Phase 3: Project Mu Engine 導入
- `aa8264d` feat: Project Mu (KASE) Engine + Knowledge Base UI + LLM 抽象層（大規模初期投入）
- `3b7fb74` docs: HANDOFF.md 追加

### Phase 4: 整流フェーズ（PR #1〜#3、Claude セッション #1）
- `48cc0c7` (PR #1) feat: KnowledgeBasePage 統合 + LoRA トレーナー本体
- `e96dce5` (PR #2) fix: pre-existing 型エラー / lint / test 失敗を一掃
- `bdd7fcb` (PR #3) docs: HANDOFF.md 更新

### Phase 5: Track B 検証スキャフォルド + 技術負債削減 R1（PR #4〜#15、セッション #2）
- `d2a18f4` (PR #4) feat(track-b): 実機検証スキャフォルド
- `33a4ec8` (PR #5) chore(tech-debt): Jest 基盤 + unused-vars 84件削減
- `a628cca` (PR #6) test: コア境界層 63件追加（40 → 103）
- `d768b35` (PR #7) chore(tech-debt): no-explicit-any 12件（LLMSettingsDialog）
- `08aa13e` (PR #14) chore(tech-debt): consolidated 73件削減（#9-#13 集約マージ）
- PR #8（HANDOFF.md 562→237 件 進捗更新案）: CLOSED、ブランチ削除で **内容消失**
- PR #9-#13: CLOSED（#14 で集約マージ済）
- PR #15（UI ダイアログ 13件削減）: CLOSED（本セッション PR #51 に subsumed、merge すると後発の改善を regress するため）

### Phase 6: 技術負債削減 R2（PR #16〜#53、本セッション）
- `705d969` (PR #16) refactor: HierarchyDefinition / TreeDefinition 統合
- `15e7b58` (PR #36, 旧 #17 再作成) test: ViewModeManager 24件（103 → 127）
- `696f3b3` (PR #18) refactor: WorkOrderBasedRow.type slim 化
- `3384234` (PR #19) App.tsx スライス A: 14件削減

旧 PR #20〜#35 は squash-merge の SHA 不一致で全 CONFLICTING に → CLOSED。cherry-pick rebase 版を新 PR #38〜#53 として作り直して順次マージ:

| 旧 PR (CLOSED) | 新 PR (MERGED) | 内容 |
|---:|---:|---|
| #17 (auto-close) | #36 | ViewModeManager Jest 24件 |
| #20 | #38 | App.tsx スライス B (9件) |
| #21 | #39 | App.tsx スライス C (7件) |
| #22 | #40 | App.tsx スライス D (10件) |
| #23 | #53（504 timeout で #41 を先に merge、後で補完）| App.tsx スライス E (6件) |
| #24 | #41 | App.tsx スライス F (11件) |
| #25 | #42 | App.tsx スライス G (11件、**App.tsx 完全達成**) |
| #26 | #43 | EnhancedMaintenanceGrid スライス 1 (12件) |
| #27 | #44 | EnhancedMaintenanceGrid スライス 2 (11件) |
| #28 | #45 | EnhancedMaintenanceGrid スライス 3 (8件、**EMG 完全達成**) |
| #29 | #46 | MaintenanceGridLayout スライス 1 (12件、Props) |
| #30 | #47 | MaintenanceGridLayout スライス 2 (5件) |
| #31 | #48 | MaintenanceGridLayout スライス 3 (5件、**MGL 完全達成**) |
| #32 | #49 | Grid family 4 ファイル (13件) |
| #33 | #50 | AIAssistant cluster 6 ファイル (17件) |
| #34 | #51 | Component cluster 8 ファイル (20件) |
| #35 | #52 | utils/demos/services + Cell partial (18件) |

PR #37（batch merge 試行）: sandbox policy で denied、CLOSED。

### Phase 7: Track D Sprint 1 認証基盤（PR #57〜#63、本セッション）

mushitaro/hoshutaro-mu に作業を移管し、Sprint 0 設計の docs (#54-#56) を経て Sprint 1 を 6 スライスに分割して順次 merge:

| PR | Slice | 内容 | 規模 | テスト |
|---:|---|---|---:|---:|
| #57 | A: バックエンド基盤 | `amplify/data` (UserSettings/LLMSettings/SyncMetadata) + `amplify/auth` 拡張 + `amplify/backend.ts` CDK overrides (passwordPolicy 12 文字 + MFA OPTIONAL TOTP) + `post-confirmation-trigger` Lambda | +1,512 LoC | — |
| #58 | B: 認証 hook 基盤 | `AmplifyAuthService` (v6 auth API thin wrapper) + `amplifyConfig` (`import.meta.glob` 安全 load) + `AuthContext` + `AuthProvider` (`Hub.listen` 自動 refresh) + `useAuth` hook | +335 LoC | 4 件 (131) |
| #59 | C: 認証画面 5 枚 + 共通 | `AuthLayout` + `authErrors.ts` (Cognito Exception 9 種日本語化) + `passwordValidation.ts` (12 文字+大小英数記号) + Login/SignUp/ConfirmEmail/RequestPasswordReset/ResetPasswordWithCode | +1,424 LoC | 53 件 (184) |
| #60 | D-1: AuthGuard + 統合 | `AuthGuard.tsx` (5 画面 state machine + `pendingEmail` 受け渡し) + `main.tsx` に `<AuthProvider>` + `<AuthGuard>` 挿入 + `AgentBar` にサインアウト menu-item | +333 LoC | 8 件 (192) |
| #61 | D-2: MFA 設定画面 | `MfaSetupScreen.tsx` (`setUpTOTP` → QRCodeSVG + secret 表示 → `verifyTOTPSetup`) + `qrcode.react` v4 依存追加 | +267 LoC | 8 件 (200) |
| #62 | D-3: プロフィール画面 | `ProfileScreen.tsx` (表示名変更 / パスワード変更 / MFA リクエスト / サインアウト) + `MfaSetupScreen` に `noLayout` prop 追加 + `AgentBar` に「プロフィール」menu + `Dialog` で ProfileScreen ↔ MfaSetupScreen 切替 + `AmplifyAuthService.updateProfile` 追加 | +535 LoC | 11 件 (211) |
| #63 | E: ドキュメント締め | HANDOFF.md / docs/8_TRACK_D_SPRINT_PLAN.md を Sprint 1 完了状態に更新、次セッションの onboarding 情報を反映 | docs のみ | — |

合計: **6 実装スライス + 1 docs スライス = 7 PR**、**+4,406 LoC**、**Jest 127 → 211 件 (+84)**、全 PR squash-merge 済。bundle 影響: aws-amplify v6 SDK 取り込みで index gzip +40 KB、AgentBar 経由の qrcode.react で App gzip +8 KB (許容範囲)。

**Sprint 1 完了で得られた機能**:
- ログイン / 新規登録 / メール確認 / パスワードリセット (要求+コード入力) の認証フロー
- TOTP MFA セットアップ (QR + 手動入力 secret 併記)
- プロフィール画面で表示名変更 / パスワード変更 / MFA リクエスト / サインアウト
- 全画面で Cognito Exception 9 種の日本語エラー表示、`UserNotConfirmedException` で自動的に ConfirmEmail 遷移、`UserNotFoundException` を**セキュリティ上隠蔽**
- `Hub.listen('auth', ...)` 経由でサインイン/サインアウト後の AuthProvider state 自動 refresh
- **AgentBar から MUI Dialog で ProfileScreen / MfaSetupScreen を切替表示**

**Sprint 1 スコープ外** (Sprint 4-5 に移管):
- データエクスポート / アカウント削除 (`user-management` Lambda 待ち)
- MFA 無効化 UI (`setPreferredMFA('NOMFA')` + 確認ダイアログ)
- アカウント作成日表示 (Cognito からの取得方法限定的)
- 新規登録時の MFA 必須化フロー (現状 MfaSetupScreen に `onSkip` prop 用意済、未配線)

**残作業**: ユーザー環境で `aws configure` + `npx ampx sandbox` を起動し、実 Cognito + DynamoDB に対する E2E 動作確認 (docs/8 §7 の手順) を実施。これが pass すれば Sprint 2 (データ基盤) 着手。

### Phase 8: Track D Sprint 2-5 (PR #64〜#78、本セッション)

Sprint 1 完了から間を置かず、Sprint 2-5 を計画書通り順次実装:

| PR | Slice | 内容 | テスト |
|---:|---|---|---:|
| #64 | **2-A** | `cloudSync` (generateClient<Schema> lazy + null fallback) + `useUserSettings` (React Query 5) | +12 |
| #65 | **2-B** | `useLLMSettings` (preferredModel / fallbackModels / mtpEnabled / customApiKeys) | +9 |
| #66 | **2-C** | `CloudLLMSettingsSection` を `LLMSettingsDialog` 冒頭に統合 (Autocomplete + KNOWN_CLOUD_MODELS) | +8 |
| #67 | **3-A** | `llm-proxy` Lambda (Bedrock + Anthropic Direct fallback + Cognito JWT + Function URL invokeMode=RESPONSE_STREAM) + CDK 配線 | +8 |
| #68 | **3-B** | `CloudProxyAdapter` 本実装 (httpx + SSE parser + retries + ping) | +13 |
| #69 | **3-C** | `registry.py` に `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku` 追加 + env 補完 + UI Autocomplete | +8 |
| #70 | **3-D** | **真の SSE streaming**: Lambda streamifyResponse + adapter httpx.stream + aiter_lines | +8 |
| #71 | **4-A** | `user-management` Lambda (Cognito AdminDeleteUser + DynamoDB batch delete + exportData) | +10 |
| #72 | **4-B** | ProfileScreen に「データをエクスポート」(Blob download) + 「アカウントを削除…」(2 段階 Dialog) | +5 |
| #73 | **4-C** | `maximo-proxy` Lambda (mock 実装、assets/workorders + filter、実 API は Sprint 5 NOT_IMPLEMENTED) | +9 |
| #74 | **5-A** | Lambda llm-proxy default handler を streamingHandler に切替 (buffered は bufferedHandler に保持) | +2 |
| #75 | **5-B** | LoginScreen に MFA TOTP challenge inline (`confirmSignIn` 連携、2 stage state machine) | +6 |
| #76 | **5-C** | ProfileScreen に MFA 無効化 UI (`updateMFAPreference({ totp: 'DISABLED' })` + 2 段階確認) | +5 |
| #77 | **5-D** | bundle 最適化: `auth-vendor` chunk 分離 (aws-amplify + qrcode.react) → index gzip -38 KB / App -12 KB | — |
| #78 | **5-E** | 本 PR: HANDOFF.md + docs/8 を Track D 完全完了状態に更新 | — |

**累積**: 15 PR、+10,000 LoC 規模、**Jest 211 → 289 (+78)**、Python テスト 0 → 21、すべて squash-merge 済。実 AWS deploy 確認はユーザー環境で別途残あり。

**Track D 完了で得られた機能**:
- メールパスワード認証 + メール確認 + パスワードリセット + TOTP MFA (設定/再ログイン/無効化)
- クラウド同期: UserSettings (theme/language) + LLMSettings (preferredModel/mtpEnabled)
- LLM 中継: Lambda 経由 Bedrock Runtime API → Claude 3.5 Sonnet/Haiku (Anthropic Direct fallback、真の SSE streaming)
- ユーザー管理: アカウント削除 (Cognito + DynamoDB 一括) + データエクスポート (JSON download)
- Maximo 連携 mock (sandbox 開発用、実 API は Sprint 5 残)
- bundle 最適化済 (aws-amplify を別 chunk へ)

### squash-merge SHA 不一致の教訓（次セッション向け）

連鎖 PR スタック（#20→#21→...→#35 のような chain）を順番に squash-merge すると、上流 PR がマージされた時点で main に新しい SHA が刻まれ、下流 PR のブランチが元にしていた古い SHA との差分計算で **CONFLICTING (false positive)** が発生する。

回避策:
- **PR スタックは短く保つ** (最大 3-5 PR 連鎖まで)
- **下流が conflict したら**: local で cherry-pick rebase →新 branch に push → 新 PR を作って merge
- **batch merge**（1 PR に 16 commit 含めて --merge）は sandbox で denied される運用なので、1 PR ずつ順次がベター

---

## 10. 現在の Open PR

なし。

すべての作業ブランチは整理済み。リモート上に残るのは `main` のみ。

---

## 11. 新セッション開始チェックリスト

**重要**: 新しい Claude Code セッション、新しい PC、別の worktree から作業を始める時は、**最初に必ず以下のステップを順番に実行**してください。これを怠ると `mushitaro/main` の最新状態が見えず、ドキュメント (HANDOFF.md / docs/8_TRACK_D_SPRINT_PLAN.md 等) が古いか存在しないように見えます。

### Step 0: リポジトリの場所を確認

```bash
pwd                    # 現在のディレクトリ
git rev-parse --show-toplevel    # リポジトリ root
```

リポジトリ root が **`hoshutaro` ディレクトリ** (woodygaragelab/hoshutaro の clone) であることを確認。違う場所にいたら正しい場所へ `cd`。

### Step 1: リモート設定を確認・追加

```bash
git remote -v
```

出力に `mushitaro` が **無ければ追加**:

```bash
git remote add mushitaro https://github.com/mushitaro/hoshutaro-mu.git
```

期待される最終状態:
```
mushitaro       https://github.com/mushitaro/hoshutaro-mu.git (fetch)
mushitaro       https://github.com/mushitaro/hoshutaro-mu.git (push)
origin          https://github.com/woodygaragelab/hoshutaro.git (fetch)
origin          https://github.com/woodygaragelab/hoshutaro.git (push)
```

### Step 2: 真の main (= mushitaro/main) を fetch

```bash
git fetch mushitaro main
```

### Step 3: ローカル main を mushitaro/main に同期

**現在のブランチが main の場合**:
```bash
git checkout main
git reset --hard mushitaro/main    # ⚠️ 未コミットの変更は失う、必要なら stash で退避
```

**現在のブランチが他のブランチで、未コミットの作業がある場合**:
```bash
git stash                          # 退避
git checkout main
git reset --hard mushitaro/main
git checkout -                     # 元のブランチに戻る
git stash pop                      # 退避を戻す
```

**worktree や fresh clone で main が無い場合**:
```bash
git checkout -b main mushitaro/main
```

### Step 4: 同期確認

```bash
git log -1 --oneline mushitaro/main    # mushitaro 側 HEAD
git log -1 --oneline main              # ローカル main HEAD
# 両者が一致していれば OK
```

### Step 5: 必読ドキュメントが見えることを確認

```bash
ls HANDOFF.md docs/PROJECT_MU.md docs/CONCEPTS.md docs/6_FRONTEND_BACKEND_INTEGRATION.md docs/7_AUTH_AND_USERS.md docs/8_TRACK_D_SPRINT_PLAN.md
```

すべてのファイルがリストされれば OK。エラーが出る場合は Step 3 の `reset --hard` が成功していない可能性が高い。

### Step 6: 開発環境セットアップ (初回のみ)

```bash
npm install
cd backend && pip install -r requirements.txt && cd ..
```

### Step 7: CI 相当の動作確認

```bash
npm run lint && npx tsc -b --noEmit && npm run test
```

すべて clean なら準備完了。

### トラブルシューティング

| 症状 | 原因 | 対策 |
|---|---|---|
| `gh pr list` で見えない PR がある | デフォルトリポが origin になっている | `-R mushitaro/hoshutaro-mu` を明示 |
| HANDOFF.md / docs/ が古い・無い | ローカル main が origin/main (古い) を tracking | Step 3 の `git reset --hard mushitaro/main` |
| `mushitaro/main` が fetch できない | リモート未設定 / 認証エラー | Step 1 のリモート追加、`gh auth login` で認証 |
| ブランチを切ろうとして "branch already in worktree" エラー | 別 worktree で同じブランチを使用中 | 別の worktree (`C:\Users\kazuh\hoshutaro\.claude\worktrees\`) を確認・整理 |
| `npx ampx sandbox` がエラー | AWS 認証情報未設定 | `aws configure` で IAM ユーザー credentials 設定 (Track D で必要) |

---

## 12. ドキュメント階層 (どこに何があるか)

```
hoshutaro/ (リポジトリ root)
├── HANDOFF.md                          # ★ まずこれを読む (この文書)
├── README.md                           # 一般的な README
├── docs/
│   ├── README.md                       # docs/ の目次
│   ├── PROJECT_MU.md                   # Project Mu 正式仕様 (LLM/SQLite/LoRA)
│   ├── CONCEPTS.md                     # 用語定義 (Plugin/Skill/MCP/Adapter/MTP)
│   ├── ARCHITECTURE.md                 # 全体アーキテクチャ
│   ├── DATA_MODEL.md                   # DataModel v3.0.0
│   ├── 1_GETTING_STARTED.md            # Hello World プラグイン
│   ├── 2_CONNECTOR_DEVELOPMENT.md      # Connector Plugin 開発
│   ├── 3_LLM_ADAPTER_DEVELOPMENT.md    # LLM Adapter Plugin 開発
│   ├── 4_SKILL_RECIPES.md              # Skill レシピ集
│   ├── 5_PUBLISH_GUIDE.md              # Plugin 公開フロー
│   ├── 6_FRONTEND_BACKEND_INTEGRATION.md   # ★ Track D アーキテクチャ
│   ├── 7_AUTH_AND_USERS.md             # ★ Track D 認証フロー + 7 画面
│   └── 8_TRACK_D_SPRINT_PLAN.md        # ★ Track D Sprint 計画 + 詳細タスク
├── backend/                            # FastAPI + Project Mu Engine
├── src/                                # Frontend (React + MUI 7)
├── amplify/                            # AWS Amplify Gen2 (Track D)
├── tools/quantize-models/              # OpenVINO INT4/INT8 量子化
└── .claude/                            # Claude Code 関連 (リポ内、worktree, plans)
    ├── worktrees/<name>/               # 各 worktree
    └── plans/                          # 個人作業 plan (gitignored、worktree のみ参照可)

# user-level (ユーザーホーム配下、別管理):
~/.claude/plans/                        # Claude が auto-generate するプランファイル
~/.claude/projects/.../memory/          # auto-memory (CLAUDE.md memory)
```

「**新セッションでドキュメントが見つからない**」と感じたら、まず Step 5 で `ls` してみてください。それでも無ければ Step 3 の `reset --hard` が必要です。
