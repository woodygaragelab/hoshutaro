# Cloud Architecture (AWS Amplify Gen 2)

HOSHUTARO のクラウドモードは **AWS Amplify Gen 2** + **Lambda（llm-proxy / user-management /
post-confirmation）** で構成されます。本ドキュメントは構造の俯瞰と、後から実装着手するため
の前提整理です（プラン WS3-2）。

> **本リリースでは機能実装はしません**。コードは `amplify/` 配下に残置し、本ドキュメントで
> 役割と接続フローを記述します。ローカルモード運用時はクラウド経路に**到達しない**ことを
> `APP_MODE=local`（既定）で保証します。

---

## 1. 全体構成

```
            ┌────────────────────────────────────────────────────────┐
            │  HOSHUTARO desktop (Tauri) — core/ (FastAPI sidecar)   │
            └──┬───────────────────────────────────┬─────────────────┘
               │ APP_MODE=local                    │ APP_MODE=cloud
               │                                   │
               ▼                                   ▼
  ┌──────────────────────────┐    ┌────────────────────────────────────┐
  │ OpenVinoGemmaAdapter      │    │ CloudProxyAdapter                  │
  │ ・ローカル Gemma 4 + MTP  │    │ ・LLM_PROXY_URL → Lambda URL       │
  │ ・openvino-genai LLMPipeline│  │ ・LLM_PROXY_JWT_TOKEN（認証）      │
  └──────────────────────────┘    └─────────┬──────────────────────────┘
                                            │ HTTPS
                                            ▼
                          ┌─────────────────────────────────────────────┐
                          │ AWS Lambda: llm-proxy                       │
                          │ ・JWT 検証（Cognito 発行）                  │
                          │ ・Bedrock InvokeModel 経由で Claude を呼ぶ │
                          │ ・Bedrock 障害時は Anthropic Direct に fallback│
                          └─────────────────────────────────────────────┘

  ┌──────────────────────────┐    ┌────────────────────────────────────┐
  │ Cognito User Pool         │◄──►│ Lambda: post-confirmation          │
  │ ・サインアップ/ログイン   │    │ ・初回ユーザー作成、DynamoDB 登録 │
  └──────────────────────────┘    └────────────────────────────────────┘

  ┌──────────────────────────┐    ┌────────────────────────────────────┐
  │ Amplify Data (AppSync)    │◄──►│ Lambda: user-management            │
  │ ・GraphQL                 │    │ ・管理 API（プラン変更等）        │
  └──────────────────────────┘    └────────────────────────────────────┘
```

---

## 2. ディレクトリ構成

| パス | 役割 |
|---|---|
| `amplify/backend.ts` | Amplify Gen 2 のリソース定義エントリ |
| `amplify/auth/` | Cognito User Pool（クライアント、フェデレーション等） |
| `amplify/data/` | AppSync GraphQL + DynamoDB データソース |
| `amplify/functions/llm-proxy/` | クラウド LLM 中継（Bedrock Claude 経路） |
| `amplify/functions/user-management/` | ユーザー管理 API |
| `amplify/functions/post-confirmation/` | Cognito サインアップ後の初回処理 |
| `amplify/package.json` | Amplify バックエンド依存 |
| `core/app/llm/adapters/cloud_proxy.py` | バックエンド側の Lambda クライアント |
| `core/app/llm/registry.py` | `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku` 登録（cloud モード限定） |

---

## 3. APP_MODE による分離

`core/app/config.py` には `APP_MODE` の明示フィールドはありませんが、`core/app/llm/registry.py`
の `_current_app_mode()` が **`os.environ["APP_MODE"]`** を直接読み（既定 `local`）、各モデルの
`available_in` でフィルタします。

- `APP_MODE=local`（既定）: `cloud_*` モデルは `_is_available()` で False を返し、`resolve()` は
  必ず `DEFAULT_MODEL` = `local_gemma_4_e2b_it` を選ぶ → **クラウド経路に到達しない**。
- `APP_MODE=cloud`: `cloud_claude_3_5_sonnet` / `cloud_claude_3_haiku` が利用可能になり、
  `CloudProxyAdapter` が選択される。

この保証は `core/tests/test_llm_registry_cloud.py::test_resolve_skips_cloud_claude_in_local_mode`
で検証されています。

---

## 4. クラウドモード有効化手順（実装着手時）

1. `amplify/` ディレクトリで Amplify Gen 2 をデプロイ:
   ```bash
   cd amplify
   npm install
   npx ampx sandbox     # 開発用 sandbox
   # または
   npx ampx pipeline-deploy --branch main --app-id <app-id>  # 本番
   ```

2. デプロイ後に生成される `amplify_outputs.json` から Lambda Function URL を取得し、
   `core/.env` に設定:
   ```
   APP_MODE=cloud
   LLM_PROXY_URL=https://xxx.lambda-url.us-west-2.on.aws/
   LLM_PROXY_JWT_TOKEN=<Cognito で発行した JWT>
   ```

3. アプリ起動 → 設定画面 → LLM プロバイダを `cloud_claude_3_5_sonnet` に切替。

4. 動作確認: `/api/settings/llm/test` で `adapter.ping()` が ok を返すこと。

> **本リリース時点では amplify はビルド成果物の検証のみ**。動作には Cognito User Pool ID
> 等の追加設定が必要です（`amplify/README.md` を参照）。

---

## 5. Bedrock モデルマッピング

`llm-proxy` Lambda 内部の `BEDROCK_MODEL_MAP` で HOSHUTARO の論理モデル名 → Bedrock model ID を
変換します:

| HOSHUTARO モデル名 | Bedrock model ID（例） |
|---|---|
| `cloud_claude_3_5_sonnet` | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `cloud_claude_3_haiku` | `anthropic.claude-3-haiku-20240307-v1:0` |

Bedrock 障害時は Lambda 内で Anthropic Direct API（`api.anthropic.com`）に自動 fallback します。
詳細は `amplify/functions/llm-proxy/handler.ts` を参照。

---

## 6. セキュリティ

- `LLM_PROXY_JWT_TOKEN` は Cognito 発行の ID トークン。Lambda 側で署名検証。
- `MAXIMO_API_KEY` 等の秘匿値は manifest.json の `secret: true` で管理され、
  バックエンドプロセスメモリ + `core/.env` のみに保持されます。クラウドに保存されません。
- 監査ログは Lambda 側 CloudWatch + `core/app/services/licensing.py` のクォータカウンタで集計。

---

## 7. ローカルモード時の保証

ローカル運用時に「うっかりクラウドにリクエストが飛ぶ」事態を防ぐため:
- `registry._is_available()` で `available_in` をフィルタ。
- `CloudProxyAdapter` は `endpoint_url=""` の場合 NotImplementedError を投げる。
- `core/tests/test_llm_registry_cloud.py` がこれを CI で検証。

`APP_MODE` 未設定（環境変数なし）= local とみなすフォールバックが `_current_app_mode()` に
組み込まれているため、`.env` を消しても安全側に倒れます。
