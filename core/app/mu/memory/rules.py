"""
rules テーブル CRUD（Project Mu フェーズ1 の蒸留結果保存・参照）。

スキーマ: schema.sql の `rules` テーブル参照。
主要カラム:
  - task_type: 'id_normalization' | 'character_conversion' | 'header_pattern' 等
  - regex_pattern: コード適用可能な正規表現
  - instruction_text: LLM 向け自然言語指示
  - confidence: 0.0-1.0
  - usage_count / success_count: 利用統計（プロンプト注入時の優先順位）
  - source: 'distilled' | 'user_added' | 'lora_learned'
  - active: 0/1（1のみが Skill のプロンプトに注入される）
"""

from __future__ import annotations

import json
import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable, Literal, Optional

from app.mu.memory.db import get_connection

logger = logging.getLogger(__name__)


RuleSource = Literal["distilled", "user_added", "lora_learned"]
TaskType = str  # 'id_normalization' 等、自由文字列で拡張可能


# ───────────────────────────────────────────────────────────
# Domain Model
# ───────────────────────────────────────────────────────────


@dataclass
class Rule:
    """rules 行のドメイン表現。"""

    id: Optional[int]
    task_type: TaskType
    regex_pattern: Optional[str]
    instruction_text: Optional[str]
    organization: Optional[str]
    examples: list[Any] = field(default_factory=list)
    confidence: float = 0.5
    usage_count: int = 0
    success_count: int = 0
    source: RuleSource = "distilled"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    active: bool = True

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Rule":
        examples_json = row["examples_json"]
        try:
            examples = json.loads(examples_json) if examples_json else []
        except json.JSONDecodeError:
            logger.warning("Rule id=%s: invalid examples_json", row["id"])
            examples = []
        return cls(
            id=row["id"],
            task_type=row["task_type"],
            regex_pattern=row["regex_pattern"],
            instruction_text=row["instruction_text"],
            organization=row["organization"],
            examples=examples,
            confidence=row["confidence"] if row["confidence"] is not None else 0.5,
            usage_count=row["usage_count"] or 0,
            success_count=row["success_count"] or 0,
            source=row["source"] or "distilled",
            created_at=_parse_ts(row["created_at"]),
            updated_at=_parse_ts(row["updated_at"]),
            active=bool(row["active"]),
        )


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        # SQLite のデフォルトフォーマット 'YYYY-MM-DD HH:MM:SS'
        return datetime.fromisoformat(str(value).replace(" ", "T"))
    except ValueError:
        return None


# ───────────────────────────────────────────────────────────
# CRUD
# ───────────────────────────────────────────────────────────


