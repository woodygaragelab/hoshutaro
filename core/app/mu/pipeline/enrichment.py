"""
フェーズ3: 意味補完・階層化パイプライン（Enrichment Phase）。

入力: フェーズ2の出力 + 未登録の機器名
処理:
  1. master_map.find_by_raw_name で完全一致検索（既知マッピング即適用）
  2. 未登録なら master_map_vec ベクトル検索で「似た過去」TopK 取得
  3. 候補を LLM に提示し連想推論で最適選択
  4. 結果は EnrichedItem として返す（user_confirmed=False）
  5. ユーザー確認後、commit_user_confirmation() で master_map に蓄積
     + training_cache に学習用ペアを INSERT
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from app.llm import LLMAdapter, get_adapter
from app.mu.embeddings.local_embedder import get_embedder
from app.mu.memory import master_map as master_map_repo
from app.mu.memory import training_cache as training_cache_repo
from app.mu.memory import vector_search

logger = logging.getLogger(__name__)


ENRICHMENT_SYSTEM_PROMPT = """\
あなたは機器名の意味を解釈し、最適なカテゴリ・ロケーション階層を選ぶ専門家です。
以下の「過去の確定マッピング（候補）」を参考に、入力の raw_name に最もふさわしい
standard_name / category_id / location_path を JSON で返してください。

