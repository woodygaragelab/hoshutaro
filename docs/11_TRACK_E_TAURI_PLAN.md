# 11. Track E — Tauri Desktop 配布 Sprint 計画

このドキュメントは Track E (Tauri Desktop への配布形態一本化、~3-4 週間規模) の
**Sprint 計画と詳細タスク分解** を保持します。

実装着手の前に必ずこのドキュメント + [HANDOFF.md](../HANDOFF.md) +
[docs/PROJECT_MU.md](PROJECT_MU.md) §2「配布方式」を読み込んでください。

> **位置づけ**: Track A/B (Project Mu Engine + LLM Adapter + Plugin/MCP) と
> Track D (AWS Cloud 認証・繋ぎ層) のコード実装が完了し、残るは「ユーザーへどう
> 届けるか」。HANDOFF.md の確定方針 **「配布: Tauri Desktop 一本化（Web 版は廃止予定）」**
> を実体化するのが Track E です。

---

## 0. 現状と移行のゴール

### 現状の配布資産 (レガシー、Track E で置換対象)

| 資産 | 役割 | Track E 後 |
|---|---|---|
| `launcher/main.py` | pystray 常駐トレイ。FastAPI backend + MCP server を子プロセス起動し、既定ブラウザで `localhost:8000` を開く。`apply_update()` で更新ステージングを差し替え | **廃止**。ウィンドウ/トレイ/更新適用はすべて Tauri (Rust) 側へ移行 |
| `build/build_all.py` | PyInstaller で frontend→backend→launcher をバイナリ化し zip / Inno Setup でパッケージ | **廃止**。Tauri bundler + GitHub Actions matrix へ移行 |
| `build/hoshutaro_setup.iss` | Inno Setup の Windows インストーラスクリプト (Windows 専用) | **廃止**。Tauri が NSIS / MSI / DMG / AppImage を生成 |

### ゴール (Track E 完了時)

- 既存 React/Vite フロントを **OS ネイティブ webview** で表示する単一のデスクトップアプリ
- Python (FastAPI) backend は **Tauri sidecar** として Tauri が起動・監視・終了
- **3 OS 配布物**: Windows (`.exe` NSIS + `.msi`)、macOS (`.dmg`)、Linux (`.AppImage` + `.deb`)
- **署名付き自動更新** (Tauri Updater + minisign + `latest.json`)
- **コード署名** (Windows Authenticode / macOS Developer ID + notarization)
- リリースは Git タグ push → GitHub Actions OS matrix → Release 添付まで自動化

---

## 1. 設計判断 (確定)

