"""
Project Mu 学習層 — LoRA ファインチューニング（自律進化）。

主要モジュール（Track A で実装予定）:
  - lora_trainer.py: PEFT + PyTorch LoRA トレーナー（Intel Arc GPU 対応）
  - adapter_manager.py: LoRA アダプターのバージョン管理（lora_adapters テーブル連携）
  - model_merger.py: ベースモデル + LoRA → OpenVINO IR
  - training_scheduler.py: training_cache 100件閾値検出 + バックグラウンド起動
  - evaluator.py: Hold-out セット評価

トリガー条件:
  user_confirmed=1 のレコードが training_cache に 100件以上溜まる、または手動実行
"""
