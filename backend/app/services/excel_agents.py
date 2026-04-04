import asyncio
import logging
from typing import Optional
from app.llm.factory import get_llm_adapter
from app.llm.json_utils import extract_json_object, extract_json_array
from app.services.excel_types import PhysicalGrid, StructureInfo, ColumnDescriptor

logger = logging.getLogger(__name__)

def _get_title_injection(grid: PhysicalGrid) -> str:
    """常にシートの先頭3行を抽出してコンテキストとする（Title Injection）"""
    title_lines = []
    for i in range(min(3, grid.total_rows)):
        display_row = grid.rows[i][:15] if i < len(grid.rows) else []
        compact = [c if c else "_" for c in display_row]
        title_lines.append(f"TopTitle Row{i}: {compact}")
    return "\n".join(title_lines)

# ═══════════════════════════════════════════════════════════════
# フェーズ1-A: 探索エージェント
# ═══════════════════════════════════════════════════════════════

PHASE1A_SYSTEM_PROMPT = """Excel構造解析の探索エキスパートです。
与えられたデータチャンクの中に、「ヘッダー行（各種列のタイトルが横に並んでいる行）」が含まれているかを探してください。
また、このシート自体がヘッダーを持たない無意味なシートだと判断した場合は探索を停止できます。"""

PHASE1A_SCHEMA = {
    "type": "object",
    "properties": {
        "thought_process": {
            "type": "string",
            "description": "どこからどこまでがヘッダーか、実データがどこから始まるかを簡潔に考察する(最大50文字)"
        },
        "action": {
            "type": "string",
            "enum": ["continue", "stop", "found"],
            "description": "found:ヘッダー発見, continue:さらに下を探す, stop:データ表ではない"
        },
        "header_start": {"type": "integer"},
        "header_end": {"type": "integer"},
        "data_start": {"type": "integer"},
        "blank_row_strategy": {"type": "string", "enum": ["skip"]},
        "key_column": {"type": "integer"},
        "forward_fill_columns": {
            "type": "array",
            "items": {"type": "integer"}
        }
    },
    "required": ["thought_process", "action"]
}

async def run_phase1a_search(grid: PhysicalGrid, filename: str) -> Optional[dict]:
    adapter = get_llm_adapter(wait_timeout=30.0)
    if not adapter:
        return None
        
    chunk_size = 15
    max_loops = 6  # 無限ループ防止
    title_injection = _get_title_injection(grid)
    
    # Pythonコードによるバリデーション（Self-Correction用）
    def validate_p1a(data: dict, start_r: int, end_r: int) -> tuple[bool, str]:
        if data.get("action") == "found":
            hs = data.get("header_start", 0)
            ds = data.get("data_start", 1)
            if not (start_r <= hs < end_r):
                return False, f"header_start ({hs}) は現在のチャンク範囲外です。"
            if hs >= ds:
                return False, f"header_start ({hs}) が data_start ({ds}) より下になっています。データはヘッダーの下にある必要があります。"
            row_vals = [c.strip() for c in grid.rows[hs] if c.strip()]
            if not row_vals:
                return False, f"指定された header_start ({hs}) の行は完全に空白です。空白行をヘッダーにはできません。"
        return True, ""

    for loop_idx in range(max_loops):
        start_row = loop_idx * 10
        if start_row >= grid.total_rows:
            break
            
        end_row = min(start_row + chunk_size, grid.total_rows)
        chunk_lines = []
        for i in range(start_row, end_row):
            display_row = grid.rows[i][:15] if i < len(grid.rows) else []
            chunk_lines.append(f"Row{i}: {[c if c else '_' for c in display_row]}")
        chunk_text = "\n".join(chunk_lines)
        
        user_text = f"ファイル名: {filename}\nシート名: {grid.sheet_name}\n"
        user_text += f"<context_injection>\n{title_injection}\n</context_injection>\n\n"
        user_text += f"<current_chunk start='{start_row}' end='{end_row-1}'>\n{chunk_text}\n</current_chunk>"
        
        logger.info("[P1-A] 探索エージェント: Chunk %d (Rows %d-%d)", loop_idx+1, start_row, end_row-1)
        
        # 自己修正ループ (最大2回)
        max_retries = 2
        error_msg = ""
        for retry in range(max_retries):
            prompt = user_text
            if error_msg:
                prompt += f"\n\n【エラー修正依頼】前回のあなたの出力は以下の理由で棄却されました。間違いを修正して出し直してください。\n理由: {error_msg}"
                
            raw_text = await adapter.generate_structured(
                system_prompt=PHASE1A_SYSTEM_PROMPT,
                user_prompt=prompt,
                json_schema=PHASE1A_SCHEMA,
                retries=1,
            )
            data = extract_json_object(raw_text)
            if not data:
                error_msg = "JSONを出力してください"
                continue
                
            action = data.get("action", "continue")
            if action == "stop":
                logger.info("[P1-A] エージェントが自律的に探索を破棄しました。")
                return {"is_target_sheet": False}
            elif action == "continue":
                break # 次のチャンクへ
            elif action == "found":
                ok, err = validate_p1a(data, start_row, end_row)
                if ok:
                    logger.info("[P1-A] 探索成功！ header_start=%d", data.get("header_start"))
                    return data
                else:
                    logger.warning("[P1-A] Self-Correction発動: %s", err)
                    error_msg = err
    return None

