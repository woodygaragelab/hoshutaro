"""
フェーズ1: ルール蒸留パイプライン（Distillation Phase）。

入力: ユーザー Excel/CSV から代表的な数件（10-20行）をサンプリング
処理: Gemma 4 E2B-it + Thinking Mode で ID命名規則・表記揺れ・階層構造を自己分析
保存: rules テーブルに INSERT（source='distilled'）

LLM 呼び出し:
  - LLMAdapter.generate_structured() を使い JSON Schema で出力強制
  - Thinking Mode は OpenVinoGemmaAdapter（Track B）が <|think|> タグを処理する
    本パイプラインは「Adapter が Thinking 結果を抽出した後の最終出力」を扱う
"""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass
from typing import Any, Optional

from app.llm import LLMAdapter, get_adapter
from app.mu.embeddings.local_embedder import get_embedder
from app.mu.memory import rules as rules_repo
from app.mu.memory import vector_search

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Schema
# ───────────────────────────────────────────────────────────


DISTILLATION_SYSTEM_PROMPT = """\
あなたは機器台帳の構造解析専門家です。サンプル行データから、ID命名規則・表記揺れ・階層構造を分析し、
正規化ルール（regex_pattern と instruction_text）を JSON で返してください。

Thinking Mode を活用し、複雑な構造は反復自己検証してください（OmniDocBench 1.5 スコア 0.290 を考慮）。

## 出力フォーマット（JSON Schema）
{
  "rules": [
    {
      "task_type": "id_normalization | character_conversion | header_pattern | classification_inference | location_hierarchy",
      "regex_pattern": "正規表現（コード適用可能なもの。なければ null）",
      "instruction_text": "LLM 向け自然言語指示（必須）",
      "examples": ["EQ001", "EQ-001"],
      "confidence": 0.0-1.0
    }
  ]
}
"""


_DISTILLED_SCHEMA = {
    "type": "object",
    "properties": {
        "rules": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task_type": {"type": "string"},
                    "regex_pattern": {"type": ["string", "null"]},
                    "instruction_text": {"type": "string"},
                    "examples": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "number"},
                },
                "required": ["task_type", "instruction_text"],
            },
        }
    },
    "required": ["rules"],
}


@dataclass
class DistillationResult:
    saved_rule_ids: list[int]
    raw_rules: list[dict[str, Any]]
    sample_size: int
    skipped_count: int
    error: Optional[str] = None


# ───────────────────────────────────────────────────────────
# Sampler
# ───────────────────────────────────────────────────────────


def _sample_rows(rows: list[Any], sample_size: int = 20) -> list[Any]:
    """先頭 + ランダムで偏りを抑える。"""
    if len(rows) <= sample_size:
        return list(rows)
    head = rows[: max(1, sample_size // 4)]
    rest = rows[len(head):]
    sampled = random.sample(rest, k=sample_size - len(head))
    return head + sampled


def _format_rows_for_prompt(rows: list[Any]) -> str:
    """サンプル行を JSON 文字列としてプロンプトに整形。"""
    if not rows:
        return "(no rows)"
    return json.dumps(rows[:20], ensure_ascii=False, indent=2)


# ───────────────────────────────────────────────────────────
# Pipeline
# ───────────────────────────────────────────────────────────


class DistillationPipeline:
    """
    フェーズ1 ルール蒸留パイプライン。

    Args:
        adapter: LLMAdapter（None なら registry から取得）
        sample_size: サンプリング件数（デフォルト 20）
        embedder: 埋め込みモデル（None ならデフォルト、ベクトル登録は best-effort）
    """

    def __init__(
        self,
        *,
        adapter: Optional[LLMAdapter] = None,
        sample_size: int = 20,
        embedder=None,
    ) -> None:
        self.adapter = adapter or get_adapter()
        self.sample_size = sample_size
        self.embedder = embedder or get_embedder()

    async def run(
        self,
        *,
        rows: list[Any],
        organization: Optional[str] = None,
    ) -> DistillationResult:
        """
        サンプリング → LLM 推論 → rules テーブルへ保存。

        rows: 任意の行データ（dict のリスト推奨）
        organization: マルチテナント境界
        """
        sample = _sample_rows(rows, self.sample_size)
        sample_str = _format_rows_for_prompt(sample)

        user_prompt = (
            "以下のサンプル行を分析し、機器台帳構造化に必要なルールを JSON で抽出してください。\n\n"
            f"## サンプル行（{len(sample)}件、全{len(rows)}件中）\n"
            f"{sample_str}"
        )

        try:
            raw = await self.adapter.generate_structured(
                system_prompt=DISTILLATION_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                json_schema=_DISTILLED_SCHEMA,
            )
        except NotImplementedError as e:
            logger.warning("Distillation skipped: LLM adapter not implemented (%s)", e)
            return DistillationResult(
                saved_rule_ids=[],
                raw_rules=[],
                sample_size=len(sample),
                skipped_count=len(rows) - len(sample),
                error=f"LLM adapter not implemented: {e}",
            )
        except Exception as e:
            logger.error("Distillation LLM call failed: %s", e)
            return DistillationResult(
                saved_rule_ids=[],
                raw_rules=[],
                sample_size=len(sample),
                skipped_count=len(rows) - len(sample),
                error=str(e),
            )

        parsed = self._parse_response(raw)
        if parsed is None:
            return DistillationResult(
                saved_rule_ids=[],
                raw_rules=[],
                sample_size=len(sample),
                skipped_count=len(rows) - len(sample),
                error="Failed to parse LLM response as JSON",
            )

        saved_ids = self._save_rules(parsed.get("rules", []), organization=organization)

        return DistillationResult(
            saved_rule_ids=saved_ids,
            raw_rules=parsed.get("rules", []),
            sample_size=len(sample),
            skipped_count=len(rows) - len(sample),
        )

    def _parse_response(self, raw: str) -> Optional[dict[str, Any]]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # 緩やかな抽出: 最初の { から最後の } までを試行
            try:
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
        logger.warning("Distillation: could not parse LLM response: %.200s", raw)
        return None

    def _save_rules(
        self,
        rule_dicts: list[dict[str, Any]],
        *,
        organization: Optional[str],
    ) -> list[int]:
        saved_ids: list[int] = []
        for r in rule_dicts:
            task_type = r.get("task_type")
            instruction = r.get("instruction_text")
            if not task_type or not instruction:
                continue
            rule_id = rules_repo.create(
                task_type=str(task_type),
                regex_pattern=r.get("regex_pattern") or None,
                instruction_text=str(instruction),
                organization=organization,
                examples=r.get("examples") or [],
                confidence=float(r.get("confidence", 0.5)),
                source="distilled",
                active=True,
            )
            saved_ids.append(rule_id)

            # ベクトル登録（best-effort、失敗してもパイプラインは継続）
            self._index_rule_vector(rule_id, instruction)
        logger.info(
            "Distillation: saved %d rules (org=%s)", len(saved_ids), organization
        )
        return saved_ids

    def _index_rule_vector(self, rule_id: int, instruction_text: str) -> None:
        if not vector_search.is_available():
            return
        if not self.embedder.is_available:
            return
        try:
            emb = self.embedder.encode_one(instruction_text)
            vector_search.upsert_rule(rule_id=rule_id, embedding=emb)
        except Exception as e:
            logger.debug("rule vector indexing skipped: %s", e)
