"""
training_cache テーブル CRUD（LoRA 学習データセット蓄積）。

スキーマ: schema.sql の `training_cache` テーブル参照。
主要カラム:
  - input_text: 入力（プロンプト + ユーザーデータ）
  - output_json: 高精度な構造化出力（GroundTruth）
  - confidence_score: LLM 自己評価 + ユーザー確認
  - user_confirmed: ユーザー承認済か（学習対象の基準）
  - used_for_training: 既に学習に使ったか（次回バッチから除外）
  - lora_version: 紐づく LoRA バージョン

学習トリガー:
  user_confirmed=1 AND used_for_training=0 が 100件以上溜まったら
  learning/training_scheduler が LoRA トレーニングを起動。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Optional

from app.mu.memory.db import get_connection


@dataclass
class TrainingExample:
    id: Optional[int]
    task_type: str
    input_text: str
    output_json: str
    confidence_score: Optional[float]
    user_confirmed: bool
    used_for_training: bool
    lora_version: Optional[str]
    organization: Optional[str]
    created_at: Optional[datetime]

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "TrainingExample":
        ts = row["created_at"]
        try:
            created = datetime.fromisoformat(str(ts).replace(" ", "T")) if ts else None
        except ValueError:
            created = None
        return cls(
            id=row["id"],
            task_type=row["task_type"],
            input_text=row["input_text"],
            output_json=row["output_json"],
            confidence_score=row["confidence_score"],
            user_confirmed=bool(row["user_confirmed"]),
            used_for_training=bool(row["used_for_training"]),
            lora_version=row["lora_version"],
            organization=row["organization"],
            created_at=created,
        )


def add(
    *,
    task_type: str,
    input_text: str,
    output_json: str,
    confidence_score: Optional[float] = None,
    user_confirmed: bool = False,
    organization: Optional[str] = None,
) -> int:
    conn = get_connection()
    cur = conn.execute(
        """
        INSERT INTO training_cache (
            task_type, input_text, output_json, confidence_score,
            user_confirmed, used_for_training, organization
        )
        VALUES (?, ?, ?, ?, ?, 0, ?)
        """,
        (
            task_type,
            input_text,
            output_json,
            confidence_score,
            1 if user_confirmed else 0,
            organization,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def confirm(example_id: int, *, confidence_score: Optional[float] = 1.0) -> bool:
    conn = get_connection()
    if confidence_score is not None:
        cur = conn.execute(
            "UPDATE training_cache SET user_confirmed = 1, confidence_score = ? WHERE id = ?",
            (float(confidence_score), example_id),
        )
    else:
        cur = conn.execute(
            "UPDATE training_cache SET user_confirmed = 1 WHERE id = ?",
            (example_id,),
        )
    conn.commit()
    return cur.rowcount > 0


def list_unused(
    *,
    task_type: Optional[str] = None,
    organization: Optional[str] = None,
    limit: int = 1000,
) -> list[TrainingExample]:
    """user_confirmed=1 かつ used_for_training=0 のレコードを返す（学習対象）。"""
    conditions = ["user_confirmed = 1", "used_for_training = 0"]
    params: list[Any] = []
    if task_type:
        conditions.append("task_type = ?")
        params.append(task_type)
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    sql = f"""
        SELECT * FROM training_cache
        WHERE {' AND '.join(conditions)}
        ORDER BY created_at ASC
        LIMIT ?
    """
    params.append(int(limit))
    rows = get_connection().execute(sql, params).fetchall()
    return [TrainingExample.from_row(r) for r in rows]


def count_unused(
    *,
    task_type: Optional[str] = None,
    organization: Optional[str] = None,
) -> int:
    """学習トリガーの閾値判定用（100件超で起動）。"""
    conditions = ["user_confirmed = 1", "used_for_training = 0"]
    params: list[Any] = []
    if task_type:
        conditions.append("task_type = ?")
        params.append(task_type)
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    sql = f"SELECT COUNT(*) AS c FROM training_cache WHERE {' AND '.join(conditions)}"
    row = get_connection().execute(sql, params).fetchone()
    return int(row["c"])


def mark_used(
    example_ids: Iterable[int],
    *,
    lora_version: str,
) -> int:
    """学習に使ったレコードを used_for_training = 1 にし、lora_version を紐付ける。"""
    ids = list(example_ids)
    if not ids:
        return 0
    placeholders = ",".join(["?"] * len(ids))
    conn = get_connection()
    cur = conn.execute(
        f"""
        UPDATE training_cache
        SET used_for_training = 1, lora_version = ?
        WHERE id IN ({placeholders})
        """,
        [lora_version, *ids],
    )
    conn.commit()
    return cur.rowcount


def stats(
    *,
    organization: Optional[str] = None,
) -> dict[str, int]:
    """Knowledge Base UI 用の集計。"""
    where = "WHERE organization = ?" if organization else ""
    params: list[Any] = [organization] if organization else []
    rows = get_connection().execute(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN user_confirmed = 1 THEN 1 ELSE 0 END) AS confirmed,
            SUM(CASE WHEN used_for_training = 1 THEN 1 ELSE 0 END) AS used,
            SUM(CASE WHEN user_confirmed = 1 AND used_for_training = 0 THEN 1 ELSE 0 END) AS pending
        FROM training_cache
        {where}
        """,
        params,
    ).fetchone()
    return {
        "total": int(rows["total"] or 0),
        "confirmed": int(rows["confirmed"] or 0),
        "used": int(rows["used"] or 0),
        "pending": int(rows["pending"] or 0),
    }


def delete(example_id: int) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM training_cache WHERE id = ?", (example_id,))
    conn.commit()
    return cur.rowcount > 0