# ═══════════════════════════════════════════════════════════════
# フェーズ1-B: 全体像エージェント
# ═══════════════════════════════════════════════════════════════

PHASE1B_SYSTEM_PROMPT = """Excel構造解析の全体像推論エキスパートです。
ヘッダー行とシートのタイトル行をみて、このシートがどのようなものであるかを一発で推測しJSONで出力してください。

pattern値のルール:
- Schedule Matrix: 作業予定（4月 5月...）や丸印（○●）が入る星取表
- Specs Only: メーカーや型式など、機器の仕様のみが書かれた表
- Mixed Data: 両方が混ざっている表
"""

PHASE1B_SCHEMA = {
    "type": "object",
    "properties": {
        "thought_process": {"type": "string", "description": "シートの性質を簡潔に分析(最大50文字)"},
        "pattern": {"type": "string", "enum": ["Schedule Matrix", "Specs Only", "Mixed Data"]},
        "year_context": {"type": "integer", "description": "年度が書かれていれば抽出(例:2025)。不明なら0"},
        "implied_hierarchy": {
            "type": "object",
            "additionalProperties": {"type": "string"},
            "description": "シート名やタイトルに書かれた階層情報(例: '第1階層名': '値')"
        }
    },
    "required": ["thought_process", "pattern", "year_context", "implied_hierarchy"]
}

async def run_phase1b_global_state(grid: PhysicalGrid, filename: str, p1a_data: dict) -> dict:
    adapter = get_llm_adapter(wait_timeout=30.0)
    if not adapter:
        return {"pattern": "Specs Only", "year_context": 0, "implied_hierarchy": {}}
        
    hs = p1a_data.get("header_start", 0)
    he = p1a_data.get("header_end", hs)
    title_injection = _get_title_injection(grid)
    
    header_text = []
    for i in range(hs, he+1):
        header_text.append(f"HeaderRow{i}: {grid.rows[i][:15]}")
    
    user_text = f"ファイル名: {filename}\nシート名: {grid.sheet_name}\n"
    user_text += f"<context_injection>\n{title_injection}\n</context_injection>\n\n"
    user_text += f"<header>\n{chr(10).join(header_text)}\n</header>"

    max_retries = 2
    error_msg = ""
    for retry in range(max_retries):
        prompt = user_text
        if error_msg:
            prompt += f"\n\n【エラー】{error_msg}"
            
        raw_text = await adapter.generate_structured(PHASE1B_SYSTEM_PROMPT, prompt, json_schema=PHASE1B_SCHEMA, retries=1)
        data = extract_json_object(raw_text)
        if not data:
            error_msg = "JSONを出力してください"
            continue
            
        # Validate
        pat = data.get("pattern", "")
        if pat not in ["Schedule Matrix", "Specs Only", "Mixed Data"]:
            error_msg = "pattern は指定された3つのいずれかにしてください。"
            continue
            
        logger.info("[P1-B] 全体像推論完了: %s", pat)
        return data
        
    return {"pattern": "Specs Only", "year_context": 0, "implied_hierarchy": {}}

