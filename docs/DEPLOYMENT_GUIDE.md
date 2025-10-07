# デプロイメントガイド

## 概要

このガイドでは、HOSHUTARO フロントエンド改良版を静的サイトホスティングサービス（Vercel/Netlify）にデプロイする手順を説明します。

## 前提条件

### 必要なツール

- Node.js 18以上
- npm または yarn
- Git
- Vercel CLI または Netlify CLI（オプション）

### アカウント準備

- [Vercel](https://vercel.com) または [Netlify](https://netlify.com) のアカウント
- GitHub アカウント（自動デプロイ用）

## ローカル環境での準備

### 1. プロジェクトのビルド確認

```bash
# 依存関係のインストール
npm install

# テストの実行
npm run test

# リンターの実行
npm run lint

# プロダクションビルド
npm run build

# ビルド結果の確認
npm run preview
```

### 2. 環境変数の設定

プロダクション環境用の環境変数を設定します：

```bash
# .env.production ファイルを作成
cat > .env.production << EOF
VITE_APP_NAME=HOSHUTARO
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://api.example.com
VITE_ENABLE_AI_ASSISTANT=true
VITE_ENABLE_EXCEL_IMPORT=true
EOF
```

## Vercel へのデプロイ

### 方法1: Vercel CLI を使用

```bash
# Vercel CLI のインストール
npm install -g vercel

# ログイン
vercel login

# プロジェクトの初期化とデプロイ
vercel

# プロダクションデプロイ
vercel --prod
```

### 方法2: GitHub 連携による自動デプロイ

1. **GitHub リポジトリの準備**

   ```bash
   # リポジトリの作成とプッシュ
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/hoshutaro-frontend.git
   git push -u origin main
   ```

2. **Vercel での設定**
   - [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
   - "New Project" をクリック
   - GitHub リポジトリを選択
   - プロジェクト設定：
     - Framework Preset: `Vite`
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install`

3. **環境変数の設定**
   - Vercel Dashboard でプロジェクトを選択
   - Settings → Environment Variables
   - 必要な環境変数を追加

### 方法3: vercel.json を使用した設定

プロジェクトルートの `vercel.json` ファイルが自動的に使用されます：

```json
{
  "version": 2,
  "name": "hoshutaro-frontend-preview",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ]
}
```

## Netlify へのデプロイ

### 方法1: Netlify CLI を使用

```bash
# Netlify CLI のインストール
npm install -g netlify-cli

# ログイン
netlify login

# プロジェクトの初期化
netlify init

# ビルドとデプロイ
netlify build
netlify deploy

# プロダクションデプロイ
netlify deploy --prod
```

### 方法2: ドラッグ&ドロップデプロイ

```bash
# ビルドの実行
npm run build

# dist フォルダを Netlify にドラッグ&ドロップ
# https://app.netlify.com/drop
```

### 方法3: GitHub 連携による自動デプロイ

1. **Netlify での設定**
   - [Netlify Dashboard](https://app.netlify.com) にアクセス
   - "New site from Git" をクリック
   - GitHub リポジトリを選択
   - ビルド設定：
     - Build command: `npm run build`
     - Publish directory: `dist`

2. **netlify.toml の設定**
   プロジェクトルートの `netlify.toml` ファイルが自動的に使用されます。

## カスタムドメインの設定

### Vercel でのカスタムドメイン

1. Vercel Dashboard でプロジェクトを選択
2. Settings → Domains
3. カスタムドメインを追加
4. DNS レコードを設定：

   ```
   Type: CNAME
   Name: www (または任意のサブドメイン)
   Value: cname.vercel-dns.com
   ```

### Netlify でのカスタムドメイン

1. Netlify Dashboard でサイトを選択
2. Site settings → Domain management
3. "Add custom domain" をクリック
4. DNS レコードを設定：

   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   ```

## SSL証明書の設定

### 自動SSL（推奨）

- Vercel: 自動的にLet's Encrypt証明書が設定されます
- Netlify: 自動的にLet's Encrypt証明書が設定されます

### カスタムSSL証明書

両サービスともカスタムSSL証明書のアップロードに対応しています。

## パフォーマンス最適化

### CDN設定

- 両サービスとも自動的にグローバルCDNが適用されます
- 静的アセットは自動的にキャッシュされます

### 圧縮設定

```javascript
// vite.config.ts での圧縮設定
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
        },
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
});
```

## 監視とアナリティクス

### Vercel Analytics

```bash
# Vercel Analytics の有効化
npm install @vercel/analytics

# コンポーネントに追加
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
```

### Netlify Analytics

- Netlify Dashboard で Analytics を有効化
- リアルタイムトラフィック監視が利用可能

## 環境別デプロイ戦略

### ブランチベースデプロイ

```yaml
# GitHub Actions での環境別デプロイ
name: Deploy
on:
  push:
    branches:
      - main      # Production
      - develop   # Staging
      - feature/* # Preview

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test -- --coverage --watchAll=false
      
      - name: Build
        run: npm run build
        env:
          VITE_ENVIRONMENT: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## トラブルシューティング

### よくある問題と解決方法

#### ビルドエラー

```bash
# 依存関係の問題
rm -rf node_modules package-lock.json
npm install

# TypeScript エラー
npm run lint
npx tsc --noEmit

# メモリ不足
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### デプロイエラー

```bash
# Vercel でのデバッグ
vercel logs

# Netlify でのデバッグ
netlify logs
```

#### パフォーマンス問題

```bash
# バンドルサイズの分析
npm run build
npx vite-bundle-analyzer dist

# Lighthouse での監査
npx lighthouse https://your-site.vercel.app --output html
```

## セキュリティ考慮事項

### 環境変数の管理

- 機密情報は環境変数として設定
- `.env` ファイルは `.gitignore` に追加
- プロダクション環境では適切な値を設定

### セキュリティヘッダー

```javascript
// vercel.json でのセキュリティヘッダー設定
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 運用・保守

### 定期的なタスク

- 依存関係の更新
- セキュリティパッチの適用
- パフォーマンス監視
- ログの確認

### バックアップ戦略

- Git リポジトリでのソースコード管理
- 設定ファイルのバックアップ
- デプロイ履歴の保持

### 監視項目

- サイトの可用性
- レスポンス時間
- エラー率
- ユーザー体験指標（Core Web Vitals）

このガイドに従って、安全かつ効率的にアプリケーションをデプロイできます。
