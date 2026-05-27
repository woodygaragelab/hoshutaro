# Project Mu — 自律進化型 機器台帳構造化エンジン

> HOSHUTARO の中核差別化機能。SQLite を「LLM の長期メモリ」として使い、ユーザー判定が学習されて自己進化するエッジコンピューティングシステム。

---

## 第1部: 正式実装指示書（原文）

本プロジェクト（Project Mu）における、Gemma 4 E2B を活用した機器台帳構造化システムの最終的な実装指示。

### 1. システム概要

非構造化状態の機器台帳（Excel/CSV）を、軽量LLM（Gemma 4 E2B）と外部DB（SQLite）を組み合わせて高精度・高速に JSON 化するオフライン・エッジコンピューティング・システム。

### 2. システム構成

本システムは、**推論（LLM）・記憶（SQLite）・学習（LoRA）** の **3層構造** で運用する。

| 層 | 実装 |
|---|---|
| **推論層** | Gemma 4 E2B-it (Thinking Mode) + **Gemma 4 E2B-it-assistant（MTP drafter、Speculative Decoding で最大3x高速化）** |
| **記憶層** | SQLite (変換ルール、マスターマッピング、学習用ペアの蓄積) |
| **学習層** | LoRA (SQLite のデータに基づく、特定タスクへの軽量チューニング) |

**推論層の詳細（MTP / Speculative Decoding）**:
- **Target**: `google/gemma-4-E2B-it`（本格推論、出力品質を保証）
- **Drafter (Assistant)**: `google/gemma-4-E2B-it-assistant`（4-layer 軽量 drafter、複数トークンを並列提案）
- Drafter の提案を Target が 1 パスで検証 → **出力品質劣化なしで最大 3x 高速化**
- フェーズ2「高速一括変換」で効果が最大化（10行バッチ × 多回数 → スループット向上）
- API: HuggingFace transformers `model.generate(..., assistant_model=...)`、または OpenVINO GenAI `LLMPipeline(draft_model=...)`

**モデルバリアントの選別（重要）**:

| バリアント | 訓練段階 | Project Mu での用途 | 採用 |
|---|---|---|---|
| `google/gemma-4-E2B`（base、無印） | 事前学習のみ（次トークン予測） | 独自 base 訓練の起点として将来検討 | ❌ 不採用 |
| `google/gemma-4-E2B-it` | base + SFT + RLHF（指示追従・対話） | **target**: 全フェーズで使用 | ✅ |
| `google/gemma-4-E2B-it-assistant` | it 系 target 用 4-layer MTP drafter | **drafter**: フェーズ2 で 3x 高速化 | ✅ |

base 版（無印）を選ばない理由:
- フェーズ1 Thinking Mode の `<\|think\|>` タグ生成は instruction tuning に依存
- フェーズ2/3 の JSON 出力フォーマット遵守、system prompt 追従は instruction following 必須
- LoRA 学習も `it` 版を起点にした方が target ↔ drafter ペアの整合性を保てる

**配布方式（初回起動時ダウンロード）**:
- Tauri 本体: ~50MB（モデル含まず）
- 初回起動時にユーザー同意 UI → HuggingFace Hub または社内 S3 ミラーから取得
  - target ~1.5GB（INT4 量子化）
  - drafter ~300MB（INT8 量子化）
- 配置先: `~/.hoshutaro/models/`
- 二回目以降はローカルロード、ネット不要

### 3. データ処理パイプライン

#### フェーズ1：ルール蒸留と初期構造化（Analysis Phase）
- **サンプリング**: 入力データ（Excel/CSV）から代表的な数件を抽出
- **推論処理**: Thinking Mode を有効化し、データ特有の表記揺れや階層構造をモデルに言語化させる
- **記憶**: 推論結果（変換ルール）を SQLite の `rules` テーブルへ保存。この際、ベンチマーク上の **OmniDocBench 1.5 のスコア（0.290）** を考慮し、複雑なテーブル構造の解釈をモデルに繰り返し自己検証させる

