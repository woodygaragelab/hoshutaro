from pydantic import BaseModel
from typing import Literal, Any, Dict, List, Optional

class OperationTarget(BaseModel):
    entity_type: str
    entity_id: Optional[str] = None
    changes: Dict[str, Any]

class MaintenanceOperation(BaseModel):
    type: Literal[
        "create_work_order", "update_work_order", "delete_work_order",
        "create_work_order_line", "update_work_order_line", "delete_work_order_line",
        "bulk_schedule", "predict_schedule", "import_excel_mapping", "explain_only"
    ]
    targets: List[OperationTarget] = []
    action_summary: str
