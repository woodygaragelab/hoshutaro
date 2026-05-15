# 10. UI デザイン設計書 (HOSHUTARO Project Mu)

> このドキュメントは **HOSHUTARO の UI 一貫性を保つための Single Source of Truth**。
> 新 UI を追加する際、既存 UI を修正する際、レビューする際の判定基準として使う。
>
> 既存コード (`src/components/KnowledgeBase/common.tsx`、`AuthLayout`、`ThemeProvider` 等) に
> 暗黙的に存在していたルールを reverse-engineer して明文化したもの。**コード優先で、コードと
> このドキュメントが矛盾した場合は本ドキュメントを更新する**。

---

## 0. 本ドキュメントの位置づけと使い方

### 目的

1. UI 一貫性の判定基準を**明文化**する (各画面で同じトーン、同じ確認 UX、同じローディング表現になるように)
2. **内部用語 (Sprint 名 / DynamoDB テーブル名 / 専門用語) がユーザー向け文字列に漏れない**ようにする
3. 新 UI 追加時に再発する小さな手戻り (aria-label 忘れ、過剰な subtitle、機能リンク切れ) を防ぐ
4. **Track E (Tauri Desktop) 以降の新 UI 追加が暗黙ルールを破らない**ようにする

### スコープ

- 対象: `src/components/**` 以下のすべての user-facing UI
- 非対象: 開発者向けツール (PluginManager の YAML エディタ等は別ルール)、ログ出力、テストコード
- 対象技術: MUI 7 + React Query 5 + light/dark Theme (`src/theme/`)

### 使い方

- **新 UI 追加時**: §10 のチェックリストに沿って確認
- **既存 UI 監査時**: 各セクションの判定基準と差分を `docs/9_UI_AUDIT.md` に記録
- **不明な判断時**: 既存の `src/components/KnowledgeBase/common.tsx` パターンと
  `src/components/Auth/AuthLayout.tsx` パターンを参照

---

## 1. デザイン原則 (Top-level Principles)

HOSHUTARO 次世代版 (Project Mu) の 4 つのコア価値 (PROJECT_MU.md) のうち、UI に直結する 3 つ:

| 原則 | UI への反映 |
|---|---|
| **操作最小** | 設定項目は最小限。ユーザーに必要な選択肢のみ提示。中間ステップを増やさない |
| **瞬時応答** | ローディング表示は構造的 Skeleton 優先、CircularProgress は inline 操作のみ。重い処理は SSE で逐次反映 |
| **プライバシー** | データはローカル SQLite 主、クラウド設定は明示。「データをエクスポート」「アカウントを削除」を ProfileScreen で対等に提供 |

加えて UI 専用原則:

- **Material Design 準拠** (MUI 7) + **日本語タイポグラフィ最適化** (text-balance / text-pretty / tabular-nums)
- **light/dark テーマ完全対応** (色や境界は theme 経由、ハードコード禁止)
- **キーボード操作 + スクリーンリーダー対応** (aria-label / aria-live / autoComplete)

---

## 2. トーン & ボイス

### 文体

- **ボタン・メニュー項目**: 動詞単独、最大 8 文字を目安
  - 良: 「保存」「削除」「キャンセル」「サインアウト」「閉じる」「次へ」「データをエクスポート」
  - 不可: 「保存する」「ここをクリックして保存」「保存を実行する」
- **タイトル (Typography variant="h5"/"h6"/"subtitle1")**: 名詞単独 or 短い名詞句
  - 良: 「ログイン」「プロフィール」「パスワード変更」「多要素認証 (MFA) の設定」
  - 不可: 「あなたのプロフィールを管理する画面」
- **説明文 (Typography variant="body2")**: 「です/ます調」、1-2 行で完結。詳細は次画面に移動
  - 良: 「TOTP 対応の認証アプリで QR をスキャンしてください。」
  - 不可: 「お客様の認証アプリ (Google Authenticator や Microsoft Authenticator 等) を起動し、表示されている QR コードをスキャンすることで MFA を有効化できます。なお、本機能は…」
- **エラーメッセージ**: 「〜できません」「〜してください」の形、原因→対処の順
  - 良: 「メールアドレスかパスワードが正しくありません。再度入力してください。」
  - 不可: 「Error: AuthenticationError: Invalid credentials (code: NotAuthorizedException)」

### ✋ 禁止語彙 (内部用語をユーザーに見せない)

以下は **ユーザー向け文字列に絶対に出さない**:

| 内部用語 (NG) | 理由 | ユーザー向け代替 (OK) |
|---|---|---|
| Sprint 1〜5 / Slice A-E | 開発工程の内部呼称 | 言及しない (機能リリース時期はマーケティング担当が決定) |
| MTP / Speculative Decoding / Multi-Token Prediction | 専門用語、ユーザーには無意味 | **LLM 高速化** / **応答を高速化 (推奨)** |
| UserSettings / LLMSettings / SyncMetadata | DynamoDB テーブル名 | **アカウント設定** / **アカウント設定とクラウド同期データ** |
| MCP / Adapter / Orchestrator / cloud_proxy / openvino-adapter | 内部実装の階層構造 | **プラグイン** / **スキル** ([CONCEPTS.md](CONCEPTS.md) 準拠) |
| Cognito / DynamoDB / Lambda / Bedrock / AppSync | AWS サービス名 | **アカウント** / **クラウド** / 状況により省略 |
| cloud_claude_3_5_sonnet | モデル ID | **Claude 3.5 Sonnet (クラウド)** (フレンドリー名+提供形態) |
| TOTP | 略語 (RFC 用語) | **認証アプリの 6 桁コード** / **多要素認証 (MFA)** |
| post-confirmation Lambda / Hub.listen | 実装詳細 | 言及しない |
| エラーコード (NotAuthorizedException, UserNotConfirmedException 等) | API レスポンスコード | `authErrors.ts` の `mapAuthError()` で日本語化 |

### ✅ ユーザー向け一級用語 (積極的に使う)

[CONCEPTS.md](CONCEPTS.md) 準拠で **2 概念のみ** を表に出す:

- **プラグイン (Plugin)**: 拡張機能の単位 (LLM Adapter / Connector / Skill 等)
- **スキル (Skill)**: ユーザーが直接実行するタスクテンプレート

加えて Track D で追加された語彙:
- **アカウント設定** (= ProfileScreen のスコープ全体)
- **クラウド同期** (= 複数デバイス間で共有される設定)
- **多要素認証 (MFA)** (TOTP / 認証アプリ の総称)

### 用語の一貫性ルール

