# 3. LLM アダプタの開発

保守太郎にはGoogleの **Gemini API** が標準で組み込まれていますが、「社内のセキュリティポリシーでローカルの Ollama しか使えない」「OpenVINOで動く特定のエッジAIを利用したい」といったケースがあるでしょう。

そのような場合、Gemini の代わりに働く **LLM アダプタ** をプラグインとして開発し、インストールすることができます。

---

## 必須ツール（Tool）仕様

LLM アダプタとして保守太郎に認識されるには、指定された名前と引数を持つ Tool を公開する必要があります。保守太郎のバックエンド（チャットルーティング）がこのToolを検知し、標準の Gemini から切り替える動作を試みます。

### 1. `test_connection`
LLMサーバー・API が生きているか確認する機能です。
**戻り値:**
```json
{
  "ok": true,
  "models": ["llama3.1", "qwen2.5-coder"]
}
```

### 2. `list_models`
UIの設定画面等で、利用可能なモデルのドロップダウンを表示させるために必要な機能です。
**戻り値:** `["llama3.1", "qwen2.5-coder"]` (文字列のリスト)

### 3. `generate_text` (テキスト生成)
これが最も重要な Tool です。保守太郎からプロンプトが送られ、LLM が生成したテキストを返します。

**Python MCP Serverでの実装例:**
```python
import httpx
from mcp.server.fastmcp import FastMCP
import os

mcp = FastMCP("ollama-adapter")

@mcp.tool()
async def generate_text(prompt: str, model: str = None, temperature: float = 0.7) -> str:
    """LLMを使用してテキストを生成します"""
    
    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    target_model = model or os.getenv("OLLAMA_MODEL", "llama3.1")
    
    payload = {
        "model": target_model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature}
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{base_url}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")
```

---

## （推奨）ストリーミング対応

`generate_text` だけでも動作しますが、チャットUI上で文字がカタカタと表示されるスムーズな体験（ストリーミング）を提供したい場合は、以下のToolも実装することをお勧めします。

### `generate_text_stream`
MCPのストリーム機能（サーバからクライアントへの連続的なJSON-RPC通知、または SSE）を利用して実装しますが、MCP SDKによって実装方法が異なります。
（※現在、FastMCPの標準ツールではストリーム機能の完全な型付けが過渡期にあるため、実装する場合は各SDKの `Server-Sent Events` のドキュメントを参照してください）。

まずは標準の `generate_text` を実装して、完全な応答が返せることを確認するのが最優先です。