#### フェーズ2：高速一括変換（Transformation Phase）
- **キャッシュ利用**: 保存されたルールをシステムプロンプトに注入し、プロンプトキャッシングを有効化
- **実行**: Thinking Mode をオフ、または制限し、10行単位のバッチ処理で高速に JSON 変換を実行
- **コンテキスト制御**: **MRCR v2 (19.1%)** の制約を回避するため、コンテキストには「ルール」と「対象データ」のみを保持し、情報を詰め込みすぎないよう制御する

#### フェーズ3：自律進化（Learning Cycle）
- **データ蓄積**: 変換後の高精度な JSON 出力と元の入力データのペアを SQLite の `training_cache` に蓄積
- **ファインチューニング**: 一定数（例：100件以上）のペアが蓄積された段階で、LoRA を用いた追加学習を実施
- **モデル更新**: ベースモデルに学習済み LoRA アダプターを適用。これにより、以降は複雑なプロンプトや Thinking なしでも、現場特有のルールに従った出力が可能になる

### 4. SQLite スキーマ（指示書）

| テーブル名 | 用途 | 主要カラム |
|---|---|---|
| **rules** | 変換ロジックの保持 | task_type, regex_pattern, instruction_text |
| **master_map** | 機器名称と分類の紐付け | raw_name, standard_name, category_id, location_path |
| **training_cache** | LoRA 学習用データセット | input_text, output_json, confidence_score |

### 5. タスク別実装ガイドライン

| 機能 | 実装アプローチ | E2B の役割 |
|---|---|---|
| **ID 正規化** | ルールベース ＋ Thinking | 表記揺れパターンの発見と正規表現化 |
| **文字変換** | 定型スクリプト ＋ LLM | コンバート処理および例外的な記号の除去 |
| **分類マッピング** | セマンティック抽出 ＋ DB | 機器名称の「意味」を汲み取ったマスター割り当て |
| **階層推測** | ロジカル推論 ＋ DB | 機器名に含まれる「棟・階・エリア」情報の分解 |

詳細:
- **ID 正規化**: Thinking プロセスで正規表現を生成し、SQLite に保存。以降はコードまたは LLM でそのルールを適用
- **ロケーション・分類推論**: 機器名に含まれるキーワードから意味を連想させ、`master_map` にない場合は E2B に推論させる。推論結果は将来の高速化のために**必ず DB へフィードバック**する
- **文字フォーマット**: 全半角、記号除去はベースモデル（E2B）の基本性能で対応可能だが、**アダプター学習によって出力フォーマット（JSON キーの固定など）の安定性を 100% に近づける**

### 6. 運用環境の最適化

- **ハードウェア**: Intel NPU または Arc GPU で OpenVINO を使用して実行
- **オフライン保証**: Project Mu の設計思想に基づき、**すべての推論、DB アクセス、学習処理をローカルネットワーク内で完結させる**

---

## 第2部: 詳細設計

### SQLite テーブル詳細スキーマ