- 表記揺れ禁止: 「サインアウト」を採用、「ログアウト」「サインオフ」と混在させない
- カタカナ語と漢字の混在は最小化: 「アカウント削除」(× アカウントを Delete)
- 全角/半角の統一: 数字・英字・記号は半角、ただし句点「。」読点「、」は全角

---

## 3. タイポグラフィ

### MUI Typography variant の使い分け

| variant | 用途 | 例 |
|---|---|---|
| `h5` | 画面タイトル (AuthLayout で使用、`fontWeight: 700`) | "HOSHUTARO" のロゴ |
| `h6` | サブタイトル (画面のサブ見出し) | "ログイン" "新規登録" |
| `subtitle1` | セクション見出し (Dialog 内、Card 内) | "表示名の変更" "パスワード変更" |
| `subtitle2` | サブセクション見出し / 小タイトル | "クラウド同期設定" |
| `body1` | 本文 (重要情報) | ユーザーのメールアドレス表示 |
| `body2` | 説明文 / 補足 (`color: text.secondary` と組合せ) | 機能の説明文、helper text |
| `caption` | キャプション / メタ情報 | 「手動入力用キー (アプリで QR が読めない場合):」|
| `overline` | ラベル / カテゴリタグ (`color: text.secondary`) | 「メールアドレス」(値の上に置くラベル) |

### 日本語タイポグラフィ

`src/components/KnowledgeBase/common.tsx` で定義された sx スニペットを採用:

```tsx
import { sxTabularNum, sxTextBalance, sxTextPretty, sxLineClamp } from '../KnowledgeBase/common'

// 数値表示 (列幅が揃う)
<Typography variant="body1" sx={sxTabularNum}>{count}</Typography>

// 短い見出しの折り返しを綺麗に (text-wrap: balance)
<Typography variant="h6" sx={sxTextBalance}>...</Typography>

// 長い説明文の禁則処理 (text-wrap: pretty)
<Typography variant="body2" sx={sxTextPretty}>...</Typography>

// リスト要約の n 行省略 (line-clamp)
<Typography variant="body2" sx={sxLineClamp(2)}>...</Typography>
```

### Letter spacing

- ロゴ (HOSHUTARO): `letterSpacing: '0.05em'` (AuthLayout の確立済パターン)
- 通常文: theme default (調整不要)

### 数値・コード表示

- 数値: 必ず `sxTabularNum` (列幅が揃う、tabular-nums 採用)
- コード/シークレット: `fontFamily: 'monospace'` + `wordBreak: 'break-all'` + `userSelect: 'all'` (MfaSetupScreen の secret 表示パターン)

---

## 4. カラーとトーン

### Theme palette

`src/theme/` の `lightTheme` / `darkTheme` を使う。色はハードコード禁止、必ず theme 経由:

| 用途 | 適切な指定 |
|---|---|
| 背景 | `bgcolor: 'background.default'` (ページ) / `'background.paper'` (Card 内) |
| 境界線 | `borderColor: 'divider'` |
| 一次テキスト | default (Typography が `text.primary` を自動適用) |
| 二次テキスト | `color: 'text.secondary'` (説明文・キャプション・disabled 風) |
| エラー | `color: 'error'` (Button) / `severity: 'error'` (Alert) |
| 警告 | `color: 'warning'` / `severity: 'warning'` |
| 成功 | `severity: 'success'` (Alert のみ、Button は使用控えめ) |

### StatTone 4 値 (構造的トーン)

`src/components/KnowledgeBase/common.tsx` の `StatTone` を全画面で採用:

```ts
type StatTone = 'neutral' | 'positive' | 'warning' | 'critical'
```

| StatTone | Alert severity | Button color | 用途 |
|---|---|---|---|
| `neutral` | (Alert 不要 or `info`) | `primary` / `inherit` | 情報 / 通常操作 |
| `positive` | `success` | `success` (控えめ) | 成功通知、完了確認 |
| `warning` | `warning` | `warning` | MFA 無効化、可逆だが注意 |
| `critical` | `error` | `error` | アカウント削除、不可逆 destructive |

### 1 画面につき 1 アクセントカラー

- destructive section が混在する場合 (ProfileScreen で「パスワード変更」+「アカウント削除」)
  → critical action は `<Typography color="error">` + `<Button color="error">` で **セクションごと色分け**

### 4.5 フルカラースケール (50-900)

`src/theme/index.ts` の `colorPalette` 定義をそのまま採用。新規追加時は **必ずこのスケール内**から選び、独自色は導入しない。

| カラー名 | 50 (lightest) | 500 (base) | 900 (darkest) | 主用途 |
|---|---|---|---|---|
| `primary` | `#f0f9ff` | `#0ea5e9` | `#0c4a6e` | primary action (Button contained)、links、focus ring。`palette.primary.main` = 600 |
| `secondary` | `#f8fafc` | `#64748b` | `#0f172a` | secondary chips、neutral アクセント。`palette.secondary.main` = 600 |
| `success` | `#f0fdf4` | `#22c55e` | `#14532d` | StatTone `positive` / `severity="success"`。`palette.success.main` = 600 |
| `warning` | `#fffbeb` | `#f59e0b` | `#78350f` | StatTone `warning` / `severity="warning"`。`palette.warning.main` = 500 |
| `error` | `#fef2f2` | `#ef4444` | `#7f1d1d` | StatTone `critical` / `severity="error"`。`palette.error.main` = 600 |
| `neutral` | `#fafafa` | `#737373` | `#171717` | background / text / divider / disabled |

**ライト/ダーク マッピング** (`createModernTheme` で自動切替):

