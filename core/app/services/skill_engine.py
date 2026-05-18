"""
Skill Engine — YAML Skill 定義の読み込み・実行エンジン

Gemini Function Calling を使って Skill 定義に従い、
DataStore Tool (内部) + MCP Tool (外部) を自動実行する。
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from app.config import settings
from app.services.gemini_client import gemini_client
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
            "logs": self.logs[-20:],  # 最新20件
            "result": self.result,
            "error": self.error,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
        }


# ── DataStore Tool 定義 ──────────────────────────────────

DATASTORE_TOOLS = [
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
                "entity": {"type": "string", "description": "エンティティ種別 (assets/workOrders/workOrderLines)"},
                "records": {"type": "array", "description": "インポートするレコードの配列"},
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
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "datastore.backup",
        "description": "保守太郎のデータをバックアップする",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
]


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
        """ディレクトリから YAML Skill 定義を読み込み"""
        skills = []
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
        """全 Skill 一覧を取得"""
        self._skills_cache.clear()
        builtin = self._load_skills_from_dir(self._builtin_dir, "builtin")
        user = self._load_skills_from_dir(self._user_dir, "user")
        return [s.to_dict() for s in builtin + user]

    def get_skill(self, skill_id: str) -> SkillDefinition | None:
        """指定 ID の Skill を取得"""
        if skill_id in self._skills_cache:
            return self._skills_cache[skill_id]
        # キャッシュにない場合は再読み込み
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
        Skill を実行する。
        Gemini に system_prompt + tool_definitions + params を送信し、
        Tool 呼び出し → 結果返却を繰り返す ReAct ループ。
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
            # Tool 定義を収集
            tool_definitions = await self._collect_tool_definitions(skill)
            
            # 初期メッセージ構築
            user_content = f"パラメータ: {json.dumps(params, ensure_ascii=False)}"
            if data_context:
                stats = {
                    "assetCount": len(data_context.get("assets", {})),
                    "woCount": len(data_context.get("workOrders", {})),
                    "wolCount": len(data_context.get("workOrderLines", {})),
                }
                user_content += f"\n現在のデータ統計: {json.dumps(stats)}"

            messages = [
                {"role": "user", "parts": [user_content]},
            ]

            # ReAct ループ
            max_iterations = 20
            for iteration in range(max_iterations):
                execution.current_step = f"Gemini 呼び出し (Step {iteration + 1})"
                execution.progress = min(iteration / max_iterations * 100, 95)

                response = await gemini_client.generate_with_tools(
                    messages,
                    system_instruction=skill.system_prompt,
                    tools=tool_definitions,
                    temperature=0.3,
                )

                # レスポンス解析
                candidate = response.candidates[0] if response.candidates else None
                if not candidate:
                    execution.log("error", "Gemini からの応答がありません")
                    break

                # Function Call チェック
                function_calls = []
                text_parts = []
                for part in candidate.content.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        function_calls.append(part.function_call)
                    elif hasattr(part, "text") and part.text:
                        # thought part をスキップ
                        if hasattr(part, "thought") and part.thought:
                            continue
                        text_parts.append(part.text)

                if not function_calls:
                    # Tool 呼び出しなし → 完了
                    final_text = "".join(text_parts)
                    execution.result = final_text
                    execution.log("info", f"完了: {final_text[:200]}")
                    break

                # Function Call を実行
                messages.append({"role": "model", "parts": candidate.content.parts})
                
                function_responses = []
                for fc in function_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}
                    execution.log("info", f"Tool呼び出し: {tool_name}", tool_name=tool_name)

                    try:
                        result = await self._execute_tool(tool_name, tool_args, data_context)
                        execution.log("info", f"Tool結果: 成功", tool_name=tool_name, tool_result=result)
                        function_responses.append(
                            genai_function_response(tool_name, {"result": result})
                        )
                    except Exception as e:
                        error_msg = str(e)
                        execution.log("error", f"Tool失敗: {error_msg}", tool_name=tool_name)
                        function_responses.append(
                            genai_function_response(tool_name, {"error": error_msg})
                        )

                messages.append({"role": "function", "parts": function_responses})

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
        """実行状態を取得"""
        return self._executions.get(execution_id)

    # ── Tool 定義収集 ─────────────────────────────────────────

    async def _collect_tool_definitions(self, skill: SkillDefinition) -> list:
        """Skill に必要な Tool 定義を収集"""
        import google.generativeai as genai

        tools = []

        # DataStore Tool は常に利用可能
        for ds_tool in DATASTORE_TOOLS:
            tools.append(genai.protos.Tool(
                function_declarations=[
                    genai.protos.FunctionDeclaration(
                        name=ds_tool["name"],
                        description=ds_tool["description"],
                        parameters=genai.protos.Schema(**self._schema_to_proto(ds_tool["parameters"])),
                    )
                ]
            ))

        # MCP Server の Tool
        for server_req in skill.required_servers:
            server_type = server_req.get("type", "")
            mcp_tools = await mcp_hub.list_tools(server_type)
            for mt in mcp_tools:
                tools.append(genai.protos.Tool(
                    function_declarations=[
                        genai.protos.FunctionDeclaration(
                            name=f"{server_type}.{mt.name}",
                            description=mt.description,
                            parameters=genai.protos.Schema(**self._schema_to_proto(mt.parameters)),
                        )
                    ]
                ))

        return tools if tools else None

    def _schema_to_proto(self, schema: dict) -> dict:
        """JSON Schema → Gemini protos.Schema 変換"""
        result: dict[str, Any] = {"type_": "OBJECT"}
        properties = schema.get("properties", {})
        if properties:
            result["properties"] = {}
            for key, prop in properties.items():
                prop_type = prop.get("type", "string").upper()
                type_map = {"STRING": "STRING", "NUMBER": "NUMBER", "INTEGER": "INTEGER",
                           "BOOLEAN": "BOOLEAN", "ARRAY": "ARRAY", "OBJECT": "OBJECT"}
                result["properties"][key] = {
                    "type_": type_map.get(prop_type, "STRING"),
                    "description": prop.get("description", ""),
                }
        return result

    # ── Tool 実行 ─────────────────────────────────────────────

    async def _execute_tool(
        self, tool_name: str, args: dict, data_context: dict | None = None,
    ) -> Any:
        """Tool を実行する (DataStore or MCP)"""
        if tool_name.startswith("datastore."):
            return await self._execute_datastore_tool(tool_name, args, data_context)
        
        # MCP Server の Tool: "server_id.tool_name" 形式
        parts = tool_name.split(".", 1)
        if len(parts) == 2:
            server_id, actual_tool = parts
            return await mcp_hub.call_tool(server_id, actual_tool, args)
        
        raise ValueError(f"不明な Tool: {tool_name}")

    async def _execute_datastore_tool(
        self, tool_name: str, args: dict, data_context: dict | None = None,
    ) -> Any:
        """DataStore Tool を実行"""
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
            # 実際のインポートは Phase 5 で DataStore への直接書き込みに拡張
            return {"entity": entity, "imported": len(records), "status": "simulated"}

        elif tool_name == "datastore.export_records":
            entity = args.get("entity", "")
            data = dc.get(entity, {})
            return {"entity": entity, "count": len(data), "records": list(data.values())[:100]}

        elif tool_name == "datastore.backup":
            return {"status": "simulated", "message": "バックアップ機能は Phase 6 で実装予定"}

        else:
            raise ValueError(f"不明な DataStore Tool: {tool_name}")

    # ── User Skill CRUD ───────────────────────────────────────

    def create_user_skill(self, skill_data: dict) -> SkillDefinition:
        """ユーザー Skill を作成"""
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
        """ユーザー Skill を更新"""
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
        """ユーザー Skill を削除"""
        for yaml_path in self._user_dir.glob("*.yaml"):
            data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            if data and data.get("id") == skill_id:
                yaml_path.unlink()
                self._skills_cache.pop(skill_id, None)
                return True
        return False


def genai_function_response(name: str, response: dict):
    """Gemini SDK 用の FunctionResponse part を生成"""
    import google.generativeai as genai
    return genai.protos.Part(
        function_response=genai.protos.FunctionResponse(
            name=name,
            response=response,
        )
    )


# シングルトンインスタンス
skill_engine = SkillEngine()
