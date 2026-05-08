#!/usr/bin/env python3
"""
Track B 実機検証 — 事前確認 (pre-flight check)。

依存・モデルファイル・OpenVINO デバイス・HF トークンを一括検証し、
不足を JSON + 人間可読な next-action として報告する。

使い方:
    python tools/bench-mu/check_setup.py
    python tools/bench-mu/check_setup.py --json   # JSON のみ出力
    python tools/bench-mu/check_setup.py --strict # blocker があれば exit 1

設計方針:
  - 重い import は遅延（未インストール環境でも import 失敗しない）
  - 失敗時は何をすればよいかを具体的なコマンドで提示
  - bench 本体（run_inference_bench.py）は実行前に必ず本スクリプトを通すこと
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class CheckItem:
    name: str
    ok: bool
    detail: str = ""
    next_action: str = ""


@dataclass
class SetupReport:
    overall_ok: bool
    items: list[CheckItem] = field(default_factory=list)
    summary: str = ""


# ───────────────────────────────────────────────────────────
# 個別チェック
# ───────────────────────────────────────────────────────────


def check_python() -> CheckItem:
    v = sys.version_info
    ok = v.major == 3 and v.minor >= 10
    return CheckItem(
        name="python_version",
        ok=ok,
        detail=f"{v.major}.{v.minor}.{v.micro}",
        next_action="" if ok else "Python 3.10+ にアップデート",
    )


def check_deps() -> list[CheckItem]:
    """transformers / optimum-intel / openvino / huggingface_hub の存在確認。"""
    items: list[CheckItem] = []
    for mod, install_hint in [
        ("transformers", "pip install -U transformers"),
        ("optimum.intel", "pip install -U 'optimum-intel[nncf]'"),
        ("openvino", "pip install -U openvino"),
        ("huggingface_hub", "pip install -U huggingface_hub"),
        ("torch", "pip install -U torch"),
    ]:
        try:
            __import__(mod)
            items.append(CheckItem(name=f"dep_{mod}", ok=True, detail="installed"))
        except ImportError as e:
            items.append(
                CheckItem(
                    name=f"dep_{mod}",
                    ok=False,
                    detail=str(e),
                    next_action=install_hint,
                )
            )
    return items


def check_hf_token() -> CheckItem:
    token = os.environ.get("HUGGINGFACE_HUB_TOKEN") or os.environ.get("HF_TOKEN")
    if token:
        return CheckItem(
            name="hf_token",
            ok=True,
            detail=f"set ({len(token)} chars)",
        )
    return CheckItem(
        name="hf_token",
        ok=False,
        detail="not set",
        next_action=(
            "HuggingFace でモデルアクセスを承認後、"
            "`export HUGGINGFACE_HUB_TOKEN=hf_xxx` または `huggingface-cli login`"
        ),
    )


def check_disk_space() -> CheckItem:
    home = Path.home()
    usage = shutil.disk_usage(home)
    free_gb = usage.free / (1024**3)
    # 量子化中のピーク使用量を考慮し 8GB 以上を推奨
    ok = free_gb >= 8
    return CheckItem(
        name="disk_space",
        ok=ok,
        detail=f"{free_gb:.1f} GB free at {home}",
        next_action="" if ok else "8 GB 以上空きを確保（量子化中のピークで必要）",
    )


def check_models() -> list[CheckItem]:
    """`.convert_done` マーカーで配置済かチェック。"""
    raw = os.environ.get("HOSHUTARO_MODELS_DIR")
    root = Path(raw).expanduser() if raw else Path.home() / ".hoshutaro" / "models"
    items: list[CheckItem] = []
    for repo in ("google/gemma-4-E2B-it", "google/gemma-4-E2B-it-assistant"):
        slug = repo.replace("/", "_").lower()
        marker = root / slug / ".convert_done"
        ok = marker.exists()
        items.append(
            CheckItem(
                name=f"model_{slug}",
                ok=ok,
                detail=f"{root / slug}",
                next_action=(
                    ""
                    if ok
                    else f"`python tools/quantize-models/download_and_quantize.py "
                    f"--target {repo}` でダウンロード"
                ),
            )
        )
    return items


def check_openvino_devices() -> CheckItem:
    """OpenVINO で利用可能なデバイス一覧。NPU > GPU > CPU の優先順を表示。"""
    try:
        import openvino as ov  # type: ignore
    except ImportError:
        return CheckItem(
            name="openvino_devices",
            ok=False,
            detail="openvino not installed",
            next_action="pip install -U openvino",
        )
    try:
        core = ov.Core()
        devices = list(core.available_devices)
        accel = [d for d in devices if d.startswith("NPU") or d.startswith("GPU")]
        ok = len(devices) > 0
        return CheckItem(
            name="openvino_devices",
            ok=ok,
            detail=f"available={devices} accelerators={accel or '(none, CPU only)'}",
            next_action=(
                ""
                if accel
                else "GPU/NPU が無いと推論が遅い。Intel Arc GPU を推奨。CPU で動作はする。"
            ),
        )
    except Exception as e:
        return CheckItem(
            name="openvino_devices",
            ok=False,
            detail=f"core init failed: {e}",
            next_action="OpenVINO ランタイムのインストール状態を確認",
        )


# ───────────────────────────────────────────────────────────
# 集約
# ───────────────────────────────────────────────────────────


def run_all_checks() -> SetupReport:
    items: list[CheckItem] = []
    items.append(check_python())
    items.extend(check_deps())
    items.append(check_hf_token())
    items.append(check_disk_space())
    items.extend(check_models())
    items.append(check_openvino_devices())

    overall = all(i.ok for i in items)
    blockers = [i for i in items if not i.ok]
    if overall:
        summary = "✅ All Track B prerequisites satisfied. Run run_inference_bench.py next."
    else:
        summary = (
            f"⚠️  {len(blockers)}/{len(items)} blocker(s). "
            "Fix the next_action items below before running the bench."
        )
    return SetupReport(overall_ok=overall, items=items, summary=summary)


# ───────────────────────────────────────────────────────────
# CLI
# ───────────────────────────────────────────────────────────


def _print_human(report: SetupReport) -> None:
    print("=" * 64)
    print("Track B Setup Check")
    print("=" * 64)
    for it in report.items:
        mark = "OK  " if it.ok else "FAIL"
        print(f"  [{mark}] {it.name:30s} {it.detail}")
        if not it.ok and it.next_action:
            print(f"         → {it.next_action}")
    print("-" * 64)
    print(report.summary)


def main() -> int:
    ap = argparse.ArgumentParser(description="Track B prerequisites checker")
    ap.add_argument("--json", action="store_true", help="Emit JSON only")
    ap.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 if any blocker exists (for CI)",
    )
    args = ap.parse_args()

    report = run_all_checks()

    if args.json:
        print(json.dumps(asdict(report), ensure_ascii=False, indent=2))
    else:
        _print_human(report)

    if args.strict and not report.overall_ok:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
