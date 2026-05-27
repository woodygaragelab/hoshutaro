# HOSHUTARO リリース手順 — Claude Code 用 Runbook

このドキュメントは **Claude Code がリリース指示を受けたときに**確実に同じ手順を踏むためのリファレンスです。新しい Claude セッションでも、まず [CLAUDE.md](../CLAUDE.md) からこのファイルへ誘導されます。

---

## トリガー

ユーザが以下のいずれかを言ったらこの手順を実行する：

- 「リリース v0.2.0」「リリース v X.Y.Z」
- 「release v X.Y.Z」
- 「v X.Y.Z を出して」「v X.Y.Z を配布」

**正規表現**：`(リリース|release|配布)\s*v?(\d+)\.(\d+)\.(\d+)`

該当しない場合は通常の開発フローとして main に直 push して終わり（**リリースはトリガー無しでは絶対に発火しない**）。

---

## 前提となる二リポジトリ構造

| リポ | 役割 | branch protection |
|---|---|---|
| **`mushitaro/hoshutaro-mu`** (private) | 開発本拠地。Claude Code と一緒に頻繁にコミットする場所 | なし（main 直 push OK） |
| **`woodygaragelab/hoshutaro`** (public) | 公式リリース配布。GitHub Releases / .msi が置かれる場所 | なし（main 直 push、tag push で CI 起動） |

両 main は常に同じ SHA に同期している。リリース時はその同じ SHA にタグを打って、woodygaragelab 側で CI が動く。

---

## 必須環境（事前確認）

- `gh auth status` で `mushitaro` 認証済み（push 権限が両リポにあること）
- ローカルに `C:\Users\kazuh\hoshutaro-mu` worktree
- `git remote -v` で `origin = mushitaro/hoshutaro-mu`、`upstream = woodygaragelab/hoshutaro` が設定済み
- 両 main の HEAD SHA が一致していること（`gh api repos/<owner>/hoshutaro(-mu)?/commits/main --jq '.sha[0:7]'`）

---

## リリース実行手順

### ステップ 0 — pre-flight チェック

```sh
cd C:\Users\kazuh\hoshutaro-mu

# 1. 現在のブランチ確認
git branch --show-current
# main であること。違うブランチで作業中なら user に確認

# 2. 未コミット変更がないこと
git status --short
# 空が望ましい。何かあれば user に確認 → コミット or stash

# 3. 両 main SHA が一致
gh api repos/mushitaro/hoshutaro-mu/commits/main --jq '.sha[0:7]'
gh api repos/woodygaragelab/hoshutaro/commits/main --jq '.sha[0:7]'
# 一致していないなら user に報告して停止
```

### ステップ 1 — version bump

`X.Y.Z` 部分は user が指定したバージョン。

```sh
# 以下 3 ファイルを編集（version を X.Y.Z に変更）
#  - src-tauri/tauri.conf.json     "version": "X.Y.Z"
#  - package.json                  "version": "X.Y.Z"
#  - src-tauri/Cargo.toml          version = "X.Y.Z"

git add src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml
git commit -m "chore(release): bump version to X.Y.Z"
```

### ステップ 2 — リリースノートを git log から自動生成

```sh
# 直前のタグを取得
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# 範囲指定で feat:/fix:/chore: 等の Conventional Commits をカテゴライズ
# 出力例: /tmp/release-notes-vX.Y.Z.md
```

カテゴリ分類ルール（commit message のプレフィックスで判定）:

| プレフィックス | セクション | 並び順 |
|---|---|---|
| `feat:` / `feat(...):` | ✨ 新機能 | 1 |
| `fix:` / `fix(...):` | 🐛 バグ修正 | 2 |
| `perf:` / `perf(...):` | ⚡ パフォーマンス | 3 |
| `refactor:` / `refactor(...):` | ♻️ リファクタリング | 4 |
| `docs:` / `docs(...):` | 📝 ドキュメント | 5 |
| `chore:` / `chore(...):` / `style:` / `test:` / `ci:` / その他 | 🔧 その他 | 6 |

リリースノートのテンプレ（最後に「ダウンロード」「既知の制約」「変更履歴詳細」を付ける）:

```markdown
# HOSHUTARO vX.Y.Z

## ✨ 新機能
- feat 系コミット message から行頭の `feat[(scope)]:` を剥がして列挙

## 🐛 バグ修正
- ...

## (該当があれば他カテゴリ)

## ダウンロード

| プラットフォーム | ファイル |
|---|---|
| Windows (MSI) | `HOSHUTARO_X.Y.Z_x64_en-US.msi` |
| Windows (EXE) | `HOSHUTARO_X.Y.Z_x64-setup.exe` |
| Landing 安定リンク | `hoshutaro-windows.msi`（中身は MSI と同じ） |

ランディング: https://hoshutaro-delivery.tsunagi.app

## 既知の制約

- Authenticode コード署名はまだ調達していない → SmartScreen 警告は「詳細情報 → 実行」で進められます
- macOS / Linux 未対応

## 変更履歴詳細

[v(前タグ)...vX.Y.Z](https://github.com/woodygaragelab/hoshutaro/compare/v<prev>...vX.Y.Z)
```

