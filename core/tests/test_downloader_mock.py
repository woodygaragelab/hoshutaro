"""
ModelSetupManager の mock 駆動 integration test。

実 HuggingFace / OpenVINO 量子化を呼び出さずに、ダウンロード→変換→完了の
状態遷移と SSE 進捗通知が正しく動くかを検証する。

Track B 本実行（実モデル）の前段で、orchestration ロジックの正当性を担保する。

実行:
    cd core && python tests/test_downloader_mock.py
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
import tempfile
from pathlib import Path


def _setup_path_and_env() -> Path:
    """sys.path 追加 + テンポラリの models dir を切る。"""
    backend = Path(__file__).resolve().parent.parent
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))
    tmp = Path(tempfile.mkdtemp(prefix="mu_downloader_test_"))
    os.environ["HOSHUTARO_MODELS_DIR"] = str(tmp)
    return tmp


def _patch_convert_to_noop(manager) -> list[str]:
    """`_convert_one` を「`.convert_done` マーカーを書くだけ」に置き換える。"""
    called: list[str] = []

    def fake_convert(*, repo: str, quantization: str, hf_token):
        called.append(repo)
        from app.mu.setup.downloader import _models_root, _slug

        target = _models_root() / _slug(repo)
        target.mkdir(parents=True, exist_ok=True)
        (target / ".convert_done").write_text("ok")

    manager._convert_one = fake_convert  # type: ignore[assignment]
    return called


# ───────────────────────────────────────────────────────────
# Tests
# ───────────────────────────────────────────────────────────


def test_full_setup_flow_mocked():
    """target + drafter 両方を mock で完走させ、状態遷移を検証。"""
    tmp = _setup_path_and_env()
    try:
        from app.mu.setup.downloader import ModelSetupManager

        manager = ModelSetupManager()
        called = _patch_convert_to_noop(manager)

        # 初期状態
        assert manager.status.state == "idle"
        assert manager.setup_required() == {"target": True, "drafter": True}

        async def go():
            started = await manager.trigger_download(include_drafter=True)
            assert started is True

            # 既に running なら 2 回目は False
            second = await manager.trigger_download(include_drafter=True)
            assert second is False

            # 完了待ち
            assert manager._task is not None
            await manager._task

        asyncio.run(go())

        # 完了状態
        assert manager.status.state == "done", manager.status
        assert manager.status.progress_pct == 100.0
        assert "google/gemma-4-E2B-it" in manager.status.completed_repos
        assert "google/gemma-4-E2B-it-assistant" in manager.status.completed_repos

        # mock が target / drafter 両方で呼ばれた
        assert len(called) == 2
        assert called[0] == "google/gemma-4-E2B-it"
        assert called[1] == "google/gemma-4-E2B-it-assistant"

        # マーカーファイルが書かれ setup_required が false に
        assert manager.setup_required() == {"target": False, "drafter": False}

        # 環境変数が補完されている
        assert os.environ.get("LOCAL_LLM_TARGET_MODEL_DIR") == str(manager.target_dir())
        assert os.environ.get("LOCAL_LLM_DRAFTER_MODEL_DIR") == str(manager.drafter_dir())

        print("OK: full_setup_flow_mocked")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop("HOSHUTARO_MODELS_DIR", None)
        os.environ.pop("LOCAL_LLM_TARGET_MODEL_DIR", None)
        os.environ.pop("LOCAL_LLM_DRAFTER_MODEL_DIR", None)


def test_skip_existing_target():
    """`.convert_done` が既存の場合は convert を呼ばずスキップ。"""
    tmp = _setup_path_and_env()
    try:
        from app.mu.setup.downloader import ModelSetupManager, _models_root, _slug

        # target のみ既に done
        target = _models_root() / _slug("google/gemma-4-E2B-it")
        target.mkdir(parents=True, exist_ok=True)
        (target / ".convert_done").write_text("ok")

        manager = ModelSetupManager()
        called = _patch_convert_to_noop(manager)

        assert manager.setup_required() == {"target": False, "drafter": True}

        async def go():
            await manager.trigger_download(include_drafter=True)
            await manager._task

        asyncio.run(go())

        # target はスキップ、drafter のみ convert された
        assert manager.status.state == "done"
        assert called == ["google/gemma-4-E2B-it-assistant"], called
        # しかし両方 completed_repos には記録される
        assert "google/gemma-4-E2B-it" in manager.status.completed_repos
        assert "google/gemma-4-E2B-it-assistant" in manager.status.completed_repos
        print("OK: skip_existing_target")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop("HOSHUTARO_MODELS_DIR", None)


def test_failure_propagates():
    """convert 中の例外が status.failed に伝播することを確認。"""
    tmp = _setup_path_and_env()
    try:
        from app.mu.setup.downloader import ModelSetupManager

        manager = ModelSetupManager()

        def fake_failing_convert(*, repo, quantization, hf_token):
            raise RuntimeError("simulated convert failure")

        manager._convert_one = fake_failing_convert  # type: ignore[assignment]

        async def go():
            await manager.trigger_download(include_drafter=False)
            await manager._task

        asyncio.run(go())

        assert manager.status.state == "failed"
        assert manager.status.error and "simulated convert failure" in manager.status.error
        print("OK: failure_propagates")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop("HOSHUTARO_MODELS_DIR", None)


def test_progress_event_fires():
    """SSE 用 progress event が convert ステップで起きることを確認。"""
    tmp = _setup_path_and_env()
    try:
        from app.mu.setup.downloader import ModelSetupManager

        manager = ModelSetupManager()
        _patch_convert_to_noop(manager)

        events = 0

        async def consume():
            """progress_stream を tick ごとに数える（最大 5 イベントで停止）。"""
            nonlocal events
            async for _ in manager.progress_stream():
                events += 1
                if events >= 5 or manager.status.state in ("done", "failed"):
                    break

        async def go():
            await manager.trigger_download(include_drafter=True)
            # 進捗 stream と job 完了を並行
            await asyncio.wait_for(asyncio.gather(consume(), manager._task), timeout=5.0)

        asyncio.run(go())

        # 少なくとも 1 つは progress イベントが発火している
        assert events >= 1, f"no progress events fired (got {events})"
        assert manager.status.state == "done"
        print(f"OK: progress_event_fires (events={events})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop("HOSHUTARO_MODELS_DIR", None)


# ───────────────────────────────────────────────────────────
# Runner
# ───────────────────────────────────────────────────────────


if __name__ == "__main__":
    failed = 0
    for fn in (
        test_full_setup_flow_mocked,
        test_skip_existing_target,
        test_failure_propagates,
        test_progress_event_fires,
    ):
        try:
            fn()
        except AssertionError as e:
            print(f"FAIL: {fn.__name__}: {e}")
            failed += 1
        except Exception as e:
            import traceback

            print(f"ERROR: {fn.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    if failed:
        print(f"\n=== {failed} test(s) failed ===")
        sys.exit(1)
    print("\n=== All passed ===")
