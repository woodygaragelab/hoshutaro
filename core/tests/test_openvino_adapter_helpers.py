"""
OpenVinoGemmaAdapter のヘルパ純関数の unit test。

依存（transformers / optimum-intel / openvino）が無い環境でも実行可能。
これにより、Track B 本実行（実モデル推論）の事前に最低限の正当性を担保する。

実行:
    cd core && python tests/test_openvino_adapter_helpers.py

カバー対象:
    - _strip_thinking: <|think|>...</think> ブロック除去
    - _format_messages: チャットテンプレ整形
    - _detect_device: 環境変数オーバーライド経路
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _setup_path() -> None:
    backend = Path(__file__).resolve().parent.parent
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))


# ───────────────────────────────────────────────────────────
# _strip_thinking
# ───────────────────────────────────────────────────────────


def test_strip_thinking_basic():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _strip_thinking

    # 基本: thinking が削除され answer のみ残る
    s = "<|think|>これは思考</think>これは答え"
    assert _strip_thinking(s) == "これは答え"

    # 思考が無い場合はそのまま
    assert _strip_thinking("普通の応答") == "普通の応答"

    # 複数行 thinking
    s = "<|think|>line1\nline2\nline3</think>final"
    assert _strip_thinking(s) == "final"

    # 前後の空白は trim される
    s = "  <|think|>x</think>  out  "
    assert _strip_thinking(s) == "out"

    # thinking ブロックのみで answer 空 → 空文字
    assert _strip_thinking("<|think|>only</think>") == ""

    print("OK: _strip_thinking basic")


def test_strip_thinking_multiple_blocks():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _strip_thinking

    # 複数の thinking ブロック
    s = "<|think|>step1</think>middle<|think|>step2</think>final"
    assert _strip_thinking(s) == "middlefinal"

    print("OK: _strip_thinking multiple blocks")


# ───────────────────────────────────────────────────────────
# _format_messages
# ───────────────────────────────────────────────────────────


def test_format_messages_basic():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _format_messages

    out = _format_messages(
        [
            {"role": "system", "content": "Be helpful."},
            {"role": "user", "content": "Hello"},
        ]
    )
    # Gemma 4 chat template の特徴を検査
    assert "<start_of_turn>system" in out
    assert "Be helpful." in out
    assert "<start_of_turn>user" in out
    assert "Hello" in out
    # 最後にアシスタント開始タグが入っていること
    assert out.endswith("<start_of_turn>model\n")
    # role 未指定はデフォルト user 扱い
    out2 = _format_messages([{"content": "no-role"}])
    assert "<start_of_turn>user" in out2
    print("OK: _format_messages basic")


def test_format_messages_empty():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _format_messages

    # 空リストでも model 開始タグだけは付く
    out = _format_messages([])
    assert out == "<start_of_turn>model\n"
    print("OK: _format_messages empty")


# ───────────────────────────────────────────────────────────
# _detect_device
# ───────────────────────────────────────────────────────────


def test_detect_device_env_override():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _detect_device

    # 明示指定が最優先（OpenVINO 未インストール環境でも値はそのまま返る）
    saved = os.environ.get("OPENVINO_DEVICE")
    try:
        os.environ["OPENVINO_DEVICE"] = "gpu"
        assert _detect_device() == "GPU"  # 大文字化
        os.environ["OPENVINO_DEVICE"] = "  npu  "
        assert _detect_device() == "NPU"
    finally:
        if saved is None:
            os.environ.pop("OPENVINO_DEVICE", None)
        else:
            os.environ["OPENVINO_DEVICE"] = saved
    print("OK: _detect_device env override")


def test_detect_device_fallback():
    _setup_path()
    from app.llm.adapters.openvino_gemma import _detect_device

    # OPENVINO_DEVICE 未指定 + openvino 未インストール → CPU フォールバック
    saved = os.environ.get("OPENVINO_DEVICE")
    try:
        os.environ.pop("OPENVINO_DEVICE", None)
        # この CI 環境では openvino 入っていないので "CPU" が返るはず
        # （openvino インストール済の dev box では NPU/GPU が返ってもこのテストは skip）
        try:
            import openvino  # noqa: F401
            print("SKIP: openvino installed (device detection depends on hardware)")
            return
        except ImportError:
            pass
        assert _detect_device() == "CPU"
    finally:
        if saved is not None:
            os.environ["OPENVINO_DEVICE"] = saved
    print("OK: _detect_device CPU fallback")


# ───────────────────────────────────────────────────────────
# Runner
# ───────────────────────────────────────────────────────────


if __name__ == "__main__":
    failed = 0
    for fn in (
        test_strip_thinking_basic,
        test_strip_thinking_multiple_blocks,
        test_format_messages_basic,
        test_format_messages_empty,
        test_detect_device_env_override,
        test_detect_device_fallback,
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
