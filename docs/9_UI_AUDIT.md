# 9. UI 監査レポート (Sprint 6 Phase 1B)

> [docs/10_UI_DESIGN_SYSTEM.md](10_UI_DESIGN_SYSTEM.md) を判定基準として、Track D で追加された UI
> + 既存 UI 全体を点検した結果。優先度 P0/P1/P2 で分類し、Sprint 6 Phase 2-4 の修正対象を特定する。
>
> 監査時点: 2026-05-14、mushitaro/main HEAD = 598edd3 (PR #78 マージ後)

---

## 0. 監査範囲と方法

### 対象

| カテゴリ | ファイル | 行数 |
|---|---|---:|
| Track D 認証 | `src/components/Auth/{LoginScreen,SignUpScreen,ConfirmEmailScreen,RequestPasswordResetScreen,ResetPasswordWithCodeScreen,MfaSetupScreen,ProfileScreen,AuthLayout,AuthGuard}.tsx` | ~1,500 |
| Track D クラウド設定 | `src/components/AIAssistant/components/CloudLLMSettingsSection.tsx` | ~150 |
| 既存統合 | `src/components/AgentBar/AgentBar.tsx` (Track D で profile/MFA 配線), `src/components/AIAssistant/components/LLMSettingsDialog.tsx` | ~28,000 + 537 |
| Plugin/Skill 系 | `src/components/PluginManager/PluginManager.tsx`, `src/components/SkillRunner/SkillRunner.tsx`, `src/components/UpdateNotification/UpdateNotification.tsx` | 302 + 600 + 200 |
| ナレッジベース | `src/components/KnowledgeBase/{Dashboard,RuleEditor,MasterMapView,MappingSimilaritySearch,PatternViews,LoRAAdapterManager,TrainingCacheView,LearningHistoryView,KnowledgeBasePage,common,hooks}.tsx` | ~7,500 |

### 用語: エンドユーザー UI vs 管理者 UI

監査の厳しさを区別するため:

- **エンドユーザー UI** (= 全ユーザーが触る): Auth 全画面、ProfileScreen、AgentBar、CloudLLMSettingsSection
  → docs/10 の用語ルールを**厳格に**適用 (内部用語ゼロ許容)
- **管理者 UI** (= 設定者・運用者が触る): KnowledgeBase 9 画面、PluginManager、SkillRunner、LLMSettingsDialog のローカル設定部分
  → 用語ルールは**緩和** (`task_type` / `regex_pattern` / `LoRA` / `Project Mu` 等のドメイン用語は許容)。ただし dead UI / accessibility / 過剰文言 のルールは同じく適用

### 優先度

- **P0**: 設計書の必須ルール違反、ユーザーに誤解を与える、機能リンク切れ。Sprint 6 で必ず修正
- **P1**: 一貫性違反、UX の手戻り要因。Sprint 6 で可能なら修正
- **P2**: 将来改善 (Track E 以降)、または意図的保留

---

## 1. Track D エンドユーザー UI

### 1.1 LoginScreen.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| L-1 | [LoginScreen.tsx:50,222-231](src/components/Auth/LoginScreen.tsx#L222) | `rememberMe` チェックボックスが state 更新するだけで `signIn()` に渡されない。完全な dead UI | §9.4 UI 配線ルール | **P0** | チェックボックスごと削除。amplify v6 は内部でセッション保持するため、ユーザー操作不要 |
| L-2 | [LoginScreen.tsx:99-103](src/components/Auth/LoginScreen.tsx#L99) | エラーメッセージに `"...Sprint 5 以降で対応予定です。"` という内部用語 | §2 禁止語彙 | **P0** | `"未対応の認証方式が必要です。サポートに連絡してください。"` に置換、Sprint 言及削除 |
| L-3 | [LoginScreen.tsx:217](src/components/Auth/LoginScreen.tsx#L217) | subtitle `"メールアドレスとパスワードでログイン"` が title 「ログイン」から自明 | §6.1 subtitle のルール / §2 過剰禁止 | P1 | subtitle 削除 (title だけで十分) |
| L-4 | [LoginScreen.tsx:189](src/components/Auth/LoginScreen.tsx#L189) | MFA challenge stage の subtitle `"認証アプリで生成した 6 桁コードを入力してください (${email})"` は妥当だが「認証アプリで生成した」が長い | §2 ボイス | P2 | `"認証アプリの 6 桁コードを入力 (${email})"` 程度に短縮、現状でも許容 |

### 1.2 SignUpScreen.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| S-1 | [SignUpScreen.tsx:88](src/components/Auth/SignUpScreen.tsx#L88) | subtitle `"HOSHUTARO アカウントを作成します"` が title 「新規登録」と AuthLayout 内のロゴ HOSHUTARO から自明 | §6.1 subtitle | P1 | subtitle 削除、または `"無料でアカウントを作成"` のような付加情報に置換 |

### 1.3 ConfirmEmailScreen / RequestPasswordResetScreen / ResetPasswordWithCodeScreen

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| C-1 | (全般) | 認証コード入力の `inputProps` に `autoComplete="one-time-code"` を付けていない可能性。設計書 §7.3 のルール | §7.3 input 補助 | P1 | 監査時に確認、必要なら追加 |
| C-2 | ResetPasswordWithCodeScreen → AuthGuard で `setScreen('login')` 遷移時に `pendingEmail` が捨てられ、再ログインで auto-fill されない | §6.1 UX (継続性) | P2 | LoginScreen に `defaultEmail` prop を追加検討、ただし小型 UX なので Sprint 6 では保留可 |

### 1.4 MfaSetupScreen.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| M-1 | [MfaSetupScreen.tsx:204](src/components/Auth/MfaSetupScreen.tsx#L204) | AuthLayout subtitle `"認証アプリで QR コードをスキャンして 6 桁コードを入力してください"` が本文と重複 (本文に同じ説明 + 認証アプリ例 4 つ) | §6.1 subtitle / §2 過剰禁止 | P1 | subtitle を `"認証アプリで QR をスキャン"` 程度に短縮 |
| M-2 | [MfaSetupScreen.tsx:113](src/components/Auth/MfaSetupScreen.tsx#L113) | 本文「Google Authenticator、Microsoft Authenticator、1Password、Authy などの TOTP 対応アプリを使用してください。」: ブランド列挙 4 つは冗長気味、また `TOTP` という略語 | §2 禁止語彙 (TOTP) / §2 ボイス | P1 | `"認証アプリ (Google Authenticator / Authy など) で 6 桁コードを生成します。"` 程度に統合、TOTP は使わない |

### 1.5 ProfileScreen.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| P-1 | [ProfileScreen.tsx:368](src/components/Auth/ProfileScreen.tsx#L368) | データ管理セクション本文 `"UserSettings / LLMSettings / SyncMetadata のクラウド保存内容を JSON で..."` で DynamoDB テーブル名露出 | §2 禁止語彙 | **P0** | `"アカウント設定とクラウド同期データを JSON でダウンロードします。"` に置換 |
| P-2 | [ProfileScreen.tsx:332-345](src/components/Auth/ProfileScreen.tsx#L332) | MFA 「現在の状態: 無効」section の本文が長く、MfaSetupScreen に同じ説明あり | §2 ボイス過剰 | P1 | `"ログイン時の追加認証 (TOTP) を有効化できます。"` 程度に短縮 |
| P-3 | [ProfileScreen.tsx:380-385](src/components/Auth/ProfileScreen.tsx#L380) | 「アカウント削除」本文 `"Cognito アカウントと、クラウドに保存されている全データを完全に削除します。"` で `Cognito` 露出 | §2 禁止語彙 | **P0** | `"アカウントと、クラウドに保存されている全データを完全に削除します。"` に置換 |
| P-4 | (全体) | useUserSettings の theme/language を扱う UI セクションがゼロ。hook は実装済 (`src/hooks/useUserSettings.ts`) だが配線が無い | §9.4 UI 配線ルール (逆: hook はあるが UI が無い) | **P0** | Phase 3A で ProfileScreen に「外観 (Theme)」セクションを追加。Language はもし i18n 着手未定なら **hook と schema を削る**判断もあり |
| P-5 | [ProfileScreen.tsx:36-43](src/components/Auth/ProfileScreen.tsx#L36) | JSDoc コメント内に「Slice D-3」「Sprint 4 で user-management Lambda 実装後に追加」等の Sprint/Slice 言及。コードコメントでありユーザー非影響だが、Track D 完了後はリファクタ候補 | §2 (用語、コードコメント) | P2 | コードコメントなので保留可。Track D 完了マーカーとして残してもよい |
| P-6 | [ProfileScreen.tsx:419](src/components/Auth/ProfileScreen.tsx#L419) | アカウント削除最終確認 DialogContentText `"これが最終確認です。「アカウントを削除する」を押すと即座に削除処理が実行されます。"` で「即座に」は強調しすぎ | §2 ボイス | P2 | `"「アカウントを削除する」を押すと削除処理が実行されます。この操作は取り消せません。"` |
| P-7 | [ProfileScreen.tsx:471](src/components/Auth/ProfileScreen.tsx#L471) | MFA 無効化最終確認 `"あとから再度有効化することもできます。"` は正確だが、強調文 `"これが最終確認です。"` の直後にあり tone がチグハグ | §6.3 確認ダイアログ | P2 | `"「MFA を無効化する」を押すと TOTP 設定が削除されます。"` (再有効化可能の補足は confirm1 stage 側に移動) |

### 1.6 CloudLLMSettingsSection.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| CL-1 | [CloudLLMSettingsSection.tsx:140](src/components/AIAssistant/components/CloudLLMSettingsSection.tsx#L140) | ラベル `"MTP (Speculative Decoding) を有効化"` で MTP / Speculative Decoding という専門用語をエンドユーザー向けに使用 | §2 禁止語彙 | **P0** | `"LLM 高速化 (推奨)"` + 補助 caption `"対応モデルで応答が最大 3 倍速くなります"` に置換 |
| CL-2 | [CloudLLMSettingsSection.tsx:122-135](src/components/AIAssistant/components/CloudLLMSettingsSection.tsx#L122) | `KNOWN_CLOUD_MODELS = ['cloud_claude_3_5_sonnet', 'cloud_claude_3_haiku']` を Autocomplete freeSolo で表示。**ユーザーがモデル ID を直接入力する形** | §2 禁止語彙 (モデル ID 内部識別子) | **P0** | `<Select>` に変更、`{ id: 'cloud_claude_3_5_sonnet', label: 'Claude 3.5 Sonnet (クラウド)' }` の mapping。registry.py の LLM_MODELS を mirror または直接 fetch |
| CL-3 | [CloudLLMSettingsSection.tsx:130](src/components/AIAssistant/components/CloudLLMSettingsSection.tsx#L130) | helperText `"ログイン中のアカウントで既定として使う LLM モデル ID。空欄なら未設定。"` が長く、`モデル ID` の露出 | §2 ボイス過剰 / §2 禁止語彙 | P1 | helperText 削除 (Select 化で自明)、または `"既定のモデル"` 程度 |
| CL-4 | [CloudLLMSettingsSection.tsx:30-38](src/components/AIAssistant/components/CloudLLMSettingsSection.tsx#L30) | JSDoc に `"Slice 2-C"` / `"Sprint 5 で encrypted handling 整備後に拡張"` の言及 | §2 (コードコメント、ユーザー非影響) | P2 | 保留 (コードコメント) |
| CL-5 | [CloudLLMSettingsSection.tsx:117](src/components/AIAssistant/components/CloudLLMSettingsSection.tsx#L117) | セクション全体を `border` で囲んでいるだけで「ローカル設定 / クラウド設定」の概念分離が弱い (LLMSettingsDialog 内で並ぶ) | §6 構造的一貫性 | P1 | LLMSettingsDialog 全体を Tabs (ローカル/クラウド) 化、または subtitle2 を larger に。Phase 4D で検討 |

### 1.7 AuthLayout / AuthGuard (構造)

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| A-1 | [AuthGuard.tsx](src/components/Auth/AuthGuard.tsx) (全般) | 概ね設計通り。`pendingEmail` の状態管理は妥当 | — | — | 問題なし |
| A-2 | (全般) | SignUp → ConfirmEmail 成功後の MFA 設定促し画面が無い (docs/7 では「サインアップ後に MFA セットアップを促進 (オプション)」とある) | docs/7 設計との乖離 | P2 | Sprint 6 範囲外、将来 Sprint で扱う |

---

## 2. Track D 既存統合 UI

### 2.1 AgentBar.tsx (Track D で追加した部分)

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| AB-1 | [AgentBar.tsx:506](src/components/AgentBar/AgentBar.tsx#L506) | 「外部連携」メニュー項目が `onClick={() => { alert('Maximo等の外部API連携設定画面（準備中）'); setShowToolsMenu(false); }}` で **placeholder alert** | §6.8 disabled state / §9.4 UI 配線ルール | **P0** | メニューから完全削除 (maximo-proxy Lambda は mock 実装で UI 設定画面が未着手のため、実装が揃うまで出さない) |
| AB-2 | [AgentBar.tsx:503-525](src/components/AgentBar/AgentBar.tsx#L503) | ツールメニューに「LLM設定 / 外部連携 / スキル設定 / MCP管理 / ナレッジベース / プロフィール / サインアウト」が並ぶ。設定系とアカウント系の境界が弱い | §6.7 メニュー区切り | P1 | プロフィール/サインアウトの前に menu-separator を入れる |
| AB-3 | [AgentBar.tsx:507](src/components/AgentBar/AgentBar.tsx#L507) | 「MCP管理」というメニューラベルが内部用語 `MCP` を使用 | §2 禁止語彙 | **P0** | `"プラグイン管理"` に変更 (PluginManager 自体のタイトルと一致) |
| AB-4 | [AgentBar.tsx:506](src/components/AgentBar/AgentBar.tsx#L506) | 「外部連携」がそもそもユーザー向けに必要かは未確定 | §9.3 設定追加判断 | P2 | 削除後、本実装着手時に再追加 (本実装時は「Maximo 連携設定」等の具体名に) |

### 2.2 LLMSettingsDialog.tsx (既存、Track D で CloudLLMSettingsSection を冒頭に統合)

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| LD-1 | [LLMSettingsDialog.tsx:368](src/components/AIAssistant/components/LLMSettingsDialog.tsx#L368) | CloudLLMSettingsSection が冒頭にあり、その下にローカル設定 (Provider / Temperature / HF download) が続く。**概念分離が border 1 本のみ** | §6 構造的一貫性 | P1 | Tabs 化検討 (`<Tab>クラウド設定</Tab><Tab>ローカル設定</Tab>`) — 設定の責任範囲をユーザーが理解しやすくなる |
| LD-2 | [LLMSettingsDialog.tsx:402-410](src/components/AIAssistant/components/LLMSettingsDialog.tsx#L402) | gemini 選択時の説明文 `"HOSHUTAROエージェント（Gemini）の設定です。 ※ 内部で最適化されたパラメータを使用するため、詳細設定は必要ありません。 ※ サブスクリプション化を見据え、APIキーの表示・編集は行えません。"` が長く、※ 多用 | §2 ボイス過剰 | P1 | 1-2 行に統合、「サブスクリプション化を見据え」は内部の経営判断なので削除 |
| LD-3 | [LLMSettingsDialog.tsx:380](src/components/AIAssistant/components/LLMSettingsDialog.tsx#L380) | Select の MenuItem ラベル `"HOSHUTAROエージェント（Gemini）"` — ブランド名 + 技術名で長い | §2 ボイス | P2 | `"HOSHUTAROエージェント"` だけにする (Gemini はベンダー情報) or 内部 |
| LD-4 | LLMSettingsDialog 内 HF download セクション | OpenVINO 専用 UI が gemini 選択時にも残るかは未確認 (管理者向けなので問題低) | §6 構造 | P2 | 監査保留 (Phase 4D で確認) |

---

## 3. 既存 Plugin/Skill UI (管理者向け)

### 3.1 PluginManager.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| PM-1 | [PluginManager.tsx:103](src/components/PluginManager/PluginManager.tsx#L103) | `window.confirm(...)` でアンインストール確認。**ブラウザ標準 dialog は theme と一致せず**、a11y も劣る | §6.3 確認ダイアログ / §4 theme | **P0** | MUI Dialog に置換 (1 段階で OK、再 install 可能なので 2 段階は不要) |
| PM-2 | [PluginManager.tsx:115,142](src/components/PluginManager/PluginManager.tsx#L115) | `getStatusLabel` の `'起動中' / '停止' / 'エラー' / 'インストール中'` は良いが、`default: return status` で **生の英語 status が漏れる可能性** | §2 ボイス | P1 | default に `"不明"` を返す or undefined ガードを追加 |
| PM-3 | [PluginManager.tsx:222,254](src/components/PluginManager/PluginManager.tsx#L222) | License chip `'Premium' / 'Free'` は英語 | §2 ボイス | P2 | ブランド用語として許容、または `'プレミアム' / '無料'` に揃える判断 |
| PM-4 | [PluginManager.tsx:75-77](src/components/PluginManager/PluginManager.tsx#L75) | エラーメッセージ `"APIへの接続に失敗しました。サーバーが起動しているか確認してください。"` は妥当 (管理者向け) | — | — | 問題なし |
| PM-5 | [PluginManager.tsx:1-7](src/components/PluginManager/PluginManager.tsx#L1) | JSDoc `"Phase 4B: インストール済み / 利用可能 の2タブ構成"` は内部開発フェーズ言及。コードコメントなのでユーザー非影響 | §2 (コメント) | P2 | 保留 |
| PM-6 | [PluginManager.tsx:236](src/components/PluginManager/PluginManager.tsx#L236) | アンインストール IconButton に `title="アンインストール"` のみ、`aria-label` 無し | §8.1 必須対応 | P1 | `aria-label="${plugin.name} をアンインストール"` 追加 |
| PM-7 | (全般) | Chip の category color logic がインラインで散在 (`plugin.category === 'connector' ? 'primary' : 'llm-adapter' ? 'secondary' : 'default'`) | DRY | P2 | 関数化、または `getCategoryColor()` ヘルパ |

### 3.2 SkillRunner.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| SR-1 | [SkillRunner.tsx](src/components/SkillRunner/SkillRunner.tsx) ログ表示部 | `bgcolor: '#0a0a0a'` / `borderColor: '#1a1a1a'` の**色ハードコード** | §4 カラー (theme 経由必須) | **P0** | `bgcolor: 'grey.900'` (dark theme で適切) または theme variable に置換 |
| SR-2 | [SkillRunner.tsx:1-5](src/components/SkillRunner/SkillRunner.tsx#L1) | JSDoc `"Phase 4C"` | §2 (コメント) | P2 | 保留 |
| SR-3 | Skill 一覧の空状態未確認 (Skill が 0 件の場合の表示) | §6.6 空状態 | P1 | 監査時にコード確認、無ければ Empty state 追加 |

### 3.3 UpdateNotification.tsx

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| UN-1 | [UpdateNotification.tsx:1-7](src/components/UpdateNotification/UpdateNotification.tsx#L1) | JSDoc `"Phase 4D"` | §2 (コメント) | P2 | 保留 |
| UN-2 | (全般) | `UpdateNotification.css` を併用 (MUI sx ではなく CSS) | §3-4 一貫性 | P2 | MUI sx 化検討 (将来) |
| UN-3 | (全般) | 機能リンク・通知文言は妥当 (`"プラグインの更新があります"` 等) | — | — | 問題なし |

---

## 4. KnowledgeBase 9 画面 (管理者向け)

### 4.1 全体

`KnowledgeBase/common.tsx` の StatCard / SectionHeader / InlineError / EmptyState 等の共通基盤を**ほぼすべての画面が使っており**、内部一貫性は他カテゴリより高い。

| ID | 場所 | 症状 | 違反原則 | 優先度 | 推奨修正 |
|---|---|---|---|---:|---|
| KB-1 | [Dashboard.tsx:54](src/components/KnowledgeBase/Dashboard.tsx#L54) | description `"Project Mu 全層の統計サマリ。30秒ごとに自動更新します。"` で内部コードネーム `Project Mu` 露出 | §2 禁止語彙 (管理者向けでも社外ブランドは要検討) | P1 | `"ナレッジベースの統計サマリ。30秒ごとに自動更新します。"` (Project Mu は社内開発コードネームのため外向きには不要) |
| KB-2 | [Dashboard.tsx:62](src/components/KnowledgeBase/Dashboard.tsx#L62) | Alert `"Mu サブシステムの一部が利用できません。"` で `Mu` 露出 | §2 禁止語彙 | P1 | `"一部の機能が利用できません。詳細はヘルスチェックを確認してください。"` |
| KB-3 | [KnowledgeBasePage.tsx:53-63](src/components/KnowledgeBase/KnowledgeBasePage.tsx#L53) | Tab ラベル `"Location 分析"` `"Classification 分析"` `"LoRA 管理"` で英語ドメイン語 | §2 (管理者 UI 緩和適用、ドメイン用語として許容) | P2 | 管理者は Maximo の "Location" / "Classification" カラム名に親しんでいるため許容。ただし `LoRA` は Plugin 用語との一貫性を考慮 |
| KB-4 | [RuleEditor.tsx:104](src/components/KnowledgeBase/RuleEditor.tsx#L104) | description `"フェーズ1 で蒸留されたルールの手動補正"` で内部パイプライン用語 `フェーズ1` / `蒸留` | §2 (管理者向け、ドメイン語として一部許容) | P1 | `"パイプラインで抽出されたルールの手動補正、新規追加、有効/無効切替。"` (蒸留 = distillation はドメイン語として残せるが、ユーザーが理解できる表現が望ましい) |
| KB-5 | [RuleEditor.tsx:318,331,342,351](src/components/KnowledgeBase/RuleEditor.tsx#L318) | フォームの TextField label が **DB カラム名そのもの** (`task_type`, `instruction_text（必須）`, `regex_pattern（任意）`, `confidence`) | §2 ボイス (管理者向けでも friendly label が望ましい) | P1 | `"タスク種別"` `"指示文（必須）"` `"正規表現パターン（任意）"` `"信頼度"` に置換 |
| KB-6 | [RuleEditor.tsx:242](src/components/KnowledgeBase/RuleEditor.tsx#L242) | description `"削除されたルールは復元できません。プロンプトキャッシュも次回呼び出し時に再構築されます。"` で **`プロンプトキャッシュ` という実装詳細** が露出 | §2 ボイス | P2 | `"削除されたルールは復元できません。"` (キャッシュ再構築はバックエンド責務、ユーザーに開示不要) |
| KB-7 | (全般) | 各画面の destructive action (削除) が 1 段階確認のみ。共通の ConfirmDialog コンポーネントを使っているか未確認 | §6.3 確認ダイアログ | P1 | 監査時に確認、軽量 destructive (個別ルール削除) は 1 段階で OK |
| KB-8 | (LoRAAdapterManager 等) | 詳細未監査。Phase 4C で確認 | — | — | (Phase 4C で詳細確認、見つかれば追記) |

---

## 4-bis. 横断的な視覚スタイル課題 (Phase 1A 拡張で追加)

docs/10 §4.5-§4.9 + §6.9-§6.14 + §7.5-§7.9 の視覚スタイル仕様を当てはめると、以下の横断的問題が判明:

### V-1 (P0): `src/index.css` の `* { color: #ffffff !important; }` グローバル上書き

| 場所 | 症状 | 違反原則 | 影響 |
|---|---|---|---|
| [src/index.css:21-23](src/index.css#L21) | `* { color: #ffffff !important; }` で**全要素のテキストを強制的に白固定** | §4 カラー (theme 経由) / §4.5 light/dark | **light theme が実質無効化** されている。`useUserSettings.theme: 'light'` を Phase 3A で配線しても、CSS の `!important` が勝つため切替不能。lightTheme で text.primary が `neutral.900` (#171717) になっていても、CSS が white で上書きする |

**推奨対応**: 別 Sprint で `src/index.css` を**全面リファクタ**:
- 全 `!important` を除去
- `* { color }` のような universal selector の text 上書きを廃止
- 必要な reset (margin/padding 0、box-sizing 等) のみ残す
- light/dark 切替は MUI `<ThemeProvider>` の palette に任せる

Sprint 6 範囲外 (大きい変更、Phase 3A の Theme UI 配線と組み合わせて別 PR 化が望ましい)。

### V-2 (P1): 独自 CSS ファイル (component-local) の MUI sx 化遅れ

| ファイル | 行数 | 問題 |
|---|---:|---|
| `src/components/AgentBar/AgentBar.css` | ~6,451 bytes | **AgentBar 専用 signature motion** を含むため一部は CSS のままで OK、ただし `border-radius: 20px` / `box-shadow: 0 8px 32px ...` 等の固有値は **theme トークンへの揃え**が望ましい |
| `src/components/PluginManager/PluginManager.css` | 158 bytes | ほぼ空、削除可能性あり |
| `src/components/SkillRunner/SkillRunner.css` | 150 bytes | ほぼ空、削除可能性あり |
| `src/components/UpdateNotification/UpdateNotification.css` | ~200 bytes | sx 化容易、Phase 4 で検討 |

### V-3 (P1): borderRadius / shadow のハードコード値の点在

docs/10 §4.6 で `borderRadius: 8` (lg) / `12` (xl) / `9999` (full) をスケール定義したが、実コードに以下のハードコードあり:

- `AgentBar.css` `border-radius: 20px` (frost glass surface) → 独自値、Tauri 化時に再評価
- `AgentBar.css` `border-radius: 12px` (`hover-menu-vertical`) → スケール内、OK
- `PluginManager.tsx:152` `Tabs sx={{ '& .MuiTab-root': { borderRadius: 4 } }}` → 4px は中間値、`borderRadius.md` (6px) にスケール内移行を推奨
- `PluginManager.tsx` `ListItem sx={{ borderRadius: 2 }}` → 16px (`borderRadius.2xl`)、現状妥当だが Card 階層との一貫性確認

**推奨**: Sprint 6 Phase 4 中に grep して棚卸し、`borderRadius.lg/xl/2xl/full` に統一できる箇所を整理。

### V-4 (P2): アニメーション duration / easing の表記揺れ

docs/10 §4.8 で 150/200/300ms + cubic-bezier(0.16, 1, 0.3, 1) を標準化したが、`AgentBar.css` 内に:

- `transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)` (signature motion、OK)
- `transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1)` (signature motion、ただし 400ms に統一可)
- `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`
- `transition: all 0.2s ease !important` ← `!important` 不要、`ease-in-out` に
- `transition: all 0.15s`

これらは **AgentBar の signature motion** として残してよいが、新規 motion 追加時は§4.8 ルールに従う。

### V-5 (P1): Button の pressed (active) state 未実装

docs/10 §7.7 で Button の active 時に `transform: scale(0.98)` を提案したが、現状の `src/theme/index.ts` の MuiButton override には未実装:

```ts
// src/theme/index.ts MuiButton styleOverrides
root: {
  // ...
  '&:hover': { boxShadow: shadows.sm }
  // ❌ '&:active': { transform: 'scale(0.98)', transition: 'transform 100ms' } が欠落
}
```

**推奨対応**: Sprint 6 Phase 4 で theme override に `&:active: { transform: 'scale(0.98)' }` を追加 (1 行)。

---

## 5. useUserSettings hook の UI 未配線 (P0、横断的問題)

[src/hooks/useUserSettings.ts](src/hooks/useUserSettings.ts) は Sprint 2-A で実装され、theme / language / mfaEnabled を DynamoDB と同期する完全な実装を持つが、**`__tests__/` 以外で参照しているコンポーネントが 0 件**。

具体的な未配線項目:
- `theme: 'light' | 'dark'` — 既存 ThemeProvider (`src/providers/ThemeProvider.tsx`) が localStorage `'theme-mode'` を使っており、Cloud sync と完全に独立している
- `language: 'ja' | 'en'` — i18n フレームワーク未導入、UI も無い
- `mfaEnabled` — ProfileScreen は `AmplifyAuthService.fetchMfaStatus()` を直接呼び出しており、DynamoDB の値は使われていない (実質 Cognito が正、DynamoDB は重複した記録)

### 推奨対応 (Phase 3A)

1. ProfileScreen に「外観 (Theme)」セクションを追加、`useUserSettings.theme` と `ThemeProvider.setTheme()` を結線
2. `language` は i18n 本実装まで UI 化しない (hook と schema は保持、`docs/10` §9.1 に「本リリース未対応」と明記済)
3. `mfaEnabled` は Cognito 側を正として DynamoDB 側の同期は post-confirmation Lambda がデフォルト false で書き、以降の更新は省略する判断 (= ProfileScreen で MFA を有効化したら DynamoDB も更新する別 PR が必要) — **Sprint 6 範囲外、保留**

---

## 6. 優先度別サマリ

### P0 (Sprint 6 で必ず修正、Phase 2-3)

| ID | 概要 | 修正先 | 想定 PR |
|---|---|---|---|
| L-1 | LoginScreen rememberMe dead UI 削除 | LoginScreen.tsx | S6-2B |
| L-2 | LoginScreen "Sprint 5..." 削除 | LoginScreen.tsx | S6-2A |
| P-1 | ProfileScreen "UserSettings/LLMSettings/SyncMetadata" → "アカウント設定とクラウド同期データ" | ProfileScreen.tsx | S6-2A |
| P-3 | ProfileScreen "Cognito アカウント" → "アカウント" | ProfileScreen.tsx | S6-2A |
| P-4 | ProfileScreen に Theme セクション追加 (useUserSettings 配線) | ProfileScreen.tsx + ThemeProvider | S6-3A |
| CL-1 | "MTP (Speculative Decoding)" → "LLM 高速化 (推奨)" | CloudLLMSettingsSection.tsx | S6-2A |
| CL-2 | LLM モデル選択を Autocomplete freeSolo → Select with friendly label | CloudLLMSettingsSection.tsx | S6-2C |
| AB-1 | AgentBar 「外部連携」placeholder alert 削除 | AgentBar.tsx | S6-2B |
| AB-3 | AgentBar 「MCP管理」→ 「プラグイン管理」 | AgentBar.tsx | S6-2A |
| PM-1 | PluginManager window.confirm → MUI Dialog | PluginManager.tsx | S6-4A |
| SR-1 | SkillRunner ハードコード色 → theme | SkillRunner.tsx | S6-4B |
| V-1 | `src/index.css` の `* { color: #ffffff !important; }` 除去 (light theme 復活) | src/index.css | **Sprint 6 範囲外、別 PR (Phase 3A と組合せ)** |

合計 12 件 P0 (うち V-1 は Sprint 6 範囲外で別途扱う)。

### P1 (Sprint 6 で可能なら修正、Phase 2-4)

| ID | 概要 |
|---|---|
| L-3 | LoginScreen subtitle 削除 |
| S-1 | SignUpScreen subtitle 削除/置換 |
| C-1 | autoComplete one-time-code の追加 |
| M-1 | MfaSetupScreen subtitle 短縮 |
| M-2 | MfaSetupScreen 本文の TOTP 用語削除と短縮 |
| P-2 | ProfileScreen MFA 説明短縮 |
| CL-3 | CloudLLMSettingsSection helperText 短縮 |
| CL-5 | LLMSettingsDialog 全体の Tabs 化 |
| AB-2 | AgentBar メニュー区切り追加 |
| LD-1 | LLMSettingsDialog ローカル/クラウドの Tabs 化 (CL-5 と統合検討) |
| LD-2 | LLMSettingsDialog gemini 説明文短縮 |
| PM-2 | PluginManager status default 値ガード |
| PM-6 | PluginManager IconButton に aria-label |
| KB-1 | Dashboard "Project Mu" 露出修正 |
| KB-2 | Dashboard "Mu サブシステム" 露出修正 |
| KB-4 | RuleEditor "フェーズ1 蒸留" 言い換え |
| KB-5 | RuleEditor フォーム label を friendly に |
| V-2 | 各 component CSS ファイル整理 (PluginManager.css / SkillRunner.css / UpdateNotification.css の sx 化、AgentBar.css は signature motion を残しトークン化) |
| V-3 | borderRadius ハードコード値棚卸し (PluginManager の `borderRadius: 4` を `md` に等) |
| V-5 | Button の active 時 `transform: scale(0.98)` を theme override に追加 (1 行) |

合計 20 件 P1。

### P2 (保留 / 将来 Sprint)

JSDoc 内の "Sprint X" / "Slice X-Y" 言及、Project Mu/Mu コードネーム、コードコメントの整理、AuthGuard の pendingEmail 引継ぎ、SignUp 後の MFA 促し画面、SkillRunner 空状態の確認、Plugin License Free/Premium の和訳判断、UpdateNotification.css → sx 化、KB 各画面の詳細監査続行 等。Sprint 6 範囲外、必要なら別 Sprint で。

---

## 7. Sprint 6 修正方針

### Phase 2 (Track D 致命修正)

- **PR S6-2A** (内部用語の言い換え): L-2, P-1, P-3, CL-1, AB-3 + LoginScreen, MfaSetupScreen, ProfileScreen の他文字列を docs/10 §2 用語マッピング表に従って一括見直し
- **PR S6-2B** (Dead UI 除去): L-1 (rememberMe), AB-1 (外部連携 placeholder)
- **PR S6-2C** (LLM モデル選択 UX): CL-2 (Select 化)
- **PR S6-2D** (過剰文言の整理): L-3, S-1, M-1, M-2, P-2, CL-3, LD-2

### Phase 3 (useUserSettings UI 配線)

- **PR S6-3A**: P-4 (ProfileScreen に Theme セクション、ThemeProvider と結線)

### Phase 4 (既存 UI 修正)

- **PR S6-4A** (PluginManager): PM-1 (Dialog 化), PM-2, PM-6
- **PR S6-4B** (SkillRunner): SR-1 (色ハードコード除去), SR-3 (Empty state 確認後)
- **PR S6-4C** (KnowledgeBase): KB-1, KB-2, KB-4, KB-5 (RuleEditor フォーム label)
- **PR S6-4D** (AgentBar/LLMSettingsDialog 構造): AB-2 (区切り), LD-1+CL-5 (Tabs 化検討)

### 保留 (P2)

- A-2 (SignUp 後の MFA 促し画面追加) — docs/7 設計には記載があるが、UX 価値が「強制ではない MFA セットアップ画面」の追加で薄いため Track E 以降に判断
- C-2 (LoginScreen の defaultEmail prop) — 小型 UX、優先度低
- 各 JSDoc 内 Sprint/Slice 言及 — コードコメントのため

---

## 8. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — 全体引き継ぎ
- [docs/10_UI_DESIGN_SYSTEM.md](10_UI_DESIGN_SYSTEM.md) — 判定基準となるデザイン設計書
- [docs/8_TRACK_D_SPRINT_PLAN.md](8_TRACK_D_SPRINT_PLAN.md) — Track D + Sprint 6 計画
- [docs/CONCEPTS.md](CONCEPTS.md) — Plugin / Skill / MCP / Adapter / MTP の用語定義

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-14 | 初版 (Sprint 6 Phase 1B、Track D + 既存 UI 全体監査、P0 11 件 + P1 17 件 + P2 多数を特定) |
| 2026-05-15 | §4-bis 視覚スタイル横断課題を追加 (V-1 ~ V-5、index.css の !important / 独自 CSS / borderRadius ハードコード / active state 未実装)。P0 12 件 + P1 20 件に更新 |