| token | light theme | dark theme |
|---|---|---|
| `background.default` | `neutral.50` (#fafafa) | `neutral.900` (#171717) |
| `background.paper` | `#ffffff` | `neutral.800` (#262626) |
| `text.primary` | `neutral.900` | `neutral.100` |
| `text.secondary` | `neutral.600` | `neutral.400` |
| `divider` | `neutral.200` | `neutral.700` |

⚠️ **重要**: 現在 `src/index.css` に `* { color: #ffffff !important; }` の global override があり、これが light theme を実質無効化している。これは技術負債として `docs/9_UI_AUDIT.md` に記載済 (Sprint 6 範囲外、別 Sprint で除去)。新規 CSS では **絶対に `!important` で text color を上書きしない**。

### 4.6 Border radius scale

`src/theme/index.ts` の `borderRadius` 定義、および MUI theme の `shape.borderRadius = 8`:

| token | 値 | 用途 |
|---|---|---|
| `borderRadius.none` | `0` | 通常使わない (フラットなテーブル罫線等のみ) |
| `borderRadius.sm` | `0.125rem` = 2px | チップ内部のサブ要素等 (稀) |
| `borderRadius.md` | `0.375rem` = 6px | 小型バッジ、status indicator |
| `borderRadius.lg` | `0.5rem` = 8px | **TextField, Paper, Button, Select** (デフォルト) |
| `borderRadius.xl` | `0.75rem` = 12px | **Card** (StatCard など)、Dialog 内のサブ Card |
| `borderRadius.2xl` | `1rem` = 16px | 大型 surface (今後の Tauri 用フローティングカード等) |
| `borderRadius.full` | `9999px` | **Chip** (pill 形状)、アバター、円形 IconButton |

**MUI theme で既に component override 済** (`MuiButton` / `MuiTextField` / `MuiCard` / `MuiPaper` / `MuiChip`)。new component 追加時は MUI コンポーネントを使えば自動で適用される。**独自 div で border-radius を書く際はこのスケール内のみ使う**。

### 4.7 Shadow & elevation scale

`src/theme/index.ts` の `shadows` 定義 + `src/styles/globals.css` の `--shadow-*` トークン:

| token | 値 | 用途 (elevation 階層) |
|---|---|---|
| (none) | `boxShadow: 'none'` | 通常状態のフラット UI (デフォルト)、TextField や OutlinedButton |
| `shadows.sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Card 通常時、Button hover 時 |
| `shadows.md` | `0 4px 6px -1px ..., 0 2px 4px -2px ...` | Card hover 時、ContainedButton hover 時、Menu / Tooltip |
| `shadows.lg` | `0 10px 15px -3px ..., 0 4px 6px -4px ...` | Dialog (MUI が自動で適用)、Popover |
| `shadows.xl` | `0 20px 25px -5px ..., 0 8px 10px -6px ...` | Drawer、フローティング AgentBar (`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4)` 相当) |
| `shadows.2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | スプラッシュ的大型 modal (Tauri 用途) |

**elevation の意味論ルール**:
- elevation = **画面 z 軸方向の重要度**。トップレベル surface (Card / Paper) は sm、interactive な surface (hover) は md、overlay (Dialog/Drawer) は lg+ と段階的に上げる
- 通常の Box / Container は **影なし** (`boxShadow: 'none'`) がデフォルト
- 同じ階層に複数の影を重ねない (Card 内 Card の二重シャドウ禁止)
- ダークテーマでは影は視認性が下がるため、border (`borderColor: 'divider'`) で代替するのが望ましい場面が増える

**MUI コンポーネント既定挙動**:
- `MuiButton.contained`: hover で md、デフォルト none
- `MuiCard`: デフォルト sm、hover で md
- `MuiDialog`: lg (MUI 標準)

### 4.8 Motion: transition / easing / duration

`src/styles/globals.css` の `--transition-*` トークン + `src/components/AgentBar/AgentBar.css` の cubic-bezier 利用慣行を採用:

| 用途 | duration | easing | 例 |
|---|---|---|---|
| 微細 (色変化、focus ring) | `150ms` (`--transition-fast`) | `ease-in-out` | Button text color、focus border |
| 標準 (hover, expand, fade) | `200ms` (`--transition-normal`) | `ease-in-out` | 通常の hover、Alert mount |
| ゆっくり (slide up, scale in) | `300ms` (`--transition-slow`) | `ease-out` | Dialog mount、page enter |
| 高度なアニメ (toolbar 開閉) | `400-500ms` | `cubic-bezier(0.16, 1, 0.3, 1)` (snappy out) | AgentBar の expand/collapse、agent-tool-anim-wrapper の hidden 切替 |

**Easing curve の意味論**:
- `ease-in-out`: 自然な往復、汎用 (色変化 / 影 / 透明度)
- `ease-out`: 開始は速く終了は緩やか。**新規要素の出現** に適する (page mount、Dialog open)
- `ease-in`: 開始は緩やか。**離脱・消失** に適する (Dialog close、削除アニメ) ※ 現状ほぼ未使用
- `cubic-bezier(0.16, 1, 0.3, 1)`: 「snappy out」と呼ぶ、終端で素早く確定。AgentBar の toolbar 拡張等の**プロダクト固有の signature motion** に使う

**アニメ keyframes** (既に `src/styles/globals.css` に定義済):

```css
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes scaleIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
```

**使い方ルール**:
- `Dialog` mount: MUI 標準の Grow transition (scale + opacity) を使う → 上書きしない
- `Alert` (mount): デフォルトの Collapse + Fade で十分、追加アニメ禁止
- `Page` / 全画面切替 (AuthGuard 内の screen 切替など): **アニメを入れない** (state-machine の状態切替に過剰なアニメは混乱を招く)
- カスタムアニメは **AgentBar の signature motion 系のみに限定**。新規コンポーネントで `@keyframes` を独自定義しない (既存の fadeIn/slideUp/scaleIn を使う)

**ローディングアニメーション**:
- `<CircularProgress />`: MUI 標準のスピン (定常回転)、stop ボタンや短時間操作の inline ローディング
- `<LinearProgress />`: progress 既知の場合 `variant="determinate"`、未知の場合 `variant="indeterminate"`。Skill 実行進捗で採用 (SkillRunner で使用)
- `<Skeleton />`: 構造的ローディング、shimmer animation は MUI デフォルトのまま (`animation="pulse"` or `"wave"`、本プロジェクトは `"pulse"` を採用)

### 4.9 Z-index scale

`src/styles/globals.css` の `--z-*` トークン:

| token | 値 | 用途 |
|---|---|---|
| `z-dropdown` | 1000 | AgentBar の hover menu、Select の MenuList |
| `z-sticky` | 1020 | sticky header (今後) |
| `z-fixed` | 1030 | 全画面固定要素 (今後) |
| `z-modal` | 1040 | Dialog (MUI standard) |
| `z-popover` | 1050 | Popover (MUI standard) |
| `z-tooltip` | 1060 | Tooltip (最前面) |

**ルール**:
- MUI 標準 z-index を上書きしない (MUI が内部的に 1300/1400/1500 を使うが、これは触らない)
- 独自のオーバーレイ要素は `--z-dropdown` (1000) 以下に収める
- AgentBar は `z-index: 1000` で fixed (画面下部) — Dialog (MUI 1300) より下なので Dialog open 時は隠れる、これが正しい挙動

---

## 5. スペーシング & レイアウト

### Stack spacing

| spacing | 用途 |
|---|---|
| `0.5` | 密接 (ラベル + 値のペア) |
| `1` | 関連項目 (チェックボックス群、Stack 内の補助情報) |
| `2` | フォーム内のフィールド間 (デフォルト) |
| `3` | セクション間 (ProfileScreen の Divider 区切り単位) |

### Box padding / margin

- Card: `<CardContent sx={{ p: { xs: 3, sm: 4 } }}>` (モバイル 24px / デスクトップ 32px、AuthLayout の確立済パターン)
- Dialog: `<DialogContent>` はデフォルト padding を踏襲、必要なら `sx={{ pb: 3 }}` で底を調整
- Form 内の Section: `mb: 1.5` (subtitle と本文の間)

### Width 制約

| シーン | maxWidth |
|---|---|
| 認証画面 (AuthLayout) | `460` px (Card) |
| 標準 Dialog | `maxWidth="sm"` (600px) |
| 確認 Dialog (destructive) | `maxWidth="xs"` (444px) |
| LLMSettingsDialog 等の大型設定 | `maxWidth="sm"` + `fullWidth` |
| 監査・履歴の一覧画面 | 制限なし (full bleed) |

### Field size

- AuthLayout 内: `size` 指定なし (default = medium、タップ領域大きめで認証画面に最適)
- ProfileScreen 内: `size="small"` (画面内に複数セクションが並ぶため)
- LLMSettingsDialog 内: `size="small"` (技術設定で密度優先)

### 5.5 8px グリッド原則

MUI theme の `spacing: 8` を基盤とし、**すべての margin / padding / gap を 8px の倍数で表現**する。

- `sx={{ p: 1 }}` = 8px、`sx={{ p: 2 }}` = 16px、`sx={{ p: 3 }}` = 24px、`sx={{ p: 4 }}` = 32px
- `sx={{ mt: 0.5 }}` = 4px (4px 単位の例外、密接時のみ)
- 奇数 px (5/7/13 等) は使わない
- ピクセル直接指定 (`mt: '12px'`) は禁止、必ず theme.spacing 経由

### 5.6 コンポーネント別 padding ルール

| コンポーネント | padding | 理由 |
|---|---|---|
| `Card` / `CardContent` | `p: { xs: 3, sm: 4 }` (24px / 32px) | レスポンシブ、モバイル時のタッチ余白確保 |
| `Dialog` 内 `DialogContent` | MUI デフォルト (24px) を維持、調整時は `pb: 3` のみ | MUI 標準を尊重 |
| `DialogActions` | `px: 3, pb: 3, pt: 1` | ボタン群と本文の視覚的区切り |
| `Box component="form"` 全体 | padding 不要、内部 Stack で制御 | Box は構造のみ |
| Section (form 内のセクション) | section title `mb: 1.5`、最終要素は `mb: 0` | 詰めすぎ防止 |
| ListItem (PluginManager 等) | `px: 2, py: 2`、`mb: 1.5` で隣接 ListItem と分離 | カード型 List の標準 |
| Alert (フォーム内) | `sx={{ mb: 2 }}` で次要素と分離 | 常に 16px 下マージン |
| `Stack` 内の要素 | `Stack spacing={n}` で制御、要素個別 margin 禁止 | DRY (margin の二重管理を避ける) |

---

## 6. コンポーネントパターン (再利用ルール)

### 6.1 認証画面の枠

`src/components/Auth/AuthLayout.tsx` を**必ず使う**。中央寄せ Card + HOSHUTARO ロゴ + title + 任意 subtitle:

```tsx
<AuthLayout title="ログイン" subtitle={undefined /* タイトルだけで意味が通る場合は省略 */}>
  <Box component="form" onSubmit={handleSubmit} noValidate>
    {/* ... */}
  </Box>
</AuthLayout>
```

**subtitle のルール**: title から自明な内容を繰り返さない。`subtitle="メールアドレスとパスワードでログイン"` のような冗長は禁止。subtitle は **追加情報** (例: `(${email})` のような文脈) を入れる時のみ使う。

### 6.2 統計表示 (StatCard)

`KnowledgeBase/common.tsx` の `StatCard` を採用。tone 引数で色味を統一:

```tsx
<StatCard label="ルール数" value={rules.length} tone="neutral" />
<StatCard label="未確認" value={pending} tone="warning" />
```

### 6.3 確認ダイアログ (Destructive action)

不可逆操作は **2 段階確認**:

1. セクション内のボタンクリック → 確認 Dialog `(1/2)`
2. 確認 Dialog `(1/2)` で「次へ」→ 最終確認 Dialog `(2/2)`
3. 最終確認 `(2/2)` で「〜する」→ 実行

実装テンプレ (ProfileScreen のアカウント削除 / MFA 無効化が標準):
- 各 stage は `'idle' | 'confirm1' | 'confirm2'` state
- 実行中は close を block (`onClose={() => { if (!ing) setStage('idle'); }}`)
- 最終確認の Button は destructive color (`color="error"` for delete, `color="warning"` for disable)

軽度 (取消し可能) な確認は 1 段階 Dialog (Snackbar の Undo パターンでも可)。

### 6.4 エラー / 成功表示 (Alert)

```tsx
{/* エラー */}
{error && (
  <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
    {error}
  </Alert>
)}

{/* 成功 */}
{success && (
  <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
    {success}
  </Alert>
)}
```

- `severity` は StatTone と対応 (§4 表)
- `role` は error→"alert"、success→"status"
- `aria-live="polite"` 必須
- 一時的な成功通知は Snackbar も可、ただし永続的な成功確認は Alert

### 6.5 フォーム送信中 / ローディング

```tsx
{/* ボタン内ローディング */}
<Button
  type="submit"
  variant="contained"
  disabled={loading}
  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
>
  {loading ? 'ログイン中…' : 'ログイン'}
</Button>
```

- `CircularProgress size`: ボタン startIcon 内なら 14 or 16、画面中央なら 20+
- インライン ローディング (1 要素のみ) は CircularProgress
- 画面全体・複数要素 のローディングは **Skeleton** を構造的に配置:

```tsx
{loading ? <Skeleton variant="rectangular" height={56} /> : <TextField ... />}
```

KnowledgeBase common の `StatCard` は loading 引数を受け取って内部で Skeleton を出す。同パターンで他の Card / Section も統一する。

### 6.6 空状態 (Empty state)

```tsx
<Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
  <Typography variant="body2" color="text.secondary" sx={sxTextPretty}>
    まだプラグインがインストールされていません。
  </Typography>
  <Button variant="outlined" onClick={onInstall}>プラグインを追加</Button>
</Stack>
```

### 6.7 メニュー区切り

AgentBar の hover menu のように複数アクションが並ぶ場合、論理セクション間に区切りを入れる:

```tsx
<div className="menu-item">LLM設定</div>
<div className="menu-item">スキル設定</div>
<div className="menu-item">MCP管理</div>
<div className="menu-item">ナレッジベース</div>
<div className="menu-separator" />
<div className="menu-item">プロフィール</div>
<div className="menu-item">サインアウト</div>
```

### 6.8 disabled state

- 「準備中」「実装中」の UI は **メニューに出さない** (placeholder alert は禁止)
- 一時的に無効な操作は `disabled={true}` + tooltip で理由説明
- 認証必須の操作は AuthGuard で確実に防ぐ (UI で disabled する二重防御は不要)

### 6.9 Button (詳細仕様)

#### 6.9.1 Anatomy (構造)

```
┌────────────────────────────────────────┐
│  [startIcon]  Label text  [endIcon]    │  ← Button height
└────────────────────────────────────────┘
   ↑ padding-left      padding-right ↑
```

#### 6.9.2 サイズ別 padding と高さ

| size | height | padding | font-size | 使用シーン |
|---|---|---|---|---|
| `large` | 48px (`size="large"`) | `0.75rem 1.5rem` | 1rem | 認証画面の primary action (LoginScreen の「ログイン」ボタン等) |
| (default = `medium`) | 40px | `0.5rem 1rem` (theme override) | 0.875rem | **デフォルト**、最も多用 |
| `small` | 32px (`size="small"`) | `0.25rem 0.625rem` | 0.8125rem | Dialog 内 secondary action、密度優先の画面 |

#### 6.9.3 Variant 別ビジュアル

| variant | bg | border | text color | shadow (rest) | shadow (hover) |
|---|---|---|---|---|---|
| `contained` | `primary.main` | なし | `primary.contrastText` | none | `shadows.md` (cubic-bezier-out 200ms) |
| `outlined` | `transparent` | 1px solid `primary.main` (rest), thicker on hover | `primary.main` | none | `shadows.sm` |
| `text` | `transparent` | なし | `primary.main` | none | bg = `primary.50` 相当 (action.hover) |

**ボタンエッジ (角丸)**:
- すべての Button: `borderRadius: 8px` (`borderRadius.lg`、theme override で適用済)
- IconButton (アイコン単独): 円形 = `borderRadius: '50%'` (MUI 標準)
- ButtonGroup: 連結ボタンは外側のみ角丸、内側は直線 (MUI 標準挙動)

#### 6.9.4 ボタンアクション アニメーション

すべての state transition は **`transition: all 150ms ease-in-out`** をベースとする (`--transition-fast`):

| state | 視覚変化 |
|---|---|
| rest (default) | デフォルトのスタイル |
| hover | bg がわずかに濃く (theme palette の hover variant)、shadow が一段上がる (contained のみ)。150ms |
| focus-visible | 2px solid `primary.main` の outline (キーボード操作時のみ、マウスクリック後は表示しない) |
| pressed (active) | shadow が下がる、わずかに scale (0.98) — **theme override で実装する** (未実装) |
| disabled | opacity 50%、cursor not-allowed、shadow なし |
| loading | startIcon に `<CircularProgress size={14|16} color="inherit" />`、ボタン text を 「ログイン中…」等の進行表現に置換、`disabled={true}` |

⚠️ ボタンの**過剰なアニメーション禁止**: scale 変換やバウンス、長時間 (>300ms) のアニメは不要。素早い feedback が瞬時応答原則 (§1) に合致する。

#### 6.9.5 アイコン併用ルール

- `startIcon`: action を視覚的に強調 (Download / Save / Send icon)、テキストとセット
- `endIcon`: 次画面遷移を示唆 (`<ArrowForward />`) — 控えめに使う
- IconButton 単独: ツールバー / メニュー / Dialog header の Close
- IconButton には**必ず `aria-label` または `title` を付ける** (§8.1)

### 6.10 Tab (タブデザイン)

HOSHUTARO では **3 つのタブパターン** が混在しているため、用途で使い分ける:

#### 6.10.1 Pill tab (PluginManager 形式) — 同一画面内のセクション切替

```tsx
<Tabs
  value={tab}
  onChange={(_, v) => setTab(v)}
  TabIndicatorProps={{ style: { display: 'none' } }}
  sx={{
    minHeight: 36,
    '& .MuiTab-root': {
      minHeight: 36, py: 0.5, px: 2, mr: 1,
      borderRadius: 4,
      textTransform: 'none',
      color: 'text.secondary',
    },
    '& .Mui-selected': {
      bgcolor: 'action.selected',
      color: 'text.primary',
      fontWeight: 'bold',
    }
  }}
>
```

- 用途: Dialog 内の 2-3 タブ (PluginManager の「インストール済み」「利用可能」)
- 特徴: 下線インジケータ無し、選択タブは bg fill (pill 形状)

#### 6.10.2 標準 MUI Tabs — KnowledgeBase 等の大きい画面切替

```tsx
<Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
  <Tab label="ダッシュボード" value="dashboard" />
  ...
</Tabs>
```

- 用途: KnowledgeBasePage の 9 画面切替
- 特徴: 下線インジケータ (MUI 標準)、`variant="scrollable"` で水平スクロール
- モバイル時は `scrollButtons="auto"` で矢印自動表示

#### 6.10.3 Vertical tabs — 設定画面 (将来用)

- 現状未使用。LLMSettingsDialog を Tabs 化する際 (Sprint 6 P1) は水平 (6.10.1) を採用
- vertical tabs は今後の Tauri 全画面設定 (Track E) で検討

### 6.11 Card / Dialog のエッジ & シャドウ

#### 6.11.1 Card

```tsx
<Card sx={{ /* MUI theme で borderRadius: 0.75rem (xl)、shadow sm/hover md が適用済 */ }}>
  <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
    ...
  </CardContent>
</Card>
```

- borderRadius: `xl` (12px、theme override 済)
- shadow rest: `shadows.sm`、hover: `shadows.md` (theme で自動)
- padding: `{ xs: 3, sm: 4 }` (24px / 32px)
- border (オプション): `border: '1px solid', borderColor: 'divider'` を付けて影を弱める方針も可 (CloudLLMSettingsSection が使用中)

#### 6.11.2 Dialog

```tsx
<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
    プロフィール
    <IconButton onClick={onClose} size="small" aria-label="閉じる">
      <CloseIcon />
    </IconButton>
  </DialogTitle>
  <DialogContent sx={{ /* デフォルト padding を維持 */ }}>
    ...
  </DialogContent>
  <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
    <Button onClick={onClose}>キャンセル</Button>
    <Button variant="contained">保存</Button>
  </DialogActions>
</Dialog>
```

- borderRadius: `lg` (8px、MuiPaper theme override で自動適用)
- shadow: MUI 標準の `shadows.lg` を維持 (上書き禁止)
- backdrop: `rgba(0, 0, 0, 0.5)` (MUI default、上書きしない)
- maxWidth: 通常 `sm` (600px)、確認 dialog は `xs` (444px)、設定の大型は `md` (900px)

### 6.12 Hover menu (AgentBar pattern)

AgentBar の `hover-menu-vertical` が project signature pattern。新規 hover menu を追加する場合はこれを踏襲:

```tsx
<div
  className="control-hover-group"
  onMouseEnter={() => setShowMenu(true)}
  onMouseLeave={() => setShowMenu(false)}
>
  <IconButton className={`tb-icon ${showMenu ? 'active' : ''}`} title="ツールと設定">
    <ToolsIcon fontSize="small" />
  </IconButton>
  {showMenu && (
    <div className="hover-menu-vertical">
      <div className="menu-item" onClick={...}>項目 1</div>
      <div className="menu-item" onClick={...}>項目 2</div>
      <div className="menu-separator" />
      <div className="menu-item" onClick={...}>サインアウト</div>
    </div>
  )}
</div>
```

スタイル要点 (`AgentBar.css`):
- 背景: `rgba(30, 30, 30, 0.85)` + `backdrop-filter: blur(12px)` (frost glass)
- border: `1px solid rgba(255, 255, 255, 0.1)`
- borderRadius: 12px (※ theme `xl` ではなく独自値、AgentBar 専用)
- shadow: `0 8px 32px rgba(0, 0, 0, 0.4)` (= `shadows.xl` 相当)
- item hover: `transition: all 0.15s` + bg 変化
- 区切り `menu-separator`: 1px horizontal divider、`opacity 0.1`

**注意**: hover menu は touch 環境で意図せず開閉してしまう。Tauri 移行時は **click-to-open** パターンへ移行検討 (Track E スコープ)。

### 6.13 画面遷移表現 (Screen transitions)

#### 6.13.1 AuthGuard 内の認証画面切替 (login → signup → confirm 等)

- **アニメーションなし**を採用 (state machine の遷移、視覚的混乱を避ける)
- ローディング (`loading=true` 時) は中央 CircularProgress のみ
- 失敗時の留まり: state を保持、ユーザー入力消失なし

#### 6.13.2 Dialog open/close

- MUI 標準の `Grow` transition (scale + opacity、`300ms ease-out`) を使う、上書き禁止
- backdrop fade も MUI 標準を維持

#### 6.13.3 Page mount (初回ロード時の AuthGuard children 表示)

```tsx
// main.tsx 内で App を Lazy ロード、Suspense fallback は SkeletonLoaders.Grid
const App = LazyWrapper(() => import('./App'), <SkeletonLoaders.Grid rows={10} columns={6} />)
```

- 初回ロードは Skeleton (`animation="pulse"`) → 完了後 fade-in (200ms)
- fade-in は `globals.css` の `.animate-fade-in` クラスまたは MUI `<Fade in={true} />` を使う

#### 6.13.4 セクション展開 / 折りたたみ

- AgentBar の `agent-tool-anim-wrapper` 風の max-width + opacity + scale 同時変化を採用 (snappy out cubic-bezier、500ms)
- 一般用途では `<Collapse>` (MUI) を使う、`timeout="auto"` or `300ms`

#### 6.13.5 List 項目の追加 / 削除

- MUI `<Fade>` または `<Slide>` を 200-300ms で適用
- 大量追加 (10+ 件) ではアニメーションを切る (パフォーマンス)

### 6.14 ローディング・レンダリング中表現

設計書 §6.5 を補完する詳細仕様:

#### 6.14.1 構造的 Skeleton (推奨)

ページ全体 / 複数要素のロード時、**最終 UI 構造と同じレイアウト**を Skeleton で再現:

```tsx
{loading ? (
  <Grid container spacing={2}>
    {[...Array(4)].map((_, i) => (
      <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
        <StatCard label="" value="" loading={true} />
      </Grid>
    ))}
  </Grid>
) : (
  /* 実 data UI */
)}
```

- `<Skeleton variant="rectangular" />`: Card / Box のプレースホルダ
- `<Skeleton variant="text" />`: テキスト行 (1 行 = 1.4em の縦幅)
- `<Skeleton variant="circular" />`: アバター / 円形要素
- animation: `"pulse"` を採用 (`wave` は CPU 負荷高、本プロジェクトでは未採用)

#### 6.14.2 Inline CircularProgress

```tsx
<Button disabled={loading} startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}>
  {loading ? '保存中…' : '保存'}
</Button>
```

- ボタン内: `size={14}` or `16`、必ず `color="inherit"` でボタン色に合わせる
- 画面中央: `<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>`
- aria: `<CircularProgress aria-label="認証情報を確認中" />` で screen reader 対応

#### 6.14.3 LinearProgress (進捗あり)

SkillRunner などで `progress: 0-100` がわかる場合:

```tsx
<LinearProgress
  variant="determinate"
  value={progress}
  sx={{ height: 6, borderRadius: 3, mb: 2 }}
/>
```

- height: 6px、borderRadius: 3px (`borderRadius.md` 相当)
- 進捗不明時は `variant="indeterminate"` (横スライドアニメ、MUI 標準)

#### 6.14.4 SSE / streaming 進捗

LLM streaming や Skill 実行中のログ表示:

- ログ表示は `bgcolor: 'grey.900'` (theme 経由) で monospace、auto-scroll
- 過去ログは shadow なし、最新ログのみ subtle highlight (`bgcolor: 'action.hover'`) で 1 秒間ハイライト → fade
- アクセシビリティ: `<div aria-live="polite" role="log">` でログ領域を囲む (将来対応)

#### 6.14.5 初回データロード時の Empty fallback

データ取得失敗時の error 表示と、データが空の Empty state を区別:

```tsx
{error ? <InlineError error={error} /> :
 loading ? <SkeletonLoaders.Grid /> :
 data?.length === 0 ? <EmptyState message="まだデータがありません" /> :
 <DataTable data={data} />}
```

優先順位は **error > loading > empty > data** の順で評価。

---

## 7. インタラクション & フィードバック

### 7.1 ボタン variant 階層

| variant | 用途 |
|---|---|
| `contained` | 画面の primary action (1 画面 1 つを目安、ログインボタン等) |
| `outlined` | secondary action (キャンセル、サブ操作、ProfileScreen 内の「表示名を更新」等) |
| `text` | tertiary action (サインアウトのような毎回出ない控えめ操作) |

### 7.2 keyboard / focus

- 認証画面のメインフィールドは `autoFocus` (例: MFA challenge の TOTP 入力)
- フォーム submit は Enter キーで動くように `<Box component="form" onSubmit={...} noValidate>` を使う
- Dialog の Close はヘッダーの ✕ アイコン + Esc キーで両方可能
- Tab 順序は DOM 順 (特殊な tabIndex を入れない)

### 7.3 input 補助

すべての TextField に `autoComplete` を付ける:

| input 用途 | autoComplete |
|---|---|
| メールアドレス | `"email"` |
| 現在のパスワード | `"current-password"` |
| 新しいパスワード | `"new-password"` |
| 表示名 (given name) | `"given-name"` |
| 確認コード (one-time) | `"one-time-code"` |

数値専用フィールド (TOTP コード等):

```tsx
<TextField
  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
/>
```

### 7.4 検証 (validation)

- **submit 前**にクライアントサイドで検証 (空欄、形式、強度)
- エラーは TextField の `error={Boolean(...)} helperText={...}` で同所表示
- フォーム全体に関わるエラーは Alert で上部に表示
- パスワード強度: `passwordValidation.ts` の `validatePasswordStrength()` を全画面で共通使用

### 7.5 Hover state 仕様

すべての interactive 要素は **明確な hover feedback** を持つ:

| 要素 | hover 時の変化 | duration |
|---|---|---|
| Button (contained) | bg color = primary dark variant、shadow 1 段アップ (`shadows.md`) | 150ms ease-in-out |
| Button (outlined) | border color = primary 400 → 600、bg = primary 50 (薄塗り) | 150ms ease-in-out |
| Button (text) | bg = `action.hover` (theme 経由、light=primary 50 相当 / dark=neutral 800 相当) | 150ms ease-in-out |
| IconButton | bg = `action.hover` 円形に | 150ms |
| Card (clickable) | shadow `sm` → `md` (theme override 済) | 200ms |
| Link | underline 表示、color は変化なし | 150ms |
| ListItem (clickable) | bg = `action.hover` | 150ms |
| Tab (unselected) | text color が text.primary に近づく | 150ms |
| TextField (rest → hover) | border color = primary 400 (theme override 済)、focus 前の hint | 150ms |
| Chip (clickable) | shadow わずか + bg 濃く | 150ms |

非 interactive 要素 (Typography 単独、Box、Card display-only) には **hover 変化を付けない**。

### 7.6 Focus state 仕様

キーボード操作時のみ表示 (マウスクリック後は出さない、`:focus-visible` を活用):

- 全 interactive 要素: 2px solid `primary.main` の outline、`outline-offset: 2px`
- `src/styles/globals.css` の `:focus-visible` 定義済
- IconButton: 円形 ripple は MUI 標準を維持、focus ring は outline で出す
- 認証画面 / Dialog の最初の input は `autoFocus` で初期 focus

### 7.7 Pressed (active) state 仕様

- Button: わずかな scale (0.98) と shadow 弱化 で **押下感** を表現
- IconButton: MUI 標準の ripple animation を活用 (ボタン色相と同系の波紋)
- Theme override で全 Button の `&:active` に `transform: scale(0.98)` を追加するのが望ましい (現状未実装、Sprint 6 Phase 2 で検討)

### 7.8 Page-level transitions (画面遷移時のフィードバック)

- 認証フロー: 画面切替時は **アニメーションなし**、即座に新画面表示 (§6.13.1)
- Dialog: MUI の Grow (scale + opacity、300ms) を維持
- AgentBar の hover menu: 0.4s cubic-bezier(0.16, 1, 0.3, 1) snappy out (signature motion)
- ロード後の data 表示: Skeleton → 実 UI の transition は **explicit な fade-in を入れない** (MUI が滑らかに reflow するため、追加アニメは過剰)

### 7.9 共通 transition プロパティ (タッチデバイス対応)

```tsx
// すべての interactive 要素
sx={{
  transition: 'all 150ms ease-in-out',
  // タッチデバイスでは :hover が常時発火する問題を回避
  '@media (hover: hover)': {
    '&:hover': { /* hover styles */ }
  }
}}
```

- `@media (hover: hover)` でタッチデバイスでの誤発火を防ぐ
- 既存コードで未対応の箇所が多い、Sprint 6 範囲外で別途整備

---

## 8. アクセシビリティ

### 8.1 必須対応

- **すべてのアイコンボタンに `aria-label` または `title`**
  - 良: `<IconButton aria-label="メニューを閉じる" title="閉じる" onClick={...}>`
  - 不可: `<IconButton onClick={...}><CloseIcon /></IconButton>` (ラベル無し)
- **Alert role**: error → `role="alert"`、success → `role="status"`、`aria-live="polite"` 必須
- **ローディングインジケータ**: `<CircularProgress aria-label="..." />`
- **フォーム input**: TextField の `label` プロパティで accessible name を確保
- **タイトル階層**: 1 画面に `h1` 1 つ (AuthLayout で実現)、それ以下は h2/h3/...
- **focus visible**: MUI のデフォルト focus ring を無効化しない

### 8.2 推奨対応

- スクリーンリーダー向けに `data-testid` も併用 (テスト + a11y)
- Skip link は本リリースでは未対応 (Track E 以降で Tauri 化と同時に検討)
- 色だけで意味を伝えない (`severity="error"` の Alert にはアイコンも付く)

### 8.3 disabled の代替表現

`disabled` 状態を伝える時、色を薄くするだけでなく:
- 状態の理由を tooltip で説明
- 「準備中」「サインインが必要」等の補足を `helperText` または隣接 Typography で

---

## 9. 設定 UI のスコープ判断ルール

設定項目を UI に出すかどうか、出すならどの画面に置くかを決めるルール。

### 9.1 クラウド同期する設定 (アカウント全体、複数デバイス間で共有)

`useUserSettings` / `useLLMSettings` で DynamoDB に保存される:

| 設定 | UI 配置先 | 注意 |
|---|---|---|
| `displayName` | ProfileScreen「表示名の変更」 | Cognito UserAttribute と DynamoDB の両方 |
| `theme` (light/dark) | ProfileScreen「外観 (Theme)」 | 既存 ThemeProvider と結線、未認証時は localStorage |
| `language` | (本リリース未対応、i18n 本実装後に追加) | hook は持つが UI 化しない、disabled `"日本語 (固定)"` 表示で説明 |
| `mfaEnabled` | ProfileScreen「多要素認証 (MFA)」 | Cognito の状態と一致 (`fetchMfaStatus()` で読む) |
| `preferredModel` | LLMSettingsDialog「クラウド同期設定」 | フレンドリー名で Select、freeSolo 禁止 |
| `mtpEnabled` | LLMSettingsDialog「クラウド同期設定」(`"LLM 高速化 (推奨)"` ラベル) | MTP 文言は禁止 |
| `fallbackModels[]` | **本リリースでは UI 出さない** | hook と schema は保持、UI は将来 (リカバリ機構が必要な場合のみ) |
| `customApiKeys` | **本リリースでは UI 出さない** | encrypted handling 完成後に追加検討 |

### 9.2 ローカルのみの設定 (デバイス固有)

`LLMSettingsDialog` のローカルバックエンド API 経由 (`getLLMSettings()` / `updateLLMSettings()`):

| 設定 | UI 配置先 |
|---|---|
| LLM Adapter (gemini/openvino/ollama 切替) | LLMSettingsDialog「プロバイダー (Adapter)」 |
| temperature / max_tokens | LLMSettingsDialog (gemini 以外で表示) |
| Hugging Face モデルダウンロード | LLMSettingsDialog 内の専用セクション |
| プラグイン個別 config | LLMSettingsDialog の plugin section |

### 9.3 設定追加時の判断フロー

```
新しい設定項目を増やしたい
  │
  ├─ ユーザーが**実際に変えたい/見たい**か?
  │   └─ いいえ → そもそも UI に出さない (config として hard-code する)
  │
  ├─ 複数デバイス間で同じ値であるべきか?
  │   ├─ はい → DynamoDB スキーマに追加 (useUserSettings/useLLMSettings 経由)
  │   └─ いいえ → ローカル設定として LLMSettingsDialog や localStorage に
  │
  └─ 機密性は?
      ├─ パスワード/API キー → encrypted handling 完了まで UI 出さない
      └─ 通常 → そのまま配置
```

### 9.4 UI 配線ルール (Dead UI 防止)

新しいコントロール (input / select / switch / checkbox) を画面に置く時、**必ず**:

1. **state**: useState または hook で値を保持
2. **change handler**: onChange で state を更新
3. **submit handler**: 何らかのバックエンドへ実際に送信される or localStorage に書く
4. **読み戻し**: 初回 mount で既存値を fetch して state に反映

3 のいずれかが欠けたら、その UI は **追加してはいけない** (実装が揃うまで delete してメニューからも外す)。

例: LoginScreen の `rememberMe` チェックボックスは state と change handler はあったが
**送信時に値が使われない** ため Sprint 6 で削除対象 (`docs/9_UI_AUDIT.md` 参照)。

---

## 10. 新 UI 追加時の checklist (再発防止)

PR レビュー時、PR 作成時、self-review 時、以下を確認:

### 用語チェック

- [ ] 内部用語が混入していないか? (Sprint / Slice / DynamoDB テーブル名 / MTP / Speculative Decoding / cloud_proxy / Cognito 等)
- [ ] §2 の禁止語彙表に該当する語が user-facing string に存在しないか
- [ ] CONCEPTS.md の「Plugin / Skill」用語と一致しているか
- [ ] エラーメッセージが日本語で、原因→対処の形で書かれているか (`mapAuthError()` のような変換を経ているか)

### 機能リンクチェック

- [ ] すべての input/select/switch/checkbox の値が **実際にバックエンドに反映** されるか
- [ ] 「準備中」「実装中」の placeholder メニュー項目を出していないか (実装が揃うまで出さない)
- [ ] hook が hooks ディレクトリにあるのに UI 配線がゼロの状態を作っていないか
  (`useUserSettings` のような例を増やさない)

### 視覚的一貫性

- [ ] MUI Typography variant を §3 表通りに使っているか
- [ ] StatTone (`neutral/positive/warning/critical`) を Alert severity と統一しているか
- [ ] 色を theme 経由で指定しているか (ハードコード `#xxx` 禁止、`text.primary` / `error.main` 等)
- [ ] Stack spacing が §5 表通りか (関連項目 1, フィールド間 2, セクション間 3)
- [ ] subtitle が title から自明な内容を繰り返していないか (`subtitle="メールアドレスでログイン"` のような重複を作らない)

### コンポーネント再利用

- [ ] 認証画面なら `AuthLayout` を使っているか
- [ ] 統計カードなら `StatCard` を使っているか (KnowledgeBase common から import)
- [ ] エラー/成功 Alert は §6.4 のテンプレ通りか (`role` + `aria-live` 含む)
- [ ] destructive action なら 2 段階確認 Dialog のテンプレを採用しているか
- [ ] ローディングは構造的 Skeleton or ボタン内 CircularProgress を使っているか

### アクセシビリティ

- [ ] すべての IconButton に `aria-label` or `title` がついているか
- [ ] フォームの TextField に `autoComplete` 属性が指定されているか
- [ ] Alert role="alert"/"status" + aria-live="polite" がついているか
- [ ] focus 順序が DOM 順で自然か (特殊な tabIndex を入れていないか)

### 過剰チェック

- [ ] subtitle が冗長になっていないか (§2 ボイス参照)
- [ ] helperText が input から自明な内容を書いていないか
- [ ] 2 段階確認以外で過剰な確認ステップを増やしていないか
- [ ] 設定項目を必要以上に増やしていないか (§9.3 の判断フロー)

---

## 11. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — 全体引き継ぎ
- [docs/CONCEPTS.md](CONCEPTS.md) — Plugin / Skill / MCP / Adapter / MTP の定義 (ユーザー向けと内部向けの線引き)
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 全体仕様
- [docs/8_TRACK_D_SPRINT_PLAN.md](8_TRACK_D_SPRINT_PLAN.md) — Track D + Sprint 6 計画
- [docs/9_UI_AUDIT.md](9_UI_AUDIT.md) — 本設計書を判定基準とした既存 UI 監査レポート

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-14 | 初版 (Sprint 6 Phase 1A、既存コードから reverse-engineer して明文化) |
| 2026-05-15 | 視覚スタイル詳細仕様を追加: §4.5 フルカラースケール / §4.6 Border radius / §4.7 Shadow & elevation / §4.8 Motion (transition/easing/duration) / §4.9 Z-index、§5.5-§5.6 8px グリッド + per-component padding、§6.9 Button anatomy + state + animation、§6.10 Tab パターン (pill/標準/vertical)、§6.11 Card/Dialog エッジ&シャドウ、§6.12 Hover menu (AgentBar signature pattern)、§6.13 画面遷移表現、§6.14 ローディング・レンダリング中表現の詳細、§7.5-§7.9 hover/focus/pressed/page transition の state spec |
