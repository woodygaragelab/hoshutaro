/**
 * CostInputDialog テストスイート
 * 
 * このディレクトリには以下のテストが含まれています：
 * 
 * 1. CostInputDialog.test.tsx - メインコンポーネントのテスト
 *    - 基本的なレンダリング
 *    - 数値フォーマットのテスト
 *    - バリデーションロジックのテスト
 *    - デバイス別表示のテスト
 *    - ユーザーインタラクション
 *    - アニメーション設定
 *    - エラーハンドリング
 * 
 * 2. costValidation.test.ts - バリデーション機能のテスト
 *    - 通貨パース・フォーマット機能
 *    - 個別バリデーション機能
 *    - 相互バリデーション機能
 *    - 完全バリデーション機能
 *    - 入力フィルタリング機能
 *    - デフォルトルール設定
 * 
 * 3. deviceOptimization.test.ts - デバイス最適化機能のテスト
 *    - デバイス固有スタイル
 *    - デバイス固有入力属性
 *    - キーボードハンドラー
 *    - フォーカス・ブラーハンドラー
 *    - ボタンスタイル
 *    - アニメーション設定
 * 
 * テスト実行方法：
 * ```bash
 * npm test -- --testPathPattern=CostInputDialog
 * ```
 * 
 * 特定のテストファイルのみ実行：
 * ```bash
 * npm test -- CostInputDialog.test.tsx
 * npm test -- costValidation.test.ts
 * npm test -- deviceOptimization.test.ts
 * ```
 */

export * from './CostInputDialog.test';
export * from './costValidation.test';
export * from './deviceOptimization.test';