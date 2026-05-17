# 11. Track E — モノレポ化 + マルチターゲット配布 Sprint 計画

このドキュメントは Track E (~3-4 週間規模) の **Sprint 計画と詳細タスク分解** を保持します。

実装着手の前に必ずこのドキュメント + [HANDOFF.md](../HANDOFF.md) +
[docs/PROJECT_MU.md](PROJECT_MU.md) §2「配布方式」 + [docs/CONCEPTS.md](CONCEPTS.md) を
読み込んでください。

> **Track E のコンセプト (確定)**
>
> **「アプリ本体を 1 つのリポジトリ (= ワンパッケージ) から、AWS とデスクトップの
> どちらにも柔軟にビルド・配布でき、更新もワンクリックで届けられる」**
>
> そのために本 Track E では 2 つを同時に行う:
> 1. **モノレポ化** — フラットな `src/` + `backend/` 構成を `apps/` + `packages/` +
>    `core/` のワークスペース構成へ再編し、UI コードを Web / デスクトップ両ターゲットで
>    共有する。
> 2. **マルチターゲット配布** — Tauri デスクトップ配布 + AWS ホスティング配布 +
>    署名付き自動更新を、1 つの一貫したビルド/リリースシステムで実現する。
>
> 最重要要件は **「メンテナンス性」** — シンプル・分かりやすい・一貫性がある構成に
> すること。早すぎる細分化 (過剰な package 分割) は避ける。

---

## 0. 背景と移行のゴール

### なぜ今モノレポ化するのか

HANDOFF.md は当初、モノレポ化を独立した「Track C」として **「Track D/E が走り始めて
2 つ目以降の app/lambda/desktop が出てから」** 実施するのが合理的、としていた
(早すぎる package 境界は手戻りを生むため)。

- Track A/B/D のコード実装は完了済み。
- Track E でデスクトップアプリ (`apps/desktop`) という **2 つ目のターゲット** が出現する。
- → 「desktop が出てから再編」の条件がまさに満たされる。

したがって **モノレポ化は Track E に統合** し、独立 Track C は廃止する。Track E が
再編のトリガを作り、その再編の上にデスクトップ配布を載せる、という順序が最も手戻りが少ない。

### 現状の構成 (再編対象)

```
hoshutaro-mu/
├── src/                 # React/Vite フロント (フラット、Web 専用前提)
├── backend/             # FastAPI Python エンジン (Project Mu Engine)
├── amplify/             # AWS Amplify Gen2 (Cognito / Lambda / DynamoDB)
├── launcher/            # pystray 常駐ランチャ (レガシー)
├── build/               # PyInstaller ビルドパイプライン (レガシー)
├── tools/ scripts/ docs/
└── package.json         # 単一ルート
```

問題点:
- `src/` は Web 配布専用に設計され、デスクトップ向けの分岐先が無い。
- フロント/バックエンド/クラウドが同列に並び、「どれがアプリ本体で、どれがターゲット
  固有か」の責務境界が不明瞭。
- `launcher/` + `build/build_all.py` + `hoshutaro_setup.iss` は Tauri と重複する旧配布系。

### ゴール (Track E 完了時)

- **1 リポジトリ = ワンパッケージ**。`apps/` (ターゲットシェル) と `packages/`
  (共有アプリ) に責務分離され、UI コードは Web / デスクトップで 1 箇所に集約。
- `npm run build:desktop` で **署名済みデスクトップインストーラ** (Win/macOS/Linux)、
  `npm run deploy:cloud` で **AWS への Web + クラウドバックエンド配備** —
  どちらも同じ一貫したツールチェーンから。
- **ワンクリック更新**: デスクトップはアプリ内ボタンで署名付き更新を取得・適用。
  配信側は Git タグ push 1 アクションで全ターゲットのビルド・署名・公開が走る。
- `npm run dev` は再編後も従来どおり動作 (Gemma 4 実機テスト / プラグイン AWS デプロイ
  テストの開発フローを保全)。
- レガシー配布系 (`launcher/` / `build/`) は完全に除去。

---

## 1. 設計判断 (確定)

