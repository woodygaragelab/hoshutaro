"""
Project Mu 記憶層 — SQLite ベースの長期メモリ。

主要テーブル（schema.sql 参照）:
  - rules: 変換ロジック（フェーズ1の蒸留結果）
  - master_map: 機器名⇔分類⇔ロケーションの確定マッピング（フェーズ3の蓄積）
  - training_cache: LoRA 学習用データセット
  - lora_adapters: LoRA アダプターのバージョン管理
  - prompt_cache_meta: KV キャッシュメタ
  - master_map_vec / rules_vec: ベクトル検索インデックス（sqlite-vec）

各テーブル CRUD は本パッケージ内の同名モジュール（rules.py 等）に実装予定（Track A）。
"""
