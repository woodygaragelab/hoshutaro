# CLAUDE.md — HOSHUTARO 開発ガイド

HOSHUTARO（次世代版）— Project Mu Engine + Knowledge Base UI。
Tauri デスクトップ（`src/` フロント + `core/` FastAPI sidecar）+ `amplify/` クラウド。

## 構成の要点

- フロント: `src/`（React + Vite + MUI + Zustand + react-query）
- バックエンド: `core/app/`（FastAPI）。LLM は `core/app/llm/`、エージェントは
  `core/app/engine/`、サービスは `core/app/services/`。
- ローカル LLM = Gemma 4 E2B-it（OpenVINO GenAI LLMPipeline + MTP）一本化。
- チャット駆動オーケストレーション: `/api/chat/completions` → `conversational_dispatcher`
  （intent 分類）→ `orchestrator.execute_agent`（エージェント/ダイアログ操作）。
- UI コンテキスト: `src/state/uiContextStore.ts` が開いているダイアログを保持し、
  `ui_context` としてチャット送信。intent ホワイトリストで操作を絞る。

## 検証コマンド

- フロント: `npm run lint` / `npm run build`（= `tsc -b && vite build`）/ `npm test`
- バックエンド: `cd core && python -m pytest tests/`
- 注意: `tsc --noEmit` より `npm run build` の `tsc -b` の方が厳格（プロジェクト参照を解決）。
  最終確認は必ず `npm run build` を使う。

## 完遂の規律（重要 — 過去に未完で「完了」と誤報告した反省）

レイヤーをまたぐ機能は「コードを書いた」ではなく「end-to-end で動く」まで完了としない。
過去、層ごとに実装して各層単体で「完了」と判断し、層と層の接続が抜けたまま「WS 完了」と
報告してしまった（新 intent を分類器に追加したが実行ハンドラ未追加、新 SSE イベントを
producer に追加したが consumer 未対応、config 値を定義したが呼出側へ未配線）。

再発防止のため、機能ごとに次を必ず確認する:

1. **producer↔consumer の対**: 新しく送るイベント/メッセージ型には必ず受け手を実装する。
   - 新しい SSE イベント型 → フロントの受信ハンドラ（例: `AgentBar` の `onEvent`）
   - 新しい intent/enum/route → 実行する側のハンドラ（例: `orchestrator.execute_agent`）
   - 新しい config 値 → 全呼出箇所への配線（定義しただけにしない）
2. **垂直スライス確認**: 機能を分類→ディスパッチ→実行→SSE→UI 描画まで 1 本辿り、
   どこかで途切れていないか確認してから「完了」と言う。
3. **「テスト/ビルド/lint が通る」≠「機能が動く」**: これらはコンパイル可否の検証であって
   振る舞いの検証ではない。報告時はこの区別を明示する（「実機 LLM 検証はユーザー環境」等）。
4. **プランの done 条件を再導出**: チェックリストを「やった気」で消さない。プランに列挙
   された intent/エージェント/ファイル一つひとつに実体があるか照合してから完了報告する。
5. **未完は正直に列挙**: 完了していない項目は「完了」と言わず、ギャップを具体的に挙げる。

## 規約

- コミット/PR/コード内に model 識別子（`claude-opus-...` 等）を書かない。
- 作業ブランチは指示されたものを使う。push 後は draft PR を用意（既存があれば積む）。
- モック実装（ダミーデータ）は作らない方針。未実装は honest な `NotImplementedError`。

---

## リポジトリ運用（2 リポ体制）

| リポ | 役割 | 触る頻度 |
|---|---|---|
| **`mushitaro/hoshutaro-mu`** (この private リポ) | 開発本拠地。Claude Code と一緒の日常コミット先 | 毎日 |
| **`woodygaragelab/hoshutaro`** (public) | 公式リリース配布 (GitHub Releases / .msi) | リリース時のみ |

両 `hoshutaro` リポの `main` ブランチは **常に同じ SHA に同期している**。日常コミットは `mushitaro/hoshutaro-mu/main` に直 push で OK（リリースは発火しない）。

関連: ランディングページは別リポ `mushitaro/hoshutaro-delivery`（AWS S3+CloudFront）で運用。

## リリース運用（明示トリガー型）

ユーザが次のような指示を出したときだけリリースを実行する。**それ以外は絶対にタグを打たない**：

- 「リリース v0.2.0」「リリース v X.Y.Z」
- 「release v X.Y.Z」
- 「v X.Y.Z を出して」「v X.Y.Z を配布」

実行手順の単一情報源 = **[`docs/RELEASE_PROCEDURE.md`](docs/RELEASE_PROCEDURE.md)**。

リリース手順を改修するときはこのファイルを必ず先に読み・更新する。両リポで内容は同一に保つ。

## 既知の状態（一回限りの記録、変わったら更新する）

- Tauri Updater 署名鍵: 生成済み。両リポの GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) に登録済み。公開鍵は [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) の `plugins.updater.pubkey` に埋め込み済み。ローカルバックアップは `~/.hoshutaro/keys/`
- Windows Authenticode 署名: **未調達**（コスト保留中）。配布バイナリは unsigned。SmartScreen 警告は「詳細情報 → 実行」で進められる
- Updater 配信元: `woodygaragelab/hoshutaro` の Releases（public）。`plugins.updater.endpoints` で参照
- ランディング Download URL: バージョン非依存 `https://github.com/woodygaragelab/hoshutaro/releases/latest/download/hoshutaro-windows.msi`（毎リリースで `hoshutaro-windows.msi` という名前のコピーを `gh release upload` する）