def create(
    *,
    task_type: TaskType,
    regex_pattern: Optional[str] = None,
    instruction_text: Optional[str] = None,
    organization: Optional[str] = None,
    examples: Optional[list[Any]] = None,
    confidence: float = 0.5,
    source: RuleSource = "distilled",
    active: bool = True,
) -> int:
    """新規ルールを作成し、id を返す。"""
    conn = get_connection()
    cur = conn.execute(
        """
        INSERT INTO rules (
            task_type, regex_pattern, instruction_text, organization,
            examples_json, confidence, source, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task_type,
            regex_pattern,
            instruction_text,
            organization,
            json.dumps(examples or [], ensure_ascii=False),
            float(confidence),
            source,
            1 if active else 0,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def get(rule_id: int) -> Optional[Rule]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
    return Rule.from_row(row) if row else None


def list_for_prompt(
    *,
    task_type: Optional[TaskType] = None,
    organization: Optional[str] = None,
    only_active: bool = True,
    limit: int = 20,
) -> list[Rule]:
    """
    Skill 実行時に system_prompt へ注入するルール一覧を取得。

    優先順位: success_count DESC, usage_count DESC, confidence DESC。
    """
    conditions: list[str] = []
    params: list[Any] = []
    if task_type:
        conditions.append("task_type = ?")
        params.append(task_type)
    if organization:
        # organization=NULL（汎用）と一致するレコードも含める
        conditions.append("(organization = ? OR organization IS NULL)")
        params.append(organization)
    if only_active:
        conditions.append("active = 1")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT * FROM rules
        {where}
        ORDER BY success_count DESC, usage_count DESC, confidence DESC
        LIMIT ?
    """
    params.append(int(limit))
    rows = get_connection().execute(sql, params).fetchall()
    return [Rule.from_row(r) for r in rows]


def list_all(
    *,
    task_type: Optional[TaskType] = None,
    organization: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> list[Rule]:
    """管理画面・診断用の網羅取得。"""
    conditions: list[str] = []
    params: list[Any] = []
    if task_type:
        conditions.append("task_type = ?")
        params.append(task_type)
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    if not include_inactive:
        conditions.append("active = 1")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = f"""
        SELECT * FROM rules
        {where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    """
    params.extend([int(limit), int(offset)])
    rows = get_connection().execute(sql, params).fetchall()
    return [Rule.from_row(r) for r in rows]


def update(
    rule_id: int,
    *,
    regex_pattern: Optional[str] = None,
    instruction_text: Optional[str] = None,
    examples: Optional[list[Any]] = None,
    confidence: Optional[float] = None,
    source: Optional[RuleSource] = None,
    active: Optional[bool] = None,
) -> bool:
    """指定フィールドのみ更新。True/False で成功可否を返す。"""
    sets: list[str] = []
    params: list[Any] = []
    if regex_pattern is not None:
        sets.append("regex_pattern = ?")
        params.append(regex_pattern)
    if instruction_text is not None:
        sets.append("instruction_text = ?")
        params.append(instruction_text)
    if examples is not None:
        sets.append("examples_json = ?")
        params.append(json.dumps(examples, ensure_ascii=False))
    if confidence is not None:
        sets.append("confidence = ?")
        params.append(float(confidence))
    if source is not None:
        sets.append("source = ?")
        params.append(source)
    if active is not None:
        sets.append("active = ?")
        params.append(1 if active else 0)

    if not sets:
        return False

    sets.append("updated_at = CURRENT_TIMESTAMP")
    params.append(rule_id)
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE rules SET {', '.join(sets)} WHERE id = ?",
        params,
    )
    conn.commit()
    return cur.rowcount > 0


def increment_usage(rule_id: int, *, success: bool = False) -> None:
    """ルールが Skill から参照された / 適用成功した時の統計更新。"""
    conn = get_connection()
    if success:
        conn.execute(
            "UPDATE rules SET usage_count = usage_count + 1, success_count = success_count + 1 WHERE id = ?",
            (rule_id,),
        )
    else:
        conn.execute(
            "UPDATE rules SET usage_count = usage_count + 1 WHERE id = ?",
            (rule_id,),
        )
    conn.commit()


def bulk_increment_usage(rule_ids: Iterable[int], *, success: bool = False) -> None:
    """list_for_prompt で取得した複数ルールを一括カウント。"""
    ids = list(rule_ids)
    if not ids:
        return
    conn = get_connection()
    placeholders = ",".join(["?"] * len(ids))
    if success:
        conn.execute(
            f"UPDATE rules SET usage_count = usage_count + 1, success_count = success_count + 1 WHERE id IN ({placeholders})",
            ids,
        )
    else:
        conn.execute(
            f"UPDATE rules SET usage_count = usage_count + 1 WHERE id IN ({placeholders})",
            ids,
        )
    conn.commit()


def delete(rule_id: int) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
    conn.commit()
    return cur.rowcount > 0


def count(
    *,
    task_type: Optional[TaskType] = None,
    organization: Optional[str] = None,
    only_active: bool = False,
) -> int:
    conditions: list[str] = []
    params: list[Any] = []
    if task_type:
        conditions.append("task_type = ?")
        params.append(task_type)
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    if only_active:
        conditions.append("active = 1")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    row = get_connection().execute(f"SELECT COUNT(*) AS c FROM rules {where}", params).fetchone()
    return int(row["c"])


def list_task_types(organization: Optional[str] = None) -> list[tuple[str, int]]:
    """task_type 別のルール数（管理画面の集計用）。"""
    if organization:
        rows = get_connection().execute(
            "SELECT task_type, COUNT(*) AS c FROM rules WHERE organization = ? GROUP BY task_type ORDER BY c DESC",
            (organization,),
        ).fetchall()
    else:
        rows = get_connection().execute(
            "SELECT task_type, COUNT(*) AS c FROM rules GROUP BY task_type ORDER BY c DESC"
        ).fetchall()
    return [(r["task_type"], int(r["c"])) for r in rows]
