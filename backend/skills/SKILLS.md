# HOSHUTARO AI Agent Skills

このファイルは、AIエージェントが利用可能なスキルとそのコンテキストを定義するマニフェストです。

## available_skills
- name: generic_chat
  description: 一般的な保全や設備に関する質問に応答する
  context: "保全のベストプラクティスに基づき、専門的かつ分かりやすい回答を提供する。"
- name: future_planning_asset
  description: 特定の設備（Asset）に対する将来の保全計画を予測・作成する
  context: "DataModelから対象Assetの過去のWorkOrderLine実績を抽出し、実施間隔の平均やばらつきを元に次回の計画日（PlanScheduleStart）を予測する。predict_schedule コマンドを返す。"
- name: future_planning_wo
  description: 特定の作業（WorkOrder）に対する将来の保全計画を予測・作成する
  context: "指定されたWorkOrderの過去の実施間隔を分析し、次回計画を立案する。"
- name: excel_import_star_chart
  description: 星取表形式のExcelデータを取り込む
  context: "ユーザーから確認されたシンボルマッピング（○:計画, ●:実施など）を用いて、WorkOrderLineの追加・更新を行う。"
