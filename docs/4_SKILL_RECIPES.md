# 4. Skill (ワークフロー) の作り方

保守太郎の最大の特長は、**「プラグイン機能をAI（Gemini）が自律的に使いこなし、ユーザーの指示を達成する」** という点です。
あなたが MCP Server で便利なTool（例: `fetch_assets` や `send_email` など）を作っても、ユーザーがチャットからそれを意図した通りに実行してもらうには、AIへの「手順書」が必要です。

これが **Skill** です。

---

## Skill とは？

Skill は単なる YAML ファイルです。
「この業務をするときは、この順番で、このToolを使いなさい」というAIへのプロンプトと、ユーザーに前もって入力させる設定画面を定義します。

保守太郎のフロントエンドにある「スキル実行ボタン」を押すと、この YAML が読み込まれ、AIが自動操縦を始めます。

---

## Skill YAML の基本フォーマット

プラグイン開発者は、自分のプラグインに便利な Skill YAML ファイルをいくつか同梱して提供することが推奨されます。

```yaml
name: "Maximo 一括インポート"
id: "my_plugin.maximo_import"
version: "1.0.0"
type: "user"                # "builtin" は本体付属専用のため、プラグイン作成時は "user" 
description: "外部システムから新規登録された機器を保守太郎にインポートします。"
icon: "download"            # 表示アイコン指定 (download, sync, chart, search など)

# このSkillを実行するために最低限起動していなければならないMCPサーバー
required_servers:
  - type: "maximo-connector"

# ユーザーに実行前に入力させる画面の定義
parameters:
  - name: "target_site"
    label: "対象サイト (Site ID)"
    type: "text"
    default: "SKK"
    required: true

  - name: "max_count"
    label: "最大取得件数"
    type: "number"
    default: 1000

# ここが AI への司令 탑（システムプロンプト）
system_prompt: |
  あなたは保守太郎のデータインポートアシスタントです。
  以下の手順に従って、外部システムから保守太郎のデータベースへデータを取り込んでください。

  1. プラグインの `test_connection` ツールを呼んで通信できるか確認する。
  2. `fetch_assets` ツールを `{target_site}` の条件で呼び出す。（上限は {max_count} 件）
  3. 保守太郎の組み込みツールである `datastore.import_records` を呼び出して保存する。
  4. 最終的な取得結果の件数とサマリーをユーザーに日本語で簡潔に報告する。

# 安全対策（データの書き込み前などにストップをかける）
safety:
  requires_confirmation: true   # 実行開始前に必ずブラウザのポップアップ「実行してよいですか？」を出す
  backup_before_write: true     # 本体のデータベースへ書き込む前に自動バックアップをとる
```

---

## パラメータとプロンプトの連動

上記の例でユーザーがUIから `target_site` に "TOK" と入力した場合、`system_prompt` に書かれている `{target_site}` という部分が自動で "TOK" に置換されてからAIに送信されます。

### サポートされている parameters の type
- `text` : 通常の文字列
- `number` : 数値
- `boolean` : チェックボックス（True/False）
- `select` : ドロップダウンリスト（YAML内で `options: ["A", "B"]` と追記が必要）
- `multi_select` : 複数選択可能なチェックボックス

---

## プラグイン同梱の推奨

プラグインを使って何ができるかをユーザーにアピールするためにも、自分で作成した `your_skill.yaml` をプラグイン公開時の zip ファイル内に `skills/` フォルダなどを設けて同梱し、「これを conservatively 登録してください」とユーザーにアナウンスするのが最も良い開発者体験となります。
