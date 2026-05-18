# 11. Track E — Tauri デスクトップ化 + ディレクトリ整理 + 配布 Sprint 計画

このドキュメントは Track E (~3-4 週間規模) の **Sprint 計画と詳細タスク分解** を保持します。

実装着手の前に必ずこのドキュメント + [HANDOFF.md](../HANDOFF.md) §1 +
[docs/PROJECT_MU.md](PROJECT_MU.md) + [docs/CONCEPTS.md](CONCEPTS.md)「動作モード」を
読み込んでください。

> **Track E のコンセプト (確定)**
>
> **「1 つの Tauri デスクトップアプリを 1 リポジトリからビルド・配布し、署名付きの
> 更新をワンクリックで届けられる」**
>
> そのために本 Track E では:
> 1. **ディレクトリ整理** — レガシー配布系と不要 Lambda を除去し、`backend/` を
>    `core/` にリネーム、`src-tauri/` を追加して**標準 Tauri 構成**へ整える。
> 2. **Tauri デスクトップ化** — `core` (Python エンジン) を Tauri の sidecar として
>    spawn/監視し、1 つのデスクトップアプリとして動かす。
> 3. **配布と自動更新** — 署名付きインストーラと Tauri Updater による更新を、
>    1 つの一貫したリリース CI で実現する。
>
> 最重要要件は **「メンテナンス性」** — シンプル・分かりやすい・一貫性がある構成。
> 早すぎる細分化 (モノレポ化・過剰な package 分割) は避ける。

> **⚠️ 旧版からの方針変更**
> 旧 docs/11 は Track E を「モノレポ化 (`apps/` + `packages/` + npm workspaces) +
> Web の AWS ホスティング再導入 + `core` の AWS コンテナ化」として計画していた。
> これは確定方針「**UI は常に 1 つの Tauri アプリ**」「**`core` は常に端末ローカル**」
> と矛盾するため**全面撤回**。Web を AWS でホストしないので UI を Web/デスクトップで
> 共有する必要がなく、モノレポ分割は不要。本版は**標準 Tauri 構成**を採る。

---

## 0. 背景と整理のゴール

### 2 モードアーキテクチャ (SoT = HANDOFF.md §1)

HOSHUTARO = **1 つの Tauri アプリ** + **ローカル `core` エンジン (常に sidecar)** +
**AWS バックエンド (`amplify/`、クラウドモードでのみ使用)**。ローカルモード /
クラウドモードの定義は [HANDOFF.md](../HANDOFF.md) §1 と
[docs/CONCEPTS.md](CONCEPTS.md)「動作モード」を正とする。Track E はこの構成を
変えず、その「**配布形態**」を整える Track である。

### 現状の構成 (整理対象)

```
hoshutaro-mu/
├── src/                 # React/Vite フロント
├── backend/             # FastAPI Python エンジン (Project Mu Engine)
├── amplify/             # AWS Amplify Gen2 (Cognito / Lambda / DynamoDB)
├── launcher/            # pystray 常駐ランチャ (レガシー)
├── build/               # PyInstaller ビルドパイプライン (レガシー)
├── tools/ scripts/ docs/
└── package.json         # 単一ルート
```

問題点:
- `launcher/` + `build/build_all.py` + `build/hoshutaro_setup.iss` は Tauri と重複する
  旧配布系。Tauri が常駐・トレイ・更新・インストーラを担うため不要。
- `backend/` という名前は `amplify/` (AWS バックエンド) と「どちらが backend か」の
  混乱を生む。Python エンジンの役割は `core` (中核エンジン)。
- `amplify/functions/maximo-proxy/` は Maximo 接続を Lambda 経由にする mock 実装だが、
  確定方針は「**`core` が Maximo REST に直接接続**」(D-10)。この Lambda は不要。
- `src-tauri/` が無く、デスクトップアプリとして起動できない。

### ゴール (Track E 完了時)

- **標準 Tauri 構成** — `src/` (フロント) + `src-tauri/` (Rust シェル) + `core/`
  (Python エンジン) + `amplify/` (AWS バックエンド)。ワークスペース機構なし。
