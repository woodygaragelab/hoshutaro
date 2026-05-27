"""
sql_context リゾルバ — Skill 定義の sql_context ラベルを実 SQL/ベクトル検索に解決。

Skill YAML ヘッダー例:
    sql_context:
      - source: rules
        filter:
          task_type: id_normalization
          organization: $current_org
          active: 1
        order_by: success_count DESC
        limit: 20
        template: rules_for_prompt
      - source: master_map_vec
        similar_to: $input.sample_text
        limit: 10
        template: similar_mappings

実行時、本リゾルバが:
  1. ランタイム変数（$current_org, $input.* 等）を解決
  2. source ごとに DB / ベクトル検索を実行
  3. テンプレート（Jinja2 or 簡易 format）でプロンプト注入用文字列に整形
  4. {sql_context.<source>} へ展開

詳細: docs/4_SKILL_RECIPES.md, docs/PROJECT_MU.md
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from app.mu.embeddings.local_embedder import get_embedder
from app.mu.memory import master_map as master_map_repo
from app.mu.memory import rules as rules_repo
from app.mu.memory import vector_search

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Data classes
# ───────────────────────────────────────────────────────────


@dataclass
class SqlContextEntry:
    """Skill 定義の sql_context リスト1要素。"""

    source: str
    """rules | master_map | master_map_vec | rules_vec | training_cache"""

    filter: dict[str, Any] = field(default_factory=dict)
    similar_to: Optional[str] = None
    """ベクトル検索: 入力テキスト（変数展開可）"""

    order_by: Optional[str] = None
    limit: int = 20
    template: Optional[str] = None
    """整形テンプレート名（rules_for_prompt 等、None なら自動整形）"""

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SqlContextEntry":
        if not isinstance(raw, dict):
            raise TypeError(f"sql_context entry must be dict, got {type(raw)}")
        if "source" not in raw:
            raise ValueError(f"sql_context entry missing 'source': {raw}")
        return cls(
            source=str(raw["source"]),
            filter=dict(raw.get("filter") or {}),
            similar_to=raw.get("similar_to"),
            order_by=raw.get("order_by"),
            limit=int(raw.get("limit", 20)),
            template=raw.get("template"),
        )


@dataclass
class ResolvedContext:
    """source 別の整形済み出力を保持。{{ sql_context.<source> }} で参照。"""

    entries: dict[str, str] = field(default_factory=dict)
    used_rule_ids: list[int] = field(default_factory=list)
    used_mapping_ids: list[int] = field(default_factory=list)

    def __getattr__(self, name: str) -> str:
        # Jinja2 や python.format で sql_context.rules のようにアクセス可能に
        if name in self.entries:
            return self.entries[name]
        raise AttributeError(f"sql_context has no source '{name}'")

    def to_dict(self) -> dict[str, str]:
        return dict(self.entries)


# ───────────────────────────────────────────────────────────
# Variable substitution
# ───────────────────────────────────────────────────────────


def _substitute(value: Any, runtime_vars: dict[str, Any]) -> Any:
    """
    値内の $var / $input.key を runtime_vars で置換。
    $input.<key> は runtime_vars["input"][<key>] を参照。
    """
    if not isinstance(value, str):
        return value
    if not value.startswith("$"):
        return value
    key = value[1:]
    if "." in key:
        head, _, tail = key.partition(".")
        scope = runtime_vars.get(head)
        if isinstance(scope, dict):
            return scope.get(tail)
        return None
    return runtime_vars.get(key)


def _resolve_filter(
    raw_filter: dict[str, Any],
    runtime_vars: dict[str, Any],
) -> dict[str, Any]:
    return {k: _substitute(v, runtime_vars) for k, v in raw_filter.items()}


# ───────────────────────────────────────────────────────────
# Source handlers
# ───────────────────────────────────────────────────────────


def _format_rules(records, template: Optional[str]) -> str:
    if not records:
        return "(no rules)"
    lines = []
    for r in records:
        regex = r.regex_pattern if hasattr(r, "regex_pattern") else None
        lines.append(
            f"- [{r.id}] task_type={r.task_type}, "
            f"regex={regex or 'N/A'}, instruction={r.instruction_text}"
        )
    return "\n".join(lines)


def _format_mappings(records, template: Optional[str]) -> str:
    if not records:
        return "(no mappings)"
    lines = []
    for m in records:
        lines.append(
            f"- raw={m.raw_name} → std={m.standard_name}, "
            f"category={m.category_id}, location={m.location_path}"
        )
    return "\n".join(lines)


def _format_vector_hits(items: list[tuple[Any, float]], template: Optional[str]) -> str:
    if not items:
        return "(no similar mappings)"
    lines = []
    for mapping, distance in items:
        lines.append(
            f"- raw={mapping.raw_name} (dist={distance:.3f}) → "
            f"std={mapping.standard_name}, category={mapping.category_id}, "
            f"location={mapping.location_path}"
        )
    return "\n".join(lines)


def _resolve_rules(
    entry: SqlContextEntry,
    *,
    runtime_vars: dict[str, Any],
) -> tuple[str, list[int]]:
    f = _resolve_filter(entry.filter, runtime_vars)
    records = rules_repo.list_for_prompt(
        task_type=f.get("task_type"),
        organization=f.get("organization"),
        only_active=bool(f.get("active", True)),
        limit=entry.limit,
    )
    return _format_rules(records, entry.template), [
        r.id for r in records if r.id is not None
    ]


def _resolve_master_map(
    entry: SqlContextEntry,
    *,
    runtime_vars: dict[str, Any],
) -> tuple[str, list[int]]:
    f = _resolve_filter(entry.filter, runtime_vars)
    records = master_map_repo.list_all(
        organization=f.get("organization"),
        confirmed_only=bool(f.get("user_confirmed", False)),
        limit=entry.limit,
    )
    return _format_mappings(records, entry.template), [
        m.id for m in records if m.id is not None
    ]


def _resolve_master_map_vec(
    entry: SqlContextEntry,
    *,
    runtime_vars: dict[str, Any],
) -> tuple[str, list[int]]:
    if not vector_search.is_available():
        return "(vector search disabled)", []
    similar_to_value = _substitute(entry.similar_to, runtime_vars)
    if not similar_to_value:
        return "(no query text for vector search)", []
    embedder = get_embedder()
    if not embedder.is_available:
        return "(embedder unavailable)", []
    try:
        emb = embedder.encode_one(str(similar_to_value))
    except Exception as e:
        logger.debug("Embedding for sql_context vector search failed: %s", e)
        return f"(embedding failed: {e})", []

    hits = vector_search.search_master_map(query=emb, k=entry.limit)
    pairs: list[tuple[Any, float]] = []
    used_ids: list[int] = []
    for map_id, distance in hits:
        mapping = master_map_repo.get(map_id)
        if mapping:
            pairs.append((mapping, distance))
            used_ids.append(map_id)
    return _format_vector_hits(pairs, entry.template), used_ids


def _resolve_rules_vec(
    entry: SqlContextEntry,
    *,
    runtime_vars: dict[str, Any],
) -> tuple[str, list[int]]:
    if not vector_search.is_available():
        return "(vector search disabled)", []
    similar_to_value = _substitute(entry.similar_to, runtime_vars)
    if not similar_to_value:
        return "(no query text for vector search)", []
    embedder = get_embedder()
    if not embedder.is_available:
        return "(embedder unavailable)", []
    emb = embedder.encode_one(str(similar_to_value))
    hits = vector_search.search_rules(query=emb, k=entry.limit)
    records = []
    used_ids: list[int] = []
    for rid, _ in hits:
        r = rules_repo.get(rid)
        if r:
            records.append(r)
            used_ids.append(rid)
    return _format_rules(records, entry.template), used_ids


_HANDLERS = {
    "rules": _resolve_rules,
    "master_map": _resolve_master_map,
    "master_map_vec": _resolve_master_map_vec,
    "rules_vec": _resolve_rules_vec,
}


# ───────────────────────────────────────────────────────────
# Public API
# ───────────────────────────────────────────────────────────


def resolve_sql_context(
    sql_context_spec: list[dict[str, Any]] | None,
    *,
    runtime_vars: Optional[dict[str, Any]] = None,
) -> ResolvedContext:
    """
    Skill 定義の sql_context リストを実行し、整形済み出力を ResolvedContext で返す。

    Args:
        sql_context_spec: Skill YAML/Markdown frontmatter の sql_context フィールド（list of dict）
        runtime_vars: ランタイム変数 ($current_org, $input.* 等)

    Returns:
        ResolvedContext: entries[<source>] で整形済み文字列を取得。
                        used_rule_ids / used_mapping_ids で参照したレコード id を取得。
    """
    if not sql_context_spec:
        return ResolvedContext()

    rv = dict(runtime_vars or {})
    ctx = ResolvedContext()

    for raw in sql_context_spec:
        try:
            entry = SqlContextEntry.from_dict(raw)
        except Exception as e:
            logger.warning("Invalid sql_context entry skipped: %s (%s)", raw, e)
            continue

        handler = _HANDLERS.get(entry.source)
        if not handler:
            logger.warning("Unknown sql_context source: %s", entry.source)
            ctx.entries[entry.source] = f"(unsupported source: {entry.source})"
            continue

        try:
            text, used_ids = handler(entry, runtime_vars=rv)
        except Exception as e:
            logger.error("sql_context resolve failed for %s: %s", entry.source, e)
            ctx.entries[entry.source] = f"(resolve error: {e})"
            continue

        ctx.entries[entry.source] = text
        if entry.source in ("rules", "rules_vec"):
            ctx.used_rule_ids.extend(used_ids)
        elif entry.source in ("master_map", "master_map_vec"):
            ctx.used_mapping_ids.extend(used_ids)

    return ctx