| 項目 | 採用 | 理由 |
|---|---|---|
| デスクトップフレームワーク | **Tauri 2.x** | Electron 比で本体軽量 (~50MB 目標)、OS ネイティブ webview、Rust。HANDOFF.md の確定方針 |
| フロント | 既存 React/Vite を **そのまま** Tauri webview に載せる | Web 版は廃止 (一本化)、コードベース共通。`tauri.conf.json` の `frontendDist` = `../dist`、`devUrl` = `http://localhost:5173` |
| Python backend 配布 | **sidecar (`externalBin`)**。バイナリ化手段は **PyInstaller `--onefile` を第一候補、PyOxidizer を比較検証** (Sprint 2 で PoC 決定) | FastAPI を別プロセスで起動し Tauri が spawn/監視/終了。HANDOFF は "PyOxidizer" を挙げるが、native 拡張 (sqlite 等) との相性は PyInstaller が実績豊富。Sprint 2 で両者を計測して確定 |
| 重い ML 依存の扱い | backend バイナリに **torch / openvino / transformers / optimum-intel を同梱しない**。初回起動時 DL (モデルと同じ仕組み) | 「Tauri 本体 ~50MB」制約 (PROJECT_MU.md §2) を満たすため。ML スタックは ~1GB 超。既存 `backend/app/mu/setup/downloader.py` + `routers/setup.py` の初回 DL UX を拡張して対応 |
| backend ↔ frontend 通信 | 既存の **localhost HTTP (FastAPI)** を維持。port は固定既定 + 衝突時に空きポート探索 | `src/services/muApi.ts` / `pluginApi.ts` / `cloudSync` 等の既存クライアントを **無改修** で使える。Tauri IPC への全面移行は工数大・利得小のため見送り |
| 自動更新 | **Tauri Updater plugin** (`@tauri-apps/plugin-updater` + `tauri-plugin-updater`) | 署名付き update artifact + `latest.json` マニフェスト。`launcher/main.py` の `apply_update()` を置換 |
| 更新配信先 | **GitHub Releases** (`mushitaro/hoshutaro-mu`、PRIVATE) | 既存リポジトリを利用。private repo の asset 取得には token / 署名付き URL が要る → Sprint 3 の論点 (§4 リスク参照) |
| Updater 署名 | Tauri updater の **minisign キーペア** (`tauri signer generate`)。アプリのコード署名証明書とは**別物** | 秘密鍵は CI secret、公開鍵は `tauri.conf.json` に埋め込み。更新パッケージの改竄検知 |
| システムトレイ | Tauri `tray-icon` API | `launcher/main.py` の pystray トレイ (開く / 再起動 / 終了) を置換 |
| ウィンドウ管理 | 単一メインウィンドウ + トレイ最小化、`tauri-plugin-single-instance` で二重起動防止、`tauri-plugin-window-state` で位置/サイズ復元 | デスクトップアプリの標準挙動 |
| ビルドターゲット | Windows (`NSIS .exe` + `.msi`)、macOS (`.dmg`、可能なら universal)、Linux (`.AppImage` + `.deb`) | Tauri bundler が生成。3 OS |
| コード署名 | Windows: **Authenticode** (OV または EV 証明書)、macOS: **Developer ID Application + notarization**、Linux: 署名なし (AppImage の GPG 署名は任意) | OS の SmartScreen / Gatekeeper 要件。証明書はユーザー調達が必要 (§4 ブロッカー) |
| リリース CI | GitHub Actions の **OS matrix** (`windows-latest` / `macos-latest` / `ubuntu-latest`) + `tauri-apps/tauri-action` | 各 OS でビルド → Release へ添付 → `latest.json` 生成まで自動 |
| Cognito 認証 | webview 内の既存 `aws-amplify` を **そのまま** 利用 (USER_SRP_AUTH、OAuth redirect 不使用) | webview は `fetch` / `localStorage` 利用可。redirect を使わないので deep link 不要。Sprint 1 で webview 上の token 永続化を実機確認 |
| バンドル識別子 | `jp.hoshutaro.desktop` (**確定要** — ユーザー確認) | reverse-domain。macOS の bundle identifier / Windows の AppUserModelID に使用 |

---

## 2. ~3-4 週間ロードマップ

### Sprint 0: 設計フェーズ ✅ 完了 (2026-05-16)
- [x] 本ドキュメント (`docs/11_TRACK_E_TAURI_PLAN.md`) 作成
- [x] HANDOFF.md に Track E 設計ドキュメント参照 + Sprint 0 完了を追記
- [x] レガシー配布資産 (`launcher/` / `build/`) の置換方針を確定

### Sprint 1: Tauri スキャフォルド + フロント統合 (Week 1)
**目的**: 既存 React UI が Tauri webview で起動する状態にする。

- `src-tauri/` を新規作成 (`Cargo.toml` / `tauri.conf.json` / `build.rs` / `src/main.rs` / `src/lib.rs` / `capabilities/` / `icons/`)
- `package.json` に `@tauri-apps/cli` (devDep) / `@tauri-apps/api` (dep) + `tauri` 系 scripts 追加
- `vite.config.ts` を Tauri 向けに調整 (`clearScreen` / `strictPort` / `envPrefix` / ブラウザ自動起動の除去)
- `.gitignore` に `src-tauri/target/` 等を追加
- `npm run tauri dev` で既存 UI が Tauri ウィンドウに表示されることを確認
- この時点では backend は別途 `npm run dev:backend` で起動 (sidecar 化は Sprint 2)

詳細は §3 を参照。

### Sprint 2: Python backend の sidecar 化 (Week 2)
**目的**: Tauri がアプリ起動時に FastAPI backend を起動・監視・終了する。