## 出力フォーマット
{
  "standard_name": "...",
  "category_id": "...",
  "location_path": "棟A/3F/エリアB",
  "confidence": 0.0-1.0,
  "reasoning": "選定根拠（簡潔に）"
}
"""


@dataclass
class EnrichmentCandidate:
    """ベクトル検索 or 完全一致で得た候補。"""

    mapping_id: int
    raw_name: str
    standard_name: Optional[str]
    category_id: Optional[str]
    location_path: Optional[str]
    distance: Optional[float]
    user_confirmed: bool


@dataclass
class EnrichedItem:
    """フェーズ3 の出力レコード。"""

    raw_name: str
    standard_name: Optional[str] = None
    category_id: Optional[str] = None
    location_path: Optional[str] = None
    confidence: float = 0.0
    source: str = "unknown"
    """source: 'exact_match' | 'vector_top1_high_confidence' | 'llm_inference' | 'failed'"""
    reasoning: Optional[str] = None
    candidates: list[EnrichmentCandidate] = field(default_factory=list)
    error: Optional[str] = None


class EnrichmentPipeline:
    """フェーズ3 意味補完パイプライン。"""

    def __init__(
        self,
        *,
        adapter: Optional[LLMAdapter] = None,
        embedder=None,
        top_k: int = 10,
        exact_match_threshold: float = 1.0,
        vector_top1_threshold: float = 0.85,
    ) -> None:
        self.adapter = adapter or get_adapter()
        self.embedder = embedder or get_embedder()
        self.top_k = top_k
        self.exact_match_threshold = exact_match_threshold
        self.vector_top1_threshold = vector_top1_threshold

    async def enrich(
        self,
        *,
        raw_names: list[str],
        organization: Optional[str] = None,
    ) -> list[EnrichedItem]:
        results: list[EnrichedItem] = []
        for name in raw_names:
            results.append(await self._enrich_one(name, organization=organization))
        return results

    async def _enrich_one(
        self,
        raw_name: str,
        *,
        organization: Optional[str],
    ) -> EnrichedItem:
        # 1. 完全一致
        exact = master_map_repo.find_by_raw_name(
            raw_name, organization=organization, confirmed_only=True
        )
        if exact:
            top = exact[0]
            return EnrichedItem(
                raw_name=raw_name,
                standard_name=top.standard_name,
                category_id=top.category_id,
                location_path=top.location_path,
                confidence=top.confidence or 1.0,
                source="exact_match",
                candidates=[
                    EnrichmentCandidate(
                        mapping_id=top.id,
                        raw_name=top.raw_name,
                        standard_name=top.standard_name,
                        category_id=top.category_id,
                        location_path=top.location_path,
                        distance=0.0,
                        user_confirmed=top.user_confirmed,
                    )
                ],
            )

        # 2. ベクトル類似検索（top_k）
        candidates = self._vector_search(raw_name)

        # 3a. ベクトル top1 が高信頼度ならそのまま採用（LLM 呼び出し節約）
        if (
            candidates
            and candidates[0].distance is not None
            and candidates[0].distance < (1 - self.vector_top1_threshold)
        ):
            top = candidates[0]
            return EnrichedItem(
                raw_name=raw_name,
                standard_name=top.standard_name,
                category_id=top.category_id,
                location_path=top.location_path,
                confidence=self.vector_top1_threshold,
                source="vector_top1_high_confidence",
                candidates=candidates,
                reasoning="ベクトル類似度が高く、LLM 推論をスキップ",
            )

        # 3b. LLM で連想推論
        try:
            inferred = await self._llm_infer(raw_name, candidates)
        except NotImplementedError as e:
            logger.warning("Enrichment LLM skipped: %s", e)
            return EnrichedItem(
                raw_name=raw_name,
                source="failed",
                candidates=candidates,
                error=f"LLM not implemented: {e}",
            )
        except Exception as e:
            logger.error("Enrichment LLM call failed: %s", e)
            return EnrichedItem(
                raw_name=raw_name,
                source="failed",
                candidates=candidates,
                error=str(e),
            )

        return EnrichedItem(
            raw_name=raw_name,
            standard_name=inferred.get("standard_name"),
            category_id=inferred.get("category_id"),
            location_path=inferred.get("location_path"),
            confidence=float(inferred.get("confidence", 0.5)),
            source="llm_inference",
            reasoning=inferred.get("reasoning"),
            candidates=candidates,
        )

    def _vector_search(self, raw_name: str) -> list[EnrichmentCandidate]:
        if not (vector_search.is_available() and self.embedder.is_available):
            return []
        try:
            emb = self.embedder.encode_one(raw_name)
            hits = vector_search.search_master_map(query=emb, k=self.top_k)
        except Exception as e:
            logger.debug("Vector search skipped: %s", e)
            return []

        candidates: list[EnrichmentCandidate] = []
        for map_id, distance in hits:
            mapping = master_map_repo.get(map_id)
            if not mapping:
                continue
            candidates.append(
                EnrichmentCandidate(
                    mapping_id=map_id,
                    raw_name=mapping.raw_name,
                    standard_name=mapping.standard_name,
                    category_id=mapping.category_id,
                    location_path=mapping.location_path,
                    distance=distance,
                    user_confirmed=mapping.user_confirmed,
                )
            )
        return candidates

    async def _llm_infer(
        self,
        raw_name: str,
        candidates: list[EnrichmentCandidate],
    ) -> dict[str, Any]:
        candidates_block = (
            "\n".join(
                f"- raw={c.raw_name} → std={c.standard_name}, "
                f"category={c.category_id}, location={c.location_path}, dist={c.distance:.3f}"
                for c in candidates
                if c.distance is not None
            )
            or "(候補なし、汎用知識で推論してください)"
        )
        user_prompt = (
            f"## 入力\nraw_name: {raw_name}\n\n"
            f"## 候補（過去マッピング）\n{candidates_block}"
        )
        raw = await self.adapter.generate_structured(
            system_prompt=ENRICHMENT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(raw[start : end + 1])
        return {}


# ───────────────────────────────────────────────────────────
# ユーザー承認 → master_map + training_cache 蓄積
# ───────────────────────────────────────────────────────────


def commit_user_confirmation(
    *,
    item: EnrichedItem,
    organization: Optional[str] = None,
    source_file: Optional[str] = None,
    embedder=None,
    task_type_for_training: str = "enrichment_classification_location",
) -> dict[str, int]:
    """
    ユーザーが補完結果を承認した際、master_map と training_cache に蓄積する。

    Returns:
        {"master_map_id": int, "training_cache_id": int}
    """
    if not item.standard_name and not item.category_id and not item.location_path:
        raise ValueError("Cannot commit: enriched item has no resolved fields")

    # master_map へ INSERT（user_confirmed=True）
    map_id = master_map_repo.create(
        raw_name=item.raw_name,
        standard_name=item.standard_name,
        category_id=item.category_id,
        location_path=item.location_path,
        user_confirmed=True,
        confidence=item.confidence or 1.0,
        source_file=source_file,
        organization=organization,
    )

    # ベクトル登録
    embedder = embedder or get_embedder()
    if vector_search.is_available() and embedder.is_available:
        try:
            emb = embedder.encode_one(item.raw_name)
            vector_search.upsert_master_map(map_id=map_id, embedding=emb)
        except Exception as e:
            logger.debug("Vector index on commit skipped: %s", e)

    # training_cache へ INSERT（学習データ蓄積）
    training_input = json.dumps({"raw_name": item.raw_name}, ensure_ascii=False)
    training_output = json.dumps(
        {
            "standard_name": item.standard_name,
            "category_id": item.category_id,
            "location_path": item.location_path,
        },
        ensure_ascii=False,
    )
    tc_id = training_cache_repo.add(
        task_type=task_type_for_training,
        input_text=training_input,
        output_json=training_output,
        confidence_score=item.confidence or 1.0,
        user_confirmed=True,
        organization=organization,
    )

    logger.info(
        "Enrichment committed: master_map_id=%d, training_cache_id=%d (org=%s)",
        map_id,
        tc_id,
        organization,
    )
    return {"master_map_id": map_id, "training_cache_id": tc_id}
