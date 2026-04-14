# 5. プラグインの配布と公開ガイド

保守太郎では、あなたの作成したプラグインを GitHub Releases を通じて安全に、かつワンクリックでユーザーに配信できる仕組み（プラグイン・レジストリ）を提供しています。

ここでは、完成したローカルのプラグインをパッケージ化し、全世界の保守太郎ユーザーへ配信可能にする手順を説明します。

---

## 1. 配布用バイナリ（zip）の作成

Pythonで作ったプラグインをユーザーの環境で動かす場合、依存するライブラリ（`mcp`, `httpx` など）をどうやって渡すかが問題になります。
一般的な配布方法は以下の2パターンのどちらかです。

### 方式A: 起動スクリプト同梱方式 （推奨・軽量）
`run.bat` などの起動スクリプトと `requirements.txt` を同梱し、ユーザーの保守太郎が初回起動時に依存関係を自動構築する方式です。（1_GETTING_STARTED.md で作成した方式です）

1. `server.py`, `manifest.json`, `requirements.txt`, `run.bat`, `skills/` などの必要なファイルを準備します。
2. **これらのファイルを「ZIPのルート直下」になるように** 全選択して `.zip` 形式で圧縮します。（フォルダ自体を圧縮して、解凍時に二重フォルダにならないよう注意してください。解凍した直後の階層に `manifest.json` が見える構造が必須です）

### 方式B: PyInstaller での単一バイナリ化
ユーザーのPC環境に依存せず動かせるように、ビルドして `.exe` 化して配布する方式です。

1. `pip install pyinstaller` を行い、 `pyinstaller --onefile server.py` を実行。
2. できた `dist/server.exe` と `manifest.json` などを同様に「ZIPのルート直下」になるよう全選択して圧縮します。
※ `manifest.json` の `command` フィールドは `server.exe` と明記します。

---

## 2. GitHub Releases へのアップロード

保守太郎のプラグイン基盤は、すべて GitHub Private / Public Repository の Release 機能と連動しています。

1. 自分の GitHub リポジトリ（例: `woodygaragelab/hoshutaro-plugin-mytool`）を作ります。
2. ソースコードをPushし、GitHub上で `v1.0.0` のような Tag を作成して **Release (リリース)** を作成します。
3. リリースの「Assets」に、先程作成した `.zip` ファイルをドラッグ＆ドロップでアップロードします。

---

## 3. plugin-registry.json への登録

最後に、保守太郎本体のリポジトリ直下にある `plugin-registry.json` に、あなたのプラグインの情報を書き加えます。
これを行うことで、ユーザーの保守太郎の画面（プラグインマネージャー）の「利用可能」タブにあなたのプラグインが表示されるようになります。

```json
{
  "registryVersion": "1.0.0",
  "plugins": [
    {
      "id": "my-awesome-utility",
      "name": "超便利ユーティリティ",
      "version": "1.0.0",
      "category": "utility",
      "icon": "✨",
      "license": "free",
      "repository": "woodygaragelab/hoshutaro-plugin-mytool",
      "releaseTag": "v1.0.0",
      "artifactPattern": "mytool-plugin.zip",
      "platforms": ["windows", "mac", "linux"],
      "bundled": false
    }
  ]
}
```

### 重要なフィールド
- `repository`: GitHubのリポジトリ名（`オーナー/リポジトリ`）。
- `releaseTag`: 対象のリリースバージョン。ここを `v1.0.1` のように変更し、本体リポジトリへ反映するだけでユーザーへ「アップデートがあります」と通知が飛びます。
- `artifactPattern`: アップロードした .zip のファイル名。プラットフォームごとにファイル名を分けたい場合は `mytool-{platform}.zip` のように記載することも可能です。

---

## 4. 保守太郎によるプラグインのインストールメカニズム（裏側の挙動）

開発者がプラグインを登録した後、ユーザーがUIから「インストール」もしくは「更新」を押した際、裏側では以下のようなライフサイクルが自動実行されます。この挙動を理解しておくことで、予期せぬ動作時のデバッグが容易になります。

1. **レジストリ検知:** `plugin-registry.json` に記載された `repository` と `releaseTag` をもとに、対象の GitHub リポジトリから Release 情報を取得します。
2. **自動ダウンロード:** 対象 Release の Assets から、`artifactPattern` に合致する対象のZIPファイルをダウンロードします。
3. **自動解凍:** `~/.gemini/antigravity/plugins/<plugin-id>` の直下へZIPが解凍・展開されます。（このためZIPルート直下に `manifest.json` 等が配置されている必要があります）
4. **スキル自動ロード:** 展開されたフォルダ直下に `skills/` フォルダが存在する場合、そこに含まれるすべての YAML ファイルを読み込み、即座に保守太郎の「スキル」として登録します。
5. **プロセス起動:** アプリケーション起動時、またはインストール完了直後に、`manifest.json` の `command` に書かれたスクリプト（`run.bat`等）を子プロセスとして非同期実行し、stdioトランスポートでJSON-RPC通信を開始します。

---

## プラグインのアップデート

バグを修正したり新機能を追加した場合は、以下の2ステップで全世界のユーザーに更新が行き渡ります。

1. あなたの GitHub で `v1.0.1` などの新しい Release を作り、新しい zip を上げる。
2. 保守太郎本体の `plugin-registry.json` の `releaseTag` と `version` を更新する（Pull Requestを出す）。

以上で、保守太郎プラグイン開発ガイドは終了です。
あなたならではの強力なプラグインを実装し、保守太郎のツールボックスを豊かにしてください！
