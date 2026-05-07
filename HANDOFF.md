# HANDOFF — 次セッション引き継ぎ

> このドキュメントは前セッションで実装した内容を、別端末・別セッション（スマホ含む）で
> Claude に再開させるための引き継ぎノート。**最初にこのファイルを読み込ませてから指示を出す**。

---

## 1. プロジェクト要約（30秒で把握）

**HOSHUTARO 次世代版**（コードネーム **Project Mu**）：
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

詳細仕様: [docs/PROJECT_MU.md](docs/PROJECT_MU.md)、[docs/CONCEPTS.md](docs/CONCEPTS.md)、[docs/4_SKILL_RECIPES.md](docs/4_SKILL_RECIPES.md)
完全な実装計画: `.claude/plans/aws-qwen3-6-35b-deepseek-v4-gemma4-30b-staged-kay.md`（worktree 経由でのみ参照可、本リポにはコピー無し。必要なら最初に読み込み）

---

## 2. 実装ステータス（このコミット時点）

### ✅ 完了
| Track | 範囲 |
|---|---|
| **A: Project Mu Engine** | memory CRUD（rules / master_map / training_cache / lora_adapters / prompt_cache / vector_search）、embeddings、cache、3フェーズパイプライン、sql_context_resolver、learning メタ管理、API ルーター 13 endpoints |
| **B-1: LLM Adapter** | `OpenVinoGemmaAdapter` を transformers + optimum-intel ベースで実装、MTP `assistant_model` 連携、Thinking Mode 抽出、ストリーミング、デバイス自動検出（NPU > GPU > CPU）、依存未インストール時 graceful |
| **B-2: モデル取得・配置** | `tools/quantize-models/download_and_quantize.py`、`backend/app/mu/setup/downloader.py`、`backend/app/routers/setup.py`（SSE progress） |
| **UI 9画面** | `src/components/KnowledgeBase/`：Dashboard / RuleEditor / MasterMapView / MappingSimilaritySearch / Location & Classification PatternViews / LoRAAdapterManager / TrainingCacheView / LearningHistoryView + KnowledgeBasePage（親 Tabs）+ hooks + common 基盤。**baseline-ui 制約遵守**、`tsc --noEmit` クリーン |
| **検証** | 4 テストすべてパス（`backend/tests/test_mu_smoke.py`：memory CRUD / sql_context_resolver / scheduler 閾値 / FastAPI dashboard）、TypeScript エラーなし |

### ❌ 未着手 / 重い依存待ち
| 項目 | ブロッカー |
|---|---|
| Track A LoRA トレーナー本体（`learning/lora_trainer.py`） | PEFT + PyTorch インストール、Intel Arc GPU 推奨 |
| Track B 実モデル動作確認（Gemma 4 E2B 推論ベンチマーク・MTP accept rate 測定） | OpenVINO 依存 + モデルダウンロード |
| Track C: モノレポ化（pnpm workspace） | 大規模リファクタ、~4-6週間 |
| Track D: AWS Cloud + 認証 + 繋ぎ層（CDK + Lambda + Cognito + 認証画面 7枚） | AWS アカウント、~4-5週間 |
| Track E: Tauri Desktop（PyOxidizer + 自動更新 + CodeSigning） | Rust、各 OS 証明書、~3-4週間 |
| KnowledgeBasePage の既存 App.tsx 組み込み | App.tsx の構造判断 |

### スタブ（NotImplementedError）
- `backend/app/mu/learning/lora_trainer.py` — PEFT 実装手順を docstring 化済
- `backend/app/mu/learning/model_merger.py` — OpenVINO IR マージ
- `backend/app/llm/adapters/cloud_proxy.py` — Lambda llm-proxy 経由（Track D）
- `backend/app/llm/adapters/sagemaker.py` — SageMaker（オンデマンド代替）
- `OpenVinoGemmaAdapter` の chat/stream/classify/generate は依存未インストール時のみ `HARD_FAIL`

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
│   ├── learning/           # LoRA メタ管理（trainer は未実装スタブ）
│   ├── embeddings/         # multilingual-e5-small ラッパ
│   ├── cache/              # KV キャッシュマネージャ
│   └── setup/              # 初回モデルダウンロードマネージャ
├── skills/
│   └── sql_context_resolver.py  # Skill の sql_context → 実 SQL/ベクトル検索
└── routers/
    ├── mu.py               # Knowledge Base UI 用 13 endpoints
    └── setup.py            # モデル DL（status / download / SSE progress）