| # | 項目 | 採用 | 理由 |
|---|---|---|---|
| D-1 | リポジトリ構成 | **`apps/` + `packages/` + `core/` のワークスペース構成** (§2 参照) | UI を Web/デスクトップ両ターゲットで共有するには共有 package が必須。`apps/` = ターゲット固有の薄いシェル、`packages/` = 共有アプリ本体、と責務を明確化 |
| D-2 | パッケージマネージャ | **npm workspaces** (pnpm ではない) | 現リポジトリは既に npm + 単一 `package-lock.json` で運用中。`npm run dev` / CI の `npm ci` を変えずに済む。pnpm 移行はツール移行コスト + CI 改修を生み「シンプル・一貫性」要件に反する。npm 7+ workspaces で `apps/*` `packages/*` は十分管理可能。**HANDOFF の「pnpm workspace」表記から変更** |
| D-3 | 共有 package の粒度 | **共有アプリは単一 package `packages/app` に集約** | UI / services / hooks / types を 3 package に割るのは早すぎる細分化。「シンプル」要件を優先し 1 package とする。境界が必要になった時点 (将来) で分割 |
| D-4 | デスクトップフレームワーク | **Tauri 2.x** | Electron 比で本体軽量 (~50MB 目標)、OS ネイティブ webview、Rust。HANDOFF.md の確定方針 |
| D-5 | Web ターゲットの再導入 | HANDOFF 旧方針「Web 版は廃止予定」を更新し、**Web を AWS ホスティング形態として再導入** | 「AWS にもデスクトップにも」のコンセプトに必須。ただしデスクトップが主配布形態である点は不変。Web は「同一 UI を AWS でホストする」構造を可能にする位置づけ |
| D-6 | Python エンジンの配置 | `backend/` → **`core/`** にリネーム (内部 package `app` は維持) | PROJECT_MU.md の `core/mu/` 構想に沿う。内部構造を保つことで Python の import 改変を最小化 |
| D-7 | Python エンジンの実行形態 | デスクトップ = **sidecar** (Tauri が spawn/監視)、AWS = **コンテナ化して別途配備** (§5 の設計決定) | `core` は SQLite + ローカル LLM 推論を行うローカル主体コンポーネント。同一コードを 2 つの実行形態で動かす |
| D-8 | クラウドインフラ (`amplify/`) | **`amplify/` を repo root に据え置き** (移動しない) | Amplify Gen2 の `ampx` が repo root の `amplify/` を前提とするため。移動は `ampx sandbox` を壊すリスク。クラウドは「インフラ」でありターゲットシェルではない |
| D-9 | backend ↔ frontend 通信 | 既存の **localhost HTTP (FastAPI)** を維持。API ベース URL はアプリシェルが注入 | `muApi.ts` / `pluginApi.ts` / `cloudSync` 等を無改修で共有。Web は `/api` (or クラウド)、デスクトップは sidecar ポートを指す |
| D-10 | 自動更新 | デスクトップ = **Tauri Updater** (`@tauri-apps/plugin-updater` + minisign 署名)、配信側 = **Git タグ → リリース CI** | `launcher/main.py` の `apply_update()` を置換。配信は 1 アクション |
| D-11 | コード署名 | Win: Authenticode、macOS: Developer ID + notarization、Linux: 署名なし | OS の SmartScreen / Gatekeeper 要件。証明書はユーザー調達 (§5 ブロッカー) |
| D-12 | リリース CI | GitHub Actions の **OS matrix** + `tauri-apps/tauri-action` | 各 OS でビルド・署名 → Release 添付 → `latest.json` 生成まで自動 |
| D-13 | バンドル識別子 | `jp.hoshutaro.desktop` (**確定要** — ユーザー確認) | macOS bundle identifier / Windows AppUserModelID 用 |

---

## 2. 移行後のディレクトリ構成

