# 7. 認証フローとユーザー管理

このガイドは保守太郎 (HOSHUTARO 次世代版) における **認証フロー、7 認証画面、ユーザーデータモデル** を定義します。

Track D の認証基盤 (Sprint 1) を実装する際の正式仕様。実装ロードマップは `.claude/plans/track-d-aws-cloud.md` 参照。

---

## 1. 認証スタック

- **認証プロバイダ**: AWS Cognito User Pool + Identity Pool
- **ログイン方式**: メール + パスワード
- **MFA**: TOTP (Time-based One-Time Password) — **Optional** (ユーザー任意)
- **セッション管理**: Cognito 発行の JWT (ID Token / Access Token / Refresh Token)
- **JWT 保存**: aws-amplify SDK が自動管理 (Web: secure cookie + localStorage、Tauri: keyring)
- **トークン更新**: aws-amplify が自動 refresh

---

## 2. ユーザーフロー (7 認証画面)

### 概要図

```
[未認証ユーザー]
       │
       ├──「ログイン」──→ (1) LoginScreen
       │                       │
       │                       ├─ 成功 ──────────────→ メインアプリ
       │                       ├─ MFA required ─────→ MFA コード入力
       │                       └─ 「パスワードを忘れた」──→ (4)
       │
       └──「新規登録」──→ (2) SignUpScreen
                              │
                              ├─ サインアップ ──→ (3) ConfirmEmailScreen
                              │                     │
                              │                     └─ 確認完了 ──→ メインアプリ
                              │                                       │
                              │                                       └─「MFA 設定」──→ (6) MfaSetupScreen
                              │
                              └─ キャンセル ──→ (1) LoginScreen


(4) RequestPasswordResetScreen
       │
       └─ メール送信成功 ──→ (5) ResetPasswordWithCodeScreen
                                  │
                                  └─ 新パスワード保存 ──→ (1) LoginScreen


[認証済みユーザー]
       │
       └──「プロフィール」──→ (7) ProfileScreen
                                  ├─ 表示: メール / 表示名 / MFA 状態
                                  ├─ 操作: パスワード変更 / MFA 設定変更 / アカウント削除 / データエクスポート
                                  └─ サインアウト
```

### 画面詳細

#### (1) LoginScreen — ログイン

**ファイル**: `src/components/Auth/LoginScreen.tsx`

**項目**:
- メールアドレス (input[type=email])
- パスワード (input[type=password])
- 「ログインを保持する」チェックボックス (Remember me)
- 「ログイン」ボタン
- 「パスワードを忘れた方」リンク → (4)
- 「新規登録」リンク → (2)

**動作**:
- バリデーション: メール形式、パスワード必須
- 成功時: メインアプリへリダイレクト (App.tsx)
- 失敗時 (UserNotConfirmedException): (3) へリダイレクト
- 失敗時 (NotAuthorizedException): "メールまたはパスワードが正しくありません"
- MFA required: TOTP 入力画面に切替 (Authenticator が自動処理)

#### (2) SignUpScreen — サインアップ

**ファイル**: `src/components/Auth/SignUpScreen.tsx`

**項目**:
- メールアドレス
- パスワード (二度入力)
- 表示名 (givenName) — 任意
- 利用規約 + プライバシーポリシー同意チェック
- 「新規登録」ボタン

**動作**:
- バリデーション:
  - メール形式
  - パスワード: 12 文字以上、大文字・小文字・数字・記号を含む
  - 2 つのパスワードフィールド一致
  - 利用規約同意必須
- 成功時: Cognito にユーザー作成 → (3) へ
- 失敗時 (UsernameExistsException): "このメールアドレスは既に登録されています"

#### (3) ConfirmEmailScreen — メール確認

**ファイル**: `src/components/Auth/ConfirmEmailScreen.tsx`

**項目**:
- メールアドレス (read-only)
- 6 桁の確認コード入力
- 「確認」ボタン
- 「コードを再送信」リンク

**動作**:
- バリデーション: 6 桁の数字
- 成功時:
  - Cognito post-confirmation trigger 発火 → DynamoDB に UserSettings レコード作成
  - 自動ログイン (Cognito が JWT 発行) → メインアプリへ
- 失敗時 (CodeMismatchException): "コードが正しくありません"

