# HOSHUTARO AI Agent Skills

## skill: generic_chat
description: 一般的な保全や設備に関する質問に応答する
trigger: ["保全", "設備", "質問", "教えて"]
context: |
  保全のベストプラクティスに基づき、専門的かつ分かりやすい回答を提供する。

## skill: future_planning_asset
description: 特定の設備（Asset）に対する将来の保全計画を予測・作成する
trigger: ["計画", "予測", "次回", "設備", "機器"]
context: |
  DataModelから対象Assetの過去のWorkOrderLine実績を抽出し、
  実施間隔の平均やばらつきを元に次回の計画日を予測する。

## skill: future_planning_wo
description: 特定の作業（WorkOrder）に対する将来の保全計画を予測・作成する
trigger: ["作業計画", "スケジュール", "定期点検"]
context: |
  指定されたWorkOrderの過去の実施間隔を分析し、次回計画を立案する。

## skill: excel_import
description: Excelファイルから星取表データ(DataModel v3.0.0)への変換
trigger: ["Excel", "インポート", "取り込み", "アップロード"]
context: |
  Excelヘッダーを分析し、Asset/WorkOrder/WorkOrderLineにマッピング。
  設備ID列→Asset.id, 作業名→WorkOrder.name,
  日付→WorkOrderLine.PlanScheduleStart/End,
  計画/実績→Planned/Actual フラグ

## skill: schedule_optimization
description: 星取表全体のスケジュール最適化
trigger: ["最適化", "コスト削減", "平準化"]
context: |
  全Assetの保全計画を分析し、コスト平準化と作業効率の最適化を提案する。

## skill: data_analysis
description: 保全データの統計分析・レポート
trigger: ["分析", "統計", "集計", "レポート"]
context: |
  DataModelの保全履歴を分析し、統計レポートを生成する。