```
hoshutaro-mu/
├── apps/                       # ターゲット固有の「薄いシェル」
│   ├── web/                    #   Web シェル → AWS ホスティングへ配備
│   │   ├── index.html
│   │   ├── src/main.tsx        #     packages/app の mountApp() を呼ぶだけ
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── desktop/                #   Tauri デスクトップシェル
│       ├── src-tauri/          #     Rust シェル (Cargo / tauri.conf.json / src)
│       ├── index.html
│       ├── src/main.tsx        #     API ベース = sidecar ポートを注入して mountApp()
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── app/                    # 共有アプリ本体 (UI / services / hooks / types / App)
│       ├── src/                #   現 src/ の中身がここへ移動
│       │   ├── components/ hooks/ providers/ services/ theme/ ...
│       │   ├── App.tsx
│       │   └── index.ts        #   mountApp() / 型 / サービスを re-export
│       └── package.json
├── core/                       # Python FastAPI エンジン (Project Mu) ← 旧 backend/
│   ├── app/                    #   mu/ llm/ services/ routers/ main.py (内部構造は不変)
│   ├── plugins/ skills/ tests/
│   ├── requirements.txt        #   コア依存 (FastAPI/uvicorn/sqlite 系、~軽量)
│   └── requirements-ml.txt     #   ML 重依存 (torch/openvino/transformers) — 同梱せず初回 DL
├── amplify/                    # AWS Amplify Gen2 (据え置き、ampx 互換維持)
│   └── auth/ data/ functions/ backend.ts
├── tools/                      # quantize-models / bench-mu (据え置き)
├── docs/
├── package.json                # ★ workspaces ルート + orchestration scripts
├── tsconfig.base.json          # 全 workspace 共通の TS 設定
├── eslint.config.js            # ルートで全 workspace を lint
└── jest.config.js              # ルートで全 workspace を test (or projects)
```

### 設計の意図

- **`apps/*` は薄い**: `index.html` + `main.tsx` (マウント) + ビルド設定 + ホスト固有
  glue (デスクトップは sidecar ポート注入、Tauri API) のみ。UI ロジックは持たない。
- **`packages/app` が唯一の UI 本体**: 現 `src/` の全コンポーネント・サービス・型・
  hooks・theme をそのまま集約。両 `apps/*` がこれを依存する。**UI の変更箇所は常に
  1 箇所** → メンテナンス性。
- **`core/` は実行形態に非依存**: 同じ FastAPI アプリが、デスクトップでは sidecar、
  AWS ではコンテナとして動く。コードは 1 つ。
- **`amplify/` はインフラ**: ターゲットではないので `apps/` に入れず root 据え置き。

### 現在 → 移行後 マッピング

| 現在 | 移行後 | 備考 |
|---|---|---|
| `src/` (App.tsx 含む全体) | `packages/app/src/` | 内部 import は相対中心 → 移動で壊れにくい |
| `src/main.tsx` | `apps/web/src/main.tsx` + `apps/desktop/src/main.tsx` | DOM マウント部はシェル側へ。`packages/app` は `mountApp(rootEl, config)` を export |
| `index.html` | `apps/web/index.html` + `apps/desktop/index.html` | エントリ HTML はシェル側 |
| `vite.config.ts` | `apps/web/` + `apps/desktop/` 各々 + 共通部を `vite.config.base.ts` へ | デスクトップ版は Tauri 対応 (clearScreen/strictPort 等) |
| `backend/` | `core/` | ディレクトリ名のみ変更、内部 package `app` 維持 → Python import 不変 |
| `backend/tests/` | `core/tests/` | スモークテスト 21 件 |
| `amplify/` | `amplify/` (不変) | `ampx` 互換維持 |
| `launcher/` | **削除** | Tauri が常駐/トレイ/更新を担う |
| `build/build_all.py` `build/hoshutaro_setup.iss` | **削除** | Tauri bundler + リリース CI が置換 |
| `tools/` `docs/` | 不変 | |
| `scripts/deploy-check*.js` | `scripts/` 据え置き、Web デプロイ前提を見直し | |
| `package.json` (単一) | root = workspaces マニフェスト + orchestration、各 workspace に個別 `package.json` | |
| `tsconfig*.json` / `jest.config.js` / `eslint.config.js` | root に base、各 workspace で継承 | |
| `vercel.json` `netlify.toml` | Web 配備先を AWS ホスティングに統一する方針で見直し (Sprint 3) | |

> **Jest 294 件 / Python 21 件は移行の各スライスで常に green を維持する** ことを
> 絶対条件とする (§4 / §6)。

---

## 3. ~3-4 週間ロードマップ

### Sprint 0: 設計フェーズ ✅ 完了 (2026-05-16)
- [x] 本ドキュメント作成 (モノレポ化 + マルチターゲット配布を統合した計画)
- [x] モノレポ化を Track E に統合、独立 Track C を廃止する方針を確定
- [x] HANDOFF.md に Track E 参照 + Sprint 0 完了を追記

