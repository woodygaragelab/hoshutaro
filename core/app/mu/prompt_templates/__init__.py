"""
Project Mu プロンプトテンプレート（Jinja2）。

実装予定テンプレート（Track A）:
  - rules_for_prompt.j2: rules テーブルの抜粋を LLM プロンプト用に整形
  - master_map_lookup.j2: master_map のベクトル検索結果を整形
  - thinking_prompt.j2: フェーズ1 Thinking Mode 用システムプロンプト

Skill 定義の sql_context.template フィールドからこれらのテンプレートが参照される。
"""