# ═══════════════════════════════════════════════════════════════
# フェーズ2: 並列マッピングエージェント
# ═══════════════════════════════════════════════════════════════

async def _agentic_column_mapper(agent_name: str, system_prompt: str, json_schema: dict, user_text: str, validator) -> list[dict]:
    adapter = get_llm_adapter(wait_timeout=30.0)
    if not adapter:
        return []
    
    max_retries = 2
    error_msg = ""
    for retry in range(max_retries):
        prompt = user_text
        if error_msg:
            prompt += f"\n\n【エラー修正指示】\n{error_msg}"
            
        raw_text = await adapter.generate_structured(system_prompt, prompt, json_schema=json_schema, retries=1)
        data_obj = extract_json_object(raw_text)
        if not data_obj:
            error_msg = "JSONオブジェクトを出力してください"
            continue
        arr = data_obj.get("mappings", [])
        
        ok, err = validator(arr)
        if ok:
            logger.info("[P2] %s 解析完了 (%d件)", agent_name, len(arr))
            return arr
        else:
            logger.warning("[P2] %s Self-Correction発動: %s", agent_name, err)
            error_msg = err
    return []

async def run_phase2_parallel_mapping(grid: PhysicalGrid, structure: StructureInfo) -> list[ColumnDescriptor]:
    hs = structure.header_start
    he = structure.header_end
    ds = structure.data_start
    
    header_display = grid.rows[hs:he+1]
    sample_display = [row for row in grid.rows[ds:min(ds+5, len(grid.rows))] if any(c.strip() for c in row)][:3]
    
    user_text = f"パターン: {structure.pattern}, 年度: {structure.year_context}\n<excel_data>\nヘッダー:\n"
    for i, row in enumerate(header_display):
        user_text += f"H{hs + i}: {[c if c else '_' for c in row[:20]]}\n"
    user_text += "データ:\n"
    for i, row in enumerate(sample_display):
        user_text += f"D{ds + i}: {[c if c else '_' for c in row[:20]]}\n"
    user_text += "</excel_data>"

    # Validation logic
    def val_asset(arr):
        if not arr:
            return True, "" # 見つからないこともある
        if sum(1 for c in arr if c.get("field") == "AssetId") > 1:
            return False, "AssetIdは1つの列にしか指定できません。"
        return True, ""
        
    def val_hierarchy(arr):
        return True, ""
        
    def val_spec(arr):
        for item in arr:
            if item.get("field") != "Attribute":
                return False, "全てのfieldは'Attribute'に統一してください。"
        return True, ""
        
    def val_work(arr):
        for item in arr:
            if item.get("field") == "schedule":
                m = item.get("month")
                if m is not None and not (1 <= m <= 12):
                    return False, f"monthは1〜12の範囲にしてください。現在の出力: {m}"
        return True, ""

    PHASE2_SCHEMA = {
        "type": "object",
        "properties": {
            "thought_process": {
                "type": "string",
                "description": "各列の意味や対応するフィールドを簡潔に推論(最大50文字)"
            },
            "mappings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "col": {"type": "integer"},
                        "field": {"type": "string"},
                        "label": {"type": "string"},
                        "month": {"type": "integer"},
                        "sub": {"type": "string"}
                    },
                    "required": ["col", "field", "label"]
                }
            }
        },
        "required": ["thought_process", "mappings"]
    }

    prompt_asset = """【機器担当エージェント】
「機器ID（タグNo、整理番号、ITEM No.、Equipment No.）」「機器名」「機器名称」に関する列だけを抽出し出力。「AssetId」は最重要。存在しない場合はmappingsを空白の配列[]にすること。"""
    
    prompt_hierarchy = """【階層担当エージェント】
「設置エリア」「プラント」「建屋」「場所」「系統」など、親階層になりうる列だけを抽出し、Hierarchy1, Hierarchy2等を割り当てる。機器番号は選ばない事。"""

    prompt_spec = """【仕様担当エージェント】
「メーカー」「型式」「電圧」「設置年」「容量」「能力」「備考」などの仕様列だけを抽出。"Attribute"を割り当てる。"""

    prompt_work = """【作業担当エージェント】
「点検内容」「作業項目」や「4月」「5月」等のスケジュール列だけを抽出。
スケジュールの場合は month=数字(1-12), sub="both"|"plan"|"actual" を付与すること。"""

    logger.info("[P2] 4つの並列エージェントを起動します...")
    
    # 🏃 並列実行 (Gather)
    results = await asyncio.gather(
        _agentic_column_mapper("Asset", prompt_asset, PHASE2_SCHEMA, user_text, val_asset),
        _agentic_column_mapper("Hierarchy", prompt_hierarchy, PHASE2_SCHEMA, user_text, val_hierarchy),
        _agentic_column_mapper("Spec", prompt_spec, PHASE2_SCHEMA, user_text, val_spec),
        _agentic_column_mapper("Work", prompt_work, PHASE2_SCHEMA, user_text, val_work),
        return_exceptions=True
    )
    
    all_descriptors = []
    seen_cols = set()
    for res in results:
        if isinstance(res, list):
            for item in res:
                col = item.get("col", -1)
                if col != -1 and col not in seen_cols:
                    seen_cols.add(col)
                    all_descriptors.append(ColumnDescriptor(
                        col=col,
                        field=item.get("field", "ignore"),
                        month=item.get("month"),
                        sub=item.get("sub"),
                        label=item.get("label", ""),
                    ))
    
    # フォールバック処理
    if not all_descriptors:
        logger.warning("[P2] パラレル抽出結果が空。ヒューリスティックによるフォールバックを使用。")
        return []
        
    all_descriptors.sort(key=lambda x: x.col)
    return all_descriptors