#### (4) RequestPasswordResetScreen — パスワードリセット要求

**ファイル**: `src/components/Auth/RequestPasswordResetScreen.tsx`

**項目**:
- メールアドレス
- 「リセットコードを送信」ボタン

**動作**:
- Cognito `forgotPassword` API 呼出し
- 成功時: 「コードを送信しました」表示 → (5) へ
- 失敗時 (UserNotFoundException): セキュリティ上の理由で具体的エラーは出さない (「コードを送信しました」と同じ表示)

#### (5) ResetPasswordWithCodeScreen — パスワードリセット (コード入力 + 新パスワード)

**ファイル**: `src/components/Auth/ResetPasswordWithCodeScreen.tsx`

**項目**:
- メールアドレス (read-only)
- 6 桁の確認コード
- 新しいパスワード (二度入力)
- 「リセット」ボタン

**動作**:
- バリデーション:
  - 6 桁の数字
  - パスワード強度チェック (SignUp と同じ)
- 成功時: (1) LoginScreen にリダイレクト、「パスワードを変更しました」フラッシュメッセージ
- 失敗時 (CodeMismatchException, ExpiredCodeException): 適切なエラーメッセージ

#### (6) MfaSetupScreen — MFA (TOTP) 設定

**ファイル**: `src/components/Auth/MfaSetupScreen.tsx`

**項目**:
- 説明文 (Google Authenticator 等のアプリ案内)
- QR コード表示 (`react-qr-code` 等)
- セットアップキー (手動入力用、テキスト表示)
- 認証アプリで生成された 6 桁コード入力
- 「MFA を有効化」ボタン
- 「スキップ」リンク (新規登録時のみ)

**動作**:
- Cognito `setUpTOTP` API → secret 取得 → QR 生成
- ユーザーが認証アプリで読み取り、6 桁コード入力
- `verifyTOTPSetup` 成功時:
  - MFA を user account に有効化
  - 既存の Cognito user `mfaSettingList: ['TOTP']` に更新
  - "MFA を有効にしました" 表示 → メインアプリへ

**MFA enable 後のログインフロー**:
- (1) LoginScreen で email + password 認証成功後、自動的に TOTP 入力画面 (Authenticator が表示)
- 6 桁コード入力 → 認証完了

#### (7) ProfileScreen — プロフィール / アカウント管理

**ファイル**: `src/components/Auth/ProfileScreen.tsx`

**項目** (表示):
- メールアドレス
- 表示名 (編集可)
- 表示名以外の userAttributes (read-only)
- MFA 状態 (有効 / 無効)
- アカウント作成日

**操作**:
- **表示名変更** — `updateUserAttributes`
- **パスワード変更** — 現パスワード + 新パスワード → `updatePassword`
- **MFA 設定変更**:
  - 無効 → 有効: (6) MfaSetupScreen
  - 有効 → 無効: 確認ダイアログ + パスワード再入力 → `setPreferredMFA('NOMFA')`
- **データエクスポート** — Lambda `user-management` の `exportUserData` 呼出し → JSON ダウンロード
- **アカウント削除** — 確認ダイアログ (2 段階) + パスワード再入力 → `user-management` の `deleteAccount` 呼出し → サインアウト
- **サインアウト** — `signOut()` → (1) LoginScreen へ

---

## 3. amplify/auth/resource.ts 設定 (Sprint 1 で実装)

```typescript
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from '../functions/post-confirmation-trigger/resource';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'HOSHUTARO 登録の確認',
      verificationEmailBody: (createCode) =>
        `下記の確認コードを入力してください: ${createCode()}\n\n` +
        `このメールに心当たりがない場合は無視してください。`,
    },
  },
  userAttributes: {
    email: { mutable: true, required: true },
    givenName: { mutable: true, required: false },
    familyName: { mutable: true, required: false },
  },
  triggers: {
    postConfirmation,
  },
});

// パスワードポリシー / MFA は Cognito User Pool レベルで CDK overrides:
// (本ファイル内では Amplify Gen2 の制約上、別途設定)
//
// 例:
// auth.resources.cfnResources.cfnUserPool.policies = {
//   passwordPolicy: {
//     minimumLength: 12,
//     requireUppercase: true,
//     requireLowercase: true,
//     requireNumbers: true,
//     requireSymbols: true,
//     temporaryPasswordValidityDays: 7,
//   },
// };
// auth.resources.cfnResources.cfnUserPool.mfaConfiguration = 'OPTIONAL';
// auth.resources.cfnResources.cfnUserPool.enabledMfas = ['SOFTWARE_TOKEN_MFA'];
```

