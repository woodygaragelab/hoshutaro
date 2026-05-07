"""
Project Mu — 自律進化型 機器台帳構造化エンジン。

3層構造:
  - 推論層 (pipeline/): Gemma 4 E2B + Thinking Mode による推論
  - 記憶層 (memory/): SQLite + sqlite-vec による長期メモリ
  - 学習層 (learning/): LoRA による現場固有モデルへの自己進化

詳細仕様: docs/PROJECT_MU.md

NOTE: Track C のモノレポ化で `core/mu/` へ移動予定。現状は `backend/app/mu/` に配置。
"""
