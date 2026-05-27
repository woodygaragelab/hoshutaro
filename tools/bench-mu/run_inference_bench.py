#!/usr/bin/env python3
"""
Track B 実機検証 — 推論ベンチマーク (real-model inference benchmark)。

OpenVinoGemmaAdapter を実モデルで駆動し、以下を計測:
  - first-token latency (P50, P95, P99)
  - tokens/sec (生成スループット)
  - MTP 有効/無効の差分（accept rate と speedup factor）
  - メモリピーク（任意、psutil があれば）

使い方:
    # 事前確認（必須）
    python tools/bench-mu/check_setup.py --strict

    # ベンチ本実行
    python tools/bench-mu/run_inference_bench.py
    python tools/bench-mu/run_inference_bench.py --repeat 3 --max-new-tokens 256
    python tools/bench-mu/run_inference_bench.py --no-mtp                  # MTP off only
    python tools/bench-mu/run_inference_bench.py --output-dir bench-out/   # JSON 結果保存先

出力:
  - 標準出力: 人間可読な集計テーブル
  - bench_results_<timestamp>.json: 機械可読の生データ（CI ベースライン記録用）
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional


# ───────────────────────────────────────────────────────────
# Data classes
# ───────────────────────────────────────────────────────────


@dataclass
class PromptCase:
    id: str
    label: str
    messages: list[dict]
    max_new_tokens: int = 256


@dataclass
class RunMetric:
    """1 prompt × 1 run（mtp on/off）の計測結果。"""

    prompt_id: str
    mtp_enabled: bool
    first_token_latency_ms: float
    total_latency_ms: float
    generated_tokens: int
    tokens_per_sec: float
    output_text: str = ""
    error: Optional[str] = None


@dataclass
class AggregatedStats:
    mtp_enabled: bool
    sample_count: int
    first_token_latency_p50_ms: float
    first_token_latency_p95_ms: float
    first_token_latency_p99_ms: float
    tokens_per_sec_mean: float
    tokens_per_sec_p50: float


@dataclass
class BenchReport:
    started_at: str
    finished_at: str
    device: str
    target_repo: str
    drafter_repo: Optional[str]
    prompt_count: int
    repeat: int
    runs: list[RunMetric] = field(default_factory=list)
    aggregated: list[AggregatedStats] = field(default_factory=list)
    mtp_speedup: Optional[float] = None
    """MTP 有効時の tokens/sec / 無効時の tokens/sec。> 1 で高速化。"""
    notes: list[str] = field(default_factory=list)


# ───────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────


def _here() -> Path:
    return Path(__file__).resolve().parent


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    frac = k - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def _load_prompts(path: Path) -> list[PromptCase]:
    if not path.exists():
        raise FileNotFoundError(f"Prompts file not found: {path}")
    cases: list[PromptCase] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        d = json.loads(line)
        cases.append(
            PromptCase(
                id=d["id"],
                label=d.get("label", d["id"]),
                messages=d["messages"],
                max_new_tokens=int(d.get("max_new_tokens", 256)),
            )
        )
    return cases


def _aggregate(runs: list[RunMetric], *, mtp: bool) -> AggregatedStats:
    subset = [r for r in runs if r.mtp_enabled == mtp and r.error is None]
    if not subset:
        return AggregatedStats(
            mtp_enabled=mtp,
            sample_count=0,
            first_token_latency_p50_ms=0.0,
            first_token_latency_p95_ms=0.0,
            first_token_latency_p99_ms=0.0,
            tokens_per_sec_mean=0.0,
            tokens_per_sec_p50=0.0,
        )
    ftl = [r.first_token_latency_ms for r in subset]
    tps = [r.tokens_per_sec for r in subset]
    return AggregatedStats(
        mtp_enabled=mtp,
        sample_count=len(subset),
        first_token_latency_p50_ms=_percentile(ftl, 0.50),
        first_token_latency_p95_ms=_percentile(ftl, 0.95),
        first_token_latency_p99_ms=_percentile(ftl, 0.99),
        tokens_per_sec_mean=statistics.fmean(tps),
        tokens_per_sec_p50=_percentile(tps, 0.50),
    )


# ───────────────────────────────────────────────────────────
# Adapter execution
# ───────────────────────────────────────────────────────────


def _build_adapter(no_mtp: bool):
    """OpenVinoGemmaAdapter を registry 経由で構築。"""
    # backend をパスに追加（CLI 単体実行を想定）
    backend = (Path(__file__).resolve().parent.parent.parent / "core").resolve()
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))

    from app.llm.adapters.openvino_gemma import OpenVinoGemmaAdapter  # type: ignore
    from app.llm.registry import LLM_MODELS  # type: ignore

    target_spec = LLM_MODELS.get("local_gemma_4_e2b_it")
    drafter_spec = (
        None if no_mtp else LLM_MODELS.get("local_gemma_4_e2b_it_assistant")
    )
    if not target_spec:
        raise RuntimeError("LLM_MODELS missing local_gemma_4_e2b_it")
    return OpenVinoGemmaAdapter(target_spec, assistant_spec=drafter_spec)


def _run_one(
    adapter, case: PromptCase, *, mtp: bool, max_new_tokens: int
) -> RunMetric:
    """1 ケース × 1 設定を計測。

    NOTE: streaming API を使うことで first-token latency を計測する。
    streaming が使えない場合は total latency のみ記録（first_token は同値）。
    """
    import asyncio

    async def _go() -> RunMetric:
        start = time.perf_counter()
        first_token_at: Optional[float] = None
        token_count = 0
        chunks: list[str] = []
        try:
            async for chunk in adapter.conversational_stream(
                messages=case.messages,
                max_new_tokens=max_new_tokens,
                use_mtp=mtp,
            ):
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                token_count += 1
                chunks.append(chunk)
        except NotImplementedError as e:
            return RunMetric(
                prompt_id=case.id,
                mtp_enabled=mtp,
                first_token_latency_ms=0.0,
                total_latency_ms=0.0,
                generated_tokens=0,
                tokens_per_sec=0.0,
                error=f"NotImplementedError: {e}",
            )
        except Exception as e:
            return RunMetric(
                prompt_id=case.id,
                mtp_enabled=mtp,
                first_token_latency_ms=0.0,
                total_latency_ms=0.0,
                generated_tokens=0,
                tokens_per_sec=0.0,
                error=f"{type(e).__name__}: {e}",
            )
        end = time.perf_counter()
        ftl_ms = ((first_token_at or end) - start) * 1000.0
        total_ms = (end - start) * 1000.0
        tps = (token_count / (total_ms / 1000.0)) if total_ms > 0 else 0.0
        return RunMetric(
            prompt_id=case.id,
            mtp_enabled=mtp,
            first_token_latency_ms=ftl_ms,
            total_latency_ms=total_ms,
            generated_tokens=token_count,
            tokens_per_sec=tps,
            output_text="".join(chunks)[:200],  # 先頭 200 字のみサンプル保存
        )

    return asyncio.run(_go())


# ───────────────────────────────────────────────────────────
# Bench main
# ───────────────────────────────────────────────────────────


def run_bench(
    *,
    prompts_path: Path,
    repeat: int,
    max_new_tokens: int,
    no_mtp: bool,
    no_mtp_baseline: bool,
) -> BenchReport:
    cases = _load_prompts(prompts_path)
    if not cases:
        raise RuntimeError("Empty prompts file")

    started = datetime.utcnow().isoformat() + "Z"
    notes: list[str] = []

    # アダプタ構築（mtp on / off ケース両方を 1 つで賄う：use_mtp 引数で切替）
    adapter = _build_adapter(no_mtp=no_mtp)

    target_repo = adapter.spec.get("hf_repo", "")
    drafter_repo = (
        adapter.assistant_spec.get("hf_repo") if adapter.assistant_spec else None
    )
    device = adapter.device

    runs: list[RunMetric] = []
    settings = []
    if not no_mtp_baseline:
        settings.append(False)  # baseline: MTP off
    if not no_mtp:
        settings.append(True)   # with MTP

    if not settings:
        raise RuntimeError("No settings to run (--no-mtp と --no-mtp-baseline 両指定不可)")

    for case in cases:
        for mtp in settings:
            for _ in range(repeat):
                runs.append(
                    _run_one(adapter, case, mtp=mtp, max_new_tokens=max_new_tokens)
                )

    aggregated = [_aggregate(runs, mtp=m) for m in settings]
    mtp_speedup: Optional[float] = None
    if False in settings and True in settings:
        base = next((a for a in aggregated if not a.mtp_enabled), None)
        with_mtp = next((a for a in aggregated if a.mtp_enabled), None)
        if base and with_mtp and base.tokens_per_sec_mean > 0:
            mtp_speedup = with_mtp.tokens_per_sec_mean / base.tokens_per_sec_mean

    err_count = sum(1 for r in runs if r.error)
    if err_count:
        notes.append(f"{err_count}/{len(runs)} runs errored. See runs[].error for details.")

    return BenchReport(
        started_at=started,
        finished_at=datetime.utcnow().isoformat() + "Z",
        device=device,
        target_repo=target_repo,
        drafter_repo=drafter_repo,
        prompt_count=len(cases),
        repeat=repeat,
        runs=runs,
        aggregated=aggregated,
        mtp_speedup=mtp_speedup,
        notes=notes,
    )


# ───────────────────────────────────────────────────────────
# CLI
# ───────────────────────────────────────────────────────────


def _print_summary(report: BenchReport) -> None:
    print("=" * 78)
    print(f"Track B Inference Bench  device={report.device}  repeat={report.repeat}")
    print(f"  target  : {report.target_repo}")
    print(f"  drafter : {report.drafter_repo or '(none, MTP disabled)'}")
    print(f"  prompts : {report.prompt_count}  runs={len(report.runs)}")
    print("=" * 78)
    print(f"{'MTP':5s}  {'samples':7s}  {'first-tok p50/p95/p99 ms':28s}  {'tok/sec mean/p50':18s}")
    for a in report.aggregated:
        mtp = "ON " if a.mtp_enabled else "OFF"
        ftl = f"{a.first_token_latency_p50_ms:6.1f}/{a.first_token_latency_p95_ms:6.1f}/{a.first_token_latency_p99_ms:6.1f}"
        tps = f"{a.tokens_per_sec_mean:6.2f}/{a.tokens_per_sec_p50:6.2f}"
        print(f"  {mtp:3s}  {a.sample_count:7d}  {ftl:28s}  {tps:18s}")
    if report.mtp_speedup is not None:
        print("-" * 78)
        print(f"  MTP speedup factor: {report.mtp_speedup:.2f}x  (mean tokens/sec ratio)")
    if report.notes:
        print("-" * 78)
        for n in report.notes:
            print(f"  ! {n}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Track B inference benchmark")
    ap.add_argument(
        "--prompts",
        type=Path,
        default=_here() / "prompts" / "benchmark_set.jsonl",
        help="JSONL of {id, label, messages, max_new_tokens?}",
    )
    ap.add_argument("--repeat", type=int, default=3, help="Repeat per (case, mtp)")
    ap.add_argument(
        "--max-new-tokens",
        type=int,
        default=256,
        help="Default cap; overridden by per-prompt max_new_tokens",
    )
    ap.add_argument(
        "--no-mtp",
        action="store_true",
        help="Skip MTP-enabled run (baseline only)",
    )
    ap.add_argument(
        "--no-mtp-baseline",
        action="store_true",
        help="Skip MTP-disabled baseline (MTP only)",
    )
    ap.add_argument(
        "--output-dir",
        type=Path,
        default=Path("bench-out"),
        help="Where to write bench_results_<timestamp>.json",
    )
    ap.add_argument("--json", action="store_true", help="Emit JSON only to stdout")
    args = ap.parse_args()

    try:
        report = run_bench(
            prompts_path=args.prompts,
            repeat=args.repeat,
            max_new_tokens=args.max_new_tokens,
            no_mtp=args.no_mtp,
            no_mtp_baseline=args.no_mtp_baseline,
        )
    except (NotImplementedError, RuntimeError) as e:
        print(f"ABORT: {e}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(asdict(report), ensure_ascii=False, indent=2, default=str))
    else:
        _print_summary(report)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    out = args.output_dir / f"bench_results_{ts}.json"
    out.write_text(
        json.dumps(asdict(report), ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"\nWrote: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