---

## 4. ユーザーデータモデル (DynamoDB)

### 4.1 UserSettings

```typescript
// amplify/data/resource.ts
UserSettings: a.model({
  userId: a.string().required(),         // Cognito user.sub (owner)
  email: a.string(),                     // 表示用 (Cognito から同期)
  givenName: a.string(),
  familyName: a.string(),
  theme: a.string(),                     // 'light' | 'dark' | 'auto'
  language: a.string(),                  // 'ja' | 'en'
  mfaEnabled: a.boolean(),               // UI 表示用 (Cognito 側が真実)
  acceptedTermsVersion: a.string(),      // 利用規約バージョン (将来の更新通知用)
  createdAt: a.datetime(),
  updatedAt: a.datetime(),
}).authorization((allow) => [allow.owner()])
```

### 4.2 LLMSettings

```typescript
LLMSettings: a.model({
  userId: a.string().required(),
  preferredModel: a.string(),            // e.g. 'local_gemma_4_e2b_it', 'cloud_claude_3_5_sonnet'
  fallbackModels: a.string().array(),    // 順序付き fallback list
  mtpEnabled: a.boolean(),               // MTP のグローバル既定値
  thinkingModeEnabled: a.boolean(),
  customApiKeys: a.json(),               // { [provider: string]: secretArn } (Secrets Manager ARN)
  bedrockRegion: a.string(),             // 'ap-northeast-1' 等
  createdAt: a.datetime(),
  updatedAt: a.datetime(),
}).authorization((allow) => [allow.owner()])
```

### 4.3 SyncMetadata

```typescript
SyncMetadata: a.model({
  userId: a.string().required(),
  deviceId: a.string().required(),       // クライアント生成 UUID
  deviceName: a.string(),                // "MacBook Pro - Office" 等
  lastSyncedAt: a.datetime(),
  syncVersion: a.integer(),              // 楽観ロック用
  platform: a.string(),                  // 'tauri-windows' | 'tauri-macos' | 'web'
}).authorization((allow) => [allow.owner()])
```

業務データ (機器台帳、WorkOrder、LoRA training_cache 等) は **DynamoDB に置かない**。これらはローカル SQLite に閉じる。

---

## 5. 認証エラーハンドリング (一覧)

| Cognito Exception | フロント表示 | 画面 |
|---|---|---|
| `UserNotConfirmedException` | 「メール確認が必要です」 | (3) ConfirmEmailScreen へ自動遷移 |
| `NotAuthorizedException` | 「メールまたはパスワードが正しくありません」 | (1) ログイン画面で表示 |
| `UsernameExistsException` | 「このメールアドレスは既に登録されています」 | (2) サインアップ画面で表示 |
| `InvalidPasswordException` | 「パスワードが要件を満たしていません」 + 詳細 | (2)/(5) で表示 |
| `CodeMismatchException` | 「確認コードが正しくありません」 | (3)/(5) で表示 |
| `ExpiredCodeException` | 「コードの有効期限が切れています。再送信してください」 | (3)/(5) で表示 |
| `LimitExceededException` | 「短時間に試行が多すぎます。しばらく待ってください」 | 全画面 |
| `UserNotFoundException` (パスワードリセット時) | (セキュリティ上、エラーを出さず) 「コードを送信しました」 | (4) で表示 |
| `MFAMethodNotFoundException` | 「MFA が設定されていません」 | (7) ProfileScreen |

ネットワークエラー (NetworkError 等) は別途グローバルエラーハンドラ。

---

## 6. セキュリティ考慮事項

### 6.1 JWT の保存と管理

- **Web**: `aws-amplify` は CognitoSession を localStorage + メモリで管理
- **Tauri Desktop**: `keyring` クレート経由で OS の安全な保存領域 (Keychain / Credential Manager / Secret Service) に保存
- **JWT の自動 refresh**: aws-amplify が Refresh Token で自動更新 (期限切れ前)

