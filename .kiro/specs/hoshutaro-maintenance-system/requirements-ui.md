# UI & Interaction Requirements - HOSHUTARO

## Introduction

本文書は、HOSHUTARO（保全管理システム）のUI操作とユーザーインタラクション要件を定義します。

## UI Requirements

### Requirement 7: Excel-like操作性

**User Story:** As a データ入力担当者, I want to Excelと同様の直感的なキーボード操作でセル移動とフォーカス管理を行いたい, so that 効率的なデータ入力が可能になる

#### Acceptance Criteria

1. WHEN ユーザーが矢印キー（Up/Down/Left/Right）を押すとき、THEN MaintenanceGrid SHALL 対応する方向にセルフォーカスを移動する
2. WHEN ユーザーがTabキーを押すとき、THEN MaintenanceGrid SHALL 次の編集可能セルにフォーカスを移動する
3. WHEN ユーザーがEnterキーを押すとき、THEN MaintenanceGrid SHALL 現在のセルの編集を開始または確定する
4. WHEN ユーザーがEscapeキーを押すとき、THEN MaintenanceGrid SHALL 現在の編集をキャンセルする
5. THE MaintenanceGrid SHALL キーボードナビゲーション中に視覚的フォーカスインジケーターを表示する

### Requirement 8: コピー&ペースト機能

**User Story:** As a データ入力担当者, I want to 設備仕様エリアと保全実績エリア間でデータを効率的に転送したい, so that データ入力作業を効率化できる

#### Acceptance Criteria

1. WHEN ユーザーがCtrl+Cを押すとき、THEN MaintenanceGrid SHALL 選択されたセルまたは範囲をクリップボードにコピーする
2. WHEN ユーザーがCtrl+Vを押すとき、THEN MaintenanceGrid SHALL クリップボードの内容を現在の選択位置にペーストする
3. THE MaintenanceGrid SHALL 設備仕様エリアと保全実績エリア間のクロスエリアコピー&ペーストをサポートする
4. WHEN コピー&ペースト操作が実行されるとき、THEN MaintenanceGrid SHALL 操作結果をユーザーに通知する

### Requirement 9: ダイアログベース編集

**User Story:** As a ユーザー, I want to 複雑な編集操作を専用ダイアログで効率的に実行したい, so that 正確で効率的な編集作業が可能になる

#### Acceptance Criteria

1. WHEN ユーザーがセルをダブルクリックするとき、THEN MaintenanceGrid SHALL 適切な編集ダイアログを開く
2. THE MaintenanceGrid SHALL 状態選択、コスト入力、設備仕様編集、作業編集、階層編集、設備再割り当ての専用ダイアログを提供する
3. WHEN ダイアログでの編集が完了するとき、THEN HOSHUTARO_System SHALL 変更をリアルタイムでグリッドに反映する
4. WHEN 作業ベースモードで編集が実行されるとき、THEN HOSHUTARO_System SHALL 関連するすべての設備を連動更新する

### Requirement 10: 時間スケール管理

**User Story:** As a 保全管理者, I want to 異なる時間スケール（年/月/週/日）でデータを表示・集約して、様々な期間での保全計画を管理したい, so that 柔軟な時間軸での保全管理ができる

#### Acceptance Criteria

1. THE HOSHUTARO_System SHALL 年、月、週、日の4つの時間スケールをサポートする
2. WHEN 時間スケールが変更されるとき、THEN MaintenanceGrid SHALL 対応する期間でデータを集約表示する
3. WHEN 複数の保全作業が同一期間に存在するとき、THEN HOSHUTARO_System SHALL 集約記号（◎(n)）で件数を表示する
4. THE HOSHUTARO_System SHALL 時間スケール変更時にフィルター条件と選択状態を保持する
5. WHEN 日単位表示のとき、THEN HOSHUTARO_System SHALL 365日分のカラムを効率的にレンダリングする

### Requirement 11: 編集範囲制御

**User Story:** As a ユーザー, I want to 編集操作の影響範囲（単一機器/全機器）を制御して、意図しない一括変更を防ぎたい, so that 安全で正確な編集作業ができる

#### Acceptance Criteria

1. THE HOSHUTARO_System SHALL 機器ベースモードで編集範囲選択（単一機器/全機器）を提供する
2. WHEN 作業ベースモードが選択されるとき、THEN HOSHUTARO_System SHALL 編集範囲を全機器に固定する
3. WHEN 編集範囲が「全機器」に設定されるとき、THEN HOSHUTARO_System SHALL 影響を受ける機器数を事前表示する
4. THE HOSHUTARO_System SHALL 編集範囲設定をセッション間で保持する
5. WHEN 一括編集が実行されるとき、THEN HOSHUTARO_System SHALL 変更確認ダイアログを表示する

### Requirement 12: 表示エリア制御

**User Story:** As a ユーザー, I want to 設備仕様エリアと保全実績エリアの表示を切り替えて、作業内容に応じた最適な画面レイアウトを使用したい, so that 効率的な作業環境を構築できる

#### Acceptance Criteria

1. THE HOSHUTARO_System SHALL 「両方表示」「仕様のみ」「保全のみ」の3つの表示モードを提供する
2. WHEN 表示モードが変更されるとき、THEN MaintenanceGrid SHALL 対応するエリアの表示/非表示を切り替える
3. THE HOSHUTARO_System SHALL 表示モード変更時にカラム幅を自動調整する
4. WHEN 「仕様のみ」モードのとき、THEN HOSHUTARO_System SHALL 設備仕様編集機能のみを有効化する
5. THE HOSHUTARO_System SHALL 表示モード設定をローカルストレージに保存する