# バグ修正指示書

レビュー日: 2026-03-25
対象コミット: `8a9fb9b` (main) + 未コミット変更

---

## 🔴 致命的バグ（起動不能・実行時エラー）— 全件修正必須

### 🔴 #1: `backend/app/engine/state.py` — `Optional` 未インポート

**現状:**
```python
from typing import TypedDict, Any

class ColumnMappingDict(TypedDict):
    month: Optional[int]  # ← NameError
```

**修正:**
```python
from typing import TypedDict, Any, Optional
```

---

### 🔴 #2: `backend/app/routers/data.py` — 未インポートシンボル

**現状:**
```python
from app.services.excel_converter import process_excel_file
# ...
initial_state = ExcelImportState(...)           # NameError
final_state = await excel_import_engine.ainvoke(...)  # NameError
```

**修正:**
```python
from app.services.excel_converter import analyze_excel_structure, infer_mapping_with_llm
from app.engine.state import ExcelImportState
from app.engine.agents.excel_import import excel_import_engine
```

---

### 🔴 #3: `backend/app/routers/data.py` — 存在しない関数のインポート

**現状:**
```python
from app.services.excel_converter import process_excel_file
```

**修正:**
`process_excel_file` は `excel_converter.py` に存在しない。🔴 #2 の修正で置換される。
このファイル内で `process_excel_file` を呼び出している箇所があれば、実際に使用する関数（`analyze_excel_structure` 等）に差し替えること。

---

### 🔴 #4: `backend/app/services/skills_optimizer.py` — `json` インポート順序

**現状:**
```python
# 63行目
lines.append(f"trigger: {json.dumps(skill.triggers, ensure_ascii=False)}")
# ...
# 75行目（ファイル末尾）
import json  # for dumps in update
```

**修正:** `import json` をファイル先頭に移動する。
```python
import logging
import os
import json          # ← ここに移動
from typing import Dict, Any
```
75行目の `import json # for dumps in update` は削除。

---

### 🔴 #5: `backend/app/engine/agents/__init__.py` — ファイル欠落

**現状:** `backend/app/engine/agents/` ディレクトリに `__init__.py` が存在しない。

**修正:** 空ファイルを作成する。
```bash
touch backend/app/engine/agents/__init__.py
```

---

### 🔴 #6: `backend/app/engine/graph.py` — `execute_engine` の新フィールド初期化漏れ

**現状 (L82-93):**
```python
initial_state = AgentState(
    session_id=session_id,
    messages=messages,
    data_context=data_context,
    current_skill="",
    next_node="",
    operations=[],
    final_response=""
    # thinking_iterations, error_message が欠落
)
```

**修正:**
```python
initial_state = AgentState(
    session_id=session_id,
    messages=messages,
    data_context=data_context,
    current_skill="",
    next_node="",
    operations=[],
    final_response="",
    thinking_iterations=1,
    error_message=""
)
```

---

## 🟡 設計上の問題 — 機能不全の原因

### 🟡 #1: `backend/app/llm/base.py` — `chat()` メソッドが未定義

**呼び出し元:** `planning_engine.py` L86
```python
response = await adapter.chat(messages)
```

**問題:** `LLMAdapter` 基底クラスに `chat()` 抽象メソッドがなく、`OpenAICompatAdapter` にも実装がない。呼び出すと `AttributeError`。

**修正 (A案 — 基底クラスに追加):**

`backend/app/llm/base.py` に追加:
```python
@abstractmethod
async def chat(self, messages: list[dict]) -> str:
    """
    非ストリーミングのチャット補完。テキスト文字列を返す。
    """
```

`backend/app/llm/openai_compat.py` に実装を追加:
```python
async def chat(self, messages: list[dict]) -> str:
    completion = await self._client.chat.completions.create(
        model=self.model,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )
    return completion.choices[0].message.content or ""
```

---

### 🟡 #2: `backend/app/services/excel_converter.py` — `chat_structured` 戻り型不一致

**現状 (L75-76):**
```python
analysis: ExcelAnalysisResult = await adapter.chat_structured(messages, context={})
return analysis
```

**問題:** `chat_structured()` は `MaintenanceOperation` を返す。`ExcelAnalysisResult` とはスキーマが全く異なるため、代入後のフィールドアクセスで全て失敗する。

**修正方針:**
`infer_mapping_with_llm()` では `chat_structured()` を使わず、`chat()` または `generate_text()` で JSON を取得し、手動で `ExcelAnalysisResult` にパースする。