### Sprint 1: モノレポ骨格への移行 (Week 1)
**目的**: フラット構成を `apps/` + `packages/` + `core/` ワークスペースへ再編する。
**Web ビルド・テスト・`npm run dev` を一切壊さずに** 移行を完了する。

この時点でデスクトップ (Tauri) はまだ無い。`apps/web` が従来の Web アプリとして
そのまま動き、`core` が従来の backend として動く。Track B-Verify / Track D の
`npm run dev` ベース検証はこの Sprint 後も継続して可能。

詳細は §4。

### Sprint 2: Tauri デスクトップシェル + core sidecar 化 (Week 2)
**目的**: `apps/desktop` を追加し、デスクトップアプリが起動する状態にする。

- `apps/desktop/src-tauri/` 作成 (Cargo / `tauri.conf.json` / Rust エントリ / capabilities / icons)
- `apps/desktop` の Vite シェルが `packages/app` を webview で表示
- `core` を単一バイナリ化 (PyInstaller `--onefile` 第一候補 / PyOxidizer 比較検証)。
  ML 重依存 (`requirements-ml.txt`) は **同梱せず初回起動時 DL** (本体 ~50MB 制約)
- `core` バイナリを Tauri `externalBin` (sidecar) 登録。Rust 側でアプリ起動 →
  sidecar spawn → `/health` ポーリング → ready 後にウィンドウ表示。終了時 graceful kill
- ポート: 既定固定 + 衝突時に空きポート探索 → `apps/desktop` の `main.tsx` が
  API ベース URL として `mountApp()` に注入
- `launcher/main.py` の必要ロジック (MCP server 管理等) を Rust に移植

### Sprint 3: マルチターゲット配布 + 自動更新 (Week 3)
**目的**: 「AWS にもデスクトップにも」配布でき、更新がワンクリックになる状態にする。

- **デスクトップ更新**: `tauri-plugin-updater` + minisign キーペア。アプリ内
  「更新を確認」UI (既存 `UpdateNotification` を結線) → ワンクリックで取得・適用
- **AWS 配備**: `apps/web` のビルドを AWS ホスティング (Amplify Hosting または
  S3 + CloudFront) へ配備する `npm run deploy:cloud`。`amplify/` のサーバレス
  バックエンドも同コマンド系で `ampx pipeline-deploy`
- **`core` の AWS 配備**: Web ターゲット用に `core` をコンテナ化し AWS へ配備
  (§5 の設計決定に従う)
- **配信パイプライン**: Git タグ push → リリース CI が全ターゲットをビルド
- システムトレイ / 単一インスタンス / ウィンドウ状態復元 (`tauri-plugin-*`)

### Sprint 4: コード署名 + 仕上げ + レガシー除去 (Week 4)
**目的**: 署名済み配布物を CI で自動生成し、旧配布系を撤去する。

- GitHub Actions OS matrix workflow (`tauri-action`) を整備
- Windows Authenticode 署名 / macOS Developer ID 署名 + notarization / Linux AppImage・deb
- `launcher/` `build/build_all.py` `build/hoshutaro_setup.iss` を **削除**
- `docs/12_RELEASE_GUIDE.md` (仮) にリリース・署名手順を記載
- 本ドキュメント + HANDOFF を Track E 完了状態に更新

---

## 4. Sprint 1 詳細タスク分解 (実装着手用)

実装は **1 Slice = 1 PR** で分割し squash-merge する (HANDOFF の作業ルール準拠)。
**各スライスで `npm run lint` / `tsc` / `npm run build` / `npm run test` (Jest 294) /
Python スモーク (21) が green** であることを必須条件とする。

