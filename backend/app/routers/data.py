import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.services.session_manager import session_manager
from app.services.excel_converter import analyze_excel_structure, infer_mapping_with_llm
from app.engine.state import ExcelImportState
from app.engine.agents.excel_import import excel_import_engine

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/data/import/excel")
async def import_excel(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    try:
        session = session_manager.get_session(session_id)
        
        file_bytes = await file.read()
        filename = file.filename or "unknown.xlsx"
        
        initial_state = ExcelImportState(
            session_id=session_id,
            filename=filename,
            file_bytes=file_bytes,
            status="pending",
            error_message="",
            header_row_index=0,
            summary="",
            mappings=[],
            symbol_mapping={"○": "planned", "●": "actual", "◎": "completed", "×": "cancelled"},
            total_rows=0,
            processed_rows=0,
            extracted_data=[]
        )
        
        # Phase 1, 2 の実行 (構造解析・マッピング提案)
        final_state = await excel_import_engine.ainvoke(initial_state)
        
        if final_state["status"] == "error":
            raise HTTPException(status_code=400, detail=final_state.get("error_message", "Excel解析エラー"))
            
        # ユーザー確認待ち状態でセッションに保存
        session.import_state = final_state
        
        return JSONResponse(content={
            "success": True,
            "status": final_state["status"],
            "summary": final_state["summary"],
            "mappings": final_state["mappings"],
            "total_rows": final_state["total_rows"],
            "suggestions": [
                {
                    "equipmentId": "IMPORT-ALL",
                    "timeHeader": "All",
                    "suggestedAction": "plan",
                    "reason": f"({filename}) ヘッダー解析が完了しました。マッピングを確認してインポートを承認してください。",
                    "confidence": 0.98
                }
            ]
        })
        
    except Exception as e:
        logger.error(f"Import excel endpoint error: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
