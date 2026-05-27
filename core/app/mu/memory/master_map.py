"""
master_map テーブル CRUD（Project Mu フェーズ3 のマッピング蓄積）。

スキーマ: schema.sql の `master_map` テーブル参照。
主要カラム:
  - raw_name: ユーザー入力の生データ（例: "P-101 給水ポンプ A"）
  - standard_name: 正規化後
  - category_id: 分類 ID（Maximo Classification 等）
  - location_path: 階層パス（"棟A/3F/エリアB"）
  - user_confirmed: ユーザー承認済か（学習データの基準）
  - confidence: 0.0-1.0
  - source_file: 出典 Excel ファイル名

利用シーン:
  - フェーズ3: 未登録機器名の連想推論で「似た過去マッピング」をベクトル検索
  - フェーズ3 完了後: ユーザー確認結果を user_confirmed=1 で INSERT し自己進化
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from app.mu.memory.db import get_connection

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Domain Model
# ───────────────────────────────────────────────────────────


@dataclass
class Mapping:
    id: Optional[int]
    raw_name: str
    standard_name: Optional[str]
    category_id: Optional[str]
    location_path: Optional[str]
    user_confirmed: bool
    confidence: Optional[float]
    source_file: Optional[str]
    organization: Optional[str]
    created_at: Optional[datetime]

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Mapping":
        return cls(
            id=row["id"],
            raw_name=row["raw_name"],
            standard_name=row["standard_name"],
            category_id=row["category_id"],
            location_path=row["location_path"],
            user_confirmed=bool(row["user_confirmed"]),
            confidence=row["confidence"],
            source_file=row["source_file"],
            organization=row["organization"],
            created_at=_parse_ts(row["created_at"]),
        )


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace(" ", "T"))
    except ValueError:
        return None


# ───────────────────────────────────────────────────────────
# CRUD
# ───────────────────────────────────────────────────────────


def create(
    *,
    raw_name: str,
    standard_name: Optional[str] = None,
    category_id: Optional[str] = None,
    location_path: Optional[str] = None,
    user_confirmed: bool = False,
    confidence: Optional[float] = None,
    source_file: Optional[str] = None,
    organization: Optional[str] = None,
) -> int:
    conn = get_connection()
    cur = conn.execute(
        """
        INSERT INTO master_map (
            raw_name, standard_name, category_id, location_path,
            user_confirmed, confidence, source_file, organization
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            raw_name,
            standard_name,
            category_id,
            location_path,
            1 if user_confirmed else 0,
            confidence,
            source_file,
            organization,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def get(mapping_id: int) -> Optional[Mapping]:
    row = get_connection().execute(
        "SELECT * FROM master_map WHERE id = ?", (mapping_id,)
    ).fetchone()
    return Mapping.from_row(row) if row else None


def find_by_raw_name(
    raw_name: str,
    *,
    organization: Optional[str] = None,
    confirmed_only: bool = True,
) -> list[Mapping]:
    """
    完全一致検索（最も高速、ベクトル検索の前段で使う）。

    confirmed_only=True なら user_confirmed=1 のみを返す。
    """
    conditions = ["raw_name = ?"]
    params: list[Any] = [raw_name]
    if organization:
        conditions.append("(organization = ? OR organization IS NULL)")
        params.append(organization)
    if confirmed_only:
        conditions.append("user_confirmed = 1")
    sql = f"""
        SELECT * FROM master_map
        WHERE {' AND '.join(conditions)}
        ORDER BY user_confirmed DESC, confidence DESC, created_at DESC
    """
    rows = get_connection().execute(sql, params).fetchall()
    return [Mapping.from_row(r) for r in rows]


def list_all(
    *,
    organization: Optional[str] = None,
    confirmed_only: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> list[Mapping]:
    conditions: list[str] = []
    params: list[Any] = []
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    if confirmed_only:
        conditions.append("user_confirmed = 1")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = f"""
        SELECT * FROM master_map
        {where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    """
    params.extend([int(limit), int(offset)])
    rows = get_connection().execute(sql, params).fetchall()
    return [Mapping.from_row(r) for r in rows]


def confirm(
    mapping_id: int,
    *,
    standard_name: Optional[str] = None,
    category_id: Optional[str] = None,
    location_path: Optional[str] = None,
    confidence: Optional[float] = 1.0,
) -> bool:
    """ユーザー承認時にユーザーが微修正した値で確定。user_confirmed = 1 にする。"""
    sets: list[str] = ["user_confirmed = 1"]
    params: list[Any] = []
    if standard_name is not None:
        sets.append("standard_name = ?")
        params.append(standard_name)
    if category_id is not None:
        sets.append("category_id = ?")
        params.append(category_id)
    if location_path is not None:
        sets.append("location_path = ?")
        params.append(location_path)
    if confidence is not None:
        sets.append("confidence = ?")
        params.append(float(confidence))
    params.append(mapping_id)
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE master_map SET {', '.join(sets)} WHERE id = ?",
        params,
    )
    conn.commit()
    return cur.rowcount > 0


def update(
    mapping_id: int,
    *,
    standard_name: Optional[str] = None,
    category_id: Optional[str] = None,
    location_path: Optional[str] = None,
    confidence: Optional[float] = None,
    user_confirmed: Optional[bool] = None,
) -> bool:
    sets: list[str] = []
    params: list[Any] = []
    if standard_name is not None:
        sets.append("standard_name = ?")
        params.append(standard_name)
    if category_id is not None:
        sets.append("category_id = ?")
        params.append(category_id)
    if location_path is not None:
        sets.append("location_path = ?")
        params.append(location_path)
    if confidence is not None:
        sets.append("confidence = ?")
        params.append(float(confidence))
    if user_confirmed is not None:
        sets.append("user_confirmed = ?")
        params.append(1 if user_confirmed else 0)
    if not sets:
        return False
    params.append(mapping_id)
    conn = get_connection()
    cur = conn.execute(
        f"UPDATE master_map SET {', '.join(sets)} WHERE id = ?",
        params,
    )
    conn.commit()
    return cur.rowcount > 0


def delete(mapping_id: int) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM master_map WHERE id = ?", (mapping_id,))
    conn.commit()
    return cur.rowcount > 0


def count(
    *,
    organization: Optional[str] = None,
    confirmed_only: bool = False,
) -> int:
    conditions: list[str] = []
    params: list[Any] = []
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    if confirmed_only:
        conditions.append("user_confirmed = 1")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    row = get_connection().execute(
        f"SELECT COUNT(*) AS c FROM master_map {where}", params
    ).fetchone()
    return int(row["c"])


def location_path_summary(
    organization: Optional[str] = None,
    *,
    limit: int = 50,
) -> list[tuple[str, int]]:
    """
    Knowledge Base UI 用の location_path 集計。

    Returns:
        [(location_path, count), ...] 上位 limit 件
    """
    conditions = ["location_path IS NOT NULL", "location_path != ''"]
    params: list[Any] = []
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    where = "WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT location_path, COUNT(*) AS c
        FROM master_map
        {where}
        GROUP BY location_path
        ORDER BY c DESC
        LIMIT ?
    """
    params.append(int(limit))
    rows = get_connection().execute(sql, params).fetchall()
    return [(r["location_path"], int(r["c"])) for r in rows]


def category_summary(
    organization: Optional[str] = None,
    *,
    limit: int = 50,
) -> list[tuple[str, int]]:
    """category_id 別の集計（Knowledge Base UI 用）。"""
    conditions = ["category_id IS NOT NULL", "category_id != ''"]
    params: list[Any] = []
    if organization:
        conditions.append("organization = ?")
        params.append(organization)
    where = "WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT category_id, COUNT(*) AS c
        FROM master_map
        {where}
        GROUP BY category_id
        ORDER BY c DESC
        LIMIT ?
    """
    params.append(int(limit))
    rows = get_connection().execute(sql, params).fetchall()
    return [(r["category_id"], int(r["c"])) for r in rows]