| Slice | 内容 | 検証の要点 |
|---|---|---|
| 1-A | npm workspaces 骨格を作る。root `package.json` に `"workspaces": ["apps/*", "packages/*"]`。`apps/` `packages/` ディレクトリと空の workspace 雛形を作成。**まだファイル移動はしない** | `npm install` が通る。既存 build/test 不変 |
| 1-B | `src/` → `packages/app/src/` へ移動。`packages/app/package.json` 作成、`index.ts` で `mountApp()`・型・サービスを re-export。`tsconfig.base.json` 切り出し、`packages/app/tsconfig.json` で継承 | Jest 294 green (testMatch のパス更新)。`tsc` clean |
| 1-C | `apps/web/` シェル作成。`index.html` + `src/main.tsx` (= `mountApp()` 呼出) + `vite.config.ts` を移設。`apps/web` が `packages/app` を依存。Web ビルドが従来どおり生成される | `npm run build` が `apps/web/dist/` を生成。手動で表示確認 |
| 1-D | `backend/` → `core/` リネーム。`core/tests/` の参照更新。`requirements.txt` を コア / `requirements-ml.txt` に分割 | Python スモーク 21 green。`uvicorn` 起動確認 |
| 1-E | root orchestration scripts を workspace 対応に。`npm run dev` = `apps/web` (Vite) + `core` (uvicorn) を並行起動。`lint` / `test` / `build` を全 workspace 横断に。CI workflow (`deploy-preview.yml`) のパス更新 | `npm run dev` で従来どおり :5173 + :8000 が起動。CI green |
| 1-F | 本ドキュメント + HANDOFF を Sprint 1 完了状態に更新 | — |

### Slice 1-B の要点 — `packages/app` の公開境界

`packages/app/src/index.ts` が共有 package の唯一の公開境界:

```ts
// packages/app/src/index.ts
export { mountApp } from './mountApp'   // (rootEl, { apiBaseUrl, platform }) => void
export type { /* HierarchicalData 等の中核型 */ } from './types'
```

- `main.tsx` の `ReactDOM.createRoot(...).render(<App/>)` 相当を `mountApp()` に集約。
- `apps/web` は `apiBaseUrl: '/api'`、`apps/desktop` は `apiBaseUrl: 'http://localhost:<port>'`
  を渡す。これにより D-9 (API ベースをシェルが注入) を実現。
- 内部の相対 import は移動でそのまま生きる。`@/` エイリアス等を使っている場合は
  `tsconfig.base.json` + Vite alias で `packages/app/src` を指すよう一度だけ更新。

---

## 5. ブロッカー / リスク / 未解決の設計決定

| 区分 | 項目 | 対策 / 方針 |
|---|---|---|
| リスク | `src/` 移動 (数百ファイル) で import / alias / テストパスが崩れる | `git mv` でディレクトリ単位移動し履歴保持。相対 import は不変。`@/` 等の alias は `tsconfig.base.json` + Vite で 1 回更新。Slice 1-B で Jest 294 green を確認してからマージ |
| リスク | `amplify/` を動かすと `ampx sandbox` が壊れる | D-8 のとおり `amplify/` は root 据え置き。移動しない |
| リスク | Tauri ビルドは OS webview 依存 (Linux=`webkit2gtk-4.1`+`libsoup-3`、Win=WebView2、macOS=WKWebView) | CI workflow に各 OS の system 依存導入ステップを明記 |
| リスク | `core` 単一バイナリに ML 重依存を含めると巨大化・PyOxidizer 破綻 | `requirements-ml.txt` を分離し **ML 依存は同梱しない**。初回起動時 DL (既存 `core/app/mu/setup/downloader.py` を拡張)。バイナリ化は PyInstaller 第一候補 |
| ブロッカー | コード署名証明書 (Windows OV/EV、Apple Developer Program) はユーザー調達必須 | 未調達でも署名なしビルドで Sprint 1-3 は進行可。Sprint 4 で証明書が揃い次第 CI に組込み |
| ブロッカー | private repo の Release asset を Tauri updater が匿名取得できない | 更新配信専用の public mirror / S3 + 署名付き URL / 軽量 update エンドポイントのいずれか。Sprint 3 で決定 |
| **設計決定** | **Web/AWS ターゲットで Project Mu Engine (`core`) をどう動かすか** | `core` は SQLite + ローカル LLM 推論のローカル主体コンポーネント。ブラウザでは動かない。**推奨案**: Sprint 3 で `core` をコンテナ化し AWS App Runner 等へ配備、`apps/web` がそれを叩く。ただし SQLite は単一ユーザー・ローカル前提のため、**AWS マルチユーザー運用時のデータ層 (SQLite → 永続ボリューム or 別データストア) は独立した設計課題**。本 Track E ではモノレポ「構造」が AWS ターゲットを可能にすることまでをスコープとし、マルチテナント・データ層の本格設計は別途扱う。**ユーザー確認を要する** |
| 設計決定 | npm → pnpm 移行の是非 | D-2 のとおり npm workspaces を採用 (pnpm 不採用)。HANDOFF の「pnpm workspace」表記を更新 |
| 注意 | 既存 UI の一部に dark UI 前提のハードコード色が残る (docs/9 V-2) | デスクトップ webview 表示時に手動視覚検証を実施 (docs/10 が SoT) |

