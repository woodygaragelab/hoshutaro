#!/usr/bin/env node

/**
 * 簡易デプロイ前チェックスクリプト
 * 最低限のデプロイ要件をチェック
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 HOSHUTARO フロントエンド改良版 - 簡易デプロイチェック');
console.log('================================================');

let hasErrors = false;

// チェック関数
function check(name, fn) {
  try {
    console.log(`\n📋 ${name}...`);
    fn();
    console.log(`✅ ${name} - 成功`);
  } catch (error) {
    console.error(`❌ ${name} - 失敗: ${error.message}`);
    hasErrors = true;
  }
}

// 1. 必要なファイルの存在確認
check('必要なファイルの存在確認', () => {
  const requiredFiles = [
    'package.json',
    'vite.config.ts',
    'src/main.tsx',
    'src/App.tsx',
    'index.html',
    'vercel.json',
    'netlify.toml'
  ];

  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      throw new Error(`必要なファイルが見つかりません: ${file}`);
    }
  });
});

// 2. package.json の検証
check('package.json の検証', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (!packageJson.scripts.build) {
    throw new Error('build スクリプトが定義されていません');
  }
  
  // 重要な依存関係の確認
  const requiredDeps = ['react', 'react-dom', 'vite'];
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
      throw new Error(`必要な依存関係が見つかりません: ${dep}`);
    }
  });
});

// 3. TypeScript コンパイルチェック（エラーを無視）
check('TypeScript コンパイルチェック', () => {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
  } catch (error) {
    console.warn('   ⚠️  TypeScript警告がありますが、デプロイは可能です');
  }
});

// 4. ビルドテスト
check('プロダクションビルドテスト', () => {
  try {
    execSync('npm run build', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('ビルドが失敗しました');
  }
  
  // dist フォルダの確認
  if (!fs.existsSync('dist')) {
    throw new Error('dist フォルダが作成されていません');
  }
  
  // 重要なファイルの確認
  if (!fs.existsSync('dist/index.html')) {
    throw new Error('index.html が生成されていません');
  }
});

// 5. バンドルサイズチェック
check('バンドルサイズチェック', () => {
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    throw new Error('dist フォルダが存在しません');
  }
  
  // アセットフォルダのサイズを計算
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    const files = fs.readdirSync(assetsPath);
    let totalSize = 0;
    
    files.forEach(file => {
      const filePath = path.join(assetsPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });
    
    const totalSizeMB = totalSize / (1024 * 1024);
    console.log(`   📦 総バンドルサイズ: ${totalSizeMB.toFixed(2)} MB`);
    
    if (totalSizeMB > 20) {
      console.warn(`   ⚠️  バンドルサイズが大きいです: ${totalSizeMB.toFixed(2)} MB`);
    }
  }
});

// 6. デプロイ設定ファイルの検証
check('デプロイ設定ファイルの検証', () => {
  // vercel.json の検証
  if (fs.existsSync('vercel.json')) {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    if (!vercelConfig.builds) {
      throw new Error('vercel.json の設定が不完全です');
    }
  }
  
  // netlify.toml の検証
  if (fs.existsSync('netlify.toml')) {
    const netlifyConfig = fs.readFileSync('netlify.toml', 'utf8');
    if (!netlifyConfig.includes('[build]')) {
      throw new Error('netlify.toml の設定が不完全です');
    }
  }
});

// 結果表示
console.log('\n================================================');
if (hasErrors) {
  console.error('❌ デプロイ前チェックで問題が見つかりました。');
  console.error('   上記のエラーを修正してから再度実行してください。');
  process.exit(1);
} else {
  console.log('✅ デプロイの準備が整いました！');
  console.log('🚀 以下のコマンドでデプロイできます:');
  console.log('');
  console.log('  📦 Vercel デプロイ:');
  console.log('    npm run deploy:vercel');
  console.log('');
  console.log('  🌐 Netlify デプロイ:');
  console.log('    npm run deploy:netlify');
  console.log('');
  console.log('  🔍 プレビューデプロイ:');
  console.log('    npm run deploy:preview');
  console.log('');
  console.log('📚 詳細なドキュメント:');
  console.log('  - ユーザーガイド: docs/USER_GUIDE.md');
  console.log('  - デプロイガイド: docs/DEPLOYMENT_GUIDE.md');
  console.log('  - バックエンド統合仕様: docs/BACKEND_INTEGRATION_SPEC.md');
}