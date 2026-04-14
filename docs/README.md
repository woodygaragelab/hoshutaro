# 保守太郎 (HOSHUTARO) プラグイン開発キット (SDK)

保守太郎は、外部システムとの連携やLLM機能の拡張を**プラグイン方式**で提供しています。
このドキュメントリポジトリは、保守太郎に機能を追加するサードパーティ開発者向けの実装ガイドおよびリファレンスです。

## ドキュメント一覧

学習プロセスに沿って、ステップバイステップでドキュメントをお読みください。

| ステップ | ファイル | 概要 |
| :--- | :--- | :--- |
| **0** | [ARCHITECTURE.md](./ARCHITECTURE.md) | プラグインが本体とどう連携するかのアーキテクチャ図・概念 |
| **1** | [1_GETTING_STARTED.md](./1_GETTING_STARTED.md) | Hello World! MCP Serverを作ってみるチュートリアル |
| **2** | [2_CONNECTOR_DEVELOPMENT.md](./2_CONNECTOR_DEVELOPMENT.md) | MaximoやSAPなどの外部システムとデータを同期する「コネクタ」の開発ガイド |
| **-** | [DATA_MODEL.md](./DATA_MODEL.md) | コネクタ開発で必要となる保守太郎のデータ型（JSONスキーマ）仕様 |
| **3** | [3_LLM_ADAPTER_DEVELOPMENT.md](./3_LLM_ADAPTER_DEVELOPMENT.md) | ローカルやクラウドのLLMを組み込む「LLMアダプタ」の開発ガイド |
| **4** | [4_SKILL_RECIPES.md](./4_SKILL_RECIPES.md) | プラグインのToolを自動化する「Skill（YAML）」の作り方 |
| **5** | [5_PUBLISH_GUIDE.md](./5_PUBLISH_GUIDE.md) | 完成したプラグインをビルドし、GitHubを通じてユーザーへ配信する手順 |

---

## 開発の前提条件
- **プラグインは保守太郎本体とは別の、独立したGitリポジトリとして作成・管理します。**
- すべてのプラグインは **MCP (Model Context Protocol) Server** として実装されます。
- `stdio` トランスポート（標準入出力を介したJSON-RPC通信）を利用するため、Python や Node.js など標準出力が扱える言語であれば何の言語でも開発可能です（本ガイドでは主に **Python** を使った解説を行います）。
- プラグインには必ず `manifest.json` が含まれ、それが保守太郎のUIで設定画面などを生成するメタデータとなります。
