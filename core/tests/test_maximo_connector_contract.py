"""
Maximo Connector スケルトンの契約テスト（プラン WS2-4）。

MCP サーバを **起動せず**、静的に以下を検証する:
  - manifest.json の必須フィールド（id, tools, configSchema）
  - 公開ツール一覧が内蔵 Skill (`core/skills/builtin/maximo_*.yaml`) の期待と一致
  - server.py に各ツール関数が存在する（NotImplementedError 投げる雛形でも OK）
  - configSchema が必須キー（MAXIMO_BASE_URL / MAXIMO_API_KEY）を持つ
"""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

import yaml

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

PLUGIN_DIR = BACKEND_DIR / "plugins" / "maximo-connector"
BUILTIN_SKILLS_DIR = BACKEND_DIR / "skills" / "builtin"


EXPECTED_TOOLS = {
    "test_connection",
    "fetch_assets",
    "fetch_work_orders",
    "fetch_hierarchies",
    "fetch_classifications",
    "push_assets",
    "push_work_orders",
    "compute_diff",
}


def _load_manifest() -> dict:
    return json.loads((PLUGIN_DIR / "manifest.json").read_text(encoding="utf-8"))


# ── manifest 構造 ─────────────────────────────────────────────


def test_manifest_exists_and_parses():
    assert PLUGIN_DIR.is_dir(), "maximo-connector plugin directory must exist"
    manifest = _load_manifest()
    assert manifest["id"] == "maximo-connector"
    assert manifest["category"] == "connector"
    assert manifest["transport"] == "stdio"
    assert manifest["command"] == "python"
    assert manifest["args"][0] in ("-u", "server.py")


def test_manifest_tools_match_expected():
    manifest = _load_manifest()
    tools = set(manifest.get("tools", []))
    missing = EXPECTED_TOOLS - tools
    extra = tools - EXPECTED_TOOLS
    assert not missing, f"manifest is missing tools: {sorted(missing)}"
    assert not extra, f"manifest has extra tools: {sorted(extra)}"


def test_manifest_config_schema_has_required_keys():
    manifest = _load_manifest()
    schema = manifest.get("configSchema", {})
    assert "MAXIMO_BASE_URL" in schema
    assert "MAXIMO_API_KEY" in schema
    # API キーは secret 扱いであるべき
    assert schema["MAXIMO_API_KEY"].get("secret") is True


# ── server.py 構造 ───────────────────────────────────────────


def _collect_server_function_names() -> set[str]:
    """server.py を AST で読み、トップレベルの関数名集合を返す（実行はしない）。"""
    server_py = (PLUGIN_DIR / "server.py").read_text(encoding="utf-8")
    tree = ast.parse(server_py)
    return {
        node.name
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


def test_server_defines_all_tool_functions():
    names = _collect_server_function_names()
    missing = EXPECTED_TOOLS - names
    assert not missing, f"server.py is missing functions for tools: {sorted(missing)}"


# ── 内蔵 Skill との整合 ───────────────────────────────────────


def test_builtin_skills_reference_maximo_connector():
    """maximo_import / maximo_export Skill が maximo-connector を required_servers で参照する。"""
    for fname in ("maximo_import.yaml", "maximo_export.yaml"):
        path = BUILTIN_SKILLS_DIR / fname
        assert path.exists(), f"missing built-in skill: {fname}"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        required = data.get("required_servers", [])
        types = {r.get("type") for r in required}
        assert "maximo-connector" in types, (
            f"{fname} must declare required_servers.type=maximo-connector"
        )


if __name__ == "__main__":
    test_manifest_exists_and_parses()
    test_manifest_tools_match_expected()
    test_manifest_config_schema_has_required_keys()
    test_server_defines_all_tool_functions()
    test_builtin_skills_reference_maximo_connector()
    print("All Maximo connector contract tests passed.")
