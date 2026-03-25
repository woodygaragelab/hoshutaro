import threading
import logging
from typing import Optional
from app.llm.base import LLMAdapter
from app.config import settings

logger = logging.getLogger(__name__)


def create_llm_adapter() -> LLMAdapter:
    adapter_type = settings.llm_adapter
    if adapter_type == "openai_compat":
        from app.llm.openai_compat import OpenAICompatAdapter
        return OpenAICompatAdapter(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
        )
    else:
        raise ValueError(f"Unknown LLM Adapter type: {adapter_type}")


_adapter: Optional[LLMAdapter] = None
_adapter_lock = threading.Lock()
_adapter_loading = False
_adapter_error: Optional[str] = None


def _init_adapter_background() -> None:
    global _adapter, _adapter_loading, _adapter_error
    try:
        logger.info("[LLM Factory] バックグラウンドでLLMアダプター初期化開始...")
        adapter = create_llm_adapter()
        with _adapter_lock:
            _adapter = adapter
            _adapter_loading = False
        logger.info("[LLM Factory] LLMアダプター初期化完了: %s", type(adapter).__name__)
    except Exception as e:
        with _adapter_lock:
            _adapter_loading = False
            _adapter_error = str(e)
        logger.error("[LLM Factory] LLMアダプター初期化失敗: %s", e)


def get_llm_adapter() -> Optional[LLMAdapter]:
    """
    LLMアダプターを取得する。
    未ロードの場合はバックグラウンドでロードを開始し None を返す。
    """
    global _adapter, _adapter_loading, _adapter_error
    with _adapter_lock:
        if _adapter is not None:
            return _adapter
        if not _adapter_loading:
            _adapter_loading = True
            _adapter_error = None
            thread = threading.Thread(target=_init_adapter_background, daemon=True)
            thread.start()
    return None


def is_llm_ready() -> bool:
    return _adapter is not None


def get_llm_loading_status() -> dict:
    return {
        "ready": _adapter is not None,
        "loading": _adapter_loading,
        "error": _adapter_error,
    }


def reset_llm_adapter() -> None:
    global _adapter, _adapter_loading, _adapter_error
    with _adapter_lock:
        _adapter = None
        _adapter_loading = False
        _adapter_error = None