- `npm run tauri:build` で **署名済みデスクトップインストーラ** (Win/macOS/Linux)
  が 1 リポジトリから生成される。
- **ワンクリック更新** — アプリ内ボタンで署名付き更新を取得・適用。配信側は Git タグ
  push 1 アクションで全 OS のビルド・署名・公開が走る。
- `npm run dev` / `npx ampx sandbox` / Jest (294) / pytest は再編後も従来どおり動作。
- レガシー配布系 (`launcher/` / `build/`) と不要 Lambda (`maximo-proxy`) は完全除去。

---

## 1. 設計判断 (確定)

| # | 項目 | 採用 | 理由 |
|---|---|---|---|
| D-1 | リポジトリ構成 | **標準 Tauri 構成** (`src/` + `src-tauri/` + `core/` + `amplify/`、ワークスペース機構なし) | UI は常に 1 つの Tauri アプリ。Web/デスクトップで UI を共有する必要がないため `apps/` + `packages/` のモノレポ分割は不要。早すぎる細分化を避け「シンプル・一貫性」要件を満たす |
| D-2 | パッケージマネージャ | **単一 npm** (workspaces を使わない) | 現リポジトリは単一 `package.json` + `package-lock.json`。`src/` を分割しないため workspaces 不要 |
| D-3 | UI (`src/`) の配置 | 現 `src/` を**そのまま維持** (移動しない) | Tauri は `src/` をフロントエンドとして直接使える。移動は数百ファイルの import 改変リスクのみで利得がない |
| D-4 | デスクトップフレームワーク | **Tauri 2.x** | Electron 比で本体軽量 (~50MB 目標)、OS ネイティブ webview、Rust |
| D-5 | Web ターゲット | **廃止** (Web の AWS ホスティングは行わない) | UI は常に Tauri デスクトップ。HANDOFF「Web 版は廃止予定」を確定。旧 docs/11 の「Web 再導入」案は撤回 |
| D-6 | Python エンジンの配置 | `backend/` → **`core/`** にリネーム (内部 package `app` は維持) | 「backend が 2 つ」(Python と `amplify`) の混乱を解消。内部構造を保ち Python import 改変を最小化 |
| D-7 | Python エンジンの実行形態 | **常に sidecar** (Tauri が spawn/監視)。AWS では動かさない | `core` は SQLite + ローカル LLM 推論を行う**端末ローカル専用**コンポーネント。旧 docs/11 の「`core` を AWS コンテナ化」案は撤回 |
| D-8 | クラウドインフラ (`amplify/`) | **`amplify/` を repo root に据え置き** (改名・移動しない) | フォルダ名 `amplify/` は AWS Amplify Gen2 が固定で要求する規約 (`ampx` CLI が `./amplify/backend.ts` を参照)。本プロジェクトは Amplify Gen2 を**バックエンド定義のみ**に使う (Cognito + Lambda + DynamoDB、Amplify Hosting は使わない) |
| D-9 | クラウド LLM | **AWS Bedrock 専用** (Claude 主軸) を `llm-proxy` Lambda 経由 | IAM 認証で LLM API キーを保存しない・請求を AWS に一本化・Batch Inference / プロンプトキャッシュが利用可能。Bedrock は Gemini 非提供、OpenAI も gpt-oss のみのため外部 API 直叩きは採用しない |
| D-10 | Maximo 連携 | **`core` が Maximo REST API に直接接続** (両モード共通、ページング取得) | Maximo は社内ネットワーク前提。`core` からの直接続が最短経路。`amplify/functions/maximo-proxy` (mock Lambda) は不要となり Sprint 1 で削除。Maximo 認証情報は端末ローカルに暗号化保存 |
| D-11 | backend ↔ frontend 通信 | 既存の **localhost HTTP (FastAPI)** を維持。ベース URL は Tauri シェルが注入 | `muApi.ts` / `pluginApi.ts` / `cloudSync` を無改修で使える。Tauri はランダム空きポートを `core` に割り当て、webview へ注入 |
| D-12 | 自動更新 | デスクトップ = **Tauri Updater** (`@tauri-apps/plugin-updater` + minisign 署名)、配信側 = **Git タグ → リリース CI** | `launcher/main.py` の `apply_update()` を置換。配信は 1 アクション |
| D-13 | コード署名 | Win: Authenticode、macOS: Developer ID + notarization、Linux: 署名なし | OS の SmartScreen / Gatekeeper 要件。証明書はユーザー調達 (§5 ブロッカー) |
| D-14 | リリース CI | GitHub Actions の **OS matrix** + `tauri-apps/tauri-action` | 各 OS でビルド・署名 → Release 添付 → `latest.json` 生成まで自動 |
| D-15 | バンドル識別子 | `jp.hoshutaro.desktop` (**確定要** — ユーザー確認) | macOS bundle identifier / Windows AppUserModelID 用 |

