"""
Skill 関連の新世代モジュール（Track A〜C で実装中）。

旧実装: `backend/app/services/skill_engine.py`、`backend/app/services/skill_loader.py`
  - 互換維持のため残置、Track C のモノレポ化で `core/skills/` へ移管予定

新規追加（本パッケージ）:
  - sql_context_resolver: Skill 定義の sql_context ラベルを実 SQL/ベクトル検索に解決
"""