### 6.2 パスワードポリシー

- 最小 12 文字
- 大文字・小文字・数字・記号必須
- 過去 5 件のパスワードを再利用不可 (Cognito の `passwordPolicy.passwordHistorySize`)
- 90 日強制変更は **しない** (NIST SP 800-63B ガイダンスに準拠、変更を強制すると逆に弱くなる)

### 6.3 MFA

- TOTP (Time-based One-Time Password) のみサポート
- SMS MFA は採用しない (SIM swap 攻撃、コスト、国際対応の困難さ)
- 推奨アプリ: Google Authenticator, Microsoft Authenticator, 1Password, Authy

### 6.4 セッションタイムアウト

- Cognito 設定: Access Token 有効期限 = **1 時間**、Refresh Token 有効期限 = **30 日**
- フロント側: 30 分の inactivity でログアウト UI 表示 (オプション、Sprint 5 で検討)

### 6.5 GDPR / 個人情報保護

- アカウント削除リクエスト時、DynamoDB + Cognito の関連レコードを 30 日以内に完全削除
- データエクスポート (Right to data portability): JSON で全データダウンロード可能
- 削除前にユーザーへ確認 (2 段階)
- 監査ログ: 削除/エクスポート操作を CloudWatch Logs に記録

---

## 7. テスト方針 (Sprint 1)

### Unit Tests (Jest)

- 各画面の rendering
- フォームのバリデーション
- 状態遷移ロジック (mocked `useAuthenticator`)

### Integration Tests (Sandbox 環境)

- 実 Cognito User Pool でテストアカウント作成 → 全フロー手動確認
- post-confirmation Lambda が UserSettings レコードを作成することを DynamoDB Console で確認
- MFA enable/disable のラウンドトリップ
- パスワードリセットフロー

### E2E Tests (Playwright、Sprint 4 で検討)

- ログイン/サインアップ/パスワードリセットの自動化テスト
- MFA は別途、認証コード生成を mock 化

---

## 8. UI/UX ガイドライン

### 8.1 デザインシステム

- **MUI 7 ベース** (baseline-ui 制約遵守)
- ボタンサイズ: タッチデバイス対応で 44px 以上
- フォントサイズ: 最小 14px (本文)、入力フィールドは 16px (iOS で zoom 回避)
- パスワードフィールド: visibility toggle (👁 アイコン)

### 8.2 アクセシビリティ

- フォームラベル必須 (`<label htmlFor>`)
- エラーメッセージは `aria-live="polite"` で読み上げ
- フォーカス管理 (sequential focus on error)
- キーボード操作可能 (Tab / Enter)
- カラーコントラスト WCAG AA 準拠

### 8.3 日本語ファースト

- すべてのラベル / エラーメッセージは日本語
- aws-amplify の `I18n.putVocabularies` で日本語 dictionary
- 英語切替は (7) ProfileScreen で可能 (`language: 'en'`)

### 8.4 ローディング状態

- 各ボタンに `loading` state (CircularProgress)
- 連打防止 (`disabled` during pending)

### 8.5 エラー表示

- インラインエラー (フィールド下に赤テキスト)
- グローバルエラー (Snackbar 上部に表示)
- 致命的エラー (Dialog で警告)

---

## 9. 関連ドキュメント

- [HANDOFF.md](../HANDOFF.md) — プロジェクト全体引き継ぎ
- [docs/6_FRONTEND_BACKEND_INTEGRATION.md](6_FRONTEND_BACKEND_INTEGRATION.md) — フロント-バックエンド統合アーキテクチャ
- [docs/PROJECT_MU.md](PROJECT_MU.md) — Project Mu 仕様
- [docs/CONCEPTS.md](CONCEPTS.md) — 用語定義
- `.claude/plans/track-d-aws-cloud.md` — Sprint 1-5 実装計画 (worktree 経由のみ参照可)

---

## 10. 参考リンク

- [Amplify Gen2 Auth Docs](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [Amplify UI Authenticator (React)](https://ui.docs.amplify.aws/react/connected-components/authenticator)
- [AWS Cognito User Pool Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-best-practices.html)
- [NIST SP 800-63B Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
