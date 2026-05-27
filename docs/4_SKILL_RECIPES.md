# 4. Skill (ワークフロー) の作り方

保守太郎の最大の特長は、**「プラグイン機能をAI（Gemini）が自律的に使いこなし、ユーザーの指示を達成する」** という点です。
あなたが MCP Server で便利なTool（例: `fetch_assets` や `send_email` など）を作っても、ユーザーがチャットからそれを意図した通りに実行してもらうには、AIへの「手順書」が必要です。

これが **Skill** です。

---

## Skill とは？

Skill は単なる YAML ファイルです。
「この業務をするときは、この順番で、このToolを使いなさい」というAIへのプロンプトと、ユーザーに前もって入力させる設定画面を定義します。

保守太郎のフロントエンドにある「スキル実行ボタン」を押すと、この YAML が読み込まれ、AIが自動操縦を始めます。

---

## Skill YAML の基本フォーマット

プラグイン開発者は、自分のプラグインに便利な Skill YAML ファイルをいくつか同梱して提供することが推奨されます。

```yaml
name: "Maximo 一括インポート"
id: "my_plugin.maximo_import"
version: "1.0.0"
type: "user"                # "builtin" は本体付属専用のため、プラグイン作成時は "user"
description: "外部システムから新規登録された機器を保守太郎にインポートします。"
icon: "download"            # 表示アイコン指定 (download, sync, chart, search など)

# ── LLM 選択（推奨、未指定時はシステムデフォルト）──
preferred_model: "local_gemma_4_e2b"          # 第一選択（モデル名は core/llm/registry.py の LLM_MODELS のキー）
fallback_models:                               # 第一選択不可時の候補（順番に試される）
  - "cloud_gemini_pro"
  - "gemini"

# ── アクセス制御（推奨）──
required_role: "Manager"                       # Admin | Manager | Operator | ReadOnly

# ── プロンプトキャッシュキー（オプション、Project Mu 用）──
prompt_cache_key: "maximo_import_v1"           # 同一キーは KV キャッシュを再利用、ルール変更で invalidate

# ── MTP (Multi-Token Prediction) 制御（オプション）──
# 対応モデル（local_gemma_4_e2b_it 等）はデフォルト ON。Skill で明示的に無効化したい場合のみ false。
# Thinking Mode を使うフェーズ1（ルール蒸留）では MTP 効果が出にくいため明示的に false 推奨。
mtp_enabled: true

# このSkillを実行するために最低限起動していなければならない Plugin
required_plugins:
  - "maximo-plugin"
# 旧名 required_servers でも当面動作（後方互換）
required_servers:
  - type: "maximo-connector"

# ユーザーに実行前に入力させる画面の定義
parameters:
  - name: "target_site"
    label: "対象サイト (Site ID)"
    type: "text"
    default: "SKK"
    required: true

  - name: "max_count"
    label: "最大取得件数"
    type: "number"
    default: 1000

# ── KASE / Project Mu 連携（オプション、SQLite長期メモリの参照）──
# Skill 実行時、ここで宣言したクエリ結果を system_prompt の {{ sql_context.* }} に注入する
sql_context:
  - source: "rules"                            # backend/app/mu/memory/schema.sql の rules テーブル
    filter:
      task_type: "id_normalization"
      organization: "$current_org"             # ランタイム変数
      active: 1
    order_by: "success_count DESC"
    limit: 20
    template: "rules_for_prompt"               # backend/app/mu/prompt_templates/ 内の Jinja2 テンプレート

# ここが AI への司令塔（システムプロンプト）
system_prompt: |
  あなたは保守太郎のデータインポートアシスタントです。
  以下の手順に従って、外部システムから保守太郎のデータベースへデータを取り込んでください。

  ## 既知の正規化ルール
  {{ sql_context.rules }}

  ## 手順
  1. プラグインの `test_connection` ツールを呼んで通信できるか確認する。
  2. `fetch_assets` ツールを `{target_site}` の条件で呼び出す。（上限は {max_count} 件）
  3. 保守太郎の組み込みツールである `datastore.import_records` を呼び出して保存する。
  4. 最終的な取得結果の件数とサマリーをユーザーに日本語で簡潔に報告する。

# 安全対策（データの書き込み前などにストップをかける）
safety:
  requires_confirmation: true   # 実行開始前に必ずブラウザのポップアップ「実行してよいですか？」を出す
  backup_before_write: true     # 本体のデータベースへ書き込む前に自動バックアップをとる
```

