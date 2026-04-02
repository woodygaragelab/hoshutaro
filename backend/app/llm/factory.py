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
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
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


import time

def get_llm_adapter(wait_timeout: float = 0.0) -> Optional[LLMAdapter]:
    """
    LLMアダプターを取得する。
    未ロードの場合はバックグラウンドでロードを開始し、wait_timeout秒まで待機する。
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
            
    if wait_timeout > 0:
        start_time = time.time()
        while time.time() - start_time < wait_timeout:
            with _adapter_lock:
                if _adapter is not None:
                    return _adapter
                if _adapter_error is not None:
                    logger.error(f"[LLM Factory] Init Error: {_adapter_error}")
                    return None
            time.sleep(0.1)
            
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
    """設定変更時にアダプターを再生成する。既存参照も新設定で即時反映。"""
    global _adapter, _adapter_loading, _adapter_error
    with _adapter_lock:
        if _adapter is not None:
            # 進行中の処理が持つ旧adapter参照にも即反映（ホットスワップ）
            from openai import AsyncOpenAI
            _adapter.model = settings.llm_model
            _adapter._base_url = settings.llm_base_url
            _adapter._api_key = settings.llm_api_key
            _adapter._client = AsyncOpenAI(
                base_url=settings.llm_base_url, api_key=settings.llm_api_key,
            )
            _adapter.temperature = settings.llm_temperature
            _adapter.max_tokens = settings.llm_max_tokens
            logger.info("[LLM Factory] アダプター設定をホットスワップ: model=%s", settings.llm_model)
        # 次回get_llm_adapter()で新設定のアダプターを再生成させる
        _adapter = None
        _adapter_loading = False
        _adapter_error = None