```python
async def infer_mapping_with_llm(filename: str, preview_data: list[list[str]]) -> ExcelAnalysisResult:
    adapter = get_llm_adapter()
    if not adapter:
        raise Exception("LLM adapter not initialized")

    system_prompt = (
        "あなたは保全システムのデータ取込みアシスタントです。"
        "提供されるExcelの冒頭15行のテキスト配列から、ヘッダー行(header_row_index)を特定し、"
        "各列がDataModelのどのフィールドに該当するか推論してください。\n"
        "【主要フィールド】AssetId, WorkOrderName, PlanCost, ActualCost\n"
        "※星取表（4月、5月...等の列）の場合は、列ごとに 'is_date': true, 'month': N 等を出力。\n"
        "タイトル行等の不要行はヘッダーではないことに注意。\n\n"
        "必ず以下のJSON形式のみを出力してください:\n"
        '{"header_row_index": <int>, "summary": "<str>", "mappings": [{"col_index": <int>, "field_name": "<str>", "is_date": <bool>, "month": <int|null>}, ...]}'
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Filename: {filename}\nPreview Data:\n{preview_data}"}
    ]

    from app.llm.json_utils import extract_json_object
    raw_text = await adapter.generate_text(
        prompt=f"{system_prompt}\n\nFilename: {filename}\nPreview Data:\n{preview_data}",
        max_tokens=1024
    )
    data = extract_json_object(raw_text)
    return ExcelAnalysisResult(**data)
```

---

### 🟡 #3: `backend/app/engine/orchestrator.py` — ExcelImport ルートが結果を返さない

**現状 (L28):**
```python
return {"agent": "ExcelImportAgent", "status": "routed"}
```

**問題:** `chat.py` L69 で `result.get("result", "")` を参照するが、`result` キーがない。Excel ルート時にユーザーへの応答が空になる。

**修正:**
```python
return {
    "agent": "ExcelImportAgent",
    "status": "routed",
    "result": "Excelインポートの準備が完了しました。データルーターから処理されます。",
    "operations": []
}
```

---

### 🟡 #4: `backend/app/engine/agents/excel_import.py` — グラフ再実行時のルーティング問題

**現状:**
`chat.py` で `session.import_state["status"] = "process_chunks"` に設定してから `excel_import_engine.ainvoke(session.import_state)` を呼ぶが、エントリーポイントは `parse` ノード。つまり再度 Phase 1-2 の構造解析が実行されてしまう。

**修正方針:**
チャンク処理の再実行時は `excel_import_engine` を呼ばず、`chunk_process_excel()` を直接呼ぶ。

`backend/app/routers/chat.py` の該当部分を修正:
```python
if hasattr(session, "import_state") and session.import_state and session.import_state.get("status") == "waiting_user":
    yield {"data": json.dumps({"type": "text_delta", "delta": "Excelインポートを開始します...\n"})}

    from app.services.excel_converter import chunk_process_excel
    result = chunk_process_excel(
        session.import_state["file_bytes"],
        {
            "header_row_index": session.import_state["header_row_index"],
            "mappings": session.import_state["mappings"],
            "symbol_mapping": session.import_state.get("symbol_mapping", {})
        },
        chunk_size=10000,
        start_row=session.import_state.get("processed_rows", 0)
    )

    extracted = result.get("extracted_data", [])
    # ... 以降は既存ロジックと同じ
```

---

### 🟡 #5: `backend/skills/SKILLS.md` — フォーマットが `skill_loader.py` と不一致

**現状の SKILLS.md:**
```markdown
## available_skills
- name: generic_chat
  description: ...
```

**`skill_loader.py` が期待するフォーマット:**
```markdown
## skill: generic_chat
description: 一般的な保全や設備に関する質問に応答する
trigger: ["保全", "設備", "質問"]
context: |
  保全のベストプラクティスに基づき、専門的かつ分かりやすい回答を提供する。
```

**修正:** `SKILLS.md` をプラン仕様のフォーマットに書き換える。

