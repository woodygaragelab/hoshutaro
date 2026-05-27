"""
Skill Engine — YAML Skill 定義の読み込み・実行エンジン（プラン WS1-5）

旧実装は Gemini Function Calling（google.generativeai.protos.Tool）に直接依存していたが、
Gemma 4 / OpenVINO へ一本化したため、tool 呼び出しを **プロンプトベース** に切り替えた。

実装方針:
  - Skill 定義 (YAML) の system_prompt と入力パラメータをまとめ、利用可能 tool 一覧を
    JSON 形式でプロンプトに埋め込み、LLM に「次に呼ぶ tool と引数」を JSON で返させる。
  - LLM 出力をパースして tool を実行 → 結果を次のターンに注入する ReAct ループ。
  - LLM が `{"final": "..."}` 形式の終了通知を返した時点でループ終了。
  - 利用可能 tool: DataStore Tool（query/import/export/statistics/backup）+ MCP Server Tool。
  - LLM adapter は registry 経由（プラン WS1-4 で Gemini を撤去済み）。
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from app.config import settings
from app.llm import get_adapter
from app.llm.json_utils import extract_json_object
from app.services.mcp_hub import mcp_hub

logger = logging.getLogger(__name__)


# ── Skill 定義 ────────────────────────────────────────────


class SkillDefinition:
    """YAML からパースされた Skill 定義"""

    def __init__(self, data: dict, skill_type: str = "builtin"):
        self.id: str = data.get("id", "")
        self.name: str = data.get("name", "")
        self.version: str = data.get("version", "1.0.0")
        self.type: str = skill_type
        self.description: str = data.get("description", "")
        self.icon: str = data.get("icon", "⚡")
        self.required_servers: list[dict] = data.get("required_servers", [])
        self.system_prompt: str = data.get("system_prompt", "")
        self.parameters: list[dict] = data.get("parameters", [])
        self.safety: dict = data.get("safety", {})
        self.preferred_model: str | None = data.get("preferred_model")
        self.fallback_models: list[str] = data.get("fallback_models", [])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "type": self.type,
            "description": self.description,
            "icon": self.icon,
            "required_servers": self.required_servers,
            "parameters": self.parameters,
            "safety": self.safety,
        }


# ── 実行状態 ───────────────────────────────────────────────


class SkillExecution:
    """Skill 実行セッション"""

    def __init__(self, skill: SkillDefinition, params: dict):
        self.id = str(uuid.uuid4())
        self.skill = skill
        self.params = params
        self.status: str = "idle"  # idle, running, completed, failed, cancelled
        self.progress: float = 0.0
        self.current_step: str = ""
        self.logs: list[dict] = []
        self.result: Any = None
        self.error: str | None = None
        self.started_at: str | None = None
        self.completed_at: str | None = None

    def log(self, level: str, message: str, tool_name: str = "", tool_result: Any = None):
        self.logs.append({
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "toolName": tool_name,
            "toolResult": tool_result,
        })

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "skillId": self.skill.id,
            "status": self.status,
            "progress": self.progress,
            "currentStep": self.current_step,
            "logs": self.logs[-20:],
            "result": self.result,
            "error": self.error,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
        }


# ── DataStore Tool 定義 ──────────────────────────────────


DATASTORE_TOOLS: list[dict] = [
    {
        "name": "datastore.query_assets",
        "description": "保守太郎の機器データを検索する",
        "parameters": {
            "type": "object",
            "properties": {
                "filter": {"type": "string", "description": "検索フィルタ (オプション)"}
            },
        },
    },
    {
        "name": "datastore.query_work_orders",
        "description": "保守太郎のWorkOrderデータを検索する",
        "parameters": {
            "type": "object",
            "properties": {
                "filter": {"type": "string", "description": "検索フィルタ (オプション)"}
            },
        },
    },
    {
        "name": "datastore.query_work_order_lines",
        "description": "保守太郎のWorkOrderLineデータを検索する",
        "parameters": {
            "type": "object",
            "properties": {
                "filter": {"type": "string", "description": "検索フィルタ (オプション)"}
            },
        },
    },
    {
        "name": "datastore.import_records",
        "description": "保守太郎にレコードをインポートする",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "description": "assets/workOrders/workOrderLines"},
                "records": {"type": "array", "description": "インポートするレコード配列"},
            },
            "required": ["entity", "records"],
        },
    },
    {
        "name": "datastore.export_records",
        "description": "保守太郎からレコードをエクスポートする",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "description": "エンティティ種別"},
                "filter": {"type": "string", "description": "エクスポートフィルタ (オプション)"},
            },
            "required": ["entity"],
        },
    },
    {
        "name": "datastore.get_statistics",
        "description": "保守太郎のデータ統計を取得する",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "datastore.backup",
        "description": "保守太郎のデータをバックアップする",
        "parameters": {"type": "object", "properties": {}},
    },
]


# ── プロンプト ──────────────────────────────────────────


_TOOL_LOOP_INSTRUCTION = """\
あなたは Skill 実行エージェントです。利用可能な tool を使ってユーザーの依頼を達成してください。