- backend を単一実行ファイル化する PoC: **PyInstaller `--onefile` vs PyOxidizer** をビルドサイズ / 起動速度 / native 拡張互換性で比較し確定
- ML 重依存 (torch / openvino / transformers) を **同梱しない** ことを `backend/requirements*.txt` の分割で担保 (コア依存 / ML 依存を別ファイルに)
- backend バイナリを Tauri `externalBin` (sidecar) に登録、target-triple サフィックス付きリネームのビルド手順を整備
- Rust 側: アプリ起動 → sidecar spawn → `GET /health` をポーリングして ready 後にメインウィンドウ表示。アプリ終了時に sidecar を graceful kill
- ポート: 既定ポート固定 + 衝突時に空きポート探索 → webview 側へ `window.__HOSHUTARO_API_PORT__` 等で受け渡し
- `launcher/main.py` のロジック (MCP server 起動 / プロセス管理) のうち必要分を Rust に移植

### Sprint 3: 自動更新 + ネイティブ統合 (Week 3)
**目的**: 署名付き自動更新とトレイ常駐を実装する。

- `tauri-plugin-updater` + `tauri-plugin-single-instance` + `tauri-plugin-window-state` 導入
- minisign キーペア生成、公開鍵を `tauri.conf.json` に、秘密鍵を CI secret に
- `latest.json` 配信方式を確定 (private repo の Release asset を updater から取得する手段 — §4 リスク)
- システムトレイ (開く / 再起動 / 終了)、ウィンドウを閉じてもトレイ常駐、復元
- 既存 `src/components/UpdateNotification/` を Tauri updater イベントに結線 (プラグイン更新通知とアプリ本体更新を UI 上で整理)
- 初回起動フロー: モデル / ML 依存 DL UX (既存 `routers/setup.py` の SSE progress) を Tauri 起動シーケンスへ統合

### Sprint 4: コード署名 + リリースパイプライン (Week 4)
**目的**: 3 OS の署名済み配布物を CI で自動生成する。

- GitHub Actions の OS matrix workflow を新規作成 (`tauri-apps/tauri-action`)
- Windows: Authenticode 署名 (証明書を CI secret 化)
- macOS: Developer ID Application 署名 + `notarytool` notarization + stapling
- Linux: `.AppImage` / `.deb` 生成 (署名なし)
- レガシー資産 (`build/build_all.py` / `build/hoshutaro_setup.iss` / `launcher/`) を削除
- `docs/11` + HANDOFF を Track E 完了状態に更新、リリース手順を記載

---

## 3. Sprint 1 詳細タスク分解 (実装着手用)

実装は **1 Slice = 1 PR** で分割し squash-merge する (HANDOFF の作業ルール準拠)。

| Slice | 内容 |
|---|---|
| 1-A | `src-tauri/` スキャフォルド (Cargo / tauri.conf.json / Rust エントリ / capabilities / icons) |
| 1-B | `package.json` 依存 + scripts、`vite.config.ts` の Tauri 対応、`.gitignore` |
| 1-C | 本ドキュメント + HANDOFF を Sprint 1 完了状態に更新 |

### Task 1.1: `src-tauri/` スキャフォルド (Slice 1-A)

| ファイル | 内容 |
|---|---|
| `src-tauri/Cargo.toml` | パッケージ名 `hoshutaro`、`tauri` 2.x を dependencies、`tauri-build` を build-dependencies。`[lib]` で `hoshutaro_lib` を切り出し |
| `src-tauri/build.rs` | `fn main() { tauri_build::build() }` |
| `src-tauri/tauri.conf.json` | `productName: "保守太郎"`、`identifier: "jp.hoshutaro.desktop"`、`build.frontendDist: "../dist"`、`build.devUrl: "http://localhost:5173"`、`build.beforeDevCommand` / `beforeBuildCommand`、`app.windows` (タイトル / 初期サイズ 1280x800 / minWidth)、`bundle.targets` (3 OS)、`bundle.icon` |
| `src-tauri/src/main.rs` | `hoshutaro_lib::run()` を呼ぶだけの薄いエントリ (`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`) |
| `src-tauri/src/lib.rs` | `tauri::Builder::default().run(tauri::generate_context!())` の最小実装 |
| `src-tauri/capabilities/default.json` | メインウィンドウへの権限セット (Sprint 1 は最小、core 権限のみ) |
| `src-tauri/icons/` | アプリアイコン。`public/` 既存アイコンを起点に `tauri icon` で各 OS 形式を生成 |
| `src-tauri/.gitignore` | `/target`、`/gen` |

