# 3. LLM アダプタの開発

保守太郎にはGoogleの **Gemini API** が標準で組み込まれていますが、「社内のセキュリティポリシーでローカルの Ollama しか使えない」「OpenVINOで動く特定のエッジAIを利用したい」といったケースがあるでしょう。

そのような場合、Gemini の代わりに働く **LLM アダプタ** をプラグインとして開発し、インストールすることができます。
保守太郎のプラグイン基盤は、インストールされたプラグインを自動で認識し、UIとバックエンドの両方でシームレスにルーティングする**動的アーキテクチャ**を採用しています。

---

## 1. マニフェストによる LLM アダプタの宣言

自作のプラグインが「LLM アダプタ」としてフロントエンド（設定画面のプルダウン）に自動表示されるようにするには、`manifest.json` の `category` に `llm-adapter` を指定します。

```json
{
  "id": "my-custom-llm-adapter",
  "name": "独自 LLM アダプタ",
  "version": "1.0.0",
  "category": "llm-adapter", 
  "command": "python",
  "args": ["-u", "server.py"]
}
```

この設定により、プラグインマネージャーからインストールした直後から、LLM設定ダイアログの「プロバイダー」の選択肢として動的に出現します。

---

## 2. 環境変数の標準インターフェース

HOSHUTAROエージェントのLLM設定画面は、すべてのアダプタに対して「共通フォーム」を採用しています。設定された値は、内部で以下の標準環境変数としてバックエンドからMCPプラグインへと注入されます。

プラグイン側では、これらの数値を読み取ってAPIリクエストにマッピングしてください。

*   `LLM_BASE_URL`: 接続先URLやモデルの配置ディレクトリのパス
*   `LLM_MODEL`: 使用するモデル名
*   `LLM_API_KEY`: APIキー（ローカル環境で不要な場合は空）

※ 注意: 既存の `OLLAMA_BASE_URL` など特定のキーも後方互換性で注入されますが、新規開発時は標準インターフェース（`LLM_` Prefix）の使用を推奨します。

---

## 3. 必須ツール（Tool）仕様

LLM アダプタとして動作するには、以下の指定された名前を持つ Tool を公開する必要があります。保守太郎のバックエンド（チャットルーティング等）は、選択中のアダプターに対して直接このToolを呼び出します。

### `test_connection`
LLMサーバー・API が生きているか確認する機能です。設定画面の「導通テスト」ボタンから呼ばれます。
**戻り値:**
```json
{
  "ok": true,
  "model_info": "llama3.1"
}
```

### `list_models` (省略可)
利用可能なモデルを動的に取得し、オプションとして返す機能です。
**戻り値:** `["llama3.1", "qwen2.5-coder"]` (文字列のリスト)

### `generate_text` (テキスト生成, 必須)
保守太郎からプロンプトが送られ、LLM が生成したテキストを返します。引数として `messages` (チャット履歴オブジェクトの配列) や `temperature` などが送信されます。

**Python MCP Server (FastMCP) での実装例:**
```python
import httpx
from mcp.server.fastmcp import FastMCP
import os

mcp = FastMCP("my-custom-adapter")

@mcp.tool()
async def generate_text(messages: list[dict], temperature: float = 0.7) -> str:
    """LLMを使用してテキストを生成します"""
    
    # HOSHUTAROから注入された標準環境変数を使用
    base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    target_model = os.getenv("LLM_MODEL", "llama3.1")
    
    # 最新の会話プロンプトを取得
    prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
    
    payload = {
        "model": target_model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature}
    }
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(f"{base_url}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")
```

これにより、任意のLLMに対するプロキシとして働くプラグインを自由に組み込めるようになります。
