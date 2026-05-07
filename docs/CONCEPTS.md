# HOSHUTARO 用語の正式定義

> このドキュメントは HOSHUTARO プロジェクトの**公式用語集**。実装・ドキュメント・会話で使う言葉はここに定義されたものを使う。混乱した場合はここに戻る。

---

## ユーザー・運用者から見える用語（2つだけ）

ユーザー・業務担当者・運用者の世界では、以下 **2つの概念**だけが存在する。

### Plugin（プラグイン）

**拡張機能の唯一の総称**。`manifest.json` + 実装コードで配布される独立した拡張モジュール。

- **配置**: 外部配布は `plugins/<plugin-id>/`、内蔵は `core/connectors/` または `core/llm/adapters/`
- **触る人**: プラグイン開発者・運用者
- **内部分類は manifest.json の `category` フィールド** で表現:
  - `llm` — LLM 接続（例: openvino-gemma4-plugin、cloud-llm-plugin）
  - `connector` — 外部システム接続（例: maximo-plugin、excel-plugin）
  - `utility` — 汎用機能（例: pdf-plugin）

→ **対外的にはすべて「Plugin」と呼ぶ**。「Connector」「LLM Adapter」は内部実装パターン名であり、ユーザー文書では使わない。

### Skill（スキル）

**ユーザーが定義するタスクの手順・ルール**。LLM選択（preferred_model）と SQL 参照（sql_context）も内包する。

- **配置**: `core/skills/definitions/`
- **触る人**: 業務担当者・PM
- **2形式**:
  - **Markdown Skill** — 自然言語の手順書、LLM が解釈実行（宣言的）。`definitions/markdown/*.skill.md`
  - **Script Skill** — Python コードでの実装、決定的処理（命令的）。`definitions/scripts/*.py`

---

## 実装詳細（コア開発者のみが意識）

以下は内部実装パターン名・プロトコル名。エンドユーザーや運用者の世界には登場しない。

### MCP（Model Context Protocol）

Plugin と HOSHUTARO コアが話す**通信プロトコル**仕様（JSON-RPC over stdio / sidecar）。Anthropic 標準を採用しているため、外部の MCP ツール（GitHub MCP、Slack MCP 等）もそのまま使える。

### Orchestrator

Skill を実行するエンジン（LangGraph ベース）。Skill 定義の `preferred_model` を読んで適切な LLM Plugin を呼ぶ。**ユーザーは存在を意識しない**。

### Agent

LangGraph で動く **ReAct ループの実装パターン名**（推論 → ツール実行 → 反復）。特定の Skill タイプで使う。

### Adapter

LLM Plugin の**実装パターン名**（Strategy パターン）。

⚠️ **重要**: 過去に `dataModelAdapter.ts`（UI データ変換）と LLM Adapter が同名で衝突していた。前者は `dataModelMapper.ts` にリネーム済み。今後 UI/データ変換系には Mapper / Converter / Transformer を使い、Adapter は LLM 接続にのみ使う。

### Target Model / Drafter Model / Assistant Model（MTP 用語）

**MTP (Multi-Token Prediction) / Speculative Decoding** の構成要素:

| 用語 | 役割 | HuggingFace API での名称 |
|---|---|---|
| **Target Model** | 本格推論を担う主モデル。出力品質を保証する | `model` |
| **Drafter Model** | 複数トークンを並列予測する軽量モデル（4-layer 等） | `assistant_model` |
| **Assistant Model** | Drafter Model の別名。HF API で使われる呼称 | `assistant_model` |

> Drafter の提案を Target が 1 パスで検証することで、出力品質を維持しつつ最大 3x の推論高速化を実現する。

**HOSHUTARO での実装**: `core/llm/registry.py` の `LLM_MODELS` で
- target エントリは `role: "target"`、`assistant_model_id` で対応する drafter を参照
- drafter エントリは `role: "drafter"`、`drafter_only: true` で単体選択不可

例: `local_gemma_4_e2b_it`（target）+ `local_gemma_4_e2b_it_assistant`（drafter）のペア。`OpenVinoGemmaAdapter(spec, assistant_spec)` でロードされ、`assistant_spec` が None でなければ MTP が有効化される。

### KASE / Project Mu

**KASE (Knowledge-Augmented Skill Engine)** または別名 **Project Mu**: SQLite 長期メモリ + 3層構造（推論・記憶・学習）+ プロンプトキャッシュを統合する HOSHUTARO の中核エンジン。詳細は [PROJECT_MU.md](PROJECT_MU.md)。

### LLM 選択ロジック

`core/llm/registry.py:resolve()` 関数で完結。Skill 定義の `preferred_model` と `fallback_models` を環境変数 `APP_MODE` に応じて解決する。

> 「MoE Router」のような独立コンポーネントは作らない（YAGNI）。

---

## 廃止された用語（使わない）

| 廃止用語 | 代替 | 理由 |
|---|---|---|
| 「プラグ」（口語） | Plugin | 不正式 |
| 「コネクタ」（口語、対外） | Plugin (category=connector) | カテゴリ名は内部のみ |
| 「LLM Adapter」（対外） | Plugin (category=llm) | 同上 |
| 「MoE Router」 | Skill 定義の `preferred_model` + `fallback_models` | YAGNI、独立コンポーネント不要 |
| `engine/` ディレクトリ | `orchestration/` | Orchestrator/Agent を含むため明示的命名 |
| `services/` ディレクトリ | ドメイン別に分解（`core/llm/`, `core/skills/`, etc） | レイヤー軸でなくドメイン軸 |

---

## 概念マップ（ユーザー目線）

```
┌─────── ユーザー・運用者から見える層（2つだけ）───────┐
│                                                      │
│   Skill (タスク手順、preferred_model 含む)           │
│    │                                                 │
│    ├─ 必要な Plugin を呼ぶ                           │
│    ▼                                                 │
│   Plugin                                             │
│    ├─ category=llm        (例: sagemaker-plugin)    │
│    ├─ category=connector  (例: maximo-plugin)       │
│    └─ category=utility    (例: pdf-plugin)          │
│                                                      │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────── 実装詳細（裏方、開発者のみ意識）──────────────┐
│   Orchestrator: Skill を実行                         │
│   LLM Registry: preferred_model 解決                 │
│   MCP プロトコル: Plugin と通信                      │
│   Adapter / Agent: 実装パターン名                    │
│   KASE / Project Mu: SQLite長期メモリ + LoRA学習    │
└──────────────────────────────────────────────────────┘
```

---

## 改修ガイドライン

新しい機能を追加・既存コードを修正する時の指針:

1. **対外文書（README、エラーメッセージ、UI）には「Plugin」と「Skill」のみ使う**
2. **内部コード・コメントでは正確な実装パターン名（Connector/LLM Adapter/Agent/Orchestrator）を使ってよい**
3. **新規ディレクトリ命名は `core/<domain>/` で揃える**（services/ には新規追加しない）
4. **新規 Adapter 系のクラス名は明確に**:
   - LLM 接続 → `<Provider>LLMAdapter`
   - UI/データ変換 → `<Source>To<Target>Mapper`
5. **「これはユーザーから見える概念か？」を常に問う**。Yes なら Plugin/Skill のどちらかに帰着させる