---

## パラメータとプロンプトの連動

上記の例でユーザーがUIから `target_site` に "TOK" と入力した場合、`system_prompt` に書かれている `{target_site}` という部分が自動で "TOK" に置換されてからAIに送信されます。

### サポートされている parameters の type
- `text` : 通常の文字列
- `number` : 数値
- `boolean` : チェックボックス（True/False）
- `select` : ドロップダウンリスト（YAML内で `options: ["A", "B"]` と追記が必要）
- `multi_select` : 複数選択可能なチェックボックス

---

## プラグイン同梱の推奨

自身の作成した `your_skill.yaml` などのスキルファイルは、プラグイン公開時のZIPファイル内に **`skills/`** という名前のフォルダを作成し、その中に配置して同梱することを強く推奨します。

保守太郎の仕様として、ユーザーがプラグインをZIPインストール（またはGitHub経由でインストール）した際、プラグインフォルダ直下に `skills/` ディレクトリが存在すると、**そこに含まれるすべてのYAMLファイルを自動的に読み込み、「スキル」として登録**します。これにより、ユーザーはインストール直後から即座にプラグインの機能をフル活用できるようになります。

---

## 新フィールド一覧（後方互換、未指定時はデフォルト動作）

| フィールド | 用途 | デフォルト |
|---|---|---|
| `preferred_model` | LLM 選択の第一候補（`core/llm/registry.py` の LLM_MODELS のキー） | システムデフォルト（settings.llm_adapter または "gemini"） |
| `fallback_models` | 第一選択不可時の代替リスト（順番に試される） | `[]` |
| `required_role` | 実行に必要な RBAC ロール | 制限なし |
| `prompt_cache_key` | Project Mu のプロンプトキャッシュキー（KV キャッシュ再利用） | キャッシュ無効 |
| `mtp_enabled` | MTP (Multi-Token Prediction) の有効化（対応モデルのみ意味あり） | モデル設定の `mtp_default_enabled` に従う（target モデルは true） |
| `required_plugins` | 必要 Plugin（`required_servers` の新名、両方サポート） | `[]` |
| `sql_context` | KASE/Project Mu の SQLite 長期メモリ参照ルール | なし |

LLM 選択ロジックの詳細は [CONCEPTS.md](CONCEPTS.md) と `core/llm/registry.py:resolve()` を参照。

---

## sql_context の使い方（KASE / Project Mu 連携）

`sql_context` は Project Mu の長期メモリ（rules / master_map / training_cache 等）から、関連レコードを LLM プロンプトに動的注入する仕組み。

### 基本構造

```yaml
sql_context:
  - source: "rules"                  # 参照テーブル名（schema.sql 参照）
    filter:                           # WHERE 条件（変数展開対応）
      task_type: "id_normalization"
      organization: "$current_org"    # ランタイム変数
      active: 1
    order_by: "success_count DESC"
    limit: 20
    template: "rules_for_prompt"      # backend/app/mu/prompt_templates/<name>.j2 の Jinja2 テンプレート
```

### 利用可能 source

| source | 用途 |
|---|---|
| `rules` | 変換ルール（id_normalization / character_conversion / header_pattern 等） |
| `master_map` | 機器名⇔分類⇔ロケーションの確定マッピング（キー検索） |
| `master_map_vec` | ベクトル検索（`similar_to: $input.sample_text` で意味近傍取得） |
| `rules_vec` | ルール説明文のベクトル検索 |

### ランタイム変数

- `$current_org`: 現在のユーザーの organization
- `$current_user`: 現在のユーザー ID
- `$input.<key>`: Skill 実行時の入力データ（パラメータ・バッチ等）