---

## 2. 整理後のディレクトリ構成 (標準 Tauri 構成)

```
hoshutaro-mu/
├── src/                  # React フロントエンド (現状のまま、移動しない)
├── src-tauri/            # Tauri Rust シェル (新規) — sidecar 管理 / 自動更新 / トレイ
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/main.rs       #   core を sidecar として spawn / /health 監視 / graceful kill
│   ├── capabilities/
│   └── icons/
├── core/                 # Python エンジン (旧 backend/ をリネーム) = Tauri sidecar
│   ├── app/              #   mu/ llm/ services/ routers/ main.py (内部構造は不変)
│   ├── plugins/ skills/ tests/
│   ├── requirements.txt        # コア依存 (FastAPI/uvicorn/sqlite 系、軽量)
│   └── requirements-ml.txt     # ML 重依存 (torch/openvino/transformers) — 同梱せず初回 DL
├── amplify/              # AWS Amplify Gen2 (据え置き、ampx 互換維持)
│   └── auth/ data/ functions/ backend.ts
├── tools/ scripts/ docs/
├── package.json          # 単一 (ワークスペース機構なし)、tauri スクリプト追加
└── vite.config.ts / tsconfig*.json / eslint.config.js / jest.config.js (現状のまま)
```

### 現状からの差分 (これだけ)

| 現在 | 整理後 | 備考 |
|---|---|---|
| (なし) | `src-tauri/` を新規追加 | `tauri init` 相当。Rust シェル |
| `backend/` | `core/` | ディレクトリ名のみ変更、内部 package `app` 維持 → Python import 不変 |
| `backend/requirements.txt` | `core/requirements.txt` + `core/requirements-ml.txt` | ML 重依存を分離 (sidecar バイナリに同梱せず初回 DL) |
| `src/` | `src/` (不変) | Tauri がそのままフロントとして使う |
| `amplify/` (`maximo-proxy` 含む) | `amplify/` (`maximo-proxy` を削除) | D-8 のとおり `amplify/` 自体は据え置き。`maximo-proxy` Lambda のみ除去 |
| `launcher/` | **削除** | Tauri が常駐/トレイ/更新を担う |
| `build/build_all.py` `build/hoshutaro_setup.iss` | **削除** | Tauri bundler + リリース CI が置換 |
| `package.json` (単一) | `package.json` (単一、`tauri` 系スクリプト追加) | workspaces 化はしない |
| `tools/` `docs/` `scripts/` | 不変 | |

> **`apps/` / `packages/` / npm workspaces は作らない。** UI を Web/デスクトップで
> 共有する要件が無いため (D-5)。

> **Jest 294 件 / Python スモーク 21 件は整理の各スライスで常に green を維持する**
> ことを絶対条件とする (§4 / §6)。

---

## 3. ~3-4 週間ロードマップ

### Sprint 0: 設計フェーズ ✅ 完了 (2026-05-16、2026-05-18 全面改訂)
- [x] 本ドキュメント作成
- [x] モノレポ化を Track E に統合、独立 Track C を廃止する方針を確定
- [x] **(改訂)** モノレポ化 / Web AWS ホスティング / `core` コンテナ化案を撤回し、
  標準 Tauri 構成へ計画を全面改訂

