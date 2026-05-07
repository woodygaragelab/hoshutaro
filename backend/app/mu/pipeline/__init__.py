"""
Project Mu 推論層 — 3フェーズパイプライン。

  - distillation.py: フェーズ1（ルール蒸留、Thinking Mode）
  - transformation.py: フェーズ2（高速一括変換、プロンプトキャッシュ）
  - enrichment.py: フェーズ3前半（意味補完）

学習層（LoRA トレーニング）は learning/ に分離（フェーズ3後半）。

実装は Track A で本格化。
"""
