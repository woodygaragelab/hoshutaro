"""
Gemini Client — ビルトインLLM直接クライアント

Google Generative AI SDK 経由で Gemini API を呼び出す。
Skill Engine (Phase 3) から使用される Function Calling 対応クライアント。
"""

import logging
from typing import AsyncGenerator, Any

import google.generativeai as genai
from google.generativeai.types import GenerationConfig

from app.config import settings

logger = logging.getLogger(__name__)


def _extract_text(response: Any) -> str:
    """
    Gemini レスポンスからテキストを安全に抽出する。
    Thinking model (2.5-flash 等) は response.text で ValueError を投げることがあるため、
    candidates → parts を直接走査して text part を結合する。
    """
    try:
        return response.text
    except (ValueError, AttributeError):
        pass

    # fallback: candidates → parts から手動抽出
    try:
        parts_text = []
        for candidate in response.candidates:
            for part in candidate.content.parts:
                # thought=True の part はスキップし、テキスト part のみ取得
                if hasattr(part, "thought") and part.thought:
                    continue
                if hasattr(part, "text") and part.text:
                    parts_text.append(part.text)
        if parts_text:
            return "".join(parts_text)
    except Exception:
        pass

    return ""


class GeminiClient:
    """Gemini API クライアント (シングルトン)"""

    _instance: "GeminiClient | None" = None
    _configured: bool = False

    def __new__(cls) -> "GeminiClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not self._configured:
            self._configure()

    def _configure(self) -> None:
        """Gemini SDK を初期化"""
        api_key = settings.gemini_api_key
        if not api_key:
            logger.warning("[GeminiClient] GEMINI_API_KEY が未設定です")
            self._configured = False
            return

        genai.configure(api_key=api_key)
        self._model_name = "gemini-3.1-flash-lite-preview"
        self._configured = True
        logger.info("[GeminiClient] 初期化完了 (model=%s)", self._model_name)

    @property
    def is_ready(self) -> bool:
        return self._configured

    def _get_model(
        self,
        system_instruction: str | None = None,
        tools: list | None = None,
    ) -> genai.GenerativeModel:
        """GenerativeModel インスタンスを生成"""
        kwargs: dict[str, Any] = {"model_name": self._model_name}
        if system_instruction:
            kwargs["system_instruction"] = system_instruction
        if tools:
            kwargs["tools"] = tools
        return genai.GenerativeModel(**kwargs)

    # ── テキスト生成 ──────────────────────────────────────────

    async def generate_text(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """単発テキスト生成"""
        if not self.is_ready:
            raise RuntimeError("GeminiClient が初期化されていません (GEMINI_API_KEY を確認してください)")

        model = self._get_model(system_instruction=system_instruction)
        config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await model.generate_content_async(
            prompt,
            generation_config=config,
        )
        return _extract_text(response)

    # ── ストリーミング生成 ─────────────────────────────────────

    async def generate_text_stream(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """ストリーミングテキスト生成"""
        if not self.is_ready:
            raise RuntimeError("GeminiClient が初期化されていません")

        model = self._get_model(system_instruction=system_instruction)
        config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await model.generate_content_async(
            prompt,
            generation_config=config,
            stream=True,
        )
        async for chunk in response:
            text = _extract_text(chunk)
            if text:
                yield text

    # ── Function Calling 付き生成 ──────────────────────────────

    async def generate_with_tools(
        self,
        messages: list[dict],
        *,
        system_instruction: str | None = None,
        tools: list | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> Any:
        """
        Tool定義付きのマルチターン対話。
        Skill Engine から呼ばれ、function_call / function_response をハンドリングする。

        Args:
            messages: [{"role": "user"|"model"|"function", "parts": [...]}]
            system_instruction: システムプロンプト
            tools: Gemini SDK の Tool 定義リスト
            temperature: 生成時温度
            max_tokens: 最大トークン数

        Returns:
            GenerateContentResponse (function_call 含む可能性あり)
        """
        if not self.is_ready:
            raise RuntimeError("GeminiClient が初期化されていません")

        model = self._get_model(
            system_instruction=system_instruction,
            tools=tools,
        )
        config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        # messages → Gemini SDK の Content 形式に変換
        contents = []
        for msg in messages:
            contents.append({
                "role": msg.get("role", "user"),
                "parts": msg.get("parts", [msg.get("content", "")]),
            })

        response = await model.generate_content_async(
            contents,
            generation_config=config,
        )
        return response

    # ── 接続テスト ─────────────────────────────────────────────

    async def test_connection(self) -> dict:
        """Gemini API 接続確認"""
        if not self.is_ready:
            return {"ok": False, "message": "GEMINI_API_KEY が未設定です"}
        try:
            result = await self.generate_text(
                "Hello, respond with 'ok' only.",
                temperature=0.0,
                max_tokens=10,
            )
            return {
                "ok": True,
                "message": f"接続成功 (model={self._model_name})",
                "response": result.strip(),
            }
        except Exception as e:
            logger.error("[GeminiClient] 接続テスト失敗: %s", e)
            return {"ok": False, "message": str(e)}

    # ── モデル一覧 ─────────────────────────────────────────────

    async def list_models(self) -> list[str]:
        """利用可能なGeminiモデル一覧を取得"""
        if not self.is_ready:
            return []
        try:
            models = genai.list_models()
            return [
                m.name for m in models
                if "generateContent" in (m.supported_generation_methods or [])
            ]
        except Exception as e:
            logger.error("[GeminiClient] モデル一覧取得失敗: %s", e)
            return []


# シングルトンインスタンス
gemini_client = GeminiClient()