```markdown
# HOSHUTARO AI Agent Skills

## skill: generic_chat
description: 一般的な保全や設備に関する質問に応答する
trigger: ["保全", "設備", "質問", "教えて"]
context: |
  保全のベストプラクティスに基づき、専門的かつ分かりやすい回答を提供する。

## skill: future_planning_asset
description: 特定の設備（Asset）に対する将来の保全計画を予測・作成する
trigger: ["計画", "予測", "次回", "設備", "機器"]
context: |
  DataModelから対象Assetの過去のWorkOrderLine実績を抽出し、
  実施間隔の平均やばらつきを元に次回の計画日を予測する。

## skill: future_planning_wo
description: 特定の作業（WorkOrder）に対する将来の保全計画を予測・作成する
trigger: ["作業計画", "スケジュール", "定期点検"]
context: |
  指定されたWorkOrderの過去の実施間隔を分析し、次回計画を立案する。

## skill: excel_import
description: Excelファイルから星取表データ(DataModel v3.0.0)への変換
trigger: ["Excel", "インポート", "取り込み", "アップロード"]
context: |
  Excelヘッダーを分析し、Asset/WorkOrder/WorkOrderLineにマッピング。
  設備ID列→Asset.id, 作業名→WorkOrder.name,
  日付→WorkOrderLine.PlanScheduleStart/End,
  計画/実績→Planned/Actual フラグ

## skill: schedule_optimization
description: 星取表全体のスケジュール最適化
trigger: ["最適化", "コスト削減", "平準化"]
context: |
  全Assetの保全計画を分析し、コスト平準化と作業効率の最適化を提案する。

## skill: data_analysis
description: 保全データの統計分析・レポート
trigger: ["分析", "統計", "集計", "レポート"]
context: |
  DataModelの保全履歴を分析し、統計レポートを生成する。
```

---

### 🟡 #6: `backend/app/engine/graph.py` — `skill_thinking_depth` の適用ロジック未実装

**現状:** `reasoning_node` は `thinking_iterations` を state 内部でインクリメントするのみ。セッションの `metadata.skill_thinking_depth` を読み出して初期値に反映する処理がない。

**修正方針:**
`orchestrator.py` の各エージェント初期化時に、セッションの `skill_thinking_depth` から初期値を設定する。

```python
session = session_manager.get_session(session_id)
depth = session.metadata.get("skill_thinking_depth", {}).get(skill_name, 1)
# → initial_state に thinking_iterations=depth として渡す
```

また、エンジン実行完了後にフィードバックを保存する:
```python
final_iters = final_state.get("thinking_iterations", 1)
if final_state.get("error_message"):
    session.metadata["skill_thinking_depth"][skill_name] = min(5, depth + 1)
elif final_iters == 2:  # 初回成功
    session.metadata["skill_thinking_depth"][skill_name] = max(1, depth - 0.5)
```

---

### 🟡 #7: `backend/app/services/excel_converter.py` L129 — 年のハードコード

**現状:**
```python
copied["PlanScheduleStart"] = f"2025-{month:02d}-01"
```

**修正:**
年コンテキストを引数で受け取るか、`analysis_dict` に含める。

```python
year = analysis_dict.get("year_context", datetime.now().year)
# ...
copied["PlanScheduleStart"] = f"{year}-{month:02d}-01"
```

---

## 🟢 軽微・改善推奨

### 🟢 #1: `excel_converter.py` L63 — タイポ
```
"データ取替アシスタント" → "データ取込みアシスタント"
```

### 🟢 #2: `chat.py` L38-58 — スレッドセーフティ
`session.import_state` の直接変異は、同時リクエスト時に競合の可能性。将来的に `asyncio.Lock` を検討。

### 🟢 #3: `schedule_planner.py` L122 — 型不一致の潜在リスク
`tool_execution_node` は `AgentState` 型を前提としているが `PlannerState` で呼ばれる。フィールド互換があれば動作するが、明示的に `PlannerState` 用の tool ノードを定義するのが安全。

### 🟢 #4: `planning_engine.py` L17 — 型ヒント不正確
```python
def parse_date(date_str: str) -> datetime:  # None を返す可能性あり
```
修正: `-> Optional[datetime]`

---

## 修正優先順位

| 順位 | ID | 種別 | 影響 |
|------|----|------|------|
| 1 | 🔴 #5 | `__init__.py` 欠落 | import 不能 → 全機能停止 |
| 2 | 🔴 #1 | `Optional` 未インポート | import 不能 → 全機能停止 |
| 3 | 🔴 #2, #3 | `data.py` インポートエラー | Excel エンドポイント停止 |
| 4 | 🔴 #4 | `json` インポート順序 | Skills最適化で実行時エラー |
| 5 | 🔴 #6 | フィールド初期化漏れ | リトライ機構が未定義動作 |
| 6 | 🟡 #5 | SKILLS.md フォーマット | スキルマッチが完全に機能しない |
| 7 | 🟡 #1 | `chat()` 未定義 | 将来計画生成で AttributeError |
| 8 | 🟡 #2 | 戻り型不一致 | Excel LLM マッピングが機能しない |
| 9 | 🟡 #3 | 結果キー欠落 | Excel 応答が空文字 |
| 10 | 🟡 #4 | グラフ再実行問題 | チャンク処理で再解析される |
| 11 | 🟡 #7 | 年ハードコード | 2026年以降のデータが不正 |
| 12 | 🟡 #6 | 思考深度未適用 | 自律最適化が機能しない |
