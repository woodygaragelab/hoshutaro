"""
Gemma 4 E2B-it / it-assistant の初回ダウンロード + OpenVINO 量子化マネージャ。

役割:
  - 配置状況の確認（`~/.hoshutaro/models/` 配下）
  - HuggingFace Hub からのダウンロード起動（非同期、SSE 進捗）
  - target → drafter の順で逐次処理
  - 同時実行抑制（既に走行中なら新規起動しない）
  - 完了後、registry の `LOCAL_LLM_TARGET_MODEL_DIR` / `LOCAL_LLM_DRAFTER_MODEL_DIR`
    に対応する環境変数を補完（プロセスメモリ上のみ）
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# target / drafter のリポジトリは env で上書き可能（プラン WS1-3）。
# - target: 既定 google/gemma-4-E2B-it（変更想定なし）
# - drafter: 既定 google/gemma-4-E2B-it-assistant。MTP drafter を別モデルへ差し替える場合は
#   `LOCAL_LLM_DRAFTER_HF_REPO` 環境変数で指定。
DEFAULT_TARGET_REPO = os.environ.get(
    "LOCAL_LLM_TARGET_HF_REPO", "google/gemma-4-E2B-it"
)
DEFAULT_DRAFTER_REPO = os.environ.get(
    "LOCAL_LLM_DRAFTER_HF_REPO", "google/gemma-4-E2B-it-assistant"
)


def _models_root() -> Path:
    raw = os.environ.get("HOSHUTARO_MODELS_DIR")
    if raw:
        return Path(os.path.expanduser(raw))
    return Path.home() / ".hoshutaro" / "models"


def _slug(repo: str) -> str:
    return repo.replace("/", "_").lower()


def _model_done(repo: str) -> bool:
    """`.convert_done` マーカーで配置済か判定。"""
    return (_models_root() / _slug(repo) / ".convert_done").exists()


# ───────────────────────────────────────────────────────────
# Job state
# ───────────────────────────────────────────────────────────


@dataclass
class DownloadJobStatus:
    state: str = "idle"  # idle | downloading | converting | done | failed
    current_repo: Optional[str] = None
    current_step: Optional[str] = None
    """例: 'downloading', 'converting', 'verifying'"""

    progress_pct: float = 0.0
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    completed_repos: list[str] = field(default_factory=list)


# ───────────────────────────────────────────────────────────
# Manager
# ───────────────────────────────────────────────────────────


class ModelSetupManager:
    """
    モデルセットアップの状態管理＋実行制御。
    """

    def __init__(
        self,
        *,
        target_repo: str = DEFAULT_TARGET_REPO,
        drafter_repo: str = DEFAULT_DRAFTER_REPO,
        target_quant: str = "int4",
        drafter_quant: str = "int8",
    ) -> None:
        self.target_repo = target_repo
        self.drafter_repo = drafter_repo
        self.target_quant = target_quant
        self.drafter_quant = drafter_quant
        self._status = DownloadJobStatus()
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._progress_event = asyncio.Event()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ───────────────────────────────────────────────────────
    # 状態確認
    # ───────────────────────────────────────────────────────

    @property
    def status(self) -> DownloadJobStatus:
        return self._status

    def is_running(self) -> bool:
        return self._status.state in ("downloading", "converting")

    def setup_required(self) -> dict[str, bool]:
        """各モデルがダウンロード必要かを返す。"""
        return {
            "target": not _model_done(self.target_repo),
            "drafter": not _model_done(self.drafter_repo),
        }

    def models_dir(self) -> Path:
        return _models_root()

    def target_dir(self) -> Path:
        return _models_root() / _slug(self.target_repo)

    def drafter_dir(self) -> Path:
        return _models_root() / _slug(self.drafter_repo)

    def detail(self) -> dict:
        return {
            "models_root": str(_models_root()),
            "target_repo": self.target_repo,
            "drafter_repo": self.drafter_repo,
            "target_done": _model_done(self.target_repo),
            "drafter_done": _model_done(self.drafter_repo),
            "target_dir": str(self.target_dir()),
            "drafter_dir": str(self.drafter_dir()),
            "running": self.is_running(),
            "state": self._status.state,
            "current_repo": self._status.current_repo,
            "current_step": self._status.current_step,
            "progress_pct": self._status.progress_pct,
            "completed_repos": list(self._status.completed_repos),
            "error": self._status.error,
        }

    # ───────────────────────────────────────────────────────
    # 起動
    # ───────────────────────────────────────────────────────

    async def trigger_download(
        self,
        *,
        include_drafter: bool = True,
        force: bool = False,
        hf_token: Optional[str] = None,
    ) -> bool:
        """
        ダウンロード + 量子化ジョブを起動する。

        Returns:
            True: 起動した。False: 既に走行中。
        """
        if self.is_running():
            return False

        async with self._lock:
            if self.is_running():
                return False
            self._status = DownloadJobStatus(
                state="downloading", started_at=datetime.utcnow(), progress_pct=0.0
            )
            self._loop = asyncio.get_running_loop()

        self._task = asyncio.create_task(
            self._run(
                include_drafter=include_drafter,
                force=force,
                hf_token=hf_token,
            )
        )
        return True

    async def _run(
        self,
        *,
        include_drafter: bool,
        force: bool,
        hf_token: Optional[str],
    ) -> None:
        try:
            jobs: list[tuple[str, str]] = [(self.target_repo, self.target_quant)]
            if include_drafter:
                jobs.append((self.drafter_repo, self.drafter_quant))

            n = len(jobs)
            for i, (repo, quant) in enumerate(jobs):
                if not force and _model_done(repo):
                    self._status.completed_repos.append(repo)
                    continue
                self._status.current_repo = repo
                self._status.current_step = "downloading"
                self._status.progress_pct = (i / n) * 100.0
                self._notify()

                await asyncio.to_thread(
                    self._convert_one,
                    repo=repo,
                    quantization=quant,
                    hf_token=hf_token,
                )
                self._status.completed_repos.append(repo)
                self._status.progress_pct = ((i + 1) / n) * 100.0
                self._notify()

            self._status.state = "done"
            self._status.current_repo = None
            self._status.current_step = None
            self._status.progress_pct = 100.0
            self._status.finished_at = datetime.utcnow()
            self._notify()

            # registry が参照する環境変数を補完
            os.environ.setdefault("LOCAL_LLM_TARGET_MODEL_DIR", str(self.target_dir()))
            os.environ.setdefault("LOCAL_LLM_DRAFTER_MODEL_DIR", str(self.drafter_dir()))
        except NotImplementedError as e:
            self._status.state = "failed"
            self._status.error = f"Dependencies missing: {e}"
            self._status.finished_at = datetime.utcnow()
            self._notify()
            logger.warning("Setup failed (deps): %s", e)
        except Exception as e:
            self._status.state = "failed"
            self._status.error = str(e)
            self._status.finished_at = datetime.utcnow()
            self._notify()
            logger.exception("Setup job failed")

    def _convert_one(
        self,
        *,
        repo: str,
        quantization: str,
        hf_token: Optional[str],
    ) -> None:
        """tools/quantize-models/download_and_quantize.py のロジックを呼ぶ。"""
        try:
            # tools パッケージ未配置のため動的に sys.path に追加
            import sys
            from pathlib import Path as _Path

            tools_dir = _Path(__file__).resolve().parents[3].parent / "tools" / "quantize-models"
            if str(tools_dir) not in sys.path:
                sys.path.insert(0, str(tools_dir))
            from download_and_quantize import download_and_quantize  # type: ignore

            self._status.current_step = "converting"
            self._notify()
            download_and_quantize(
                repo_id=repo,
                output_dir=_models_root(),
                quantization=quantization,
                hf_token=hf_token,
                skip_existing=True,
            )
        except RuntimeError as e:
            # 依存ライブラリ未インストール
            raise NotImplementedError(str(e)) from e

    # ───────────────────────────────────────────────────────
    # SSE 進捗通知
    # ───────────────────────────────────────────────────────

    def _notify(self) -> None:
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._progress_event.set)

    async def progress_stream(self):
        """
        SSE 用ジェネレータ。状態が変化するたびに detail() を yield。
        """
        while self.is_running() or self._status.state == "downloading":
            yield self.detail()
            self._progress_event.clear()
            try:
                await asyncio.wait_for(self._progress_event.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                # keep-alive
                pass
        # 完了 or 失敗時に最終状態を1回送って終了
        yield self.detail()


# ───────────────────────────────────────────────────────────
# Singleton
# ───────────────────────────────────────────────────────────

_default_manager: Optional[ModelSetupManager] = None
_default_lock = threading.Lock()


def get_setup_manager() -> ModelSetupManager:
    global _default_manager
    if _default_manager is not None:
        return _default_manager
    with _default_lock:
        if _default_manager is None:
            _default_manager = ModelSetupManager()
        return _default_manager


def reset_for_tests(manager: Optional[ModelSetupManager] = None) -> None:
    global _default_manager
    _default_manager = manager
