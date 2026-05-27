"""
LoRA トレーニング起動スケジューラ。

役割:
  - training_cache に user_confirmed=1 かつ used_for_training=0 が閾値（既定 100件）以上溜まったか判定
  - 閾値超え時に lora_trainer のバックグラウンドジョブを起動
  - 同時実行抑制（既に学習中なら新規起動しない）
  - 手動起動 API（UI からの「今すぐ学習」）
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.mu.memory import training_cache as training_cache_repo

logger = logging.getLogger(__name__)


DEFAULT_THRESHOLD = 100


@dataclass
class TrainingJobStatus:
    state: str  # 'idle' | 'running' | 'completed' | 'failed'
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    last_lora_version: Optional[str] = None
    last_error: Optional[str] = None


class TrainingScheduler:
    """
    シングルトン的に使うトレーニング起動制御。
    """

    def __init__(self, *, threshold: int = DEFAULT_THRESHOLD) -> None:
        self.threshold = threshold
        self._status = TrainingJobStatus(state="idle")
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None

    @property
    def status(self) -> TrainingJobStatus:
        return self._status

    def is_running(self) -> bool:
        return self._status.state == "running"

    # ───────────────────────────────────────────────────────
    # Trigger condition
    # ───────────────────────────────────────────────────────

    def should_trigger(
        self,
        *,
        organization: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> bool:
        if self.is_running():
            return False
        pending = training_cache_repo.count_unused(
            organization=organization, task_type=task_type
        )
        return pending >= self.threshold

    def pending_count(
        self,
        *,
        organization: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> int:
        return training_cache_repo.count_unused(
            organization=organization, task_type=task_type
        )

    # ───────────────────────────────────────────────────────
    # Trigger (async background job)
    # ───────────────────────────────────────────────────────

    async def trigger(
        self,
        *,
        organization: Optional[str] = None,
        task_type: Optional[str] = None,
        manual: bool = False,
    ) -> bool:
        """
        LoRA トレーニングジョブを起動する。

        Returns:
            True: ジョブを起動した
            False: 既に走行中、または閾値未達（manual=False の場合）
        """
        if self.is_running():
            logger.info("Training scheduler: already running, skip")
            return False

        if not manual and not self.should_trigger(
            organization=organization, task_type=task_type
        ):
            return False

        async with self._lock:
            if self.is_running():
                return False
            self._status = TrainingJobStatus(state="running", started_at=datetime.utcnow())

        # バックグラウンド実行（呼び出し側はブロックしない）
        self._task = asyncio.create_task(
            self._run_job(organization=organization, task_type=task_type)
        )
        return True

    async def _run_job(
        self,
        *,
        organization: Optional[str],
        task_type: Optional[str],
    ) -> None:
        from app.mu.learning import lora_trainer

        try:
            logger.info(
                "LoRA training job started: organization=%s, task_type=%s",
                organization,
                task_type,
            )
            result = await lora_trainer.train_lora(
                organization=organization,
                task_type=task_type,
            )
            self._status = TrainingJobStatus(
                state="completed",
                started_at=self._status.started_at,
                finished_at=datetime.utcnow(),
                last_lora_version=result.get("version") if result else None,
            )
            logger.info("LoRA training job completed: %s", result)
        except NotImplementedError as e:
            self._status = TrainingJobStatus(
                state="failed",
                started_at=self._status.started_at,
                finished_at=datetime.utcnow(),
                last_error=f"LoRA trainer not implemented: {e}",
            )
            logger.warning("LoRA training not implemented: %s", e)
        except Exception as e:
            self._status = TrainingJobStatus(
                state="failed",
                started_at=self._status.started_at,
                finished_at=datetime.utcnow(),
                last_error=str(e),
            )
            logger.exception("LoRA training job failed")

    async def wait(self) -> TrainingJobStatus:
        """テスト/管理用: 実行中ジョブの完了を待つ。"""
        if self._task:
            try:
                await self._task
            except Exception:
                pass
        return self._status


# ───────────────────────────────────────────────────────────
# Singleton
# ───────────────────────────────────────────────────────────

_default_scheduler: Optional[TrainingScheduler] = None


def get_scheduler() -> TrainingScheduler:
    global _default_scheduler
    if _default_scheduler is None:
        _default_scheduler = TrainingScheduler()
    return _default_scheduler


def reset_for_tests(scheduler: Optional[TrainingScheduler] = None) -> None:
    global _default_scheduler
    _default_scheduler = scheduler