### ステップ 3 — 両リポに push

```sh
git push origin main      # mushitaro/hoshutaro-mu に main を push（version bump コミット含む）
git push upstream main    # woodygaragelab/hoshutaro に main を push（FF）
```

両方とも FF 成功するはず。失敗するなら main 同期が崩れているので user に報告して停止。

### ステップ 4 — タグを打って push

```sh
git tag -a vX.Y.Z -m "vX.Y.Z"
git push upstream vX.Y.Z  # tag は woodygaragelab/hoshutaro にだけ push する（CI 起動）
```

**注**: tag を `origin` (mushitaro) にも push して構わないが、CI は upstream 側でのみ動作するので役割上は upstream のみで十分。

### ステップ 5 — CI 監視

```sh
# release.yml の起動を確認
gh run list --workflow=release.yml --limit 1 --repo woodygaragelab/hoshutaro

# 完了待ち
gh run watch <run-id> --repo woodygaragelab/hoshutaro --exit-status
```

ビルド時間目安: 20〜40 分（Windows + macOS + Linux 並列、初回 Rust crate cache hit による）。

CI が失敗した場合の対処:
- ログを取得して原因報告 (`gh run view <run-id> --log-failed`)
- 多くは Tauri Updater 署名鍵周りか PyInstaller hook 不足
- user に「失敗ログ」「推定原因」「修正案」を提示して指示を仰ぐ

### ステップ 6 — Draft Release を user に提示

CI が成功すると `tauri-action` が **Draft Release** を v X.Y.Z タグに作成する。

```sh
# Release URL を取得
gh release view vX.Y.Z --repo woodygaragelab/hoshutaro --json url --jq '.url'
```

User に提示する内容:
- Release URL
- 生成された asset リスト（`.msi`、`.exe`、`latest.json`、signatures）
- 自動生成されたリリースノートのプレビュー
- **「内容確認してください。OK なら publish します」と問い合わせる**

### ステップ 7 — Landing 用 stable filename をアップロード

CI が作る .msi はバージョン入りファイル名のみ。ランディングページが参照する `hoshutaro-windows.msi` も同じ release に追加する：

```sh
# Release から .msi をダウンロードして .msi の stable コピーをアップロード
gh release download vX.Y.Z --repo woodygaragelab/hoshutaro --pattern 'HOSHUTARO_X.Y.Z_x64_en-US.msi' --dir /tmp
cp /tmp/HOSHUTARO_X.Y.Z_x64_en-US.msi /tmp/hoshutaro-windows.msi
gh release upload vX.Y.Z --repo woodygaragelab/hoshutaro /tmp/hoshutaro-windows.msi
```

### ステップ 8 — User の承認後に publish

User が「OK、publish して」と言ったら：

```sh
gh release edit vX.Y.Z --repo woodygaragelab/hoshutaro --draft=false
```

ランディングページの Download URL は **バージョン非依存** で書いてあるので、自動的に新リリースを参照する：
- `https://github.com/woodygaragelab/hoshutaro/releases/latest/download/hoshutaro-windows.msi`

### ステップ 9 — 完了報告

User に以下を伝える：
- Release URL
- Landing page で実際にダウンロードが切り替わったことの動作確認方法
- 次回のためのメモ（任意）

---

## 失敗時のロールバック

リリース手順の途中で何か致命的な問題が起きたら：

```sh
# タグを削除
git push --delete upstream vX.Y.Z
git tag -d vX.Y.Z

# Draft release があれば削除
gh release delete vX.Y.Z --repo woodygaragelab/hoshutaro --yes

# version bump コミットを reset
# (まだ push してない場合)
git reset --hard HEAD~1

# (既に push してしまった場合) revert で打ち消し
git revert HEAD --no-edit
git push origin main && git push upstream main
```

---

## このリポを触っているあなたへ

1. **このファイルは絶対に消さない**（リリース手順の単一情報源）
2. リリース手順を改善したら、**両リポの `docs/RELEASE_PROCEDURE.md` を必ず同時に更新する**（差分が出ないように）
3. 鍵関連 (`TAURI_SIGNING_*` Secrets / `tauri.conf.json` の `pubkey`) は同期している。一方を変えるなら必ず両方
4. user の明示的な「リリース」指示が無いコミットは、tag を打たないこと