```sql
-- ── 1. rules: 変換ロジックの保持（フェーズ1の成果物） ───────
CREATE TABLE rules (
    id INTEGER PRIMARY KEY,
    task_type TEXT NOT NULL,           -- 'id_normalization' | 'character_conversion' | 'header_pattern' | 'classification_inference' | 'location_hierarchy' 等
    regex_pattern TEXT,                -- 正規表現（コード適用可能なもの）
    instruction_text TEXT,             -- LLM 向け自然言語指示
    organization TEXT,                 -- 組織別境界（マルチテナント対応）
    examples_json TEXT,                -- 例示データ（JSON 配列）
    confidence REAL,                   -- 0.0-1.0
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    source TEXT,                       -- 'distilled' | 'user_added' | 'lora_learned'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
);
CREATE INDEX idx_rules_task ON rules(task_type, active, success_count DESC);

-- ── 2. master_map: 機器名称と分類の紐付け（フェーズ3の蓄積） ─
CREATE TABLE master_map (
    id INTEGER PRIMARY KEY,
    raw_name TEXT NOT NULL,
    standard_name TEXT,
    category_id TEXT,                  -- 分類 ID (Maximo Classification 等)
    location_path TEXT,                -- 階層パス "棟A/3F/エリアB"
    user_confirmed BOOLEAN DEFAULT 0,
    confidence REAL,
    source_file TEXT,
    organization TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_master_map_raw ON master_map(raw_name);
CREATE INDEX idx_master_map_org ON master_map(organization, user_confirmed);

-- ── 3. training_cache: LoRA 学習用データセット ───────────────
CREATE TABLE training_cache (
    id INTEGER PRIMARY KEY,
    task_type TEXT NOT NULL,
    input_text TEXT NOT NULL,
    output_json TEXT NOT NULL,
    confidence_score REAL,
    user_confirmed BOOLEAN DEFAULT 0,
    used_for_training BOOLEAN DEFAULT 0,
    lora_version TEXT,
    organization TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_training_unused ON training_cache(task_type, user_confirmed, used_for_training)
    WHERE user_confirmed = 1 AND used_for_training = 0;

-- ── 4. ベクトル検索インデックス（sqlite-vec、補助） ─────────
CREATE VIRTUAL TABLE master_map_vec USING vec0(
    map_id INTEGER PRIMARY KEY,
    embedding float[384]
);
CREATE VIRTUAL TABLE rules_vec USING vec0(
    rule_id INTEGER PRIMARY KEY,
    embedding float[384]
);

-- ── 5. プロンプトキャッシュメタ ──────────────────────────────
CREATE TABLE prompt_cache_meta (
    cache_key TEXT PRIMARY KEY,
    file_path TEXT,
    model_id TEXT,
    rules_hash TEXT,
    lora_version TEXT,
    created_at TIMESTAMP,
    last_used_at TIMESTAMP,
    hit_count INTEGER
);

-- ── 6. LoRA アダプターメタ（学習層） ────────────────────────
CREATE TABLE lora_adapters (
    version TEXT PRIMARY KEY,
    file_path TEXT,
    base_model TEXT,
    task_types_json TEXT,
    training_examples_count INTEGER,
    metrics_json TEXT,
    organization TEXT,
    active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 補助技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| ベクトル検索拡張 | `sqlite-vec` | 軽量、Tauri に同梱可能 |
| 埋め込みモデル | `intfloat/multilingual-e5-small` (~120MB) | 日本語対応 |
| LoRA トレーニング | PEFT + PyTorch | 業界標準、Intel Arc GPU 対応 |
| LoRA 推論統合 | OpenVINO IR マージ or Adapter 機能 | 環境に応じて選択 |
| プロンプトキャッシュ（OpenVINO） | KV キャッシュをディスク保存 | `~/.hoshutaro/llm_cache/{cache_key}.bin` |

### 3フェーズパイプライン詳細

#### フェーズ1: `mu.distill_rules` Skill
```
入力: ユーザー Excel/CSV から代表的な数件（10-20行）
処理:
  1. Gemma 4 E2B + Thinking Mode 有効化
  2. <|think|> タグで自己分析
  3. 複雑構造は反復自己検証（OmniDocBench 0.290 対策）
  4. regex_pattern と instruction_text を抽出
  5. rules テーブルに INSERT (source='distilled')
  6. instruction_text の埋め込み生成 → rules_vec
出力: rules テーブルへ N件追加
```

#### フェーズ2: `mu.structure_batch` Skill
```
入力: ユーザー Excel/CSV の全行
処理:
  1. sql_context で関連 rules を取得（task_type 別、success_count 降順）
  2. プロンプト構築: 「ルール + 対象データ」のみ（MRCR 19.1% 対策）
  3. プロンプトキャッシュキー指定 → KV キャッシュ復元
  4. Thinking Mode をオフ or 制限
  5. ★ MTP (Multi-Token Prediction) 有効化:
     - target = google/gemma-4-E2B-it
     - drafter = google/gemma-4-E2B-it-assistant
     - Speculative Decoding で各バッチ推論を最大3x高速化
  6. 10行バッチ × N回（MTP + KVキャッシュで2回目以降は更に高速）
  7. 各行に regex_pattern を適用 + LLM で例外処理
