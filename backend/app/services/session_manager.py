import uuid
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class Session:
    def __init__(self, session_id: str):
        self.session_id = session_id
        # DataModel v3.0.0 準拠のルート構造。必要に応じてエンティティが追加される
        self.data_model: Dict[str, Any] = {
            "version": "3.0.0", 
            "assets": [], 
            "workOrders": [], 
            "workOrderLines": []
        }
        self.chat_history: list = []
        self.snapshots: list = []
        self.metadata: Dict[str, Any] = {
            "skill_thinking_depth": {},
            "planning_stats_cache": {}
        }

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}

    def get_session(self, session_id: str) -> Session:
        if session_id not in self.sessions:
            logger.info(f"セッション {session_id} が存在しないため新規作成します。")
            self.sessions[session_id] = Session(session_id)
        return self.sessions[session_id]
        
    def create_session(self) -> str:
        new_id = str(uuid.uuid4())
        self.sessions[new_id] = Session(new_id)
        return new_id

session_manager = SessionManager()
