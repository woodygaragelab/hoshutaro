-- ============================================================================
-- Project Mu — SQLite Schema
-- ============================================================================
-- 詳細仕様: docs/PROJECT_MU.md
--
-- 適用先: ~/.hoshutaro/data.db (Tauri 同梱 PyOxidizer Python から SQLite 接続)
--        または backend 開発時の ローカルファイル
--
-- ベクトル拡張: sqlite-vec (https://github.com/asg017/sqlite-vec)
--   - Tauri リソースとして同梱予定
--   - 起動時に load_extension で読み込む
--
-- マイグレーション: Alembic を使う想定（Track A で seed-up）
-- ============================================================================


-- ── 1. rules: 変換ロジックの保持（フェーズ1の蒸留結果） ─────────────────
CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,           -- 'id_normalization' | 'character_conversion' | 'header_pattern'
                                       -- | 'classification_inference' | 'location_hierarchy' 等
    regex_pattern TEXT,                -- コード適用可能な正規表現
    instruction_text TEXT,             -- LLM 向け自然言語指示
    organization TEXT,                 -- 組織別境界（マルチテナント対応）
    examples_json TEXT,                -- JSON 配列の例示データ
    confidence REAL DEFAULT 0.5,       -- 0.0-1.0
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'distilled',   -- 'distilled' | 'user_added' | 'lora_learned'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rules_task
    ON rules(task_type, active, success_count DESC);

CREATE INDEX IF NOT EXISTS idx_rules_org
    ON rules(organization, active);


-- ── 2. master_map: 機器名⇔分類⇔ロケーション（フェーズ3の蓄積） ──────
CREATE TABLE IF NOT EXISTS master_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_name TEXT NOT NULL,            -- ユーザー入力の生データ
    standard_name TEXT,                -- 正規化後
    category_id TEXT,                  -- 分類 ID (Maximo Classification 等)
    location_path TEXT,                -- 階層パス "棟A/3F/エリアB"
    user_confirmed INTEGER DEFAULT 0,
    confidence REAL,
    source_file TEXT,                  -- 出典 Excel ファイル名
    organization TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_master_map_raw
    ON master_map(raw_name);

CREATE INDEX IF NOT EXISTS idx_master_map_org
    ON master_map(organization, user_confirmed);


-- ── 3. training_cache: LoRA 学習用データセット ────────────────────────
CREATE TABLE IF NOT EXISTS training_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    input_text TEXT NOT NULL,          -- 入力（プロンプト + ユーザーデータ）
    output_json TEXT NOT NULL,         -- 高精度な構造化出力（GroundTruth）
    confidence_score REAL,             -- LLM 自己評価 + ユーザー確認
    user_confirmed INTEGER DEFAULT 0,  -- ユーザー承認済か
    used_for_training INTEGER DEFAULT 0,  -- 学習に使用済みか
    lora_version TEXT,                 -- 紐づく LoRA バージョン
    organization TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 「未学習・ユーザー承認済」を高速に取り出すための部分インデックス
CREATE INDEX IF NOT EXISTS idx_training_unused
    ON training_cache(task_type, user_confirmed, used_for_training)
    WHERE user_confirmed = 1 AND used_for_training = 0;


-- ── 4. lora_adapters: LoRA アダプターのバージョン管理（学習層） ──────
CREATE TABLE IF NOT EXISTS lora_adapters (
    version TEXT PRIMARY KEY,          -- 'v1', 'v2', 'org-foo-v3' 等
    file_path TEXT,                    -- ~/.hoshutaro/lora/{version}.safetensors
    base_model TEXT,                   -- 'gemma-4-e2b'
    task_types_json TEXT,              -- 学習対象タスク種別
    training_examples_count INTEGER,   -- 学習に使った training_cache の count
    metrics_json TEXT,                 -- 学習後の評価指標（Hold-out 精度等）
    organization TEXT,
    active INTEGER DEFAULT 0,          -- 現在適用中か
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lora_active
    ON lora_adapters(active, created_at DESC);


-- ── 5. prompt_cache_meta: KV キャッシュメタ ───────────────────────────
CREATE TABLE IF NOT EXISTS prompt_cache_meta (
    cache_key TEXT PRIMARY KEY,        -- 'id_normalization_v1' 等
    file_path TEXT,                    -- ~/.hoshutaro/llm_cache/{cache_key}.bin
    model_id TEXT,                     -- 'gemma-4-e2b-base' or 'gemma-4-e2b-lora-v3'
    rules_hash TEXT,                   -- 紐づくルール群のハッシュ（invalidate 判定）
    lora_version TEXT,                 -- 適用 LoRA バージョン
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    hit_count INTEGER DEFAULT 0
);


-- ── 6. ベクトル検索インデックス（sqlite-vec、補助） ─────────────────────
-- NOTE: sqlite-vec 拡張がロードされていない環境では VIRTUAL TABLE 作成が失敗する。
--       マイグレーション側で「拡張ロード可否を判定し、未対応なら作成スキップ」する。
--
-- 想定スキーマ（sqlite-vec ロード済の場合のみ実行）:
--   CREATE VIRTUAL TABLE master_map_vec USING vec0(map_id INTEGER PRIMARY KEY, embedding float[384]);
--   CREATE VIRTUAL TABLE rules_vec USING vec0(rule_id INTEGER PRIMARY KEY, embedding float[384]);


-- ── 7. schema_versions: マイグレーション管理 ──────────────────────────
CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT OR IGNORE INTO schema_versions (version, description)
VALUES ('0001_project_mu_initial', 'Project Mu 初期スキーマ: rules / master_map / training_cache / lora_adapters / prompt_cache_meta');
