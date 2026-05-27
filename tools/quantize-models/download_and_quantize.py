"""
Gemma 4 E2B-it (target) + Gemma 4 E2B-it-assistant (MTP drafter) を
HuggingFace Hub からダウンロードし、OpenVINO INT4 / INT8 形式に量子化するスクリプト。

実行方法:
    python tools/quantize-models/download_and_quantize.py \\
        --target google/gemma-4-E2B-it \\
        --drafter google/gemma-4-E2B-it-assistant \\
        --output-dir ~/.hoshutaro/models \\
        --target-quant int4 --drafter-quant int8

依存:
    pip install -U huggingface_hub optimum-intel[nncf] transformers openvino

参考: tools/quantize-models/README.md
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _slug(repo: str) -> str:
    return repo.replace("/", "_").lower()


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _check_dependencies() -> tuple[bool, list[str]]:
    """必要な依存ライブラリの存在確認。"""
    missing = []
    try:
        import huggingface_hub  # noqa: F401
    except ImportError:
        missing.append("huggingface_hub")
    try:
        import transformers  # noqa: F401
    except ImportError:
        missing.append("transformers")
    try:
        from optimum.intel import OVModelForCausalLM  # noqa: F401
    except ImportError:
        missing.append("optimum-intel[nncf]")
    return (len(missing) == 0, missing)


def download_and_quantize(
    *,
    repo_id: str,
    output_dir: Path,
    quantization: str = "int4",
    revision: Optional[str] = None,
    hf_token: Optional[str] = None,
    skip_existing: bool = True,
) -> Path:
    """
    HuggingFace から repo_id を取得し、OpenVINO IR + 量子化形式で output_dir に保存。

    Args:
        repo_id: 例 "google/gemma-4-E2B-it"
        output_dir: モデルの親ディレクトリ（実体は output_dir/<repo-slug>/）
        quantization: "int4" | "int8" | "fp16"
        revision: HuggingFace のバージョン（None なら main）
        hf_token: アクセストークン（環境変数 HUGGINGFACE_HUB_TOKEN でも可）
        skip_existing: True なら既存ディレクトリはスキップ

    Returns:
        変換後モデルディレクトリのパス
    """
    out_path = _ensure_dir(output_dir / _slug(repo_id))

    # 既存スキップ
    marker = out_path / ".convert_done"
    if skip_existing and marker.exists():
        logger.info("Skipping %s (already converted at %s)", repo_id, out_path)
        return out_path

    ok, missing = _check_dependencies()
    if not ok:
        raise RuntimeError(
            f"Missing dependencies: {missing}. "
            "Install with `pip install -U huggingface_hub optimum-intel[nncf] transformers openvino`"
        )

    from optimum.intel import OVModelForCausalLM  # type: ignore
    from optimum.intel import OVWeightQuantizationConfig  # type: ignore
    from transformers import AutoTokenizer  # type: ignore

    token = hf_token or os.environ.get("HUGGINGFACE_HUB_TOKEN")

    logger.info(
        "Downloading + converting %s → %s (quant=%s)",
        repo_id,
        out_path,
        quantization,
    )

    # 量子化設定
    quant = quantization.lower()
    quant_config = None
    load_in_8bit = False
    if quant == "int4":
        quant_config = OVWeightQuantizationConfig(bits=4, sym=True, group_size=128)
    elif quant == "int8":
        load_in_8bit = True
    elif quant == "fp16":
        quant_config = None
    else:
        raise ValueError(f"Unsupported quantization: {quantization}")

    # OpenVINO IR へ変換 + 量子化（HuggingFace から自動取得）
    kwargs: dict = {
        "export": True,
        "trust_remote_code": False,
        "token": token,
    }
    if quant_config is not None:
        kwargs["quantization_config"] = quant_config
    if load_in_8bit:
        kwargs["load_in_8bit"] = True
    if revision:
        kwargs["revision"] = revision

    model = OVModelForCausalLM.from_pretrained(repo_id, **kwargs)
    model.save_pretrained(str(out_path))

    # トークナイザも保存
    tokenizer = AutoTokenizer.from_pretrained(repo_id, token=token, revision=revision)
    tokenizer.save_pretrained(str(out_path))

    marker.write_text(f"repo_id={repo_id}\nquantization={quantization}\n", encoding="utf-8")
    logger.info("✓ Saved: %s", out_path)
    return out_path


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Download + OpenVINO量子化（Gemma 4 E2B-it と MTP drafter）"
    )
    parser.add_argument(
        "--target", default="google/gemma-4-E2B-it", help="ターゲットモデル"
    )
    parser.add_argument(
        "--drafter",
        default="google/gemma-4-E2B-it-assistant",
        help="MTP drafter（assistant）モデル",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path.home() / ".hoshutaro" / "models"),
        help="出力ディレクトリ",
    )
    parser.add_argument(
        "--target-quant",
        default="int4",
        choices=["int4", "int8", "fp16"],
        help="ターゲット量子化（既定: int4）",
    )
    parser.add_argument(
        "--drafter-quant",
        default="int8",
        choices=["int4", "int8", "fp16"],
        help="drafter 量子化（既定: int8）",
    )
    parser.add_argument(
        "--target-only",
        action="store_true",
        help="drafter を取得しない（MTP 無効運用時）",
    )
    parser.add_argument("--hf-token", default=None, help="HuggingFace アクセストークン")
    parser.add_argument(
        "--no-skip",
        action="store_true",
        help="既存変換済みディレクトリも上書き再変換",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=args.log_level, format="%(asctime)s [%(levelname)s] %(message)s")

    ok, missing = _check_dependencies()
    if not ok:
        print(f"ERROR: missing dependencies: {missing}", file=sys.stderr)
        print(
            "Install: pip install -U huggingface_hub optimum-intel[nncf] transformers openvino",
            file=sys.stderr,
        )
        return 1

    output_dir = Path(os.path.expanduser(args.output_dir))

    try:
        download_and_quantize(
            repo_id=args.target,
            output_dir=output_dir,
            quantization=args.target_quant,
            hf_token=args.hf_token,
            skip_existing=not args.no_skip,
        )
        if not args.target_only:
            download_and_quantize(
                repo_id=args.drafter,
                output_dir=output_dir,
                quantization=args.drafter_quant,
                hf_token=args.hf_token,
                skip_existing=not args.no_skip,
            )
    except Exception as e:
        logger.exception("Failed to download/quantize")
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    print(f"\n✓ All models saved under {output_dir}")
    print(
        "Next: set environment variables\n"
        f"  LOCAL_LLM_TARGET_MODEL_DIR={output_dir / _slug(args.target)}\n"
        f"  LOCAL_LLM_DRAFTER_MODEL_DIR={output_dir / _slug(args.drafter)}\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
