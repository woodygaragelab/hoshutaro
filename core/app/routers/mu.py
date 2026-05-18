"""
Project Mu API ルーター（Knowledge Base UI / フェーズ1〜3 操作用）。

エンドポイント:
  GET  /api/mu/dashboard         統計サマリ
  GET  /api/mu/rules             ルール一覧（task_type フィルタ）
  POST /api/mu/rules             ルール手動追加
  PATCH /api/mu/rules/{id}        ルール編集
  DELETE /api/mu/rules/{id}       ルール削除
  GET  /api/mu/master_map        マッピング一覧
  POST /api/mu/master_map/{id}/confirm  ユーザー承認
  GET  /api/mu/training_cache/stats     学習データ集計
  POST /api/mu/training/trigger          手動 LoRA 学習起動
  GET  /api/mu/training/status           ジョブ状態
  GET  /api/mu/lora_adapters             LoRA アダプター一覧
  POST /api/mu/lora_adapters/{version}/activate  active 切替
  GET  /api/mu/cache/stats               KV キャッシュ集計
  POST /api/mu/cache/cleanup             孤立ファイル削除
  GET  /api/mu/health                    Mu サブシステム健全性

NOTE: フロントの認証層（Cognito JWT 検証）は Track D で別途追加。本ルーター単体は
      ローカル FastAPI（127.0.0.1）想定で認証なし。
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.mu.cache.kv_cache_manager import get_manager as get_cache_manager
from app.mu.learning import adapter_manager
from app.mu.learning.training_scheduler import get_scheduler
from app.mu.memory import lora_adapters as lora_repo
from app.mu.memory import master_map as master_map_repo
from app.mu.memory import rules as rules_repo
from app.mu.memory import training_cache as training_cache_repo
from app.mu.memory import vector_search

router = APIRouter(prefix="/api/mu", tags=["project-mu"])


# ───────────────────────────────────────────────────────────
# Schemas
# ───────────────────────────────────────────────────────────


class RuleCreateBody(BaseModel):
    task_type: str
    regex_pattern: Optional[str] = None
    instruction_text: str
    organization: Optional[str] = None
    examples: list[Any] = Field(default_factory=list)
    confidence: float = 0.5
    source: str = "user_added"
    active: bool = True


class RuleUpdateBody(BaseModel):
    regex_pattern: Optional[str] = None
    instruction_text: Optional[str] = None
    examples: Optional[list[Any]] = None
    confidence: Optional[float] = None
    active: Optional[bool] = None


class RuleResponse(BaseModel):
    id: int
    task_type: str
    regex_pattern: Optional[str]
    instruction_text: Optional[str]
    organization: Optional[str]
    examples: list[Any]
    confidence: float
    usage_count: int
    success_count: int
    source: str
    active: bool


class MappingResponse(BaseModel):
    id: int
    raw_name: str
    standard_name: Optional[str]
    category_id: Optional[str]
    location_path: Optional[str]
    user_confirmed: bool
    confidence: Optional[float]
    organization: Optional[str]


class MappingConfirmBody(BaseModel):
    standard_name: Optional[str] = None
    category_id: Optional[str] = None
    location_path: Optional[str] = None
    confidence: Optional[float] = 1.0


class TrainingTriggerBody(BaseModel):
    organization: Optional[str] = None
    task_type: Optional[str] = None
    manual: bool = True


class LoRARecordResponse(BaseModel):
    version: str
    file_path: Optional[str]
    base_model: Optional[str]
    task_types: list[str]
    training_examples_count: int
    metrics: dict[str, Any]
    organization: Optional[str]
    active: bool


# ───────────────────────────────────────────────────────────
# Dashboard
# ───────────────────────────────────────────────────────────


@router.get("/dashboard")
def dashboard(organization: Optional[str] = None) -> dict[str, Any]:
    return {
        "rules": {
            "total": rules_repo.count(organization=organization),
            "active": rules_repo.count(organization=organization, only_active=True),
            "by_task_type": rules_repo.list_task_types(organization=organization),
        },
        "master_map": {
            "total": master_map_repo.count(organization=organization),
            "confirmed": master_map_repo.count(
                organization=organization, confirmed_only=True
            ),
            "top_locations": master_map_repo.location_path_summary(
                organization=organization, limit=10
            ),
            "top_categories": master_map_repo.category_summary(
                organization=organization, limit=10
            ),
        },
        "training_cache": training_cache_repo.stats(organization=organization),
        "lora": {
            "active_version": adapter_manager.get_active_version(organization=organization),
            "all": [
                LoRARecordResponse(
                    version=l.version,
                    file_path=l.file_path,
                    base_model=l.base_model,
                    task_types=l.task_types,
                    training_examples_count=l.training_examples_count,
                    metrics=l.metrics,
                    organization=l.organization,
                    active=l.active,
                ).model_dump()
                for l in lora_repo.list_all(organization=organization, limit=20)
            ],
        },
        "cache": {
            "vector_search_available": vector_search.is_available(),
            "vector_stats": vector_search.stats(),
            "kv_cache_disk": get_cache_manager().disk_usage(),
        },
        "training_scheduler_status": {
            "state": get_scheduler().status.state,
            "pending": get_scheduler().pending_count(organization=organization),
        },
    }


# ───────────────────────────────────────────────────────────
# Rules
# ───────────────────────────────────────────────────────────


def _rule_to_response(r) -> RuleResponse:
    return RuleResponse(
        id=r.id,
        task_type=r.task_type,
        regex_pattern=r.regex_pattern,
        instruction_text=r.instruction_text,
        organization=r.organization,
        examples=r.examples,
        confidence=r.confidence,
        usage_count=r.usage_count,
        success_count=r.success_count,
        source=r.source,
        active=r.active,
    )


@router.get("/rules", response_model=list[RuleResponse])
def list_rules(
    task_type: Optional[str] = None,
    organization: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
) -> list[RuleResponse]:
    items = rules_repo.list_all(
        task_type=task_type,
        organization=organization,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )
    return [_rule_to_response(r) for r in items]


@router.post("/rules", response_model=RuleResponse, status_code=201)
def create_rule(body: RuleCreateBody) -> RuleResponse:
    rid = rules_repo.create(
        task_type=body.task_type,
        regex_pattern=body.regex_pattern,
        instruction_text=body.instruction_text,
        organization=body.organization,
        examples=body.examples,
        confidence=body.confidence,
        source=body.source,
        active=body.active,
    )
    rec = rules_repo.get(rid)
    if not rec:
        raise HTTPException(status_code=500, detail="Failed to fetch created rule")
    return _rule_to_response(rec)


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, body: RuleUpdateBody) -> RuleResponse:
    ok = rules_repo.update(
        rule_id,
        regex_pattern=body.regex_pattern,
        instruction_text=body.instruction_text,
        examples=body.examples,
        confidence=body.confidence,
        active=body.active,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Rule not found")
    rec = rules_repo.get(rule_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Rule not found after update")
    return _rule_to_response(rec)


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int) -> None:
    if not rules_repo.delete(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")


# ───────────────────────────────────────────────────────────
# Master map
# ───────────────────────────────────────────────────────────


def _mapping_to_response(m) -> MappingResponse:
    return MappingResponse(
        id=m.id,
        raw_name=m.raw_name,
        standard_name=m.standard_name,
        category_id=m.category_id,
        location_path=m.location_path,
        user_confirmed=m.user_confirmed,
        confidence=m.confidence,
        organization=m.organization,
    )


@router.get("/master_map", response_model=list[MappingResponse])
def list_master_map(
    organization: Optional[str] = None,
    confirmed_only: bool = False,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
) -> list[MappingResponse]:
    items = master_map_repo.list_all(
        organization=organization,
        confirmed_only=confirmed_only,
        limit=limit,
        offset=offset,
    )
    return [_mapping_to_response(m) for m in items]


@router.post("/master_map/{mapping_id}/confirm", response_model=MappingResponse)
def confirm_mapping(mapping_id: int, body: MappingConfirmBody) -> MappingResponse:
    ok = master_map_repo.confirm(
        mapping_id,
        standard_name=body.standard_name,
        category_id=body.category_id,
        location_path=body.location_path,
        confidence=body.confidence,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Mapping not found")
    rec = master_map_repo.get(mapping_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Mapping not found after confirm")
    return _mapping_to_response(rec)


# ───────────────────────────────────────────────────────────
# Training cache & scheduler
# ───────────────────────────────────────────────────────────


@router.get("/training_cache/stats")
def training_cache_stats(organization: Optional[str] = None) -> dict[str, int]:
    return training_cache_repo.stats(organization=organization)


@router.post("/training/trigger")
async def trigger_training(body: TrainingTriggerBody) -> dict[str, Any]:
    sched = get_scheduler()
    started = await sched.trigger(
        organization=body.organization,
        task_type=body.task_type,
        manual=body.manual,
    )
    return {
        "started": started,
        "state": sched.status.state,
        "pending": sched.pending_count(
            organization=body.organization, task_type=body.task_type
        ),
    }


@router.get("/training/status")
def training_status(organization: Optional[str] = None) -> dict[str, Any]:
    sched = get_scheduler()
    return {
        "state": sched.status.state,
        "started_at": sched.status.started_at.isoformat() if sched.status.started_at else None,
        "finished_at": sched.status.finished_at.isoformat() if sched.status.finished_at else None,
        "last_lora_version": sched.status.last_lora_version,
        "last_error": sched.status.last_error,
        "pending": sched.pending_count(organization=organization),
        "threshold": sched.threshold,
    }


# ───────────────────────────────────────────────────────────
# LoRA adapters
# ───────────────────────────────────────────────────────────


@router.get("/lora_adapters", response_model=list[LoRARecordResponse])
def list_loras(organization: Optional[str] = None) -> list[LoRARecordResponse]:
    return [
        LoRARecordResponse(
            version=l.version,
            file_path=l.file_path,
            base_model=l.base_model,
            task_types=l.task_types,
            training_examples_count=l.training_examples_count,
            metrics=l.metrics,
            organization=l.organization,
            active=l.active,
        )
        for l in lora_repo.list_all(organization=organization, limit=50)
    ]


@router.post("/lora_adapters/{version}/activate")
def activate_lora(version: str) -> dict[str, Any]:
    ok = adapter_manager.activate(version)
    if not ok:
        raise HTTPException(status_code=404, detail="LoRA version not found")
    return {"activated": version}


@router.post("/lora_adapters/deactivate")
def deactivate_loras(organization: Optional[str] = None) -> dict[str, int]:
    return {"deactivated_count": adapter_manager.deactivate_for_org(organization=organization)}


@router.delete("/lora_adapters/{version}", status_code=204)
def delete_lora(version: str) -> None:
    if not adapter_manager.remove(version):
        raise HTTPException(status_code=404, detail="LoRA version not found")


# ───────────────────────────────────────────────────────────
# Cache management
# ───────────────────────────────────────────────────────────


@router.get("/cache/stats")
def cache_stats() -> dict[str, Any]:
    mgr = get_cache_manager()
    return {
        "disk": mgr.disk_usage(),
        "vector_search_available": vector_search.is_available(),
        "vector_stats": vector_search.stats(),
    }


@router.post("/cache/cleanup")
def cache_cleanup() -> dict[str, int]:
    mgr = get_cache_manager()
    return {"removed_orphans": mgr.cleanup_orphans()}


# ───────────────────────────────────────────────────────────
# Health
# ───────────────────────────────────────────────────────────


@router.get("/health")
def health() -> dict[str, Any]:
    """Mu サブシステムの状態確認（依存ライブラリのロード状況込み）。"""
    embedder_available = False
    try:
        from app.mu.embeddings.local_embedder import get_embedder
        embedder_available = get_embedder().is_available
    except Exception:
        pass
    return {
        "ok": True,
        "vector_search": vector_search.is_available(),
        "embedder": embedder_available,
        "training_scheduler": get_scheduler().status.state,
    }
