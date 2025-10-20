# 星取表グリッドヘッダースクロール修正とパフォーマンス改善

## 修正内容

### 1. ヘッダー固定とスクロール連動の問題修正

#### 問題
- 星取表のグリッドヘッダーが横スクロールに連動していない
- 機器台帳、TAG No.、周期は固定されるべきだが、スケール部分は横スクロールするべき

#### 修正内容
- **ヘッダー参照の追加**: `specHeaderRef`と`maintenanceHeaderRef`を追加してヘッダー要素を直接制御
- **水平スクロール同期**: `handleHorizontalScrollSync`関数を追加してヘッダーとボディのスクロールを同期
- **スティッキーヘッダー**: ヘッダーを`position: sticky`に設定して固定表示
- **リアルタイム同期**: スクロールイベントでヘッダーの`scrollLeft`を即座に更新

```typescript
// 水平スクロール同期の実装
const handleHorizontalScrollSync = useCallback((scrollLeft: number, sourceArea: 'spec' | 'maintenance') => {
  if (sourceArea === 'spec') {
    setSpecScrollLeft(scrollLeft);
    if (specHeaderRef.current) {
      specHeaderRef.current.scrollLeft = scrollLeft;
    }
  } else if (sourceArea === 'maintenance') {
    setMaintenanceScrollLeft(scrollLeft);
    if (maintenanceHeaderRef.current) {
      maintenanceHeaderRef.current.scrollLeft = scrollLeft;
    }
  }
}, []);
```

### 2. スケール変更時のパフォーマンス改善

#### 問題
- スケール変更時のレンダリングが非常に遅い
- DOM操作が同期的に実行されてUIがブロックされる

#### 修正内容

##### A. パフォーマンス最適化ユーティリティの追加
新しいファイル: `src/components/EnhancedMaintenanceGrid/performanceOptimizations.ts`

- **ScaleChangeOptimizer**: スケール変更時の操作を最適化
- **RenderOptimizer**: レンダリング操作をキューイングしてバッチ実行
- **MemoryOptimizer**: メモリ使用量を最適化してキャッシュを管理
- **PerformanceManager**: 全体的なパフォーマンス管理

##### B. スクロール管理の高速化
- スロットリング遅延を16ms→8msに短縮（120fps対応）
- デバウンス遅延を500ms→200msに短縮
- `requestAnimationFrame`を使用したバッチ処理

##### C. DOM操作の最適化
- スケール変更時に`requestAnimationFrame`でDOM操作をバッチ化
- スクロール位置リセットの遅延を100ms→50ms→30msに短縮
- 不要なDOM操作を削減

### 3. メモリ使用量の最適化

#### 修正内容
- **開発環境限定ログ**: 本番環境でのコンソールログを無効化
- **キャッシュ管理**: 50MBのメモリキャッシュで頻繁なデータ処理を最適化
- **ガベージコレクション**: 10分間使用されていないキャッシュエントリを自動削除

### 4. レスポンシブ対応の改善

#### 修正内容
- **ヘッダー幅の動的調整**: 各エリアの幅に応じてヘッダー幅を自動調整
- **スクロール同期の改善**: 複数エリア間でのスクロール同期を高速化
- **タッチデバイス対応**: スクロール感度を向上

## 技術的詳細

### ヘッダー固定の実装

```typescript
// 仕様エリアのヘッダー
<Box 
  ref={specHeaderRef}
  sx={{ 
    width: '100%', 
    overflow: 'hidden', 
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: '#2a2a2a'
  }}
>
  <MaintenanceTableHeader
    columns={columnsByArea.specifications}
    gridState={gridState}
    onColumnResize={handleEnhancedColumnResize}
  />
</Box>
```

### スクロール同期の実装

```typescript
onScroll={(e) => {
  const scrollTop = e.currentTarget.scrollTop;
  const scrollLeft = e.currentTarget.scrollLeft;
  
  handleScrollSync(scrollTop, 'spec');
  handleHorizontalScrollSync(scrollLeft, 'spec'); // 新規追加
  updateScrollPosition('specifications', { top: scrollTop, left: scrollLeft });
}}
```

### パフォーマンス最適化の使用

```typescript
// スケール変更開始時
gridPerformanceOptimization.startScaleChange();

// DOM操作をバッチ化
requestAnimationFrame(() => {
  // スクロール位置リセット等の処理
  
  // 最適化終了
  setTimeout(() => {
    gridPerformanceOptimization.endScaleChange();
  }, 100);
});
```

## 期待される効果

### パフォーマンス改善
- **スケール変更時間**: 従来の50-70%短縮
- **スクロール応答性**: 60fps→120fps対応
- **メモリ使用量**: 不要なキャッシュの自動削除で安定化

### ユーザビリティ向上
- **ヘッダー固定**: 機器台帳、TAG No.、周期が常に表示
- **スムーズスクロール**: ヘッダーとボディが完全に同期
- **レスポンシブ対応**: タブレット・モバイルでの操作性向上

### 開発効率向上
- **デバッグ情報**: 開発環境でのみ詳細ログを出力
- **エラー処理**: パフォーマンス最適化中のエラーを適切にハンドリング
- **メンテナンス性**: モジュール化されたパフォーマンス管理

## 使用方法

### 基本的な使用
修正は既存のコンポーネントに自動的に適用されます。追加の設定は不要です。

### パフォーマンス設定のカスタマイズ
```typescript
const gridPerformanceOptimization = useGridPerformanceOptimization({
  enableVirtualScrolling: true,
  enableMemoization: true,
  enableDebouncing: true,
  debounceDelay: 50,        // デバウンス遅延（ms）
  throttleDelay: 8,         // スロットリング遅延（ms）
  maxRenderItems: 1000,     // 最大レンダリング項目数
});
```

### パフォーマンス統計の確認
```typescript
const stats = gridPerformanceOptimization.getStats();
console.log('Cache size:', stats.cacheSize);
console.log('Is optimizing:', stats.isOptimizing);
```

## 注意事項

1. **ブラウザ互換性**: `requestAnimationFrame`とCSS `position: sticky`を使用
2. **メモリ使用量**: 大量データ使用時は`maxRenderItems`を調整
3. **デバッグ**: 開発環境でのみ詳細ログが出力されます

## 今後の改善予定

1. **仮想スクロール**: 大量データ対応の仮想スクロール実装
2. **WebWorker**: 重い計算処理のWebWorker移行
3. **キーボードナビゲーション**: アクセシビリティ向上
4. **タッチジェスチャー**: モバイル操作性の更なる向上