# ═══════════════════════════════════════════════════════════════
# フェーズ3: 階層の既存推測と退避（後で実装・利用）
# ═══════════════════════════════════════════════════════════════
# 実際のAPIエンドポイント側でフェーズ3のロジックとして統合する

PHASE3_SYSTEM_PROMPT = """既存階層推論エキスパートです。
抽出された機器リストと、システムに既に存在する階層リストから、機器がどの既存階層に属するか推論してください。
既存階層から特定できない未知の機器だった場合は、"対象階層なし" という値をセットしてください。
出力形式（JSONのみ）:
{"設備ID1": {"Area": "値", "System": "値"}, "設備ID2": {"Area": "対象階層なし"}}
"""

async def run_phase3_hierarchy_linking(assets: list[dict], existing_hierarchy: list[dict]) -> dict:
    adapter = get_llm_adapter(wait_timeout=30.0)
    if not adapter or not assets:
        return {}
        
    user_text = "【既存の階層ツリー】\n"
    if existing_hierarchy:
        for lv in existing_hierarchy:
            user_text += f"{lv.get('name')}: {lv.get('values')}\n"
    else:
        user_text += "(既存の階層はまだ登録されていません)\n"
        
    user_text += "\n【新規インポート機器】\n"
    for a in assets:
        user_text += f"ID: {a.get('id')}, 名前: {a.get('name')}\n"
        
    try:
        raw_text = await adapter.generate_structured(PHASE3_SYSTEM_PROMPT, user_text, retries=1)
        return extract_json_object(raw_text) or {}
    except Exception as e:
        logger.error("[P3] エラー: %s", e)
        return {}
