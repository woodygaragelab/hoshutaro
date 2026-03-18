# Core Requirements - HOSHUTARO

## Introduction

本文書は、HOSHUTARO（保全管理システム）のコア機能要件を定義します。

## Core Requirements

### Requirement 1: 保全作業管理

**User Story:** As a 保全管理者, I want to 保全作業を独立したエンティティとして定義・管理し、複数の設備で作業定義を再利用したい, so that 効率的な保全業務を実現できる

#### Acceptance Criteria

1. WHEN 保全管理者が新しい作業を作成するとき、THEN HOSHUTARO_System SHALL 一意のキー、名前、説明、作業分類（01-20）、デフォルトスケジュールパターンを持つ作業を作成する
2. WHEN 保全管理者が作業一覧を要求するとき、THEN HOSHUTARO_System SHALL 定義されたすべての保全作業とそのプロパティを表示する
3. WHEN 保全管理者が作業プロパティを更新するとき、THEN HOSHUTARO_System SHALL 関連するすべての設備への変更を反映する
4. WHEN 保全管理者が作業を削除するとき、THEN HOSHUTARO_System SHALL 作業とそのすべての設備との関連付けを削除する
5. THE HOSHUTARO_System SHALL 無制限の作業分類をサポートする

### Requirement 2: 作業-設備関連付け管理

**User Story:** As a 保全計画者, I want to 各設備に複数の保全作業を関連付けて、各資産に必要なすべての保全活動を追跡したい, so that 包括的な保全管理を実現できる

#### Acceptance Criteria

1. WHEN 保全計画者が保全作業を設備に関連付けるとき、THEN HOSHUTARO_System SHALL スケジュール情報を含むリンクを作成する
2. WHEN 設備に複数の関連作業があるとき、THEN HOSHUTARO_System SHALL 適切な表示モードですべての作業を表示する
3. WHEN 保全計画者が設備から作業の関連付けを削除するとき、THEN HOSHUTARO_System SHALL 作業定義を保持する
4. THE HOSHUTARO_System SHALL 同じ保全作業を複数の異なる設備に関連付けることを許可する
5. THE HOSHUTARO_System SHALL 設備-作業の組み合わせに固有の計画日、実績日、コスト情報を保存する

### Requirement 3: 設備階層管理

**User Story:** As a 施設管理者, I want to 設備階層の名前と構造を編集して、施設の変化に応じて正確な組織情報を維持したい, so that 動的な組織変更に対応できる

#### Acceptance Criteria

1. WHEN 施設管理者が階層レベル名を編集するとき、THEN HOSHUTARO_System SHALL その階層パスを使用するすべての設備の名前を更新する
2. WHEN 施設管理者が設備を別の階層パスに再割り当てするとき、THEN HOSHUTARO_System SHALL 関連するすべての表示とフィルターを更新する
3. THE HOSHUTARO_System SHALL 新しい階層レベルの作成・削除を許可し、動的な階層レベル数（1-10）をサポートする
4. THE HOSHUTARO_System SHALL 階層レベルの順序変更を許可する
5. WHEN 階層変更が実行されるとき、THEN HOSHUTARO_System SHALL 参照整合性を維持する

### Requirement 4: 設備再割り当て機能

**User Story:** As a 保全管理者, I want to 設備の階層パスを変更して、組織変更や設備移設に対応したい, so that 柔軟な設備管理を実現できる

#### Acceptance Criteria

1. WHEN 保全管理者が複数の設備を選択するとき、THEN HOSHUTARO_System SHALL 一括再割り当て機能を提供する
2. WHEN 設備再割り当てが実行されるとき、THEN HOSHUTARO_System SHALL 関連する作業関連付けを保持する
3. WHEN 再割り当てが完了するとき、THEN HOSHUTARO_System SHALL 変更された設備数を報告する

### Requirement 5: 表示モード管理

**User Story:** As a ユーザー, I want to 機器ベースと作業ベースのビューを切り替えて、異なる視点から保全データを分析したい, so that 多角的な分析が可能になる

#### Acceptance Criteria

1. WHEN Equipment_Based_Mode が選択されるとき、THEN MaintenanceGrid SHALL 設備をグリッド内の行項目として表示する
2. WHEN Task_Based_Mode が選択されるとき、THEN MaintenanceGrid SHALL 作業分類、作業、設備の階層構造でデータを表示する
3. WHEN 異なる表示モードが選択されるとき、THEN MaintenanceGrid SHALL 選択された組織を表示するようにグリッド表示を変換する
4. WHEN 表示モード切り替えが実行されるとき、THEN HOSHUTARO_System SHALL 適用可能なフィルター、日付範囲、選択状態を保持する
5. THE HOSHUTARO_System SHALL 最大50,000設備のデータセットに対して1000ミリ秒以内に遷移を完了する

### Requirement 6: データ管理

**User Story:** As a システム管理者, I want to 作業、設備、関連付けを独立したエンティティとして管理し、データの整合性を維持したい, so that 信頼性の高いデータ管理を実現できる

#### Acceptance Criteria

1. THE HOSHUTARO_System SHALL 作業、設備、関連付けを独立したエンティティとして保存する
2. WHEN データが読み込まれるとき、THEN HOSHUTARO_System SHALL 参照整合性を検証する
3. WHEN データ操作が実行されるとき、THEN HOSHUTARO_System SHALL データバリデーションを実行する
4. THE HOSHUTARO_System SHALL JSONデータ形式（バージョン2.0.0）をサポートする