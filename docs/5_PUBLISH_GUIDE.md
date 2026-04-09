# 5. プラグインの配布と公開ガイド

保守太郎では、あなたの作成したプラグインを GitHub Releases を通じて安全に、かつワンクリックでユーザーに配信できる仕組み（プラグイン・レジストリ）を提供しています。

ここでは、完成したローカルのプラグインをパッケージ化し、全世界の保守太郎ユーザーへ配信可能にする手順を説明します。

---

## 1. 配布用バイナリ（zip）の作成

Pythonで作ったプラグインをユーザーの環境で動かす場合、依存するライブラリ（`mcp`, `httpx` など）をどうやって渡すかが問題になります。
一般的な配布方法は以下の2パターンのどちらかです。

### 方式A: venv + requirements.txt （推奨・軽量）
zipの中に `requirements.txt` を入れ、ユーザーの保守太郎が起動する前にインストールさせる方式です。
1. コード (`server.py`), `manifest.json`, `requirements.txt` の3つを1つのフォルダに入れる。
2. そのフォルダごと `.zip` 形式で圧縮する。
※ `manifest.json` の `command` フィールドは `python server.py` のように設定しておき、保守太郎側にはPython環境がインストールされていることを前提とします。

### 方式B: PyInstaller での単一実行ファイル化
ユーザーのPCにPythonが入っていなくても動かせるように、`.exe` ファイル化して配布する方式です。
1. `pip install pyinstaller` を行い、 `pyinstaller --onefile server.py` を実行。
2. できた `dist/server.exe` と `manifest.json` を zip にまとめて圧縮する。
※ `manifest.json` の `command` フィールドは `server.exe` と設定します。

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

## プラグインのアップデート

バグを修正したり新機能を追加した場合は、以下の2ステップで全世界のユーザーに更新が行き渡ります。

1. あなたの GitHub で `v1.0.1` などの新しい Release を作り、新しい zip を上げる。
2. 保守太郎本体の `plugin-registry.json` の `releaseTag` と `version` を更新する（Pull Requestを出す）。

以上で、保守太郎プラグイン開発ガイドは終了です。
あなたならではの強力なプラグインを実装し、保守太郎のツールボックスを豊かにしてください！
