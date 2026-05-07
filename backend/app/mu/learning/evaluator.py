"""
LoRA 評価器（Hold-out セットでの精度測定）。

仕様:
  - training_cache の user_confirmed=1 レコードから 80/20 で train/test 分割
  - test セットを LoRA 適用前 (base) / 適用後 で推論し、JSON 一致率を比較
  - 一致率向上が +X% 未満の場合は LoRA 採用見送り（adapter_manager.activate を呼ばない）

現状:
  - LLM Adapter 未実装のため、Track A スコープではメトリクス枠組みのみ提供
  - 実推論は Track B の OpenVinoGemmaAdapter 完成後に有効化
"""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass
from typing import Any, Optional

from app.llm import LLMAdapter, get_adapter
from app.mu.memory import training_cache as training_cache_repo

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    """LoRA 評価結果。"""

    sample_size: int
    base_accuracy: float
    lora_accuracy: float
    delta: float
    """delta > 0 なら LoRA が改善、< 0 なら劣化"""

    notes: list[str]


def _is_match(expected: str, actual: str) -> bool:
    """JSON 同等性で正解判定（緩く）。"""
    try:
        a = json.loads(expected)
        b = json.loads(actual)
        return a == b
    except json.JSONDecodeError:
        return expected.strip() == actual.strip()


async def _accuracy_with_adapter(
    adapter: LLMAdapter,
    test_cases: list,
    notes: list[str],
) -> float:
    """テストケース集合に対する正解率を返す。"""
    if not test_cases:
        return 0.0
    correct = 0
    for tc in test_cases:
        try:
            actual = await adapter.generate_structured(
                system_prompt=f"task_type: {tc.task_type}",
                user_prompt=tc.input_text,
            )
        except NotImplementedError as e:
            notes.append(f"Adapter not implemented: {e}")
            return 0.0
        except Exception as e:
            notes.append(f"Eval error on case {tc.id}: {e}")
            continue
        if _is_match(tc.output_json, actual):
            correct += 1
    return correct / len(test_cases)


async def evaluate(
    *,
    base_adapter: Optional[LLMAdapter] = None,
    lora_adapter: Optional[LLMAdapter] = None,
    organization: Optional[str] = None,
    task_type: Optional[str] = None,
    test_ratio: float = 0.2,
    max_examples: int = 200,
    seed: int = 42,
) -> EvaluationResult:
    """
    Hold-out 評価を実行。

    Args:
        base_adapter: LoRA 適用前モデル
        lora_adapter: LoRA 適用後モデル（未指定時は base_adapter と同じインスタンス、
                      実装により内部状態切替で評価する想定）
        organization: 対象組織
        task_type: 対象タスク
        test_ratio: テストセット比率（学習対象から除外）
        max_examples: 上限件数（評価時間の上限）
        seed: シャッフル乱数シード
    """
    base = base_adapter or get_adapter()
    lora = lora_adapter or base

    notes: list[str] = []

    examples = training_cache_repo.list_unused(
        organization=organization, task_type=task_type, limit=max_examples
    )
    if len(examples) < 10:
        notes.append("Not enough examples for evaluation (<10).")
        return EvaluationResult(
            sample_size=0,
            base_accuracy=0.0,
            lora_accuracy=0.0,
            delta=0.0,
            notes=notes,
        )

    rng = random.Random(seed)
    rng.shuffle(examples)
    test_size = max(1, int(len(examples) * test_ratio))
    test_cases = examples[:test_size]

    base_acc = await _accuracy_with_adapter(base, test_cases, notes)
    lora_acc = await _accuracy_with_adapter(lora, test_cases, notes)

    return EvaluationResult(
        sample_size=len(test_cases),
        base_accuracy=base_acc,
        lora_accuracy=lora_acc,
        delta=lora_acc - base_acc,
        notes=notes,
    )