### Sprint 1: ディレクトリ整理 (Week 1) ✅ 完了 (2026-05-18)
**目的**: レガシー配布系・不要 Lambda を除去し、`backend/`→`core/` リネーム +
`src-tauri/` scaffold で標準 Tauri 構成へ整える。**`npm run dev` /
`npx ampx sandbox` / Jest / pytest を一切壊さずに**完了する。

Slice 1-A〜1-F 完了。検証結果: `npm run lint` / `npm run build` exit 0、
Jest 24 suites **285 件** pass (maximo-proxy テスト 9 件除去で 294→285)、
core スモークテスト全 pass。詳細は §4。

### Sprint 2: Tauri シェル + core sidecar 化 (Week 2) 🟡 一部完了 (2026-05-18)
**目的**: デスクトップアプリが起動する状態にする。

**✅ 実装済 (cargo build exit 0 で検証)**:
- `src-tauri/src/sidecar.rs` — ポート確保 (既定 8000・衝突時は空きポート探索) /
  uvicorn 経由の `core` 起動 / `/api/health` HTTP ポーリング / graceful kill
- `src-tauri/src/lib.rs` — `setup` フックで別スレッド起動 → health 後に
  `window.show()`、`ExitRequested` で `core` 停止。`core_base_url` コマンドを公開
- `tauri.conf.json` — メインウィンドウを `visible:false` に (ready 後に表示)
- `launcher/main.py` の役割 (バックエンド起動) は上記 sidecar 管理で代替。
  MCP server 管理は `core` 内の `mcp_hub` が担うため Rust 側移植は不要

**⏭ 残作業 (本環境では検証不可 — ローカル/CI 環境で実施)**:
- `core` の単一バイナリ化 (PyInstaller `--onefile`)。ML 重依存は非同梱・初回 DL。
  現状は dev と同じく Python インタプリタ経由で `core` を起動している
- `tauri dev` / `tauri build` による実ウィンドウ起動・sidecar 連携の実機確認
- webview への API ベース URL 注入をフロントエンド側で消費する結線 (`core_base_url`)

### Sprint 3: 自動更新 + モード切替 UX (Week 3) 🟡 一部完了 (2026-05-18)
**目的**: 更新がワンクリックになり、ローカル/クラウドモードの切替が UX 上明確になる。

**✅ 実装済 (cargo build / npm lint・test・build で検証)**:
- システムトレイ — 「ウィンドウを表示」/「終了」メニュー (`tauri` の `tray-icon`)
- `tauri-plugin-single-instance` — 二重起動時は既存ウィンドウにフォーカス
- `tauri-plugin-window-state` — ウィンドウ位置・サイズの保存/復元
- `tauri-plugin-updater` — プラグイン登録 + `tauri.conf.json` の updater 設定
  (`endpoints` / `pubkey` / `createUpdaterArtifacts`)
- **モード切替 UX** — AgentBar ツールメニューに現在のモード（ローカル/クラウド）を
  表示。`useAuth()` の認証状態に追従

**⏭ 残作業 (リリース基盤に依存 → Sprint 4 と併せて実施)**:
- updater の本番署名鍵ペア生成（秘密鍵は CI シークレット管理、リポジトリ非格納）と
  実リリースエンドポイント（private repo のリリース資産取得方式の確定）
- アプリ内「更新を確認」UI を `tauri-plugin-updater` に結線（現状 `UpdateNotification`
  は `core` 経由の更新確認のまま）
- `tauri dev` / `tauri build` による実機ウィンドウ・トレイ動作の確認
- `amplify/` バックエンドの本番配備手順 (`ampx pipeline-deploy`) の整備

### Sprint 4: コード署名 + リリース CI + 仕上げ (Week 4)
**目的**: 署名済み配布物を CI で自動生成する。

- GitHub Actions OS matrix workflow (`tauri-action`) を整備
- Windows Authenticode 署名 / macOS Developer ID 署名 + notarization / Linux AppImage・deb
- `latest.json` 生成 → GitHub Release 添付 (Tauri Updater 配信元)
- `docs/12_RELEASE_GUIDE.md` (仮) にリリース・署名手順を記載
- 本ドキュメント + HANDOFF を Track E 完了状態に更新

---

## 4. Sprint 1 詳細タスク分解

