# src-tauri/resources/core/

このディレクトリは `tauri build` 時に **HOSHUTARO** アプリへ同梱される core
（Python エンジン）の成果物を置く場所。`tauri.conf.json` の
`bundle.resources` が `resources/core` → アプリ内 `core/` へマッピングする。

中身はビルド時に生成され、リポジトリにはコミットしない（`.gitignore` 済み）:

- `bin/hoshutaro-core/` — PyInstaller で梱包した core 実行ファイル一式
  （`cd core && pyinstaller --noconfirm hoshutaro-core.spec` の出力）
- `home-template/` — 初回起動時に書き込み可能ディレクトリへ展開する
  設定テンプレート（`config/` / `skills/builtin/` / `plugins/` / `.env.example`）

生成手順は `.github/workflows/release.yml` の "Build core sidecar" ステップを参照。
ローカルで `tauri build` を試す場合も同じ手順で本ディレクトリを用意する。
