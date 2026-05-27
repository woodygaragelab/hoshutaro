# HOSHUTARO Amplify Backend

AWS Amplify Gen 2 で構築する HOSHUTARO のクラウドバックエンド。Cognito User Pool、
AppSync GraphQL、Lambda 関数（llm-proxy / user-management / post-confirmation）で構成。

> **本リリースでは機能実装はしません**。ローカル運用（`APP_MODE=local`、既定）に集中し、
> 本ディレクトリは後続実装のための構造保持のみが目的です。

詳細な構成図と接続フローは **[`../docs/14_CLOUD_ARCHITECTURE.md`](../docs/14_CLOUD_ARCHITECTURE.md)** を参照。

---

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `backend.ts` | Amplify Gen 2 リソース定義のエントリ |
| `auth/` | Cognito User Pool 設定 |
| `data/` | AppSync GraphQL スキーマ + DynamoDB |
| `functions/llm-proxy/` | 外部 LLM 中継（Bedrock Claude 等） |
| `functions/user-management/` | 管理 API（プラン変更等） |
| `functions/post-confirmation/` | Cognito サインアップ後フック |
| `package.json` | Amplify バックエンド依存 |
| `tsconfig.json` | TypeScript 設定 |

---

## デプロイ手順（実装着手時）

### Sandbox（開発用、個人スタック）

```bash
cd amplify
npm install
npx ampx sandbox
```

ローカル変更を即時反映するモード。`amplify_outputs.json` がプロジェクトルートに生成され、
フロントエンドが認証/データソースを参照できるようになります。

### 本番デプロイ（Amplify Hosting と連携）

GitHub リポジトリを Amplify Console に接続し、CI/CD で自動デプロイする場合:

```bash
npx ampx pipeline-deploy --branch main --app-id <amplify-app-id>
```

ローカルから手動デプロイする場合:

```bash
npx ampx sandbox --once --identifier prod
```

### デプロイ後の env 反映

`amplify_outputs.json` から Lambda Function URL を取得し、`core/.env` に設定:

```ini
APP_MODE=cloud
LLM_PROXY_URL=https://xxx.lambda-url.us-west-2.on.aws/
LLM_PROXY_JWT_TOKEN=<Cognito ID トークン>
```

`core/app/llm/registry.py` がこれを読み、`cloud_claude_*` 経路を有効化します。

---

## ローカル運用時の保証

`APP_MODE=local`（既定）では `registry._is_available()` が `cloud_*` モデルを除外するため、
クラウド経路に到達しません。`core/tests/test_llm_registry_cloud.py` がこれを検証します。

---

## 既知の制約

- 本リポジトリの amplify/ は **デプロイ未検証**です。実装着手時に IAM ロール・Bedrock
  モデル ID 等の調整が必要になる場合があります。
- `llm-proxy` の Bedrock fallback（Anthropic Direct API）は、Anthropic API キーを
  Lambda 環境変数に追加する必要があります（実装時に Secrets Manager 経由を推奨）。
- Cognito ユーザープールの MFA / SSO 設定は `auth/resource.ts` で行います。
