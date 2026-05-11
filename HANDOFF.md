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
Track D 設計: [docs/6_FRONTEND_BACKEND_INTEGRATION.md](docs/6_FRONTEND_BACKEND_INTEGRATION.md)、[docs/7_AUTH_AND_USERS.md](docs/7_AUTH_AND_USERS.md)、`.claude/plans/track-d-aws-cloud.md`（worktree のみ）
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

### ❌ 未着手 / 重い依存待ち
| 項目 | ブロッカー |
|---|---|
| **B-Verify**: Track A LoRA 学習の実機動作確認（Gemma 4 E2B 実 SFT・loss 推移・delta 計測） | PEFT + PyTorch + Intel Arc GPU 推奨。コードは実装済み（依存未インストール時 NotImplementedError） |
| **B-Verify**: Track B 実モデル動作確認（Gemma 4 E2B 推論ベンチマーク・MTP accept rate 測定） | OpenVINO 依存 + モデルダウンロード + HuggingFace Token |
| Track D: AWS Cloud + 認証 + 繋ぎ層（CDK + Lambda + Cognito + 認証画面 7枚） | AWS アカウント、~4-5週間 |
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

次の候補:

1. **🥇 Track B-Verify: 実機動作確認** — コードは完全に揃っているが、Gemma 4 E2B モデルでの実推論 / MTP accept rate / LoRA SFT が**一度も動かされていない**。最も自然な次の一手。
   - 作業: PEFT + PyTorch + transformers + datasets 依存インストール、Gemma 4 E2B-it / -it-assistant モデル DL + 量子化、OpenVINO 経由 MTP ベンチマーク、LoRA SFT 動作確認（100ペア × 1epoch）
   - ブロッカー: HuggingFace Token 取得、Intel Arc GPU 推奨（CPU だと遅い）

2. **Track D: AWS Cloud + 認証 + 繋ぎ層** — ~4-5週間。Amplify Gen2 (= CDK + TypeScript) + Lambda + Cognito + AppSync + DynamoDB + 認証画面 7枚。
   - **Sprint 0 (設計、完了済)**: [docs/6_FRONTEND_BACKEND_INTEGRATION.md](docs/6_FRONTEND_BACKEND_INTEGRATION.md) + [docs/7_AUTH_AND_USERS.md](docs/7_AUTH_AND_USERS.md) + `.claude/plans/track-d-aws-cloud.md` (worktree)
   - **Sprint 1 (Week 1)**: 認証基盤 (amplify/auth 拡張 + post-confirmation Lambda + 認証画面 7枚 + App.tsx AuthGuard)
   - **Sprint 2 (Week 2)**: データ基盤 (DynamoDB UserSettings/LLMSettings/SyncMetadata + user-sync Lambda)
   - **Sprint 3 (Week 3)**: LLM 中継 (llm-proxy Lambda + AWS Bedrock + cloud_proxy.py 実装 + SSE streaming)
   - **Sprint 4 (Week 4)**: 連携 + 管理 (maximo-proxy + user-management + E2E)
   - **Sprint 5 (Week 5)**: 本番化 + 観測性 + ドキュメント整備

3. **Track E: Tauri Desktop** — ~3-4週間。PyOxidizer + 自動更新 + CodeSigning。配布形態として一本化必須。

4. **Plugin/Skill 機能拡張**（中粒度、軽量） — 既存の Plugin/Skill プラットフォーム上で新コネクタ Plugin（Maximo / SAP / Excel 別系統）、新 LLM Adapter（Anthropic Claude / OpenAI / Mistral 経由クラウド）、新組込 Skill（運転履歴分析 / 設備故障予測）等を追加。

5. **Track C: モノレポ化**（pnpm workspace）— **Track D/E 着手後** が合理的（package 境界の手戻り回避）

6. **残技術負債 2 件**（優先度低） — `MaintenanceCell.tsx` の `value: any` cascade refactor、`loadingOptimization.ts` は React 標準パターンなので保留

---

## 6. 新セッション開始時の指示テンプレ（コピペ用）

新しい Claude Code / Claude.ai セッションで以下を貼り付け：

```
このリポジトリは HOSHUTARO 次世代版（Project Mu / KASE）です。
最初に HANDOFF.md を読み、次に docs/PROJECT_MU.md と docs/CONCEPTS.md を確認してください。
.claude/plans/ に過去の実装計画があります。

現在の状況:
- Track A/B-1/B-2/B-3 全コード完了（Project Mu Engine + LLM Adapter + Plugin/MCP プラットフォーム）
- LoRA トレーナー本体実装済（依存未インストール時 graceful）
- UI 9画面（KnowledgeBase）+ PluginManager + SkillRunner + UpdateNotification + AgentBar 統合完了
- 技術負債削減完了（eslint-disable 562 → 2、Jest 127 件、no-explicit-any 175件削減、副次バグ修正 10+ 件）
- CI green（lint/build/test all pass）

次の作業: <ここに今回の依頼内容を書く。例: "Track B-Verify を進めて" >

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

### squash-merge SHA 不一致の教訓（次セッション向け）

連鎖 PR スタック（#20→#21→...→#35 のような chain）を順番に squash-merge すると、上流 PR がマージされた時点で main に新しい SHA が刻まれ、下流 PR のブランチが元にしていた古い SHA との差分計算で **CONFLICTING (false positive)** が発生する。

回避策:
- **PR スタックは短く保つ** (最大 3-5 PR 連鎖まで)
- **下流が conflict したら**: local で cherry-pick rebase →新 branch に push → 新 PR を作って merge
- **batch merge**（1 PR に 16 commit 含めて --merge）は sandbox で denied される運用なので、1 PR ずつ順次がベター

---

## 10. 現在の Open PR

なし（本ドキュメント更新 PR を除き）。

すべての作業ブランチは整理済み。リモート上に残るのは `main` + 本 PR の作業ブランチのみ。
