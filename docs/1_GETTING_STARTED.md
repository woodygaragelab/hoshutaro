# 1. 開発の始め方と Hello World プラグイン

このガイドでは、もっともシンプルな「Hello World」機能を持つユーティリティ・プラグインを作成して保守太郎へインストールする流れを説明します。保守太郎のプラグイン開発の世界に触れてみましょう。

---

## 必要な環境

プラグインは独立したプログラムであるため、どの言語でも記述できますが、ここでは最も簡単で公式SDKが充実している **Python 3.10以降** を想定します。

1. **Python 3.10+**
2. 依存ライブラリをまとめるパッケージツール (ここでは標準の `venv` と `pip` を使います)

---

## 1. プロジェクトの作成

まずはプラグインのフォルダを作成します。

```bash
mkdir hello-world-plugin
cd hello-world-plugin
```

次に、Pythonの仮想環境を作り、MCP（Model Context Protocol）の公式SDKをインストールします。

```bash
python -m venv venv
# Windowsの場合
venv\Scripts\activate

# MCP用ライブラリのインストール
pip install mcp
```

保守太郎のプラグインは、配布時にこれら依存関係も丸ごとパッケージ化するか、または「アプリ起動時に `pip install -r requirements.txt` を叩かせる仕組み」にする必要があります。（詳しくは 5_PUBLISH_GUIDE.md で解説します）
ここでは開発中のローカルテストとして進めます。

---

## 2. manifest.json の作成

保守太郎があなたのプログラムを「プラグイン」として認識するために必須となるのが `manifest.json` です。プロジェクト直下に作成してください。

```json
{
  "id": "hello-world-utility",
  "name": "Hello World プラグイン",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "utility",
  "icon": "👋",
  "license": "free",
  "minAppVersion": "1.0.0",
  "transport": "stdio",
  "command": "venv/Scripts/python",
  "args": ["server.py"],
  "tools": ["say_hello"],
  "configSchema": {
    "GREETING_WORD": { 
      "type": "string", 
      "label": "挨拶の言葉", 
      "default": "こんにちは" 
    }
  }
}
```

### ポイント
- `command` と `args` : 保守太郎はこの通りに子プロセスとして実行します。（環境に依存させないため、最終版では `run.bat` のようなスクリプトを指定するのが一般的です）
- `configSchema` : ユーザーが保守太郎のUI（プラグインマネージャー）上で入力できる環境設定の値です。APIキーなどを入力させたい場合は `type: "secret"` にします。

---

## 3. サーバー (server.py) の実装

次に、本体となる `server.py` を作成します。
MCPのPythonライブラリの `FastMCP` フレームワークを使うと、わずか数行で実装できます。

```python
import os
import sys

# Windows環境での文字化けを防ぐ（重要）
sys.stdout.reconfigure(encoding='utf-8')

from mcp.server.fastmcp import FastMCP

# マニフェストのidと一致させるのが推奨
mcp = FastMCP("hello-world-utility")

# ツール（保守太郎のGeminiから呼び出される機能）を定義
@mcp.tool()
def say_hello(name: str) -> str:
    """
    ユーザーに挨拶を返します。
    引数:
        name: 挨拶する相手の名前
    """
    # configSchema に設定した値は環境変数として渡されます
    greeting = os.getenv("GREETING_WORD", "Hello")
    return f"{greeting}, {name}さん！保守太郎のMCPプラグインからのメッセージです。"

if __name__ == "__main__":
    # stdio トランスポートで待ち受け開始
    mcp.run(transport='stdio')
```

これだけで、`say_hello` という Tool を持つ MCP Server が完成しました。関数の型ヒント(`name: str`) やDocstring(`ユーザーに...`) がそのまま機能説明として保守太郎本体に共有されます。

---

## 4. 保守太郎へのローカルインストール（テスト）

開発したプラグインをテストするためには、保守太郎のプラグインディレクトリにこのフォルダを配置するだけです。
（※本番環境ではzipにしてGitHubにアップロードしますが、開発中はローカル環境にシンボリックリンク等を使って配置すると便利です）

1. 保守太郎のシステムフォルダを開きます： `C:\Users\<YourUserName>\.gemini\antigravity\plugins`
2. 上記のフォルダの中に、直接 `hello-world-plugin` をコピー（またはシンボリックリンク）します。
3. 保守太郎（UI）を開き、歯車アイコン等のメニューから「プラグイン管理」を開きます。
4. インストール済みの一覧に「Hello World プラグイン」が表示されているはずです。
5. 【起動】ボタンを押して緑色のランプが付与されれば通信成功です。

起動後、保守太郎の AI チャット欄で以下のように入力してみましょう。

> 「Hello Worldユーティリティの機能を使って、山田さんに挨拶して」

AI が自動的に `say_hello` Tool を見つけ、プラグインに通信し、「こんにちは、山田さん！」といった結果を返してくれるはずです！

---

## 次のステップ

これで、基本的な MCP Server の仕組みと保守太郎での認識方法が把握できました。
さらに具体的な外部連携などを作りたい場合は、以下のチュートリアルに進んでください。

- Maximoなど外部データと連携したい場合 → [2_CONNECTOR_DEVELOPMENT.md](./2_CONNECTOR_DEVELOPMENT.md)
- 別のLLMに変えるプラグインを作りたい場合 → [3_LLM_ADAPTER_DEVELOPMENT.md](./3_LLM_ADAPTER_DEVELOPMENT.md)