出力: 構造化済 JSON、assets/draft_plans に INSERT
```

**MTP の効果（フェーズ2で最大化）**:
- 単発推論時間: ベースライン比 **約 1/3**
- バッチ全体: KVキャッシュヒット併用で **5x 以上の高速化**期待
- 出力品質劣化: なし（Target が drafter 提案を必ず検証するため）

#### フェーズ3: `mu.enrich_and_learn` Skill + Background Job
```
[Skill: mu.enrich_and_learn]
入力: フェーズ2の出力 + 未登録の機器名
処理:
  1. master_map をキー検索
  2. 未登録なら master_map_vec ベクトル検索 TopK
  3. 候補を Gemma 4 E2B に提示し連想推論
  4. ユーザー確認 → master_map に INSERT (user_confirmed=1)
  5. training_cache に (input, output, confidence) を蓄積

[Background Job: mu.lora_train]
トリガー: training_cache に user_confirmed=1 が 100件以上、または手動
処理:
  1. training_cache から未学習データ抽出（used_for_training=0）
  2. PEFT + PyTorch で LoRA ファインチューニング（Intel Arc GPU）
     - rank=8-16, alpha=16-32, target_modules=q_proj/v_proj
     - 1 epoch、所要 15-30分
  3. アダプターを ~/.hoshutaro/lora/{version}.safetensors に保存
  4. lora_adapters テーブルに INSERT、active 切替
  5. Hold-out セットで評価 → metrics_json
  6. ベースモデル + LoRA → OpenVINO IR にマージ
  7. prompt_cache_meta の lora_version 更新（必要に応じ invalidate）
  8. training_cache の used_for_training=1 にマーク
出力: 新 LoRA 適用、現場特有ルールの内在化
```

### Skill DSL（sql_context ラベル）

```markdown
---
id: mu.structure_batch
name: 機器台帳の構造化変換
preferred_model: local_gemma_4_e2b
fallback_models: [cloud_gemini_flash]
prompt_cache_key: structure_batch_v1
sql_context:
  - source: rules
    filter:
      task_type: ['id_normalization', 'character_conversion']
      organization: '$current_org'
      active: true
    order_by: success_count DESC
    limit: 30
    template: rules_for_prompt
required_plugins: [excel-plugin]
required_role: Operator
---

# システムプロンプト

あなたは機器台帳の構造化変換専門家です。以下のルールに基づき、入力行を JSON に変換してください。

## ルール
{{ sql_context.rules }}

## 入力
{{ batch }}

JSON 配列で出力してください。
```

### Knowledge Base UI

`src/components/KnowledgeBase/`:

| 画面 | 内容 |
|---|---|
| KnowledgeBaseDashboard | rules / master_map / training_cache 件数・利用頻度 |
| RuleEditor | rules 手動追加・編集・無効化 |
| MasterMapView | master_map 一覧、信頼度分布 |
| LocationPatternView | location_path 集計 |
| ClassificationPatternView | category_id 別マッピング統計 |
| MappingSimilaritySearch | ベクトル検索で「似た過去マッピング」 |
| LoRAAdapterManager | LoRA 一覧、適用切替、評価指標 |
| TrainingCacheView | 未学習データ件数、手動トレーニング起動 |
| LearningHistoryView | 蒸留・確認・LoRA 学習の履歴 |

### ディレクトリ配置

```
core/app/mu/
├── memory/
│   ├── rules.py
│   ├── master_map.py
│   ├── training_cache.py
│   ├── lora_adapters.py
│   └── vector_search.py        # sqlite-vec
├── pipeline/
│   ├── distillation.py         # フェーズ1
│   ├── transformation.py       # フェーズ2
│   └── enrichment.py           # フェーズ3前半
├── learning/                   # 学習層
│   ├── lora_trainer.py         # PEFT + PyTorch
│   ├── adapter_manager.py
│   ├── model_merger.py         # OpenVINO IR
│   ├── training_scheduler.py   # 100件閾値検出
│   └── evaluator.py            # Hold-out 評価
├── embeddings/
│   └── local_embedder.py       # multilingual-e5-small
├── cache/
│   └── kv_cache_manager.py
└── prompt_templates/           # Jinja2
    ├── rules_for_prompt.j2
    ├── master_map_lookup.j2
    └── thinking_prompt.j2