# 利用可能な tool
{tool_catalog}

# 応答ルール（厳守）
- 次に実行する tool を選び、JSON のみで応答する。前置きや説明文を含めない。
- まだ実行すべき tool がある場合は次の形式で返す:
  {{"action": "tool_call", "name": "<tool名>", "arguments": {{ ... }}}}
- すべて完了したら次の形式で返す:
  {{"action": "final", "message": "<ユーザー向け要約>"}}
- 直前の tool 結果は messages の system ロールで提供される。それを参照して次の判断をする。
"""


def _render_tool_catalog(tools: list[dict]) -> str:
    """tool 一覧を LLM 向けに整形（name / description / parameters の JSON）。"""
    items = []
    for t in tools:
        items.append(
            "- "
            + json.dumps(
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("parameters", {}),
                },
                ensure_ascii=False,
            )
        )
    return "\n".join(items)


# ── Skill Engine ──────────────────────────────────────────


class SkillEngine:
    """Skill の読み込み・実行エンジン"""

    _instance: "SkillEngine | None" = None

    def __new__(cls) -> "SkillEngine":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, "_initialized"):
            self._home = Path(settings.hoshutaro_home)
            self._builtin_dir = self._home / "skills" / "builtin"
            self._user_dir = self._home / "skills" / "user"
            self._skills_cache: dict[str, SkillDefinition] = {}
            self._executions: dict[str, SkillExecution] = {}
            self._initialized = True

    # ── Skill 読み込み ────────────────────────────────────────

    def _load_skills_from_dir(self, directory: Path, skill_type: str) -> list[SkillDefinition]:
        skills: list[SkillDefinition] = []
        if not directory.exists():
            return skills
        for yaml_path in directory.glob("*.yaml"):
            try:
                data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
                if data:
                    skill = SkillDefinition(data, skill_type)
                    skills.append(skill)
                    self._skills_cache[skill.id] = skill
            except Exception as e:
                logger.warning("[SkillEngine] %s の読み込みに失敗: %s", yaml_path, e)
        return skills

    def list_skills(self) -> list[dict]:
        self._skills_cache.clear()
        builtin = self._load_skills_from_dir(self._builtin_dir, "builtin")
        user = self._load_skills_from_dir(self._user_dir, "user")
        return [s.to_dict() for s in builtin + user]

    def get_skill(self, skill_id: str) -> SkillDefinition | None:
        if skill_id in self._skills_cache:
            return self._skills_cache[skill_id]
        self.list_skills()
        return self._skills_cache.get(skill_id)

    # ── Skill 実行 ────────────────────────────────────────────

    async def execute_skill(
        self,
        skill_id: str,
        params: dict,
        data_context: dict | None = None,
    ) -> SkillExecution:
        """
        Skill を ReAct ループで実行する（プロンプトベース tool calling）。
        """
        skill = self.get_skill(skill_id)
        if not skill:
            execution = SkillExecution(SkillDefinition({"id": skill_id}), params)
            execution.status = "failed"
            execution.error = f"Skill {skill_id} が見つかりません"
            return execution

        execution = SkillExecution(skill, params)
        execution.status = "running"
        execution.started_at = datetime.now().isoformat()
        self._executions[execution.id] = execution

        try:
            # 利用可能な tool を集約
            tools = await self._collect_tool_definitions(skill)
            tool_catalog = _render_tool_catalog(tools)
            tool_loop_prompt = _TOOL_LOOP_INSTRUCTION.format(tool_catalog=tool_catalog)
            system_prompt = (skill.system_prompt + "\n\n" + tool_loop_prompt).strip()

            # LLM adapter は skill が指定する preferred/fallback を尊重
            from app.llm.registry import resolve

            model_id = resolve(skill.preferred_model, skill.fallback_models)
            adapter = get_adapter(model_id)

            # 初期ユーザープロンプト
            user_content = f"パラメータ: {json.dumps(params, ensure_ascii=False)}"
            if data_context:
                stats = {
                    "assetCount": len(data_context.get("assets", {})),
                    "woCount": len(data_context.get("workOrders", {})),
                    "wolCount": len(data_context.get("workOrderLines", {})),
                }
                user_content += f"\n現在のデータ統計: {json.dumps(stats, ensure_ascii=False)}"

            tool_history: list[str] = []
            max_iterations = 20

            for iteration in range(max_iterations):
                execution.current_step = f"LLM 呼び出し (Step {iteration + 1})"
                execution.progress = min(iteration / max_iterations * 100, 95)

                tool_history_block = (
                    "\n\n# これまでの tool 実行ログ\n" + "\n".join(tool_history)
                    if tool_history
                    else ""
                )
                prompt = user_content + tool_history_block

                raw = await adapter.generate_structured(
                    system_prompt=system_prompt,
                    user_prompt=prompt,
                    max_new_tokens=2048,
                )
                parsed = extract_json_object(raw) or {}
                action = parsed.get("action")

                if action == "final" or not action:
                    final_text = (
                        parsed.get("message")
                        or parsed.get("final")
                        or raw.strip()
                    )
                    execution.result = final_text
                    execution.log("info", f"完了: {final_text[:200]}")
                    break

                if action != "tool_call":
                    execution.log(
                        "warn",
                        f"未知の action: {action} — 終了します",
                    )
                    execution.result = raw.strip()
                    break

                tool_name = parsed.get("name", "")
                tool_args = parsed.get("arguments", {}) or {}
                execution.log("info", f"Tool呼び出し: {tool_name}", tool_name=tool_name)

                try:
                    result = await self._execute_tool(tool_name, tool_args, data_context)
                    execution.log(
                        "info", "Tool結果: 成功", tool_name=tool_name, tool_result=result
                    )
                    tool_history.append(
                        json.dumps(
                            {"tool": tool_name, "arguments": tool_args, "result": result},
                            ensure_ascii=False,
                        )
                    )
                except Exception as e:
                    error_msg = str(e)
                    execution.log("error", f"Tool失敗: {error_msg}", tool_name=tool_name)
                    tool_history.append(
                        json.dumps(
                            {"tool": tool_name, "arguments": tool_args, "error": error_msg},
                            ensure_ascii=False,
                        )
                    )

            execution.status = "completed"
            execution.progress = 100

        except Exception as e:
            execution.status = "failed"
            execution.error = str(e)
            execution.log("error", f"Skill 実行失敗: {e}")
            logger.error("[SkillEngine] Skill %s 実行失敗: %s", skill_id, e)

        execution.completed_at = datetime.now().isoformat()
        return execution

    def get_execution(self, execution_id: str) -> SkillExecution | None:
        return self._executions.get(execution_id)

    # ── Tool 定義収集 ─────────────────────────────────────────

    async def _collect_tool_definitions(self, skill: SkillDefinition) -> list[dict]:
        """DataStore Tool + MCP Server Tool を素のスキーマ dict で集約。"""
        tools: list[dict] = list(DATASTORE_TOOLS)

        for server_req in skill.required_servers:
            server_type = server_req.get("type", "")
            try:
                mcp_tools = await mcp_hub.list_tools(server_type)
            except Exception as e:
                logger.warning(
                    "[SkillEngine] MCP tool 列挙失敗 (server=%s): %s", server_type, e
                )
                continue
            for mt in mcp_tools:
                tools.append(
                    {
                        "name": f"{server_type}.{getattr(mt, 'name', '')}",
                        "description": getattr(mt, "description", "") or "",
                        "parameters": getattr(mt, "parameters", {}) or {},
                    }
                )
        return tools

    # ── Tool 実行 ─────────────────────────────────────────────

    async def _execute_tool(
        self, tool_name: str, args: dict, data_context: dict | None = None,
    ) -> Any:
        if tool_name.startswith("datastore."):
            return await self._execute_datastore_tool(tool_name, args, data_context)

        parts = tool_name.split(".", 1)
        if len(parts) == 2:
            server_id, actual_tool = parts
            return await mcp_hub.call_tool(server_id, actual_tool, args)

        raise ValueError(f"不明な Tool: {tool_name}")

    async def _execute_datastore_tool(
        self, tool_name: str, args: dict, data_context: dict | None = None,
    ) -> Any:
        dc = data_context or {}

        if tool_name == "datastore.query_assets":
            assets = dc.get("assets", {})
            return {"count": len(assets), "records": list(assets.values())[:100]}

        elif tool_name == "datastore.query_work_orders":
            wos = dc.get("workOrders", {})
            return {"count": len(wos), "records": list(wos.values())[:100]}

        elif tool_name == "datastore.query_work_order_lines":
            wols = dc.get("workOrderLines", {})
            return {"count": len(wols), "records": list(wols.values())[:100]}

        elif tool_name == "datastore.get_statistics":
            return {
                "assetCount": len(dc.get("assets", {})),
                "woCount": len(dc.get("workOrders", {})),
                "wolCount": len(dc.get("workOrderLines", {})),
            }

        elif tool_name == "datastore.import_records":
            entity = args.get("entity", "")
            records = args.get("records", [])
            return {"entity": entity, "imported": len(records), "status": "simulated"}

        elif tool_name == "datastore.export_records":
            entity = args.get("entity", "")
            data = dc.get(entity, {})
            return {"entity": entity, "count": len(data), "records": list(data.values())[:100]}

        elif tool_name == "datastore.backup":
            return {"status": "simulated", "message": "バックアップ機能は別フェーズで実装"}

        else:
            raise ValueError(f"不明な DataStore Tool: {tool_name}")

    # ── User Skill CRUD ───────────────────────────────────────

    def create_user_skill(self, skill_data: dict) -> SkillDefinition:
        self._user_dir.mkdir(parents=True, exist_ok=True)
        skill = SkillDefinition(skill_data, "user")
        yaml_path = self._user_dir / f"{skill.id.replace('.', '_')}.yaml"
        yaml_path.write_text(
            yaml.dump(skill_data, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
        self._skills_cache[skill.id] = skill
        return skill

    def update_user_skill(self, skill_id: str, skill_data: dict) -> SkillDefinition | None:
        for yaml_path in self._user_dir.glob("*.yaml"):
            data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            if data and data.get("id") == skill_id:
                yaml_path.write_text(
                    yaml.dump(skill_data, allow_unicode=True, default_flow_style=False),
                    encoding="utf-8",
                )
                skill = SkillDefinition(skill_data, "user")
                self._skills_cache[skill_id] = skill
                return skill
        return None

    def delete_user_skill(self, skill_id: str) -> bool:
        for yaml_path in self._user_dir.glob("*.yaml"):
            data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            if data and data.get("id") == skill_id:
                yaml_path.unlink()
                self._skills_cache.pop(skill_id, None)
                return True
        return False


# シングルトンインスタンス
skill_engine = SkillEngine()
