# 1. 開発の始め方と Hello World プラグイン

このガイドでは、もっともシンプルな「Hello World」機能を持つユーティリティ・プラグインを作成して保守太郎へインストールする流れを説明します。保守太郎のプラグイン開発の世界に触れてみましょう。

---

## 必要な環境

プラグインは独立したプログラムであるため、どの言語でも記述できますが、ここでは最も簡単で公式SDKが充実している **Python 3.10以降** を想定します。

1. **Python 3.10+**
2. 依存ライブラリをまとめるパッケージツール (ここでは標準の `venv` と `pip` を使います)

---

## 1. プロジェクトの作成

まずはプラグインの独立したGitリポジトリ（フォルダ）を作成します。
最終的に目指す標準的なリポジトリ構成は以下のようになります：

```text
hello-world-plugin/
├── manifest.json       # プラグインのメタデータと設定ファイル（必須）
├── server.py           # MCPサーバーの実装本体（必須）
├── requirements.txt    # 依存ライブラリのリスト
├── run.bat             # 起動および依存解決スクリプト (Windows用)
├── run.sh              # 起動および依存解決スクリプト (Mac/Linux用)
└── skills/             # (任意) プラグインに同梱する設定や自動化ワークフロー (YAML群)
```

**各ファイルの責務:**
- `manifest.json`: UI設定や起動コマンドなどを定義し、保守太郎本体にプラグインを認識させるメタデータ。
- `server.py`: プラグインのToolの定義や実処理を行うメインプログラム。
- `requirements.txt`: 動作に必要な外部ライブラリを指定します。
- `run.bat` / `run.sh`: プラグイン起動時のエントリポイント。初回起動時に `venv` の自動生成と `pip install` による依存解決を行い、次回以降はそのままサーバーを立ち上げるベストプラクティスです。

それでは、実際にプロジェクトフォルダを作成してみましょう。

```bash
mkdir hello-world-plugin
cd hello-world-plugin
```

続いて、依存パッケージを指定する `requirements.txt` を作成します。内容には `mcp` フレームワークのみを記述します。

```text
mcp
```

そして、最も重要な **起動スクリプト (run.bat)** を作成します。保守太郎はこのスクリプトを呼び出してプラグインを起動します。この仕組みにより、プラグインを配布した際、ユーザー環境で自動的に依存パッケージがインストールされるようになります。

**[Windows向け: run.bat]**
```bat
@echo off
cd /d "%~dp0"

IF NOT EXIST "venv" (
    echo [init] Creating venv...
    python -m venv venv
    venv\Scripts\python -m pip install --upgrade pip
    venv\Scripts\python -m pip install -r requirements.txt
)

venv\Scripts\python server.py
```

**(任意) [Mac/Linux向け: run.sh]**
```bash
#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "[init] Creating venv..."
    python3 -m venv venv
    venv/bin/python -m pip install --upgrade pip
    venv/bin/python -m pip install -r requirements.txt
fi

venv/bin/python server.py
```

開発中も、このスクリプトを実行するだけで自動展開とサーバー起動が行われます。


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
  "command": "run.bat",
  "args": [],
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
- `command` と `args` : 保守太郎はこの通りに子プロセスとして実行します。上の例では依存関係を自動解決する `run.bat` を指定しています。環境に依存させず、確実に実行させるこの方式がベストプラクティスです。
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
