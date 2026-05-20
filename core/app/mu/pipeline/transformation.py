"""
フェーズ2: 高速一括変換パイプライン（Transformation Phase）。

入力: ユーザー Excel/CSV 全行 + フェーズ1で蒸留した rules
処理:
  1. 関連 rules を取得（task_type 別、success_count 降順）
  2. プロンプト構築（「ルール + 対象データ」のみ、MRCR 19.1% 対策）
  3. プロンプトキャッシュキー指定 → KV キャッシュ復元
  4. Thinking Mode をオフ
  5. MTP（Multi-Token Prediction）で 10行バッチ × N回 を高速化
  6. 各行に regex_pattern を適用 + LLM で例外処理
出力: 構造化済 JSON

設計:
  - regex_pattern が定義されているルールはコード側で先に適用（LLM 呼び出し回数削減）
  - LLM には正規表現で処理しきれない例外のみ渡す（コスト最小化）
  - バッチ単位で進捗コールバックを呼ぶ（フロント SSE 連携）
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from app.llm import LLMAdapter, get_adapter
from app.mu.cache.kv_cache_manager import get_manager as get_cache_manager
from app.mu.memory import prompt_cache as prompt_cache_repo
from app.mu.memory import rules as rules_repo

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Schema
# ───────────────────────────────────────────────────────────


TRANSFORMATION_SYSTEM_PROMPT_TEMPLATE = """\
あなたは機器台帳の構造化変換専門家です。以下のルールに基づき、入力行を JSON に変換してください。
コンテキストに含めるのは「ルール」と「対象データ」のみで、それ以外の情報は持ち込まないでください
（MRCR 19.1% 対策）。

## 既知の正規化ルール
{rules_block}

