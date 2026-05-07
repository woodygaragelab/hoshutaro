"""
sqlite-vec ベースのベクトル検索（フェーズ3 で master_map / rules の意味類似検索に使用）。

依存:
  - sqlite-vec 拡張（db.py の `_try_load_sqlite_vec` で動的ロード）
  - 拡張がロードできない環境では `is_available()` が False を返し、呼び出し側はフォールバック

ベクトル次元: 384（multilingual-e5-small）

使い方:
    >>> from app.mu.memory import vector_search
    >>> if vector_search.is_available():
    ...     vector_search.upsert_master_map(map_id=1, embedding=[0.1, ...])  # 384次元
    ...     results = vector_search.search_master_map(query=[0.1, ...], k=10)
"""

from __future__ import annotations

import logging
import struct
from typing import Optional

from app.mu.memory.db import get_connection, is_vector_search_available

logger = logging.getLogger(__name__)


VECTOR_DIM = 384


def is_available() -> bool:
    """ベクトル検索が利用可能か（sqlite-vec ロード成否）。"""
    return is_vector_search_available()


def _validate(embedding: list[float]) -> None:
    if len(embedding) != VECTOR_DIM:
        raise ValueError(
            f"Embedding dimension mismatch: expected {VECTOR_DIM}, got {len(embedding)}"
        )


def _to_blob(embedding: list[float]) -> bytes:
    """float32 little-endian バイト列に変換（sqlite-vec の vec0 型仕様）。"""
    return struct.pack(f"{VECTOR_DIM}f", *embedding)


# ───────────────────────────────────────────────────────────
# master_map_vec
# ───────────────────────────────────────────────────────────


def upsert_master_map(*, map_id: int, embedding: list[float]) -> None:
    """master_map レコードのベクトルを登録/更新。"""
    if not is_available():
        logger.debug("vector_search not available; skipping upsert")
        return
    _validate(embedding)
    conn = get_connection()
    # vec0 は INSERT OR REPLACE を直接サポートしないので、DELETE → INSERT
    conn.execute("DELETE FROM master_map_vec WHERE map_id = ?", (map_id,))
    conn.execute(
        "INSERT INTO master_map_vec(map_id, embedding) VALUES (?, ?)",
        (map_id, _to_blob(embedding)),
    )
    conn.commit()


def search_master_map(
    *,
    query: list[float],
    k: int = 10,
) -> list[tuple[int, float]]:
    """
    近傍検索: クエリベクトルに近い master_map.id を距離付きで返す。

    Returns:
        [(map_id, distance), ...] 距離昇順、最大 k 件。
        ベクトル検索無効時は空リスト。
    """
    if not is_available():
        return []
    _validate(query)
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT map_id, distance
        FROM master_map_vec
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
        """,
        (_to_blob(query), int(k)),
    ).fetchall()
    return [(int(r["map_id"]), float(r["distance"])) for r in rows]


def remove_master_map(map_id: int) -> None:
    if not is_available():
        return
    conn = get_connection()
    conn.execute("DELETE FROM master_map_vec WHERE map_id = ?", (map_id,))
    conn.commit()


# ───────────────────────────────────────────────────────────
# rules_vec
# ───────────────────────────────────────────────────────────


def upsert_rule(*, rule_id: int, embedding: list[float]) -> None:
    if not is_available():
        return
    _validate(embedding)
    conn = get_connection()
    conn.execute("DELETE FROM rules_vec WHERE rule_id = ?", (rule_id,))
    conn.execute(
        "INSERT INTO rules_vec(rule_id, embedding) VALUES (?, ?)",
        (rule_id, _to_blob(embedding)),
    )
    conn.commit()


def search_rules(
    *,
    query: list[float],
    k: int = 10,
) -> list[tuple[int, float]]:
    if not is_available():
        return []
    _validate(query)
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT rule_id, distance
        FROM rules_vec
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
        """,
        (_to_blob(query), int(k)),
    ).fetchall()
    return [(int(r["rule_id"]), float(r["distance"])) for r in rows]


def remove_rule(rule_id: int) -> None:
    if not is_available():
        return
    conn = get_connection()
    conn.execute("DELETE FROM rules_vec WHERE rule_id = ?", (rule_id,))
    conn.commit()


# ───────────────────────────────────────────────────────────
# 診断
# ───────────────────────────────────────────────────────────


def stats() -> dict[str, Optional[int]]:
    """各 vec テーブルの登録件数（管理画面用、未対応時は None）。"""
    if not is_available():
        return {"master_map_vec": None, "rules_vec": None}
    conn = get_connection()
    try:
        m = conn.execute("SELECT COUNT(*) AS c FROM master_map_vec").fetchone()
        r = conn.execute("SELECT COUNT(*) AS c FROM rules_vec").fetchone()
        return {
            "master_map_vec": int(m["c"]) if m else 0,
            "rules_vec": int(r["c"]) if r else 0,
        }
    except Exception as e:
        logger.warning("vector_search.stats failed: %s", e)
        return {"master_map_vec": None, "rules_vec": None}
