"""
Skills Router — Skill 管理・実行 REST API
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.skill_engine import skill_engine

router = APIRouter(prefix="/api/skills", tags=["skills"])
logger = logging.getLogger(__name__)


class SkillExecuteRequest(BaseModel):
    params: dict = {}
    data_context: dict | None = None


class SkillCreateRequest(BaseModel):
    skill_data: dict


# ── Endpoints ────────────────────────────────────────

@router.get("")
async def list_skills():
    """全 Skill 一覧 (builtin + user)"""
    skills = skill_engine.list_skills()
    return {"skills": skills}


@router.get("/{skill_id}")
async def get_skill(skill_id: str):
    """指定 Skill の詳細"""
    skill = skill_engine.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill {skill_id} が見つかりません")
    return skill.to_dict()


@router.post("/{skill_id}/execute")
async def execute_skill(skill_id: str, body: SkillExecuteRequest):
    """Skill を実行"""
    execution = await skill_engine.execute_skill(
        skill_id,
        body.params,
        body.data_context,
    )
    return execution.to_dict()


@router.get("/execution/{execution_id}/status")
async def get_execution_status(execution_id: str):
    """Skill 実行状態を取得"""
    execution = skill_engine.get_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail=f"実行 {execution_id} が見つかりません")
    return execution.to_dict()


@router.post("/user")
async def create_user_skill(body: SkillCreateRequest):
    """ユーザー Skill を作成"""
    skill = skill_engine.create_user_skill(body.skill_data)
    return skill.to_dict()


@router.put("/user/{skill_id}")
async def update_user_skill(skill_id: str, body: SkillCreateRequest):
    """ユーザー Skill を更新"""
    skill = skill_engine.update_user_skill(skill_id, body.skill_data)
    if not skill:
        raise HTTPException(status_code=404, detail=f"ユーザー Skill {skill_id} が見つかりません")
    return skill.to_dict()


@router.delete("/user/{skill_id}")
async def delete_user_skill(skill_id: str):
    """ユーザー Skill を削除"""
    success = skill_engine.delete_user_skill(skill_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"ユーザー Skill {skill_id} が見つかりません")
    return {"status": "deleted", "skill_id": skill_id}
