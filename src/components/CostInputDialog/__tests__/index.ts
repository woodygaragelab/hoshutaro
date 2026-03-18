/**
 * CostInputDialog テストスイート
 * 
 * このディレクトリには以下のテストが含まれています：
 * 
 * 1. CostInputDialog.desktop.test.tsx - デスクトップ専用コンポーネントのテスト
 *    - 基本的なレンダリング
 *    - キーボード操作
 *    - ユーザーインタラクション
 *    - 数値フォーマット
 *    - バリデーション
 *    - アニメーション設定
 *    - 読み取り専用モード
 * 
 * 2. costValidation.test.ts - バリデーション機能のテスト
 *    - 通貨パース・フォーマット機能
 *    - 個別バリデーション機能
 *    - 相互バリデーション機能
 *    - 完全バリデーション機能
 *    - 入力フィルタリング機能
 *    - デフォルトルール設定
 * 
 * テスト実行方法：
 * ```bash
 * npm test -- --testPathPattern=CostInputDialog
 * ```
 * 
 * 特定のテストファイルのみ実行：
 * ```bash
 * npm test -- CostInputDialog.desktop.test.tsx
 * npm test -- costValidation.test.ts
 * ```
 * 
 * 注意: このアプリケーションはデスクトップ専用設計です（1280px以上）
 */

export * from './CostInputDialog.desktop.test';
export * from './costValidation.test';