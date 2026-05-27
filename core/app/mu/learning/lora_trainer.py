"""
LoRA トレーナー（PEFT + Hugging Face transformers）。

依存（オプション）:
    pip install transformers peft datasets accelerate safetensors torch
    # Intel Arc GPU 利用時は追加で:
    pip install intel-extension-for-pytorch

未インストール時は train_lora() が NotImplementedError を投げ、
training_scheduler が捕捉してジョブ状態を 'failed' にする（既存挙動と互換）。

学習仕様:
    - ベース: google/gemma-4-E2B-it（registry の resolve_target で解決）
    - LoraConfig: r=16, alpha=32, dropout=0.05, target_modules=["q_proj","v_proj"]
    - 1 epoch、バッチ 4、grad accum 4、lr 2e-4、warmup_ratio 0.03
    - 入出力: training_cache.list_unused() → SFT 形式に整形 → Trainer.train()

成果物:
    - PEFT 形式ディレクトリ ~/.hoshutaro/lora/{version}/ (adapter_model.safetensors + adapter_config.json + tokenizer)
    - lora_adapters メタ登録: file_path はディレクトリパス
    - training_cache.mark_used で消費済みに
    - evaluator.evaluate で base 比較、改善 +Δ ≥ activation_min_delta なら adapter_manager.activate

スレッディング:
    - 学習本体は同期（HF Trainer）。asyncio.run_in_executor 経由で実行しイベントループを止めない。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.mu.learning import adapter_manager
from app.mu.learning import evaluator as evaluator_module
from app.mu.memory import lora_adapters as lora_repo
from app.mu.memory import training_cache as training_cache_repo

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Optional imports（インストール無しでも import エラーを出さない）
# ───────────────────────────────────────────────────────────


def _load_training_stack() -> dict[str, Any]:
    """学習に必要な torch / transformers / peft / datasets を読み込む。

    成功時: モジュール参照を含む dict（'error' キーなし）
    失敗時: {'error': str} のみ

    重い import を遅延させるため、train_lora() の最初に呼ぶ。
    """
    try:
        import torch  # type: ignore
        from datasets import Dataset  # type: ignore
        from peft import LoraConfig, get_peft_model  # type: ignore
        from transformers import (  # type: ignore
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForLanguageModeling,
            Trainer,
            TrainingArguments,
        )
    except ImportError as e:
        return {"error": f"Training deps not installed: {e}"}
    return {
        "torch": torch,
        "AutoModelForCausalLM": AutoModelForCausalLM,
        "AutoTokenizer": AutoTokenizer,
        "DataCollator": DataCollatorForLanguageModeling,
        "Trainer": Trainer,
        "TrainingArguments": TrainingArguments,
        "LoraConfig": LoraConfig,
        "get_peft_model": get_peft_model,
        "Dataset": Dataset,
    }


def _detect_device(torch_module: Any) -> str:
    """学習デバイスを自動検出。優先順 cuda > xpu(Intel Arc/IPEX) > cpu。"""
    try:
        if torch_module.cuda.is_available():
            return "cuda"
        # XPU は intel-extension-for-pytorch を import して初めて有効化されることがある
        try:
            import intel_extension_for_pytorch  # type: ignore  # noqa: F401
        except ImportError:
            pass
        if hasattr(torch_module, "xpu") and torch_module.xpu.is_available():
            return "xpu"
    except Exception as e:
        logger.debug("Device detection fallback to CPU: %s", e)
    return "cpu"


# ───────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────


def _generate_version(prefix: str = "v") -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"


def _adapter_directory(version: str) -> Path:
    """PEFT 出力ディレクトリ。adapter_path() の '.safetensors' を取り除いた位置を使う。"""
    return adapter_manager.adapter_path(version).with_suffix("")


def _format_example(tokenizer: Any, ex: Any) -> dict[str, Any]:
    """training_cache.TrainingExample → SFT テキスト形式（Gemma 4 チャットテンプレ）。"""
    messages = [
        {
            "role": "system",
            "content": (
                f"You are an extraction assistant for task_type: {ex.task_type}. "
                "Output JSON only."
            ),
        },
        {"role": "user", "content": ex.input_text},
        {"role": "assistant", "content": ex.output_json},
    ]
    text = tokenizer.apply_chat_template(messages, tokenize=False)
    return {"text": text}


# ───────────────────────────────────────────────────────────
# 同期コア（run_in_executor 経由で呼ぶ）
# ───────────────────────────────────────────────────────────


def _train_sync(
    *,
    examples: list,
    base_model: str,
    rank: int,
    alpha: int,
    epochs: int,
    learning_rate: float,
    target_modules: list[str],
    output_dir: Path,
    max_seq_length: int,
) -> dict[str, Any]:
    stack = _load_training_stack()
    if "error" in stack:
        raise NotImplementedError(stack["error"])

    torch = stack["torch"]
    AutoModelForCausalLM = stack["AutoModelForCausalLM"]
    AutoTokenizer = stack["AutoTokenizer"]
    DataCollator = stack["DataCollator"]
    Trainer = stack["Trainer"]
    TrainingArguments = stack["TrainingArguments"]
    LoraConfig = stack["LoraConfig"]
    get_peft_model = stack["get_peft_model"]
    Dataset = stack["Dataset"]

    device = _detect_device(torch)
    use_bf16 = device != "cpu"
    dtype = torch.bfloat16 if use_bf16 else torch.float32
    logger.info(
        "LoRA training: device=%s dtype=%s base=%s examples=%d",
        device,
        dtype,
        base_model,
        len(examples),
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(base_model, torch_dtype=dtype)
    if device in ("cuda", "xpu"):
        model = model.to(device)

    peft_config = LoraConfig(
        r=rank,
        lora_alpha=alpha,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=target_modules,
    )
    model = get_peft_model(model, peft_config)

    raw_records = [_format_example(tokenizer, ex) for ex in examples]
    ds = Dataset.from_list(raw_records)

    def tokenize_fn(batch: dict) -> dict:
        out = tokenizer(
            batch["text"],
            truncation=True,
            max_length=max_seq_length,
            padding=False,
        )
        out["labels"] = [list(ids) for ids in out["input_ids"]]
        return out

    ds = ds.map(tokenize_fn, batched=True, remove_columns=["text"])

    output_dir.mkdir(parents=True, exist_ok=True)
    args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=epochs,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        warmup_ratio=0.03,
        logging_steps=10,
        save_strategy="no",
        report_to=[],
        bf16=use_bf16,
        fp16=False,
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds,
        data_collator=DataCollator(tokenizer=tokenizer, mlm=False),
    )
    train_result = trainer.train()

    # PEFT は adapter_model.safetensors と adapter_config.json をディレクトリへ書き出す
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    return {
        "loss": float(train_result.training_loss),
        "global_step": int(train_result.global_step),
        "device": device,
    }


# ───────────────────────────────────────────────────────────
# Public API
# ───────────────────────────────────────────────────────────


async def train_lora(
    *,
    organization: Optional[str] = None,
    task_type: Optional[str] = None,
    base_model: str = "google/gemma-4-E2B-it",
    rank: int = 16,
    alpha: int = 32,
    epochs: int = 1,
    learning_rate: float = 2e-4,
    target_modules: Optional[list[str]] = None,
    min_examples: int = 10,
    max_seq_length: int = 2048,
    activation_min_delta: float = 0.0,
    skip_evaluation: bool = False,
) -> dict[str, Any]:
    """LoRA ファインチューニングを実行（モジュール docstring 参照）。

    Returns:
        {
            "version": str,
            "trained_count": int,
            "activated": bool,
            "metrics": dict,  # loss, global_step, device, base_accuracy, lora_accuracy, delta, ...
        }

    Raises:
        NotImplementedError: 学習スタック（torch/transformers/peft/datasets）が未インストール
        RuntimeError: 学習データが min_examples 未満
    """
    target_modules = list(target_modules) if target_modules else ["q_proj", "v_proj"]

    # 0. 依存事前確認 — 重い処理前に Quick fail
    stack_check = _load_training_stack()
    if "error" in stack_check:
        raise NotImplementedError(
            f"{stack_check['error']}. "
            "Install with: pip install torch transformers peft datasets accelerate safetensors"
        )

    examples = training_cache_repo.list_unused(
        organization=organization, task_type=task_type, limit=10_000
    )
    if len(examples) < min_examples:
        raise RuntimeError(
            f"Not enough training examples: have={len(examples)} < min={min_examples}"
        )

    version = _generate_version()
    output_dir = _adapter_directory(version)

    logger.info(
        "LoRA training start: version=%s examples=%d base=%s rank=%d alpha=%d epochs=%d",
        version,
        len(examples),
        base_model,
        rank,
        alpha,
        epochs,
    )

    loop = asyncio.get_running_loop()
    train_metrics = await loop.run_in_executor(
        None,
        lambda: _train_sync(
            examples=examples,
            base_model=base_model,
            rank=rank,
            alpha=alpha,
            epochs=epochs,
            learning_rate=learning_rate,
            target_modules=target_modules,
            output_dir=output_dir,
            max_seq_length=max_seq_length,
        ),
    )

    metrics: dict[str, Any] = {
        **train_metrics,
        "rank": rank,
        "alpha": alpha,
        "epochs": epochs,
        "learning_rate": learning_rate,
        "target_modules": target_modules,
    }
    task_types_in_set = sorted({ex.task_type for ex in examples if ex.task_type})

    lora_repo.register(
        version=version,
        file_path=str(output_dir),
        base_model=base_model,
        task_types=task_types_in_set,
        training_examples_count=len(examples),
        metrics=metrics,
        organization=organization,
        activate=False,
    )

    eval_result = None
    if not skip_evaluation:
        try:
            eval_result = await evaluator_module.evaluate(
                organization=organization, task_type=task_type
            )
            metrics.update(
                {
                    "base_accuracy": eval_result.base_accuracy,
                    "lora_accuracy": eval_result.lora_accuracy,
                    "delta": eval_result.delta,
                    "eval_sample_size": eval_result.sample_size,
                    "eval_notes": eval_result.notes,
                }
            )
            lora_repo.update_metrics(version, metrics)
        except Exception as e:
            logger.warning("Evaluation failed (non-fatal): %s", e)
            metrics["evaluation_error"] = str(e)
            lora_repo.update_metrics(version, metrics)

    activated = False
    if eval_result is not None and eval_result.delta >= activation_min_delta:
        activated = adapter_manager.activate(version)

    used_ids = [ex.id for ex in examples if ex.id is not None]
    training_cache_repo.mark_used(used_ids, lora_version=version)

    logger.info(
        "LoRA training done: version=%s activated=%s loss=%s delta=%s",
        version,
        activated,
        metrics.get("loss"),
        metrics.get("delta"),
    )

    return {
        "version": version,
        "trained_count": len(examples),
        "activated": activated,
        "metrics": metrics,
    }