### system_prompt への展開

`sql_context` の各エントリは、Skill 実行時に解決されて `{{ sql_context.<source> }}` で参照可能になる:

```yaml
sql_context:
  - source: "rules"
    template: "rules_for_prompt"
  - source: "master_map_vec"
    similar_to: "$input.sample_text"
    template: "similar_mappings"

system_prompt: |
  ## 既知のルール
  {{ sql_context.rules }}

  ## 似た過去マッピング
  {{ sql_context.master_map_vec }}

  ## 入力
  {{ batch }}
```

詳細は [PROJECT_MU.md](PROJECT_MU.md) と `core/skills/sql_context_resolver.py`（Track A で実装予定）を参照。

---

---

## MTP (Multi-Token Prediction) の使い分け

Project Mu の推論層は **target + drafter（assistant）** のペアで動作し、Speculative Decoding により最大 **3x 高速化**します（[CONCEPTS.md](CONCEPTS.md) の「Target / Drafter / Assistant Model」参照）。

### Skill ごとの推奨設定

| ユースケース | preferred_model | mtp_enabled | 根拠 |
|---|---|---|---|
| **フェーズ1（ルール蒸留、Thinking）** | `local_gemma_4_e2b_it` | **`false`**（明示OFF） | Thinking Mode は思考プロセスが分岐するため MTP の accept rate が低く効果限定的。Off にして安定動作優先 |
| **フェーズ2（高速一括変換）** | `local_gemma_4_e2b_it` | `true`（デフォルト） | 出力フォーマットが安定し drafter 提案が当たりやすい。**MTP の効果が最大化** |
| **フェーズ3（意味補完・連想推論）** | `local_gemma_4_e2b_it` | `true`（デフォルト） | 同上、ただし create rate は中程度 |
| **対話チャット（converse）** | `local_gemma_4_e2b_it` | `true`（デフォルト） | レスポンス感重視 |
| **クラウド計画立案** | `cloud_gemini_pro` | （該当なし） | クラウド側はサーバ側が適切に最適化 |

### 例: フェーズ1 用 Skill（MTP 無効化）

```yaml
id: "mu.distill_rules"
preferred_model: "local_gemma_4_e2b_it"
mtp_enabled: false               # Thinking Mode 用に明示的に MTP OFF
prompt_cache_key: null           # フェーズ1はルール蒸留前なのでキャッシュ無効
```

### 例: フェーズ2 用 Skill（MTP 有効、デフォルト動作）

```yaml
id: "mu.structure_batch"
preferred_model: "local_gemma_4_e2b_it"
# mtp_enabled は省略可（target は default ON）
prompt_cache_key: "structure_batch_v1"
```

---

## Markdown Skill 形式（推奨、新形式）

YAML 形式に加え、**Markdown 形式の Skill**（`*.skill.md`）もサポート予定（Track C で実装）。frontmatter（YAML ヘッダー）に上記フィールドを書き、本文をシステムプロンプトとして使う。

```markdown
---
id: mu.distill_rules
name: 機器台帳ルール蒸留
preferred_model: local_gemma_4_e2b
fallback_models: [cloud_gemini_pro]
prompt_cache_key: distill_rules_v1
required_plugins: [excel-plugin]
required_role: Operator
sql_context: []                 # フェーズ1は既存ルール参照なし
---

あなたは機器台帳の構造解析専門家です。

サンプリングされた行データから、ID命名規則・表記揺れ・階層構造を分析し、
正規化ルール（regex_pattern と instruction_text）を JSON で返してください。

Thinking Mode を活用し、複雑な構造は反復自己検証してください。
（OmniDocBench 1.5 スコア 0.290 を考慮）

## 入力
{{ sample_rows }}

## 出力フォーマット
... (省略)
```

Markdown Skill のメリット:
- 業務担当者がファイル1つで全完結（YAML + 本文を分離せずに済む）
- Git diff が読みやすい
- `prompt_cache_key` 等の付与が容易
- hot reload 対応（ファイル mtime 監視）