```

### ベンチマーク目標

| 項目 | ベースライン | MTP有効時 |
|---|---|---|
| フェーズ2 構造化（100行 Excel） | 5秒以内（OpenVINO + KV キャッシュヒット時） | **2秒以内**（MTP + KVキャッシュ併用） |
| フェーズ1 蒸留（20行サンプル） | 30秒以内（Thinking Mode 含む） | 同左（Thinking モード時は MTP 効果限定的） |
| LoRA 学習（100ペア） | 30分以内（Intel Arc GPU） | — |
| LoRA 適用後の精度向上 | Thinking なしで +15% 以上 | — |
| MTP drafter ロードオーバーヘッド | — | <500ms（初回のみ） |
| MTP accept rate（drafter 提案受理率） | — | 70%以上を目標 |

### リスクと対策

| リスク | 対策 |
|---|---|
| sqlite-vec 検索が遅い | ベンチマーク先行、組織別シャーディング |
| Gemma 4 E2B Thinking Mode 実装難度 | OpenVINO サンプル実装ベース、`<\|think\|>` 抽出ロジック先行検証 |
| プロンプトキャッシュ invalidate 誤り | `rules_hash` 計算の単体テスト充実 |
| ローカル埋め込み精度不足 | bge-small-ja 等への切替可能な抽象化 |
| LoRA 学習が GPU なしで遅すぎる | Intel Arc GPU 推奨、なければオプション機能化 |
| LoRA 過学習 | training_cache から Hold-out セット切り出し、評価悪化時は適用しない |
| LoRA + OpenVINO 推論互換性 | Adapter 機能 / モデルマージ両方の動作確認、CPU フォールバック |
| OmniDocBench/MRCR 制約が厳しい | フェーズ2 コンテキスト最小化徹底、フェーズ1 反復自己検証 |
| 完全オフライン保証と Cloud LLM 整合性 | Cloud LLM は Project Mu 範囲外（計画立案など）のみ |
| **MTP drafter とターゲットのバージョン非互換** | drafter は target と同じファミリーを使用（gemma-4-E2B-it ↔ gemma-4-E2B-it-assistant のペア固定）、`registry.py` で `assistant_model_id` を明示 |
| **OpenVINO GenAI の MTP（draft_model）対応バージョン制約** | 着手時に最新 OpenVINO（2026.x）バージョンで動作確認、未対応なら HuggingFace transformers 経由で MTP 実行 + OpenVINO は target のみで運用 |
| **MTP drafter のロードで起動時間が伸びる** | drafter は遅延ロード（フェーズ2の初回呼び出し時）、メインスレッドをブロックしない |
| **MTP accept rate が低くて速度向上が出ない** | プロンプトキャッシュと併用、フェーズ3 LoRA 学習後は target+drafter ペアで再評価 |
| **Thinking Mode と MTP の併用効果が薄い** | Thinking Mode（フェーズ1）では MTP 自動 OFF、フェーズ2/3 では ON とする運用ガイドライン |

---

## 第3部: 実装プラン

詳細な実装プランは [HOSHUTARO 次世代アーキテクチャ実装計画](../../.claude/plans/aws-qwen3-6-35b-deepseek-v4-gemma4-30b-staged-kay.md) Track A を参照。

期間: **6-8週間**

主要マイルストーン:
1. SQLite スキーマ + 4テーブルの CRUD 実装（Week 1-2）
2. sqlite-vec 統合 + ローカル埋め込みモデル統合（Week 2-3）
3. 3フェーズパイプライン実装（Week 3-5）
4. プロンプトキャッシュマネージャ（Week 5）
5. 学習層（LoRA）実装（Week 5-7）
6. Skill DSL の sql_context 解決器（Week 6）
7. Knowledge Base UI 9画面（Week 6-8）
8. ベンチマーク検証（Week 8）
