# 12. リリースガイド — 署名・配布・自動更新

HOSHUTARO デスクトップアプリ（Tauri）のリリース手順。Track E Sprint 4 で整備。

リリースワークフローの実体は [`.github/workflows/release.yml`](../.github/workflows/release.yml)。

---

## 1. リリースの流れ

```
git tag vX.Y.Z && git push origin vX.Y.Z
  └→ .github/workflows/release.yml（OS マトリクス）
       ├─ Windows / macOS / Linux でデスクトップインストーラをビルド
       ├─ コード署名（各 OS）+ macOS は notarization
       ├─ Tauri Updater 用に latest.json + 署名を生成
       └─ GitHub Release（ドラフト）に添付
  └→ ドラフト Release を内容確認 → publish で公開
```

`workflow_dispatch` でタグなしの手動実行も可能（検証用）。

---

## 2. 必要な GitHub Secrets

リポジトリの Settings → Secrets and variables → Actions に登録する。

| Secret | 用途 | 必須 |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri Updater 署名（minisign 秘密鍵の文字列） | 自動更新を使う場合 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 上記鍵のパスワード（無ければ空文字） | 同上 |
| `APPLE_CERTIFICATE` | macOS Developer ID 証明書（base64 の .p12） | macOS 署名 |
| `APPLE_CERTIFICATE_PASSWORD` | 上記 .p12 のパスワード | macOS 署名 |
| `APPLE_SIGNING_IDENTITY` | 例: `Developer ID Application: ...` | macOS 署名 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | notarization 用の Apple ID・app 用パスワード・チーム ID | macOS notarization |

`GITHUB_TOKEN` は Actions が自動付与（Release 作成に `contents: write` 権限を付与済み）。

---

## 3. Tauri Updater 署名鍵の生成

自動更新パッケージの署名・検証に使う minisign 鍵ペアを生成する。

```bash
npx tauri signer generate -w hoshutaro-updater.key
```

- **公開鍵**（`hoshutaro-updater.key.pub` の内容）→ `src-tauri/tauri.conf.json` の
  `plugins.updater.pubkey` に設定する。
- **秘密鍵**（`hoshutaro-updater.key` の内容）→ GitHub Secret
  `TAURI_SIGNING_PRIVATE_KEY` に登録する。**リポジトリには絶対にコミットしない。**

> 現在 `tauri.conf.json` に入っている公開鍵は開発用のプレースホルダ。
> 本番リリース前に上記手順で正式な鍵ペアを生成し、公開鍵を差し替えること。

---

## 4. コード署名

### Windows（Authenticode）
OV/EV コード署名証明書が必要。`tauri.conf.json` の `bundle > windows >
certificateThumbprint`（ランナーの証明書ストアに導入した証明書の拇印）を設定するか、
Azure Trusted Signing を利用する。証明書の導入ステップを `release.yml` の
Windows ジョブに追加する。

### macOS（Developer ID + notarization）
Apple Developer Program 加入が必要。Developer ID Application 証明書を .p12 で
書き出し、§2 の `APPLE_*` Secrets に登録すれば `tauri-action` が署名・notarization・
stapling を実行する。

### Linux
AppImage / .deb は署名なしで配布可（OS 側の Gatekeeper 相当の制約がない）。

---

## 4.5. core（Python エンジン）の同梱

配布先 PC に Python は不要。`core` は **PyInstaller** で梱包し、Tauri アプリに
同梱する。`release.yml` の "Build core sidecar" ステップが CI で自動実行する。

ローカルで `tauri build` を試す場合は、`tauri build` の前に手動で同じ手順を実行する:

```bash
# 1. core を梱包（ML 依存込み = Gemma 4 推論を含める）
cd core
pip install -r requirements.txt
pip install -r requirements-ml.txt   # openvino-genai 等。Gemma を動かすなら必須
pip install pyinstaller
pyinstaller --noconfirm hoshutaro-core.spec   # → core/dist/hoshutaro-core/
cd ..

# 2. Tauri 同梱用にステージング（tauri.conf.json: bundle.resources → resources/core）
dest=src-tauri/resources/core
mkdir -p "$dest/bin" "$dest/home-template/skills"
cp -r core/dist/hoshutaro-core "$dest/bin/hoshutaro-core"
cp -r core/config             "$dest/home-template/config"
cp -r core/skills/builtin     "$dest/home-template/skills/builtin"
cp -r core/plugins            "$dest/home-template/plugins"
cp    core/.env.example       "$dest/home-template/.env.example"

# 3. インストーラをビルド
npm run tauri build   # → src-tauri/target/release/bundle/ にインストーラ
```

- 梱包バイナリは `--port` を受け取り、`HOSHUTARO_HOME` 環境変数で渡された
  書き込み可能ディレクトリから設定を読む（Tauri の `sidecar.rs` が配線）。
- 初回起動時、`home-template/` がユーザーのアプリデータディレクトリへ展開される。
- `requirements-ml.txt` を入れずに梱包すると core は起動するが Gemma 推論は不可。

> macOS 注: PyInstaller の core バイナリはビルドしたランナーのアーキテクチャ単一。
> Intel/ARM 両対応の universal バイナリ化は今後の課題。

---

## 5. リリース手順

1. `src-tauri/tauri.conf.json` と `package.json` の `version` を更新。
2. 変更を main にマージ。
3. タグを打って push:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. `release.yml` の完了後、GitHub の Releases にドラフトが作成される。
5. 内容（インストーラ・`latest.json`）を確認し、ドラフトを publish。
6. 既存ユーザーのアプリは次回起動時に `latest.json` を確認し、更新を取得する。

---

## 6. 既知の未完了事項（Track E 残作業）

本ガイドの手順を完全に機能させるには、以下が未完了:

- ~~**`core`（Python エンジン）の同梱**~~ — **完了**。PyInstaller で梱包し
  `tauri.conf.json` の `bundle.resources` で同梱（§4.5）。Linux 環境で梱包
  バイナリの起動・ヘルス応答を検証済み。残: ML 依存込み（Gemma）の梱包と
  Windows/macOS 実機での `tauri build` 検証。
- **本番署名証明書の調達** — Windows OV/EV 証明書、Apple Developer Program。
  未調達の間は署名なしビルドになる（OS の警告が出る）。
- **private リポジトリの Updater 配信** — `tauri-plugin-updater` は匿名で
  Release 資産を取得するため、private repo では更新配信専用の public ミラー、
  S3 + 署名付き URL、軽量 update エンドポイントのいずれかが必要。
- **実機検証** — `tauri build` の実行と、生成インストーラの各 OS での
  動作確認（ヘッドレス CI 環境では未実施）。
