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
        if target.entity_type in ["workOrderLine", "workOrderLines"]:
            if "workOrderLines" not in session.data_model:
                session.data_model["workOrderLines"] = []
            
            lines = session.data_model["workOrderLines"]
            existing = None
            if target.entity_id:
                existing = next((item for item in lines if item.get("id") == target.entity_id), None)
            
            if existing:
                existing.update(target.changes)
            else:
                new_id = target.entity_id or f"WOL-{len(lines)}"
                lines.append({
                    "id": new_id,
                    **target.changes
                })
            
            applied_count += 1
            
    return {"status": "success", "applied_count": applied_count, "summary": op.action_summary}
