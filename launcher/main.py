import json
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

# pystray, PIL は launcher の requirements.txt で管理
import pystray
from pystray import MenuItem as item
from PIL import Image, ImageDraw

def create_default_icon():
    """保守太郎のデフォルトアイコン用画像を動的生成 (PIL)"""
    image = Image.new('RGB', (64, 64), color=(33, 150, 243))
    dc = ImageDraw.Draw(image)
    dc.rectangle((16, 16, 48, 48), fill=(255, 255, 255))
    dc.rectangle((24, 24, 40, 40), fill=(33, 150, 243))
    return image


class HoshutaroLauncher:
    """保守太郎ランチャー"""

    def __init__(self):
        self.base_dir = Path(os.environ.get("HOSHUTARO_HOME", Path.home() / ".hoshutaro"))
        self.server_process = None
        self.mcp_processes: dict[str, subprocess.Popen] = {}
        self.icon = None

    def start(self):
        """メインエントリーポイント"""
        self.apply_update()
        self.start_server()
        self.start_mcp_servers()
        webbrowser.open("http://localhost:8000")
        self.run_tray()

    def start_server(self):
        """FastAPI サーバーを子プロセスとして起動"""
        server_exe = self.base_dir / "core" / "hoshutaro-server.exe"
        if not server_exe.exists():
            # 開発モード: uvicorn で直接起動
            print("[Launcher] 開発モード: uvicorn で起動します")
            return

        self.server_process = subprocess.Popen(
            [str(server_exe)],
            env={**os.environ, "HOSHUTARO_HOME": str(self.base_dir)},
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        print(f"[Launcher] サーバー起動 PID={self.server_process.pid}")

    def start_mcp_servers(self):
        """設定済み MCP Server を起動"""
        plugins_config = self.base_dir / "config" / "plugins.json"
        if not plugins_config.exists():
            return

        config = json.loads(plugins_config.read_text(encoding="utf-8"))
        for name, conf in config.get("servers", {}).items():
            if conf.get("autoStart"):
                exe = self.base_dir / "plugins" / name / conf.get("command", name)
                if exe.exists():
                    self.mcp_processes[name] = subprocess.Popen(
                        [str(exe)],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                    )
                    print(f"[Launcher] MCP Server 起動: {name}")

    def apply_update(self):
        """再起動時に更新ファイルを差し替え"""
        staging = self.base_dir / "update" / "staging"
        if not staging.exists():
            return

        print("[Launcher] 更新を適用中...")
        for target in ["core", "frontend", "skills/builtin"]:
            src = staging / target
            dst = self.base_dir / target
            if src.exists():
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
                print(f"  更新: {target}")

        shutil.rmtree(staging)
        print("[Launcher] 更新適用完了")

    def open_browser(self, icon, item):
        """ブラウザで保守太郎を開く"""
        webbrowser.open("http://localhost:8000")

    def restart(self, icon, item):
        """サーバーを再起動"""
        print("[Launcher] 再起動中...")
        self.quit_server()
        self.apply_update()
        self.start_server()
        self.start_mcp_servers()
        self.open_browser(None, None)

    def quit_server(self):
        """サーバーと MCP プロセスを停止"""
        for name, proc in self.mcp_processes.items():
            proc.terminate()
            print(f"[Launcher] MCP Server 停止: {name}")
        self.mcp_processes.clear()

        if self.server_process:
            self.server_process.terminate()
            print("[Launcher] サーバー停止")
            self.server_process = None

    def quit(self, icon, item):
        """終了"""
        self.quit_server()
        if self.icon:
            self.icon.stop()
        sys.exit(0)

    def run_tray(self):
        """System Tray 常駐"""
        print("[Launcher] System Tray を起動します")
        icon_image = create_default_icon()
        menu = pystray.Menu(
            item('保守太郎を開く', self.open_browser, default=True),
            pystray.Menu.SEPARATOR,
            item('再起動', self.restart),
            item('終了', self.quit)
        )
        self.icon = pystray.Icon("hoshutaro", icon_image, title="保守太郎", menu=menu)
        
        try:
            self.icon.run()
        except KeyboardInterrupt:
            self.quit(None, None)


if __name__ == "__main__":
    launcher = HoshutaroLauncher()
    launcher.start()
