"""
LLM Adapter 実装。各 adapter は LLMAdapter ABC を継承する。

設計詳細:
  - openvino_gemma: ローカル Gemma 4 E2B + OpenVINO GenAI LLMPipeline（MTP 対応）
  - cloud_proxy: AWS Lambda llm-proxy 経由（Bedrock Claude 等）
  - mcp_relay: MCP プラグインを LLMAdapter として呼ぶリレー

ローカル LLM は Gemma 4 一本化（プラン WS1-4 で旧 Gemini / SageMaker を削除）。
クラウド LLM は Bedrock 経由 Claude のみ（プラン WS3）。
"""
