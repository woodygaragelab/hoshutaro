"""
MCP Client Hub — 全MCP Serverとの接続を一元管理

MCP Server を stdio transport の子プロセスとして起動し、
JSON-RPC 経由で Tool 呼び出しを中継する。
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class ToolInfo:
    """MCP Server が公開する Tool の情報"""
    def __init__(self, name: str, description: str, parameters: dict, server_id: str):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.server_id = server_id

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "server_id": self.server_id,
        }


class MCPServerProcess:
    """単一の MCP Server プロセスを管理"""
    
    def __init__(self, plugin_id: str, command: str, env: dict | None = None):
        self.plugin_id = plugin_id
        self.command = command
        self.env = env or {}
        self.process: asyncio.subprocess.Process | None = None
        self.status: str = "stopped"  # running, stopped, error
        self._request_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader_task: asyncio.Task | None = None

    async def start(self) -> None:
        """MCP Server プロセスを起動 (stdio transport)"""
        if self.process and self.process.returncode is None:
            logger.warning("[MCPHub] %s は既に起動中", self.plugin_id)
            return

        try:
            import os
            merged_env = {**os.environ, **self.env}
            
            self.process = await asyncio.create_subprocess_exec(
                self.command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=merged_env,
            )
            self.status = "running"
            self._reader_task = asyncio.create_task(self._read_responses())
            logger.info("[MCPHub] %s を起動しました (PID=%d)", self.plugin_id, self.process.pid)
        except Exception as e:
            self.status = "error"
            logger.error("[MCPHub] %s の起動に失敗: %s", self.plugin_id, e)
            raise

    async def stop(self) -> None:
        """MCP Server プロセスを停止"""
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()
        if self._reader_task:
            self._reader_task.cancel()
        self.status = "stopped"
        logger.info("[MCPHub] %s を停止しました", self.plugin_id)

    async def send_request(self, method: str, params: dict | None = None) -> Any:
        """JSON-RPC リクエストを送信し、レスポンスを待つ"""
        if not self.process or self.process.returncode is not None:
            raise RuntimeError(f"MCP Server {self.plugin_id} が起動していません")

        self._request_id += 1
        request_id = self._request_id
        
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }
        
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future
        
        payload = json.dumps(request) + "\n"
        self.process.stdin.write(payload.encode())
        await self.process.stdin.drain()
        
        try:
            result = await asyncio.wait_for(future, timeout=30.0)
            return result
        except asyncio.TimeoutError:
            self._pending.pop(request_id, None)
            raise TimeoutError(f"MCP Server {self.plugin_id} からの応答タイムアウト")

    async def _read_responses(self) -> None:
        """stdout から JSON-RPC レスポンスを読み取る"""
        try:
            while True:
                line = await self.process.stdout.readline()
                if not line:
                    break
                try:
                    response = json.loads(line.decode().strip())
                    request_id = response.get("id")
                    if request_id and request_id in self._pending:
                        future = self._pending.pop(request_id)
                        if "error" in response:
                            future.set_exception(
                                RuntimeError(response["error"].get("message", "Unknown error"))
                            )
                        else:
                            future.set_result(response.get("result"))
                except json.JSONDecodeError:
                    continue
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("[MCPHub] %s のレスポンス読み取りエラー: %s", self.plugin_id, e)
            self.status = "error"


class MCPClientHub:
    """全MCP Serverとの接続を一元管理"""
    
    _instance: "MCPClientHub | None" = None
    
    def __new__(cls) -> "MCPClientHub":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self) -> None:
        if not hasattr(self, "_servers"):
            self._servers: dict[str, MCPServerProcess] = {}
            self._tools_cache: dict[str, list[ToolInfo]] = {}

    async def start_server(self, plugin_id: str, config: dict) -> None:
        """MCP Serverを子プロセスとして起動 (stdio transport)"""
        if plugin_id in self._servers:
            existing = self._servers[plugin_id]
            if existing.status == "running":
                logger.info("[MCPHub] %s は既に起動中", plugin_id)
                return
        
        command = config.get("command", "")
        env = config.get("env", {})
        
        server = MCPServerProcess(plugin_id, command, env)
        await server.start()
        self._servers[plugin_id] = server
        
        # Tool一覧をキャッシュ
        try:
            tools_result = await server.send_request("tools/list")
            if tools_result and isinstance(tools_result, dict):
                tool_list = tools_result.get("tools", [])
                self._tools_cache[plugin_id] = [
                    ToolInfo(
                        name=t["name"],
                        description=t.get("description", ""),
                        parameters=t.get("inputSchema", {}),
                        server_id=plugin_id,
                    )
                    for t in tool_list
                ]
        except Exception as e:
            logger.warning("[MCPHub] %s のTool一覧取得に失敗: %s", plugin_id, e)
            self._tools_cache[plugin_id] = []

    async def stop_server(self, plugin_id: str) -> None:
        """MCP Serverを停止"""
        server = self._servers.get(plugin_id)
        if server:
            await server.stop()
            self._tools_cache.pop(plugin_id, None)
        else:
            logger.warning("[MCPHub] %s は登録されていません", plugin_id)

    async def restart_server(self, plugin_id: str) -> None:
        """MCP Serverを再起動"""
        server = self._servers.get(plugin_id)
        if server:
            config = {"command": server.command, "env": server.env}
            await self.stop_server(plugin_id)
            await self.start_server(plugin_id, config)
        else:
            logger.warning("[MCPHub] %s は登録されていません", plugin_id)

    async def list_tools(self, plugin_id: str | None = None) -> list[ToolInfo]:
        """利用可能なTool一覧 (全サーバー or 指定サーバー)"""
        if plugin_id:
            return self._tools_cache.get(plugin_id, [])
        
        all_tools = []
        for tools in self._tools_cache.values():
            all_tools.extend(tools)
        return all_tools

    async def call_tool(self, plugin_id: str, tool_name: str, args: dict) -> Any:
        """指定MCP ServerのToolを呼び出し"""
        server = self._servers.get(plugin_id)
        if not server:
            raise RuntimeError(f"MCP Server {plugin_id} が見つかりません")
        if server.status != "running":
            raise RuntimeError(f"MCP Server {plugin_id} が起動していません (status={server.status})")
        
        result = await server.send_request("tools/call", {
            "name": tool_name,
            "arguments": args,
        })
        return result

    def get_server_status(self, plugin_id: str) -> str:
        """サーバー状態 (running/stopped/error)"""
        server = self._servers.get(plugin_id)
        return server.status if server else "stopped"

    def get_all_statuses(self) -> dict[str, str]:
        """全サーバーの状態を取得"""
        return {pid: s.status for pid, s in self._servers.items()}

    async def shutdown_all(self) -> None:
        """全サーバーを停止 (アプリ終了時)"""
        for plugin_id in list(self._servers.keys()):
            try:
                await self.stop_server(plugin_id)
            except Exception as e:
                logger.error("[MCPHub] %s のシャットダウンに失敗: %s", plugin_id, e)


# シングルトンインスタンス
mcp_hub = MCPClientHub()
