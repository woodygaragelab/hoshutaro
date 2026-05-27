"""
lora_adapters テーブル CRUD（Project Mu 学習層のバージョン管理）。

スキーマ: schema.sql の `lora_adapters` テーブル参照。
主要カラム:
  - version: 'v1', 'v2', 'org-foo-v3' 等（PRIMARY KEY）
  - file_path: ~/.hoshutaro/lora/{version}.safetensors
  - base_model: 'gemma-4-e2b-it' 等
  - task_types_json: 学習対象タスク種別
  - training_examples_count: 学習に使った training_cache の count
  - metrics_json: 学習後の評価指標（Hold-out 精度等）
  - active: 現在適用中か（同じ organization で1つだけ active）
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from app.mu.memory.db import get_connection


@dataclass
class LoRAAdapter:
    version: str
    file_path: Optional[str]
    base_model: Optional[str]
    task_types: list[str]
    training_examples_count: int
    metrics: dict[str, Any]
    organization: Optional[str]
    active: bool
    created_at: Optional[datetime]

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "LoRAAdapter":
        try:
            task_types = json.loads(row["task_types_json"]) if row["task_types_json"] else []
        except json.JSONDecodeError:
            task_types = []
        try:
            metrics = json.loads(row["metrics_json"]) if row["metrics_json"] else {}
        except json.JSONDecodeError:
            metrics = {}
        ts = row["created_at"]
        try:
            created = datetime.fromisoformat(str(ts).replace(" ", "T")) if ts else None
        except ValueError:
            created = None
        return cls(
            version=row["version"],
            file_path=row["file_path"],
            base_model=row["base_model"],
            task_types=task_types,
            training_examples_count=int(row["training_examples_count"] or 0),
            metrics=metrics,
            organization=row["organization"],
            active=bool(row["active"]),
            created_at=created,
        )


def register(
    *,
    version: str,
    file_path: Optional[str],
    base_model: str,
    task_types: list[str],
    training_examples_count: int,
    metrics: Optional[dict[str, Any]] = None,
    organization: Optional[str] = None,
    activate: bool = False,
) -> str:
    """新規 LoRA アダプターを登録。activate=True なら同 organization 内で active に切替。"""
    conn = get_connection()
    conn.execute(
        """
        INSERT OR REPLACE INTO lora_adapters (
            version, file_path, base_model, task_types_json,
            training_examples_count, metrics_json, organization, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        """,
        (
            version,
            file_path,
            base_model,
            json.dumps(task_types, ensure_ascii=False),
            int(training_examples_count),
            json.dumps(metrics or {}, ensure_ascii=False),
            organization,
        ),
    )
    conn.commit()
    if activate:
        set_active(version)
    return version


def get(version: str) -> Optional[LoRAAdapter]:
    row = get_connection().execute(
        "SELECT * FROM lora_adapters WHERE version = ?",
        (version,),
    ).fetchone()
    return LoRAAdapter.from_row(row) if row else None


def get_active(organization: Optional[str] = None) -> Optional[LoRAAdapter]:
    """組織別の現在 active な LoRA を返す（推論時に動的適用）。"""
    if organization:
        row = get_connection().execute(
            """
            SELECT * FROM lora_adapters
            WHERE active = 1 AND (organization = ? OR organization IS NULL)
            ORDER BY organization IS NULL, created_at DESC
            LIMIT 1
            """,
            (organization,),
        ).fetchone()
    else:
        row = get_connection().execute(
            """
            SELECT * FROM lora_adapters
            WHERE active = 1 AND organization IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    return LoRAAdapter.from_row(row) if row else None


def set_active(version: str) -> bool:
    """対象バージョンを active=1、同 organization の他レコードを active=0 に。"""
    conn = get_connection()
    target = conn.execute(
        "SELECT organization FROM lora_adapters WHERE version = ?",
        (version,),
    ).fetchone()
    if not target:
        return False
    org = target["organization"]

    if org is None:
        conn.execute(
            "UPDATE lora_adapters SET active = 0 WHERE organization IS NULL"
        )
    else:
        conn.execute(
            "UPDATE lora_adapters SET active = 0 WHERE organization = ?",
            (org,),
        )
    conn.execute(
        "UPDATE lora_adapters SET active = 1 WHERE version = ?",
        (version,),
    )
    conn.commit()
    return True


def deactivate_all(organization: Optional[str] = None) -> int:
    """ベースモデルへ戻す時に使う。返り値は無効化された件数。"""
    conn = get_connection()
    if organization is None:
        cur = conn.execute(
            "UPDATE lora_adapters SET active = 0 WHERE organization IS NULL"
        )
    else:
        cur = conn.execute(
            "UPDATE lora_adapters SET active = 0 WHERE organization = ?",
            (organization,),
        )
    conn.commit()
    return cur.rowcount


def list_all(
    *,
    organization: Optional[str] = None,
    limit: int = 50,
) -> list[LoRAAdapter]:
    if organization is None:
        rows = get_connection().execute(
            "SELECT * FROM lora_adapters ORDER BY created_at DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
    else:
        rows = get_connection().execute(
            """
            SELECT * FROM lora_adapters
            WHERE organization = ? OR organization IS NULL
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (organization, int(limit)),
        ).fetchall()
    return [LoRAAdapter.from_row(r) for r in rows]


def update_metrics(version: str, metrics: dict[str, Any]) -> bool:
    conn = get_connection()
    cur = conn.execute(
        "UPDATE lora_adapters SET metrics_json = ? WHERE version = ?",
        (json.dumps(metrics, ensure_ascii=False), version),
    )
    conn.commit()
    return cur.rowcount > 0


def delete(version: str) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM lora_adapters WHERE version = ?", (version,))
    conn.commit()
    return cur.rowcount > 0
