"""
Project Mu プロンプトキャッシュ管理。

実装予定（Track A）:
  - kv_cache_manager.py: prompt_cache_meta テーブルと連動
    - cache_key 別に KV キャッシュをディスク保存（~/.hoshutaro/llm_cache/{key}.bin）
    - rules_hash 計算と invalidate 判定
    - LoRA バージョン変更時のキャッシュ再構築
"""
