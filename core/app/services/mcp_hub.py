"""
MCP Client Hub — 全MCP Serverとの接続を一元管理

MCP Server を stdio transport の子プロセスとして起動し、
JSON-RPC 経由で Tool 呼び出しを中継する。
"""

import asyncio
import sys
import json
import logging
import subprocess
import threading
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
    
    def __init__(self, plugin_id: str, command: str, args: list[str] | None = None, cwd: str | None = None, env: dict | None = None):
        self.plugin_id = plugin_id
        self.command = command
        self.args = args or []
        self.cwd = cwd
        self.env = env or {}
        self.process: subprocess.Popen | None = None
        self.status: str = "stopped"  # running, stopped, error
        self._request_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader_thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    async def start(self) -> None:
        """MCP Server プロセスを起動 (stdio transport)"""
        if self.process and self.process.poll() is None:
            logger.warning("[MCPHub] %s は既に起動中", self.plugin_id)
            return

        try:
            import os
            merged_env = {**os.environ, **self.env}
            
            # Windows/Uvicorn環境下での NotImplementedError 回避のため
            # asyncio.create_subprocess_exec ではなく Popen + 別スレッド を使用
            self.process = subprocess.Popen(
                [self.command] + self.args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=sys.stderr,
                env=merged_env,
                cwd=self.cwd,
            )
            self.status = "running"
            self._loop = asyncio.get_running_loop()
            
            # 別スレッドで STDOUT を読み取り、メインループへ送る
            self._reader_thread = threading.Thread(
                target=self._read_responses_thread, 
                daemon=True,
                name=f"MCP-Reader-{self.plugin_id}"
            )
            self._reader_thread.start()
            logger.info("[MCPHub] %s を起動しました (PID=%d)", self.plugin_id, self.process.pid)
        except Exception as e:
            self.status = "error"
            logger.exception("[MCPHub] %s の起動に失敗", self.plugin_id)
            raise RuntimeError(f"起動エラー: {e.__class__.__name__} - {str(e)}") from e

    async def stop(self) -> None:
        """MCP Server プロセスを停止"""
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.status = "stopped"
        logger.info("[MCPHub] %s を停止しました", self.plugin_id)

    async def send_request(self, method: str, params: dict | None = None, timeout: float = 900.0) -> Any:
        """JSON-RPC リクエストを送信し、レスポンスを待つ"""
        if not self.process or self.process.poll() is not None:
            raise RuntimeError(f"MCP Server {self.plugin_id} が起動していません")

        self._request_id += 1
        request_id = self._request_id
        
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }
        
        future: asyncio.Future = self._loop.create_future()
        self._pending[request_id] = future
        
        payload = json.dumps(request) + "\n"
        
        # Popen.stdin.write はブロッキングIOだが、短いペイロードなら問題ない
        def _write():
            if self.process and self.process.stdin:
                self.process.stdin.write(payload.encode())
                self.process.stdin.flush()
        
        await asyncio.to_thread(_write)
        
        try:
            # ローカルLLMは生成に時間がかかるため、タイムアウトを大幅に延長 (15分)
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            self._pending.pop(request_id, None)
            raise TimeoutError(f"MCP Server {self.plugin_id} からの応答タイムアウト ({timeout}秒)")

    def _read_responses_thread(self) -> None:
        """stdout から JSON-RPC レスポンスを読み取る (別スレッドで実行)"""
        if not self.process or not self.process.stdout:
            return
            
        try:
            while True:
                line = self.process.stdout.readline()
                if not line:
                    break
                try:
                    response = json.loads(line.decode('utf-8', errors='replace').strip())
                    request_id = response.get("id")
                    if request_id and request_id in self._pending:
                        future = self._pending[request_id]
                        # futureをセットするために asyncio_run_coroutine_threadsafe 等ではなく
                        # self._loop.call_soon_threadsafe を使用する
                        if "error" in response:
                            err_msg = response["error"].get("message", "Unknown error")
                            self._loop.call_soon_threadsafe(
                                self._safe_set_exception, future, RuntimeError(err_msg), request_id
                            )
                        else:
                            res_val = response.get("result")
                            self._loop.call_soon_threadsafe(
                                self._safe_set_result, future, res_val, request_id
                            )
                except json.JSONDecodeError:
                    continue
        finally:
            logger.info("[MCPHub] %s の stdout リーダーを終了しました", self.plugin_id)
            self.status = "error" if self.process.poll() != 0 else "stopped"
            # プロセスが唐突に死んだ場合など、残っている保留中リクエストをすべてエラーで解放して無限ハングを防ぐ
            for req_id, future in list(self._pending.items()):
                if not future.done():
                    self._loop.call_soon_threadsafe(
                        self._safe_set_exception, future, RuntimeError("MCP Server プロセスが異常終了したか、パイプが切断されました。"), req_id
                    )

    def _safe_set_result(self, future: asyncio.Future, result: Any, request_id: int):
        self._pending.pop(request_id, None)
        if not future.done():
            future.set_result(result)

    def _safe_set_exception(self, future: asyncio.Future, exc: Exception, request_id: int):
        self._pending.pop(request_id, None)
        if not future.done():
            future.set_exception(exc)


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
        args = config.get("args", [])
        cwd = config.get("cwd", None)
        env = config.get("env", {})
        
        server = MCPServerProcess(plugin_id, command, args, cwd, env)
        await server.start()
        self._servers[plugin_id] = server
        
        # MCP Initialization Handshake
        try:
            await server.send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "hoshutaro-mcp-hub", "version": "1.0.0"}
            })
            
            # Send initialized notification (fire and forget)
            if server.process and server.process.stdin:
                notif = '{"jsonrpc": "2.0", "method": "notifications/initialized"}\n'
                def _write_notif():
                    server.process.stdin.write(notif.encode())
                    server.process.stdin.flush()
                import asyncio
                await asyncio.to_thread(_write_notif)
                
        except Exception as e:
            logger.error(f"[MCPHub] {plugin_id} のInitializeに失敗しました: {e}")
            try:
                await server.stop()
            except:
                pass
            return
            
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

    async def restart_server(self, plugin_id: str, config: dict | None = None) -> None:
        """MCP Serverを再起動"""
        server = self._servers.get(plugin_id)
        if server:
            new_config = config or {"command": server.command, "args": server.args, "cwd": server.cwd, "env": server.env}
            await self.stop_server(plugin_id)
            await self.start_server(plugin_id, new_config)
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

    async def call_tool(self, plugin_id: str, tool_name: str, args: dict, timeout: float = 900.0) -> Any:
        """指定MCP ServerのToolを呼び出し"""
        server = self._servers.get(plugin_id)
        if not server:
            raise RuntimeError(f"MCP Server {plugin_id} が見つかりません")
        if server.status != "running":
            raise RuntimeError(f"MCP Server {plugin_id} が起動していません (status={server.status})")
        
        result = await server.send_request("tools/call", {
            "name": tool_name,
            "arguments": args,
        }, timeout=timeout)
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