### Task 1.2: `package.json` 依存 + scripts (Slice 1-B)

- `devDependencies`: `@tauri-apps/cli` ^2
- `dependencies`: `@tauri-apps/api` ^2
- `scripts`:
  - `"tauri": "tauri"`
  - `"tauri:dev": "tauri dev"`
  - `"tauri:build": "tauri build"`

> 既存の Web 向け `dev` / `build` / `deploy:*` scripts は Sprint 4 まで残置。Track E
> 完了時に Web 配布系 (`deploy:vercel` / `deploy:netlify` / `netlify.toml` / `vercel.json`) の
> 整理を別途検討する (一本化方針との整合)。

### Task 1.3: `vite.config.ts` の Tauri 対応 (Slice 1-B)

- `clearScreen: false` — Tauri CLI のログを潰さない
- `server.strictPort: true` / `server.port: 5173` — Tauri が固定ポートを前提とするため
- `server.open` の `'chrome'` を削除 — Tauri webview で開くのでブラウザ自動起動は不要
- `envPrefix: ['VITE_', 'TAURI_ENV_*']` — Tauri 環境変数をフロントに公開
- `build.target` — Tauri 推奨に合わせ Windows は `chrome105` 相当 / 他は `safari13`、`minify` は debug 時 false 検討
- 既存 `server.proxy['/api']` は dev 時のみ有効。本番 (webview) では Sprint 2 で sidecar の実ポートへ向ける

### Task 1.4: `.gitignore` (Slice 1-B)

- `src-tauri/target/`
- `src-tauri/gen/`

### Task 1.5: 検証 (各 Slice)

- `cargo check` (`src-tauri/` 内) — Rust 側のコンパイル確認。**Linux では `webkit2gtk-4.1` / `libsoup-3` 等の system パッケージが必要** (§4)
- `npm run lint` / `npx tsc -b --noEmit` / `npm run build` / `npm run test` が **不変** (Tauri 追加でフロントのビルド・テストが壊れないこと)
- `npm run tauri dev` で既存 UI が Tauri ウィンドウに表示される (system webview が入った環境で手動確認)

---

## 4. ブロッカー / リスク

| リスク | 対策 |
|---|---|
| Tauri ビルドは OS の webview に依存 (Linux=`webkit2gtk-4.1`+`libsoup-3`、Windows=`WebView2`、macOS=`WKWebView`)。CI runner / 開発コンテナに system 依存の導入が必要 | CI workflow に各 OS の system パッケージ導入ステップを明記。`ubuntu-latest` は `libwebkit2gtk-4.1-dev` 等を `apt` で導入 |
| **PyOxidizer は torch 等の native 拡張を含むと破綻しやすい**。HANDOFF は PyOxidizer を挙げるが現実的でない可能性 | ML 重依存を **同梱しない** 前提を最初から採用。バイナリ化は PyInstaller `--onefile` を第一候補とし、Sprint 2 で PoC 比較して確定 |
| backend sidecar の単一バイナリは ML 抜きでも Python stdlib + FastAPI + uvicorn + sqlite で数十 MB。「本体 ~50MB」に収まるか不明 | Sprint 2 で実測。超過時は UPX 圧縮 / 不要モジュール除外 / `--exclude-module` で削減 |
| **private repo (`mushitaro/hoshutaro-mu`) の Release asset を Tauri updater が取得できない** (updater は匿名 GET を想定) | Sprint 3 の論点。候補: (a) 更新配信専用の public mirror リポジトリ、(b) S3 + 署名付き URL、(c) 自前の軽量 update エンドポイント。いずれも `latest.json` のホスティング先を別途用意 |
| コード署名証明書はユーザー調達が必須 (Windows OV/EV 証明書、Apple Developer Program 登録) | **ブロッカー**。未調達でも署名なしビルドで Sprint 1-3 の開発は進行可。Sprint 4 で証明書が揃い次第 CI に組み込み |
| macOS notarization には Apple ID / app-specific password / Team ID が必要 | CI secret に登録。証明書同様 Sprint 4 のブロッカー |
| 既存 `vite.config.ts` の `server.open: 'chrome'` / `proxy` が Tauri と競合 | Task 1.3 で `open` 除去。`proxy` は dev 専用なので維持、本番ポートは Sprint 2 で解決 |
| `aws-amplify` の Cognito token が webview の `localStorage` で永続化されるか未確認 | Sprint 1 完了時に Tauri webview 上でログイン → 再起動 → セッション保持を実機確認。保持されない場合は Tauri Store plugin への切替を検討 |
| Track E 着手時点で実 AWS deploy 検証 (Track D 残) が未完。webview 上の認証フローは未デプロイ状態では確認不可 | Tauri 化と AWS deploy 検証は独立。webview の枠組み確認は mock / ローカルで進め、認証実機確認は AWS deploy 後に合流 |

