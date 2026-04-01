"""
データインポートAPIルーター

エンドポイント:
  POST /api/data/import/excel     - Excel解析（Phase 1-2）
  POST /api/data/import/confirm   - ユーザー確認後のチャンク変換（Phase 3）
"""
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.session_manager import session_manager
from app.services.excel_converter import analyze_excel_full, execute_chunk_conversion
from app.engine.state import ExcelImportState
from app.engine.agents.excel_import import excel_import_engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/api/data/import/excel")
async def import_excel(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    """
    Phase 1-2: 構造解析 + マッピング生成 + 検証プレビュー
    LLM呼び出し2回のみ。結果をセッションに保存してユーザー確認待ち。
    """
    try:
        session = session_manager.get_session(session_id)
        
        file_bytes = await file.read()
        filename = file.filename or "unknown.xlsx"
        
        logger.info("[import_excel] 開始: %s (%d bytes)", filename, len(file_bytes))
        
        initial_state = ExcelImportState(
            session_id=session_id,
            filename=filename,
            file_bytes=file_bytes,
            status="pending",
            error_message="",
            analysis_result=None,
            summary="",
            total_rows=0,
            structure_info=None,
            descriptors_info=None,
            symbol_mapping={},
            preview_records=[],
            warnings=[],
            processed_rows=0,
            extracted_assets=[],
            extracted_work_orders=[],
            extracted_wo_lines=[],
            error_rows=[],
        )
        
        # Phase 1-2 実行（LLM 2回）
        final_state = await excel_import_engine.ainvoke(initial_state)
        
        if final_state["status"] == "error":
            raise HTTPException(
                status_code=400,
                detail=final_state.get("error_message", "Excel解析エラー")
            )
        
        # セッションに保存（ユーザー確認待ち）
        session.import_state = dict(final_state)
        
        # フロントエンドに返すレスポンス
        return JSONResponse(content={
            "success": True,
            "status": final_state["status"],
            "summary": final_state.get("summary", ""),
            "total_rows": final_state.get("total_rows", 0),
            "sheets": final_state.get("sheets", []),
        })
        
    except Exception as e:
        logger.error(f"[import_excel] Error: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


class ConfirmImportRequest(BaseModel):
    session_id: str
    symbol_mapping: dict = None  # ユーザーが修正したシンボルマッピング（オプション）


@router.post("/api/data/import/confirm")
async def confirm_import(body: ConfirmImportRequest):
    """
    Phase 3: ユーザー確認後のチャンク変換。LLM呼び出しゼロ。
    """
    try:
        session = session_manager.get_session(body.session_id)
        
        if not hasattr(session, "import_state") or not session.import_state:
            raise HTTPException(status_code=400, detail="インポート待ちの状態がありません")
        
        import_state = session.import_state
        
        if import_state.get("status") != "waiting_user":
            raise HTTPException(status_code=400, detail=f"不正なステータス: {import_state.get('status')}")
        
        analysis_results = import_state.get("analysis_results")
        if not analysis_results:
            raise HTTPException(status_code=400, detail="解析結果がありません")
        
        # ユーザーがシンボルマッピングを修正した場合は上書き（各シートに適用）
        if body.symbol_mapping:
            for res in analysis_results:
                res["symbol_mapping"] = body.symbol_mapping
            import_state["symbol_mapping"] = body.symbol_mapping
        
        # Phase 3: チャンク変換実行
        logger.info("[confirm_import] Phase 3 開始: チャンク変換 (全シート)")
        
        chunk_size = 500
        
        chunk_result = execute_chunk_conversion(
            analysis_results, chunk_size=chunk_size,
        )
        
        all_assets_dict = {a["id"]: a for a in chunk_result["assets"]}
        all_wos_dict = {wo["name"]: wo for wo in chunk_result["work_orders"]}
        all_wol = chunk_result["work_order_lines"]
        all_errors = chunk_result["error_rows"]

        
        # セッションのdata_modelに統合 (ファジーマージ対応)
        dm = session.data_model
        
        existing_assets = dm.setdefault("assets", {})
        import difflib
        
        for new_asset in all_assets_dict.values():
            matched_existing = None
            
            # 1. 完全一致チェック
            if new_asset["id"] in existing_assets:
                matched_existing = existing_assets[new_asset["id"]]
            else:
                # 2. difflib による類似度マッチング（閾値0.8以上なら同一とみなす）
                for ext_asset in existing_assets.values():
                    name_similarity = difflib.SequenceMatcher(None, new_asset["name"], ext_asset["name"]).ratio()
                    if name_similarity > 0.8:
                        matched_existing = ext_asset
                        break
            
            if matched_existing:
                # マージ: 既存の階層は維持し、スペックを統合する
                for k, v in new_asset.items():
                    if k not in ["id", "name", "hierarchyPath"]:
                        matched_existing[k] = v
            else:
                existing_assets[new_asset["id"]] = new_asset
        
        existing_wos = dm.setdefault("workOrders", {})
        existing_wo_names = {wo.get("name") for wo in existing_wos.values()}
        for wo in all_wos_dict.values():
            if wo["name"] not in existing_wo_names:
                existing_wos[wo["id"]] = wo
        
        existing_wol = dm.setdefault("workOrderLines", {})
        for wol in all_wol:
            existing_wol[wol["id"]] = wol
        
        # 階層マスター（levels）の動的再構築
        hierarchy_dict = dm.setdefault("hierarchy", {"levels": []})
        levels = hierarchy_dict.get("levels", [])
        existing_levels = {lv["name"]: lv["values"] for lv in levels}
        
        for asset in existing_assets.values():
            hp = asset.get("hierarchyPath", {})
            for level_name, level_value in hp.items():
                if level_name not in existing_levels:
                    existing_levels[level_name] = []
                    levels.append({"name": level_name, "values": existing_levels[level_name]})
                if level_value and level_value not in existing_levels[level_name]:
                    existing_levels[level_name].append(level_value)
        
        hierarchy_dict["levels"] = levels
        
        # jsonバックアップ
        import json, os
        debug_path = os.path.join(os.getcwd(), "data_model_debug.json")
        with open(debug_path, "w", encoding="utf-8") as f:
            json.dump(dm, f, ensure_ascii=False, indent=2)
            
        # import_stateをクリア
        session.import_state = None
        
        logger.info(
            "[confirm_import] 完了: assets=%d, wos=%d, wols=%d, errors=%d",
            len(all_assets_dict), len(all_wos_dict), len(all_wol), len(all_errors),
        )
        
        return JSONResponse(content={
            "success": True,
            "status": "done",
            "imported_assets": len(all_assets_dict),
            "imported_work_orders": len(all_wos_dict),
            "imported_lines": len(all_wol),
            "error_count": len(all_errors),
            "error_rows": all_errors[:20],  # 先頭20件のみ返す
            "data_model": dm,
        })
        
    except Exception as e:
        logger.error(f"[confirm_import] Error: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