---

## 6. 開発体験 (DX) の保全

Track B-Verify (Gemma 4 実機テスト) と Track D (プラグイン AWS デプロイテスト) は
`npm run dev` で行う想定。再編がこの開発フローを壊さないことを **Sprint 1 の検収条件**
に含める。

| コマンド | 移行後の挙動 |
|---|---|
| `npm run dev` | root スクリプトが `apps/web` (Vite :5173) + `core` (uvicorn :8000) を並行起動。**従来と同一の体験** |
| `npm run lint` / `npm run test` / `npm run build` | root から全 workspace を横断実行 |
| `npx ampx sandbox` | `amplify/` 据え置きのため従来どおり動作 |
| `npm run tauri:dev` (Sprint 2 以降) | `apps/desktop` で Tauri ウィンドウ起動 |
| Gemma 4 実機推論 / LoRA SFT | `core/` に移った Python エンジンで従来どおり。`requirements-ml.txt` を入れた環境で実行 |

> **再編 → テスト → 実装の流れ**: Sprint 1 完了後、構成が `apps/` + `packages/` +
> `core/` に整理されるため、Track B-Verify / Track D のテストで判明した修正は
> 「UI なら `packages/app`」「エンジンなら `core`」「クラウドなら `amplify`」と
> 投入先が一意に決まる。これがメンテナンス性向上の実利。

---

## 7. ワンクリック配布・更新の仕組み

### 配信側 (メンテナ) — Git タグ 1 アクション

```
git tag v1.x.x && git push --tags
  └→ リリース CI (GitHub Actions OS matrix)
       ├─ apps/desktop: Win/macOS/Linux ビルド + 署名 + notarization
       ├─ minisign 署名 + latest.json 生成 → GitHub Release 添付
       └─ apps/web + amplify: AWS へ配備 (deploy:cloud)
```

### 受信側 (デスクトップ利用者) — アプリ内ワンクリック

- Tauri Updater が `latest.json` を確認 → 新版があれば `UpdateNotification` UI に通知
- 利用者が「更新」を 1 クリック → 署名検証済みパッケージを取得・適用・再起動

### インストール (ワンパッケージ)

- デスクトップ: 単一インストーラ (`.msi`/`.exe`/`.dmg`/`.AppImage`) をダブルクリック
- AWS: 利用者はブラウザで URL にアクセスするのみ (インストール不要)。配備は
  メンテナが `npm run deploy:cloud` の 1 コマンド

---

## 8. ドキュメント成果物

| ファイル | 役割 | 作成タイミング |
|---|---|---|
| `docs/11_TRACK_E_SPRINT_PLAN.md` | 本ドキュメント、Sprint 計画 + 詳細タスク | ✅ Sprint 0 (2026-05-16) |
| HANDOFF.md §2 §3 §5 | Track E 進捗 + ディレクトリ地図 (Sprint 単位で更新) | Sprint ごと |
| `docs/12_RELEASE_GUIDE.md` (仮) | 署名・notarization・リリース手順 | Sprint 4 で作成 |

---

## 9. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 正式仕様 (`apps/web/` `core/mu/` 構想 / Tauri 本体サイズの根拠)
- [docs/8_TRACK_D_SPRINT_PLAN.md](8_TRACK_D_SPRINT_PLAN.md) — Track D の Sprint 計画 (本ドキュメントの構成元)
- [docs/CONCEPTS.md](CONCEPTS.md) — 用語定義 (Plugin / Skill / MCP / Adapter)
- [docs/10_UI_DESIGN_SYSTEM.md](10_UI_DESIGN_SYSTEM.md) — UI デザイン設計書 (デスクトップ UI 追加時の SoT)
- `launcher/main.py` / `build/build_all.py` / `build/hoshutaro_setup.iss` — Track E で削除するレガシー配布資産
