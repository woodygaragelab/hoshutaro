"""
LoRA トレーナー（PEFT + PyTorch）— Track A スコープでは未実装スタブ。

実装ガイドライン（Track B 終了後 Track A 後半で実装）:
  - PEFT の LoraConfig: rank=8-16, alpha=16-32, target_modules=q_proj/v_proj
  - 1 epoch、データセット数百件、所要 15-30分（Intel Arc GPU 推奨）
  - 入出力: training_cache.list_unused() でデータ取得 → Hugging Face Dataset 化 → Trainer.train()
  - 出力: ~/.hoshutaro/lora/{version}.safetensors
  - 完了後: lora_adapters.register + training_cache.mark_used + evaluator.evaluate
            → Hold-out で base 比 +X% 以上なら adapter_manager.activate

現状の挙動:
  - train_lora() は NotImplementedError を投げる
  - これは training_scheduler が捕捉してジョブ状態を 'failed (not implemented)' にする
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from app.mu.memory import training_cache as training_cache_repo

logger = logging.getLogger(__name__)


def _generate_version(prefix: str = "v") -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"


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
) -> dict[str, Any]:
    """
    LoRA ファインチューニングを実行（**未実装スタブ**）。

    実装時に必要な手順:
      1. training_cache_repo.list_unused() で学習データ取得
      2. Hugging Face Dataset 化（input_text → output_json のペア）
      3. PEFT LoraConfig 作成
      4. transformers.Trainer で学習
      5. 保存: adapter_manager.adapter_path(version)
      6. lora_adapters.register
      7. evaluator.evaluate で評価
      8. delta が閾値超なら adapter_manager.activate
      9. training_cache_repo.mark_used で消費済みに

    Returns:
        {"version": str, "trained_count": int, "metrics": dict}
    """
    target_modules = target_modules or ["q_proj", "v_proj"]
    examples = training_cache_repo.list_unused(
        organization=organization, task_type=task_type, limit=10_000
    )
    logger.info(
        "LoRA training requested: %d examples, base=%s, rank=%d, alpha=%d, epochs=%d",
        len(examples),
        base_model,
        rank,
        alpha,
        epochs,
    )
    raise NotImplementedError(
        "LoRA training is not implemented yet. "
        "Implement using PEFT + PyTorch + transformers in Track A後半 / Track B 完了後. "
        f"Pending examples: {len(examples)}"
    )
