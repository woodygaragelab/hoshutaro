"""
prompt_cache_meta テーブル CRUD（KV キャッシュメタ管理）。

スキーマ: schema.sql の `prompt_cache_meta` テーブル参照。
主要カラム:
  - cache_key: 'id_normalization_v1' 等（PRIMARY KEY、Skill 定義の prompt_cache_key と一致）
  - file_path: ~/.hoshutaro/llm_cache/{cache_key}.bin
  - model_id: 'gemma-4-e2b-it' or 'gemma-4-e2b-it-lora-v3'
  - rules_hash: 紐づくルール群のハッシュ（invalidate 判定）
  - lora_version: 適用 LoRA バージョン
  - hit_count: キャッシュヒット回数（ヒット率分析用）

Invalidate 条件:
  rules_hash 変化 OR lora_version 変化 → 次回呼び出し時に再構築
"""

from __future__ import annotations

import hashlib
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Optional

from app.mu.memory.db import get_connection


@dataclass
class PromptCacheMeta:
    cache_key: str
    file_path: Optional[str]
    model_id: Optional[str]
    rules_hash: Optional[str]
    lora_version: Optional[str]
    created_at: Optional[datetime]
    last_used_at: Optional[datetime]
    hit_count: int

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "PromptCacheMeta":
        def _ts(v: Any) -> Optional[datetime]:
            if not v:
                return None
            try:
                return datetime.fromisoformat(str(v).replace(" ", "T"))
            except ValueError:
                return None

        return cls(
            cache_key=row["cache_key"],
            file_path=row["file_path"],
            model_id=row["model_id"],
            rules_hash=row["rules_hash"],
            lora_version=row["lora_version"],
            created_at=_ts(row["created_at"]),
            last_used_at=_ts(row["last_used_at"]),
            hit_count=int(row["hit_count"] or 0),
        )


# ───────────────────────────────────────────────────────────
# rules_hash 計算（invalidate ロジック）
# ───────────────────────────────────────────────────────────


def compute_rules_hash(rule_ids_or_keys: Iterable[str]) -> str:
    """
    sql_context で取得したルール群を一意に表すハッシュを計算。

    Args:
        rule_ids_or_keys: ルール ID（int を str 化）またはルール内容のキー一覧

    Returns:
        16進ハッシュ文字列（先頭16文字、衝突確率 ~10^-19）
    """
    h = hashlib.sha256()
    for k in sorted(str(x) for x in rule_ids_or_keys):
        h.update(k.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:16]


# ───────────────────────────────────────────────────────────
# CRUD
# ───────────────────────────────────────────────────────────


def upsert(
    *,
    cache_key: str,
    file_path: str,
    model_id: str,
    rules_hash: str,
    lora_version: Optional[str] = None,
) -> None:
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO prompt_cache_meta (
            cache_key, file_path, model_id, rules_hash, lora_version,
            created_at, last_used_at, hit_count
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        ON CONFLICT(cache_key) DO UPDATE SET
            file_path = excluded.file_path,
            model_id = excluded.model_id,
            rules_hash = excluded.rules_hash,
            lora_version = excluded.lora_version,
            last_used_at = CURRENT_TIMESTAMP
        """,
        (cache_key, file_path, model_id, rules_hash, lora_version),
    )
    conn.commit()


def get(cache_key: str) -> Optional[PromptCacheMeta]:
    row = get_connection().execute(
        "SELECT * FROM prompt_cache_meta WHERE cache_key = ?",
        (cache_key,),
    ).fetchone()
    return PromptCacheMeta.from_row(row) if row else None


def is_valid(
    cache_key: str,
    *,
    expected_rules_hash: str,
    expected_model_id: str,
    expected_lora_version: Optional[str] = None,
) -> bool:
    """
    既存キャッシュが現在の rules / model / LoRA と一致するか判定。

    一致しない場合は呼び出し側で invalidate（再構築）する。
    """
    meta = get(cache_key)
    if not meta:
        return False
    if meta.rules_hash != expected_rules_hash:
        return False
    if meta.model_id != expected_model_id:
        return False
    if (meta.lora_version or None) != (expected_lora_version or None):
        return False
    if not meta.file_path:
        return False
    return True


def record_hit(cache_key: str) -> None:
    conn = get_connection()
    conn.execute(
        """
        UPDATE prompt_cache_meta
        SET hit_count = hit_count + 1, last_used_at = CURRENT_TIMESTAMP
        WHERE cache_key = ?
        """,
        (cache_key,),
    )
    conn.commit()


def invalidate(cache_key: str) -> bool:
    """メタを削除（実ファイルは呼び出し側で unlink する）。"""
    conn = get_connection()
    cur = conn.execute(
        "DELETE FROM prompt_cache_meta WHERE cache_key = ?",
        (cache_key,),
    )
    conn.commit()
    return cur.rowcount > 0


def invalidate_by_lora_version(lora_version: str) -> int:
    """LoRA バージョン更新時に該当キャッシュを一括無効化。"""
    conn = get_connection()
    cur = conn.execute(
        "DELETE FROM prompt_cache_meta WHERE lora_version = ?",
        (lora_version,),
    )
    conn.commit()
    return cur.rowcount


def list_all(*, limit: int = 100) -> list[PromptCacheMeta]:
    rows = get_connection().execute(
        "SELECT * FROM prompt_cache_meta ORDER BY last_used_at DESC LIMIT ?",
        (int(limit),),
    ).fetchall()
    return [PromptCacheMeta.from_row(r) for r in rows]