src/
├── components/KnowledgeBase/    # UI 9画面 + hooks + common
└── services/muApi.ts            # フロント API クライアント + SSE

tools/quantize-models/            # HF → OpenVINO INT4/INT8 量子化 CLI
docs/                             # PROJECT_MU.md / CONCEPTS.md / 4_SKILL_RECIPES.md（要点集）
backend/tests/test_mu_smoke.py    # スモークテスト
```

---

## 4. 動作確認コマンド

```bash
# Python 構文 + import + DB スキーマ + memory CRUD + Router 統合
cd backend && python tests/test_mu_smoke.py

# TypeScript 型チェック
npx tsc --noEmit -p .

# 開発サーバ起動（FastAPI + Vite を並行）
npm run dev
# → http://localhost:5173 (Vite) と http://localhost:8000 (FastAPI)
# Knowledge Base UI は <KnowledgeBasePage organization="..." /> として組み込み（App.tsx に未統合）
```

---

## 5. 続きを進める優先候補

1. **KnowledgeBasePage を App.tsx のメニューに組み込む**（最短、UI 通電）
2. **LoRA トレーナー本体実装**（PEFT + PyTorch、`backend/app/mu/learning/lora_trainer.py`）
3. **OpenVINO + Gemma 4 E2B 実モデルダウンロード + ベンチマーク**（Track B 動作確認）
4. **Track C: モノレポ化**（pnpm workspace）
5. **Track D: AWS Cloud + 認証 + 繋ぎ層**
6. **Track E: Tauri Desktop**

---

## 6. 新セッション開始時の指示テンプレ（コピペ用）

新しい Claude Code / Claude.ai セッションで以下を貼り付け：

```
このリポジトリは HOSHUTARO 次世代版（Project Mu）です。
最初に HANDOFF.md を読み、次に docs/PROJECT_MU.md と docs/CONCEPTS.md を確認してください。
.claude/plans/ に過去の実装計画があります。

現在の状況: Track A/B 完了、UI 9画面完了（HANDOFF.md の表参照）。
次の作業: <ここに今回の依頼内容を書く。例: "LoRA トレーナーを実装して" >

制約:
- 既存の MUI 7 + React Query 5 を使う（baseline-ui スキルの制約遵守）
- 用語は Plugin / Skill 中心（CONCEPTS.md 参照）
- LLM ターゲットは google/gemma-4-E2B-it、drafter は -it-assistant、MTP デフォルト ON
- データは SQLite 主、クラウドは Cognito + Lambda + DynamoDB の最小サーバレスのみ
```

---

## 7. リポジトリと規約

- **Origin**: <https://github.com/mushitaro/hoshutaro-mu>（private）
- **デフォルトブランチ**: `main`
- **コミットメッセージ**: 日本語可、`feat:` `fix:` `docs:` のプレフィックス推奨
- **テスト前提**:
  - Python: `python tests/test_mu_smoke.py` が pass
  - TypeScript: `npx tsc --noEmit` がエラー無し
- **コミット時**: `git add` は対象ファイルを明示（`-A` 禁止、秘密情報混入予防）

---

## 8. 既知の注意点

- **Windows 開発環境では sqlite-vec 拡張がロードできない場合がある** → `db.py` で graceful 無効化
- **HuggingFace の `gemma-4` は利用規約同意必須**、`HUGGINGFACE_HUB_TOKEN` 環境変数で取得
- **Gemma 4 ファミリーは 2026 年に release**：base 版（無印）は使わず `it`（instruction-tuned）必須
- **MTP drafter は target と同ファミリー固定** — `gemma-4-E2B-it` ↔ `gemma-4-E2B-it-assistant` のペアをまたがない
- 現在の origin `woodygaragelab/hoshutaro` への push は意図せずやらないこと（本リポは独立フォーク）
