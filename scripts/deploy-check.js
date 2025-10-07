#!/usr/bin/env node

/**
 * デプロイ前チェックスクリプト
 * プロダクションデプロイ前に必要な検証を実行
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 HOSHUTARO フロントエンド改良版 - デプロイ前チェック');
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
    'tsconfig.json',
    'src/main.tsx',
    'src/App.tsx',
    'index.html',
    'vercel.json',
    'netlify.toml',
    '.github/workflows/deploy-preview.yml'
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
  
  if (!packageJson.scripts.test) {
    throw new Error('test スクリプトが定義されていません');
  }
  
  if (!packageJson.scripts.lint) {
    throw new Error('lint スクリプトが定義されていません');
  }

  // 重要な依存関係の確認
  const requiredDeps = ['react', 'react-dom', 'typescript', 'vite'];
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
      throw new Error(`必要な依存関係が見つかりません: ${dep}`);
    }
  });
});

// 3. TypeScript コンパイルチェック
check('TypeScript コンパイルチェック', () => {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('TypeScript コンパイルエラーがあります');
  }
});

// 4. ESLint チェック
check('ESLint チェック', () => {
  try {
    execSync('npm run lint', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('ESLint エラーがあります');
  }
});

// 5. テスト実行
check('テスト実行', () => {
  try {
    execSync('npm run test -- --coverage --watchAll=false', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('テストが失敗しました');
  }
});

// 6. ビルドテスト
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
  const requiredBuildFiles = ['dist/index.html', 'dist/assets'];
  requiredBuildFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      throw new Error(`ビルド成果物が見つかりません: ${file}`);
    }
  });
});

// 7. バンドルサイズチェック
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
    
    if (totalSizeMB > 10) {
      console.warn(`   ⚠️  バンドルサイズが大きいです: ${totalSizeMB.toFixed(2)} MB`);
    }
  }
});

// 8. 環境変数チェック
check('環境変数チェック', () => {
  // .env.example があれば確認
  if (fs.existsSync('.env.example')) {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    const requiredEnvVars = envExample
      .split('\n')
      .filter(line => line.includes('='))
      .map(line => line.split('=')[0]);
    
    console.log(`   📝 必要な環境変数: ${requiredEnvVars.join(', ')}`);
  }
});

// 9. セキュリティチェック
check('セキュリティチェック', () => {
  // .env ファイルが .gitignore に含まれているかチェック
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.includes('.env')) {
      console.warn('   ⚠️  .env ファイルが .gitignore に含まれていません');
    }
  }
  
  // node_modules が .gitignore に含まれているかチェック
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.includes('node_modules')) {
      throw new Error('node_modules が .gitignore に含まれていません');
    }
  }
});

// 10. デプロイ設定ファイルの検証
check('デプロイ設定ファイルの検証', () => {
  // vercel.json の検証
  if (fs.existsSync('vercel.json')) {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    if (!vercelConfig.builds || !vercelConfig.routes) {
      throw new Error('vercel.json の設定が不完全です');
    }
  }
  
  // netlify.toml の検証
  if (fs.existsSync('netlify.toml')) {
    const netlifyConfig = fs.readFileSync('netlify.toml', 'utf8');
    if (!netlifyConfig.includes('[build]') || !netlifyConfig.includes('publish')) {
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
  console.log('✅ すべてのチェックが完了しました！');
  console.log('🚀 デプロイの準備が整いました。');
  console.log('\n次のコマンドでデプロイできます:');
  console.log('  Vercel: npm run deploy:vercel');
  console.log('  Netlify: npm run deploy:netlify');
  console.log('  プレビュー: npm run deploy:preview');
}