---

## 5. ドキュメント成果物

| ファイル | 役割 | 作成タイミング |
|---|---|---|
| `docs/11_TRACK_E_TAURI_PLAN.md` | 本ドキュメント、Sprint 計画 + 詳細タスク | ✅ Sprint 0 (2026-05-16) |
| HANDOFF.md §2 §5 | Track E 進捗 (Sprint 単位で更新) | Sprint ごと |
| `docs/12_RELEASE_GUIDE.md` (仮) | 署名・notarization・リリース手順 | Sprint 4 で作成 |

---

## 6. 前提ツール / 環境変数

### 開発に必要なツールチェーン

```
Rust (cargo / rustc)          # Tauri のビルド
Node.js + npm                  # フロント + Tauri CLI
# OS ごとの webview system 依存:
#   Linux  : libwebkit2gtk-4.1-dev, libsoup-3.0-dev, libappindicator3-dev 等
#   Windows: WebView2 Runtime (Win11 は標準同梱)
#   macOS  : Xcode Command Line Tools
PyInstaller                    # Sprint 2: backend バイナリ化
```

### CI / 署名で必要になる secret (Sprint 3-4)

```
TAURI_SIGNING_PRIVATE_KEY            # minisign 秘密鍵 (updater 署名)
TAURI_SIGNING_PRIVATE_KEY_PASSWORD   # 同パスワード
WINDOWS_CERTIFICATE / _PASSWORD      # Authenticode 署名
APPLE_CERTIFICATE / _PASSWORD        # Developer ID Application
APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID  # notarization
```

---

## 7. 検証 (Sprint 1 完了時)

```bash
# Rust 側コンパイル (src-tauri 内、要 system webview 依存)
cd src-tauri && cargo check

# フロントのビルド・テストが Tauri 追加で壊れないこと
npm run lint           # clean を維持
npx tsc -b --noEmit    # clean を維持
npm run build          # clean を維持
npm run test           # 既存件数を維持

# Tauri ウィンドウ起動 (system webview が入った環境で手動)
npm run tauri dev      # → 既存 React UI が Tauri ウィンドウに表示される
```

**Sprint 1 完了の判定**: `cargo check` 成功 + フロントの lint/tsc/build/test が不変 +
`npm run tauri dev` で既存 UI がネイティブウィンドウに描画されること。

---

## 8. 修正対象ファイル (Sprint 1)

| ファイル | 操作 |
|---|---|
| `src-tauri/Cargo.toml` / `build.rs` / `tauri.conf.json` | 新規 |
| `src-tauri/src/main.rs` / `src/lib.rs` | 新規 |
| `src-tauri/capabilities/default.json` | 新規 |
| `src-tauri/icons/*` | 新規 |
| `src-tauri/.gitignore` | 新規 |
| `package.json` | `@tauri-apps/cli` / `@tauri-apps/api` 依存 + `tauri` scripts 追加 |
| `vite.config.ts` | Tauri 対応 (`clearScreen` / `strictPort` / `envPrefix` / `open` 除去) |
| `.gitignore` | `src-tauri/target/` 等を追加 |

---

## 9. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 正式仕様 (§2「配布方式」が Tauri 本体サイズの根拠)
- [docs/8_TRACK_D_SPRINT_PLAN.md](8_TRACK_D_SPRINT_PLAN.md) — Track D の Sprint 計画 (本ドキュメントの構成元)
- [docs/10_UI_DESIGN_SYSTEM.md](10_UI_DESIGN_SYSTEM.md) — UI デザイン設計書 (Tauri 専用 UI 追加時の SoT)
- `launcher/main.py` / `build/build_all.py` / `build/hoshutaro_setup.iss` — Track E で置換対象のレガシー配布資産
