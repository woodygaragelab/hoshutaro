"""
LoRA アダプターのバージョン管理。

`core/app/mu/memory/lora_adapters.py` の薄いラッパに、
ファイルシステム上の `.safetensors` 実体管理と、active 切替時の prompt cache invalidate を
合わせて提供する。
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from app.mu.cache.kv_cache_manager import get_manager as get_cache_manager
from app.mu.memory import lora_adapters as lora_repo

logger = logging.getLogger(__name__)


def _adapters_dir() -> Path:
    raw = os.environ.get("HOSHUTARO_LORA_DIR")
    if raw:
        path = Path(os.path.expanduser(raw))
    else:
        path = Path.home() / ".hoshutaro" / "lora"
    path.mkdir(parents=True, exist_ok=True)
    return path


def adapter_path(version: str) -> Path:
    """version 文字列からファイル名を生成。"""
    safe = "".join(c for c in version if c.isalnum() or c in ("_", "-", "."))
    if not safe:
        raise ValueError(f"Invalid version: {version!r}")
    return _adapters_dir() / f"{safe}.safetensors"


def register_new_adapter(
    *,
    version: str,
    base_model: str,
    task_types: list[str],
    training_examples_count: int,
    metrics: Optional[dict] = None,
    organization: Optional[str] = None,
) -> str:
    """
    LoRA アダプターのメタを DB に登録（実ファイルは別途トレーナーが書き込む想定）。

    Returns:
        登録した version 文字列
    """
    file_path = str(adapter_path(version))
    return lora_repo.register(
        version=version,
        file_path=file_path,
        base_model=base_model,
        task_types=task_types,
        training_examples_count=training_examples_count,
        metrics=metrics or {},
        organization=organization,
        activate=False,
    )


def activate(version: str) -> bool:
    """active を切替し、関連プロンプトキャッシュを invalidate。"""
    if not lora_repo.set_active(version):
        return False
    try:
        # 古い LoRA に紐づくキャッシュは Adapter 切替後の精度が変わるため無効化
        cache_mgr = get_cache_manager()
        for meta in [m for m in __import__('app.mu.memory.prompt_cache', fromlist=['list_all']).list_all(limit=10000) if m.lora_version and m.lora_version != version]:
            cache_mgr.invalidate(meta.cache_key)
    except Exception as e:
        logger.debug("Cache invalidation on activate skipped: %s", e)
    return True


def deactivate_for_org(organization: Optional[str] = None) -> int:
    """全アダプターを非アクティブ化（ベースモデルへ戻す）。"""
    return lora_repo.deactivate_all(organization=organization)


def get_active_version(organization: Optional[str] = None) -> Optional[str]:
    """現在 active な LoRA バージョン文字列を返す（なければ None）。"""
    rec = lora_repo.get_active(organization=organization)
    return rec.version if rec else None


def list_versions(*, organization: Optional[str] = None, limit: int = 50):
    return lora_repo.list_all(organization=organization, limit=limit)


def remove(version: str) -> bool:
    """DB メタとファイルの両方を削除。"""
    rec = lora_repo.get(version)
    if not rec:
        return False
    try:
        path = adapter_path(version)
        if path.exists():
            path.unlink()
    except OSError as e:
        logger.warning("Failed to delete adapter file %s: %s", version, e)
    return lora_repo.delete(version)
