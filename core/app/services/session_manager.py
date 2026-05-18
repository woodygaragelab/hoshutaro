import time
import uuid
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# import_stateの有効期限（秒）
IMPORT_STATE_TTL = 30 * 60  # 30分


class Session:
    def __init__(self, session_id: str):
        self.session_id = session_id
        # DataModel v3.0.0 準拠のルート構造。必要に応じてエンティティが追加される
        self.data_model: Dict[str, Any] = {
            "version": "3.0.0",
            "assets": {},
            "workOrders": {},
            "workOrderLines": {},
            "hierarchy": {"levels": []},
            "metadata": {"lastModified": "2026-03-31T00:00:00.000Z", "createdBy": "system"}
        }
        self.chat_history: list = []
        self.snapshots: list = []
        self._import_state = None  # Excelインポートの途中状態を保持
        self._import_state_ts: float = 0  # import_stateの設定時刻
        self.is_cancelled: bool = False   # キャンセル判定用フラグ
        self.metadata: Dict[str, Any] = {
            "skill_thinking_depth": {},
            "planning_stats_cache": {}
        }

    @property
    def import_state(self):
        """import_stateを取得。TTL超過時は自動クリア。"""
        if self._import_state is not None and self._import_state_ts > 0:
            if time.time() - self._import_state_ts > IMPORT_STATE_TTL:
                logger.info("import_state TTL超過 (session=%s)。自動クリア。", self.session_id)
                self._import_state = None
                self._import_state_ts = 0
        return self._import_state

    @import_state.setter
    def import_state(self, value):
        self._import_state = value
        self._import_state_ts = time.time() if value is not None else 0

    def append_message(self, role: str, content: str):
        """会話メッセージを履歴に追加。40件超で古いものを切り捨て"""
        self.chat_history.append({"role": role, "content": content})
        if len(self.chat_history) > 40:
            self.chat_history = self.chat_history[-30:]

    def get_recent_history(self, n: int = 10) -> list[dict]:
        """直近N件の会話履歴を返す"""
        return self.chat_history[-n:]

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