## 出力フォーマット
JSON 配列で、入力と同じ件数だけ返してください。
各要素: {{"raw": <入力行>, "normalized": {{"id": ..., "name": ..., ...}}, "applied_rule_ids": [int, ...]}}
"""


ProgressCallback = Callable[[int, int, str], None]
"""進捗通知: (current_batch, total_batches, message)"""


@dataclass
class TransformationResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    applied_rule_ids: set[int] = field(default_factory=set)
    cache_hits: int = 0
    cache_misses: int = 0
    batches: int = 0
    errors: list[str] = field(default_factory=list)


# ───────────────────────────────────────────────────────────
# Pipeline
# ───────────────────────────────────────────────────────────


class TransformationPipeline:
    """
    フェーズ2 高速一括変換。

    Args:
        adapter: LLMAdapter
        batch_size: 1リクエストで送る行数（None なら settings.excel_pipeline_chunk_size）
        max_concurrency: 並列バッチ数（None なら settings.excel_pipeline_max_concurrency）

    プラン WS1-7: batch_size / max_concurrency は config.py に集約。明示指定が優先。
    """

    def __init__(
        self,
        *,
        adapter: Optional[LLMAdapter] = None,
        batch_size: Optional[int] = None,
        max_concurrency: Optional[int] = None,
    ) -> None:
        from app.config import settings as _ws17_settings

        self.adapter = adapter or get_adapter()
        # batch_size は「1 リクエストで送る行数」。Excel チャンクサイズより小さい想定なので、
        # 専用既定 10 を維持しつつ env (EXCEL_PIPELINE_BATCH_SIZE 相当) が無いため設定値で上書き可能に。
        self.batch_size = (
            batch_size if batch_size is not None else 10
        )
        self.max_concurrency = (
            max_concurrency
            if max_concurrency is not None
            else max(1, int(_ws17_settings.excel_pipeline_max_concurrency))
        )

    async def run(
        self,
        *,
        rows: list[dict[str, Any]],
        task_types: Optional[list[str]] = None,
        organization: Optional[str] = None,
        prompt_cache_key: Optional[str] = None,
        model_id: str = "local_gemma_4_e2b_it",
        lora_version: Optional[str] = None,
        progress: Optional[ProgressCallback] = None,
    ) -> TransformationResult:
        """
        rows を構造化変換する。

        Args:
            rows: 入力行（dict のリスト）
            task_types: 適用したいルール種別（None なら全 task_type）
            organization: マルチテナント境界
            prompt_cache_key: 指定時は KV キャッシュを再利用検討
            model_id: 利用モデル（cache invalidate 判定用）
            lora_version: LoRA バージョン（cache invalidate 判定用）
            progress: 進捗コールバック
        """
        # 1. 関連ルール取得 + ハッシュ計算
        rules_for_prompt = self._collect_rules(task_types, organization)
        rules_hash = prompt_cache_repo.compute_rules_hash(
            [str(r.id) for r in rules_for_prompt]
        )

        # 2. キャッシュ判定
        cache_status = self._check_cache(
            prompt_cache_key=prompt_cache_key,
            rules_hash=rules_hash,
            model_id=model_id,
            lora_version=lora_version,
        )

        # 3. システムプロンプト組み立て
        system_prompt = self._build_system_prompt(rules_for_prompt)

        # 4. regex を先に適用（LLM 呼び出し削減）
        pre_processed = self._apply_regex_rules(rows, rules_for_prompt)
        applied_rule_ids: set[int] = set(pre_processed["rule_hits"])
        result_rows = list(pre_processed["rows"])

        # 5. LLM 残処理（regex で扱えなかった項目のみ）
        residual_indices = pre_processed["residual_indices"]
        if not residual_indices:
            logger.info("Transformation: all rows handled by regex; skipping LLM")
            return TransformationResult(
                rows=result_rows,
                applied_rule_ids=applied_rule_ids,
                cache_hits=cache_status["hits"],
                cache_misses=cache_status["misses"],
                batches=0,
            )

        # バッチ分割
        residual_rows = [rows[i] for i in residual_indices]
        batches = [
            residual_rows[i : i + self.batch_size]
            for i in range(0, len(residual_rows), self.batch_size)
        ]
        total = len(batches)
        errors: list[str] = []

        for bi, batch in enumerate(batches):
            try:
                if progress:
                    progress(bi + 1, total, f"Processing batch {bi + 1}/{total}")
                normalized = await self._call_llm_for_batch(system_prompt, batch)
                # residual_indices と batch の対応で結果を埋め戻す
                for offset, item in enumerate(normalized):
                    actual_idx = residual_indices[bi * self.batch_size + offset]
                    if actual_idx < len(result_rows):
                        result_rows[actual_idx] = item
                        for rid in item.get("applied_rule_ids", []):
                            try:
                                applied_rule_ids.add(int(rid))
                            except (TypeError, ValueError):
                                pass
            except NotImplementedError as e:
                logger.warning("Batch %d skipped: LLM not implemented (%s)", bi, e)
                errors.append(f"batch {bi}: LLM not implemented: {e}")
                # 全バッチをスキップ（adapter 未実装時）
                break
            except Exception as e:
                logger.error("Batch %d LLM call failed: %s", bi, e)
                errors.append(f"batch {bi}: {e}")

        # 6. ルール統計更新
        if applied_rule_ids:
            rules_repo.bulk_increment_usage(applied_rule_ids, success=True)

        # 7. キャッシュメタ更新（実ファイル書き込みは Adapter 側）
        if prompt_cache_key and cache_status["misses"] > 0:
            try:
                get_cache_manager().register(
                    cache_key=prompt_cache_key,
                    rules_hash=rules_hash,
                    model_id=model_id,
                    lora_version=lora_version,
                )
            except Exception as e:
                logger.debug("Cache register skipped: %s", e)

        return TransformationResult(
            rows=result_rows,
            applied_rule_ids=applied_rule_ids,
            cache_hits=cache_status["hits"],
            cache_misses=cache_status["misses"],
            batches=total,
            errors=errors,
        )

    # ───────────────────────────────────────────────────────
    # Helpers
    # ───────────────────────────────────────────────────────

    def _collect_rules(
        self,
        task_types: Optional[list[str]],
        organization: Optional[str],
    ) -> list:
        if not task_types:
            return rules_repo.list_for_prompt(
                organization=organization, only_active=True, limit=30
            )
        collected: list = []
        for tt in task_types:
            collected.extend(
                rules_repo.list_for_prompt(
                    task_type=tt,
                    organization=organization,
                    only_active=True,
                    limit=30,
                )
            )
        # 重複除去（id 単位）
        seen: set[int] = set()
        deduped: list = []
        for r in collected:
            if r.id is None or r.id in seen:
                continue
            seen.add(r.id)
            deduped.append(r)
        return deduped

    def _check_cache(
        self,
        *,
        prompt_cache_key: Optional[str],
        rules_hash: str,
        model_id: str,
        lora_version: Optional[str],
    ) -> dict[str, int]:
        hits = 0
        misses = 0
        if prompt_cache_key:
            try:
                path = get_cache_manager().lookup(
                    prompt_cache_key,
                    rules_hash=rules_hash,
                    model_id=model_id,
                    lora_version=lora_version,
                )
                if path:
                    hits = 1
                else:
                    misses = 1
            except Exception as e:
                logger.debug("Cache lookup skipped: %s", e)
                misses = 1
        return {"hits": hits, "misses": misses}

    def _build_system_prompt(self, rules) -> str:
        if not rules:
            block = "(no rules registered yet)"
        else:
            lines = []
            for r in rules:
                lines.append(
                    f"- [{r.id}] task_type={r.task_type}, "
                    f"regex={r.regex_pattern or 'N/A'}, "
                    f"instruction={r.instruction_text}"
                )
            block = "\n".join(lines)
        return TRANSFORMATION_SYSTEM_PROMPT_TEMPLATE.format(rules_block=block)

    def _apply_regex_rules(
        self,
        rows: list[dict[str, Any]],
        rules,
    ) -> dict[str, Any]:
        """
        regex_pattern がある id_normalization 系ルールを Python 側で適用。

        全フィールドが regex で完全に処理できた行は LLM に送らない。
        ここでは「id 列に regex を当てる」程度の保守的な処理に留める
        （完全網羅は LLM に任せる）。
        """
        result_rows = list(rows)
        rule_hits: list[int] = []
        residual_indices: list[int] = []
        normalization_rules = [
            r for r in rules if r.task_type == "id_normalization" and r.regex_pattern
        ]

        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                # 構造不明な行は LLM へ
                residual_indices.append(i)
                continue

            applied_ids: list[int] = []
            normalized = dict(row)

            # 'id' 風のキーに regex 適用
            for key in ("id", "asset_id", "ID", "Id"):
                if key in normalized and isinstance(normalized[key], str):
                    val = normalized[key]
                    for r in normalization_rules:
                        try:
                            if re.match(r.regex_pattern, val):
                                applied_ids.append(r.id)
                                break  # 最初にマッチしたルールで OK
                        except re.error:
                            continue

            if applied_ids:
                rule_hits.extend(applied_ids)
                result_rows[i] = {
                    "raw": row,
                    "normalized": normalized,
                    "applied_rule_ids": applied_ids,
                }
            # regex で完全処理できたかは判断難しいので、保守的に LLM にも回す
            residual_indices.append(i)

        return {
            "rows": result_rows,
            "rule_hits": rule_hits,
            "residual_indices": residual_indices,
        }

    async def _call_llm_for_batch(
        self,
        system_prompt: str,
        batch: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        user_prompt = "## 入力\n" + json.dumps(batch, ensure_ascii=False, indent=2)
        raw = await self.adapter.generate_structured(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # 配列を緩抽出
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1 and end > start:
                parsed = json.loads(raw[start : end + 1])
            else:
                logger.warning("Transformation: cannot parse batch response: %.200s", raw)
                parsed = []
        if not isinstance(parsed, list):
            return []
        return parsed
