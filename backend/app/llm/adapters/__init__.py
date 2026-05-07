"""
LLM Adapter 実装。各 adapter は LLMAdapter ABC を継承する。

設計詳細:
  - gemini: 既存 GeminiClient をラップする後方互換アダプタ
  - mcp_relay: 既存 llm_shim の MCP プラグイン分岐を移管（汎用 LLM Plugin 経由）
  - openvino_gemma: ローカル Gemma 4 E2B + OpenVINO（Track B で実装）
  - cloud_proxy: AWS Lambda llm-proxy 経由（Track D で実装）
  - sagemaker: SageMaker Real-time Endpoint（自前ホスト時、Track B で実装）

スタブは NotImplementedError を投げる。実装着手時に置き換える。
"""
