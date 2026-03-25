import logging
from typing import Dict, Any
from app.models.schemas import MaintenanceOperation
from app.services.session_manager import session_manager

logger = logging.getLogger(__name__)

def execute_maintenance_operation(session_id: str, op: MaintenanceOperation) -> Dict[str, Any]:
    """
    LLMが生成したMaintenanceOperationを実際のDataModelに適用するツール。
    ※Sprint 3時点ではインメモリのSession.data_modelを更新するだけのモック実装。
    """
    logger.info(f"[Tool] Executing operation {op.type} for session {session_id}")
    session = session_manager.get_session(session_id)
    
    applied_count = 0
    for target in op.targets:
        if target.entity_type == "workOrderLines":
            if "workOrderLines" not in session.data_model:
                session.data_model["workOrderLines"] = []
            
            # idの補完
            new_id = target.entity_id or f"WOL-{len(session.data_model['workOrderLines'])}"
            
            # TODO: upsertロジック（実際には既存IDの検索などが必要）
            session.data_model["workOrderLines"].append({
                "id": new_id,
                **target.changes
            })
            applied_count += 1
            
    return {"status": "success", "applied_count": applied_count, "summary": op.action_summary}