**✅ Slice 1-A〜1-F 完了 (2026-05-18)**。各スライスを個別コミットで実施 (PR #94)。
各スライスで `npm run lint` / `npm run build` / `npm run test` / core スモークテストが
green であることを確認済み (最終: lint・build exit 0、Jest 24 suites 285 件 pass)。

| Slice | 内容 | 結果 |
|---|---|---|
| 1-A | `backend/` → `core/` リネーム。`git mv` で履歴保持。内部 package `app` を維持し Python import を不変に保つ。`core/tests/` の参照、`package.json` の `dev` スクリプト等の `backend` パス参照、CI workflow のパスを更新 | `python core/tests/test_mu_smoke.py` 21 green。`uvicorn` 起動確認。`npm run dev` で :8000 起動 |
| 1-B | `core/requirements.txt` を **コア依存** (FastAPI/uvicorn/sqlite 系) と **`core/requirements-ml.txt`** (torch/openvino/transformers/peft 系) に分割 | コア依存のみで FastAPI 起動可。ML 依存込みで従来どおり推論可 |
| 1-C | レガシー配布系の除去 — `launcher/`、`build/build_all.py`、`build/hoshutaro_setup.iss` を削除。残す `build/` 配下があれば精査 | `npm run dev` / `npm run build` に影響なし |
| 1-D | 不要 Lambda の除去 — `amplify/functions/maximo-proxy/` を削除し、`amplify/backend.ts` から `maximoProxy` の import・`defineBackend` 登録・Function URL / IAM ブロックを除去。`maximo-proxy/__tests__` も削除 | `amplify/tsconfig.json` で `tsc --noEmit` + eslint exit 0。Jest green (maximo-proxy テスト 9 件除去で 294→285) |
| 1-E | `src-tauri/` scaffold (`tauri init` 相当) — `Cargo.toml` / `tauri.conf.json` / `src/main.rs` (最小) / `capabilities/` / `icons/`。root `package.json` に `tauri:dev` / `tauri:build` スクリプト追加。`@tauri-apps/cli` を devDependency に追加 | `npm run dev` (Vite :5173 + uvicorn :8000) は不変。`npm run tauri:dev` で空ウィンドウ起動 (Sprint 2 で sidecar 結線) |
| 1-F | 本ドキュメント + HANDOFF を Sprint 1 完了状態に更新 | — |

> **リネームの安全性**: `core/app/` の内部 import は相対 import 中心のため、ディレクトリ
> 名変更で壊れない。`backend` という文字列を絶対参照しているのは npm スクリプトと CI
> workflow のパスのみ → これらを 1-A でまとめて更新する。

---

## 5. ブロッカー / リスク

| 区分 | 項目 | 対策 / 方針 |
|---|---|---|
| リスク | `backend/`→`core/` リネームで Python import / npm スクリプトのパスが崩れる | `git mv` でディレクトリ単位移動し履歴保持。内部 `app` package 維持で相対 import 不変。`backend` を絶対参照する npm スクリプト / CI workflow を 1-A で更新。Slice 完了時に pytest 21 + Jest 294 green を確認 |
| リスク | `maximo-proxy` Lambda 削除で `amplify/backend.ts` の synth が壊れる | import・`defineBackend` 登録・Function URL / IAM ポリシーブロックを併せて除去。`npx ampx sandbox` の synth が通ることを 1-D で確認 |
| リスク | Tauri ビルドは OS webview 依存 (Linux=`webkit2gtk-4.1`+`libsoup-3`、Win=WebView2、macOS=WKWebView) | CI workflow に各 OS の system 依存導入ステップを明記 |
| リスク | `core` 単一バイナリに ML 重依存を含めると巨大化・PyInstaller 破綻 | `requirements-ml.txt` を分離し **ML 依存は同梱しない**。初回起動時 DL (既存 `core/app/mu/setup/downloader.py` を拡張)。バイナリ化は PyInstaller 第一候補 |
| ブロッカー | コード署名証明書 (Windows OV/EV、Apple Developer Program) はユーザー調達必須 | 未調達でも署名なしビルドで Sprint 1-3 は進行可。Sprint 4 で証明書が揃い次第 CI に組込み |
| ブロッカー | private repo の Release asset を Tauri updater が匿名取得できない | 更新配信専用の public mirror / S3 + 署名付き URL / 軽量 update エンドポイントのいずれか。Sprint 3 で決定 |
| 注意 | 既存 UI の一部に dark UI 前提のハードコード色が残る (docs/9 V-2) | デスクトップ webview 表示時に手動視覚検証を実施 (docs/10 が SoT) |

---

## 6. 開発体験 (DX) の保全

Track B-Verify (Gemma 4 実機テスト) と Track D (AWS deploy テスト) は `npm run dev` /
`npx ampx sandbox` で行う想定。整理がこの開発フローを壊さないことを **Sprint 1 の
検収条件**に含める。

| コマンド | 整理後の挙動 |
|---|---|
| `npm run dev` | `src/` (Vite :5173) + `core` (uvicorn :8000) を並行起動。**従来と同一の体験** |
| `npm run lint` / `npm run test` / `npm run build` | 従来どおり (単一 `package.json`) |
| `npx ampx sandbox` | `amplify/` 据え置きのため従来どおり動作 (`maximo-proxy` 除去後も synth 可) |
| `python core/tests/test_mu_smoke.py` | `backend/` → `core/` リネーム後のパスで実行 |
| `npm run tauri:dev` (Sprint 2 以降) | Tauri ウィンドウ起動 + `core` sidecar |
| Gemma 4 実機推論 / LoRA SFT | `core/` の Python エンジンで従来どおり。`requirements-ml.txt` を入れた環境で実行 |

---

## 7. ワンクリック配布・更新の仕組み

### 配信側 (メンテナ) — Git タグ 1 アクション

```
git tag v1.x.x && git push --tags
  └→ リリース CI (GitHub Actions OS matrix)
       ├─ Win/macOS/Linux デスクトップビルド + 署名 + notarization
       └─ minisign 署名 + latest.json 生成 → GitHub Release 添付
```

> クラウドモード用の `amplify/` バックエンドは `ampx pipeline-deploy` で別途配備する
> (デスクトップ配布とは独立した系統)。

### 受信側 (デスクトップ利用者) — アプリ内ワンクリック

- Tauri Updater が `latest.json` を確認 → 新版があれば `UpdateNotification` UI に通知
- 利用者が「更新」を 1 クリック → 署名検証済みパッケージを取得・適用・再起動

### インストール

- 単一インストーラ (`.msi`/`.exe`/`.dmg`/`.AppImage`) をダブルクリックするだけ。
- 初回起動時に LLM モデル (~1.8GB) をダウンロード (本体 ~50MB)。

---

## 8. ドキュメント成果物

| ファイル | 役割 | 作成タイミング |
|---|---|---|
| `docs/11_TRACK_E_SPRINT_PLAN.md` | 本ドキュメント、Sprint 計画 + 詳細タスク | ✅ Sprint 0 |
| HANDOFF.md §1 §5 | 設計判断 + ロードマップ (Sprint 単位で更新) | Sprint ごと |
| `docs/12_RELEASE_GUIDE.md` (仮) | 署名・notarization・リリース手順 | Sprint 4 で作成 |

---

## 9. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ。§1 が 2 モードアーキテクチャの SoT
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 正式仕様 (`core/app/mu/` 構成 / Tauri 本体サイズの根拠)
- [docs/CONCEPTS.md](CONCEPTS.md) — 用語定義 (Plugin / Skill / MCP / Adapter) +「動作モード」
- [docs/8_TRACK_D_SPRINT_PLAN.md](8_TRACK_D_SPRINT_PLAN.md) — Track D の Sprint 計画
- [docs/10_UI_DESIGN_SYSTEM.md](10_UI_DESIGN_SYSTEM.md) — UI デザイン設計書 (デスクトップ UI 追加時の SoT)
- `launcher/main.py` / `build/build_all.py` / `build/hoshutaro_setup.iss` — Sprint 1 で削除するレガシー配布資産
- `amplify/functions/maximo-proxy/` — Sprint 1 で削除する不要 Lambda (Maximo は `core` 直接接続)
