"""
OpenVINO + Gemma 4 E2B-it Adapter（MTP / Speculative Decoding 対応）。

実装方針:
  - 推論経路は2系統サポート:
    1. **HF transformers + OpenVINO backend (optimum-intel)**: 標準ルート
       - target/drafter を `OVModelForCausalLM.from_pretrained` でロード
       - `model.generate(..., assistant_model=drafter)` で MTP
    2. **OpenVINO GenAI (LLMPipeline)**: 高速ルート（OpenVINO ≥ 2024.4）
       - `LLMPipeline(model_path, device, draft_model=...)` で MTP
       - 現状はオプション。デフォルトは1のルート

  - 依存パッケージ未インストールでも import エラーにせず、`is_available` で graceful degradation
  - モデルファイルが ~/.hoshutaro/models/ に未配置なら NotImplementedError 同等のエラー応答
    （フロント setup ページでダウンロード誘導）

  - Thinking Mode: `<\\|think\\|>...</think>` ブロックを除去して最終応答のみ返す
  - KV キャッシュ: 現状は HF transformers の `past_key_values` セッションメモリ管理に委譲
    （将来の OpenVINO GenAI 連携時にディスク永続化を実装）

  - SSE ストリーミング: TextIteratorStreamer 経由で yield
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Any, AsyncGenerator, Iterator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Optional imports（インストールされていなくても import 失敗しない）
# ───────────────────────────────────────────────────────────


def _try_import_transformers() -> tuple[Any, Any, Any, Optional[str]]:
    """
    transformers を import。失敗時は (None, None, None, error_message)。

    Returns:
        (AutoTokenizer, GenerationConfig, TextIteratorStreamer, error)
    """
    try:
        from transformers import (  # type: ignore
            AutoTokenizer,
            GenerationConfig,
            TextIteratorStreamer,
        )
        return AutoTokenizer, GenerationConfig, TextIteratorStreamer, None
    except ImportError as e:
        return None, None, None, f"transformers not installed: {e}"


def _try_import_optimum_intel() -> tuple[Any, Optional[str]]:
    """optimum-intel を import。失敗時は (None, error_message)。"""
    try:
        from optimum.intel import OVModelForCausalLM  # type: ignore
        return OVModelForCausalLM, None
    except ImportError as e:
        return None, f"optimum-intel not installed: {e}"


# ───────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────


_THINK_PATTERN = re.compile(r"<\|think\|>.*?</think>", re.DOTALL)


def _strip_thinking(text: str) -> str:
    """Thinking Mode の <|think|>...</think> ブロックを除去。"""
    return _THINK_PATTERN.sub("", text).strip()


def _resolve_model_dir(env_var: Optional[str]) -> Optional[Path]:
    if not env_var:
        return None
    raw = os.environ.get(env_var)
    if not raw:
        return None
    path = Path(os.path.expanduser(raw))
    return path if path.exists() else None


def _detect_device() -> str:
    """OpenVINO デバイス自動検出。"""
    auto = os.environ.get("OPENVINO_DEVICE", "").strip().upper()
    if auto:
        return auto
    try:
        import openvino as ov  # type: ignore
        core = ov.Core()
        devices = core.available_devices
        # 優先順位: NPU > GPU > CPU
        for pref in ("NPU", "GPU.0", "GPU"):
            if pref in devices:
                return pref
        return "CPU"
    except Exception:
        return "CPU"


def _format_messages(messages: list[dict]) -> str:
    """
    {role, content} の配列を Gemma 4 のチャットテンプレートに整形。

    Gemma 4 の正式チャットテンプレートは tokenizer の apply_chat_template が標準だが、
    本ヘルパは tokenizer 未ロード時の最小フォーマットとして使用。
    """
    lines = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        lines.append(f"<start_of_turn>{role}\n{content}<end_of_turn>")
    lines.append("<start_of_turn>model\n")
    return "\n".join(lines)


# ───────────────────────────────────────────────────────────
# OpenVinoGemmaAdapter
# ───────────────────────────────────────────────────────────


class OpenVinoGemmaAdapter(LLMAdapter):
    """
    OpenVINO + Gemma 4 E2B-it 推論アダプタ。

    Args:
        spec: target モデル設定（registry の LLM_MODELS エントリ）
        assistant_spec: MTP drafter 設定（None なら通常推論）
    """

    def __init__(
        self,
        spec: dict[str, Any],
        assistant_spec: Optional[dict[str, Any]] = None,
    ) -> None:
        self.spec = spec
        self.assistant_spec = assistant_spec
        self.device = _detect_device()
        self.mtp_enabled = bool(
            spec.get("supports_mtp")
            and spec.get("mtp_default_enabled")
            and assistant_spec is not None
        )

        # 遅延ロード用
        self._tokenizer = None
        self._target_model = None
        self._drafter_model = None
        self._load_lock = threading.Lock()
        self._load_error: Optional[str] = None
        self._loaded = False

        logger.info(
            "OpenVinoGemmaAdapter init: target=%s drafter=%s device=%s mtp=%s",
            spec.get("hf_repo"),
            (assistant_spec or {}).get("hf_repo"),
            self.device,
            self.mtp_enabled,
        )

    # ───────────────────────────────────────────────────────
    # Lazy load
    # ───────────────────────────────────────────────────────

    def _ensure_loaded(self, *, with_drafter: bool = False) -> None:
        if self._loaded and (not with_drafter or self._drafter_model is not None):
            return
        with self._load_lock:
            if self._loaded and (not with_drafter or self._drafter_model is not None):
                return

            if self._load_error and self._load_error.startswith("HARD_FAIL"):
                # 致命的失敗（依存無し）→再試行しない
                raise NotImplementedError(self._load_error)

            AutoTokenizer, _, _, transformers_err = _try_import_transformers()
            if transformers_err:
                self._load_error = f"HARD_FAIL: {transformers_err}"
                raise NotImplementedError(self._load_error)

            OVModelForCausalLM, ov_err = _try_import_optimum_intel()
            if ov_err:
                self._load_error = f"HARD_FAIL: {ov_err}"
                raise NotImplementedError(self._load_error)

            target_dir = _resolve_model_dir(self.spec.get("model_dir_env"))
            if target_dir is None:
                self._load_error = (
                    f"Target model directory not found. "
                    f"Set {self.spec.get('model_dir_env')} and download "
                    f"{self.spec.get('hf_repo')} via initial setup."
                )
                raise NotImplementedError(self._load_error)

            try:
                if self._tokenizer is None:
                    self._tokenizer = AutoTokenizer.from_pretrained(str(target_dir))
                if self._target_model is None:
                    self._target_model = OVModelForCausalLM.from_pretrained(
                        str(target_dir), device=self.device
                    )
                logger.info(
                    "Target loaded: %s on %s", self.spec.get("hf_repo"), self.device
                )
            except Exception as e:
                self._load_error = f"Failed to load target model: {e}"
                logger.exception("Target model load failed")
                raise NotImplementedError(self._load_error)

            if with_drafter and self.mtp_enabled and self.assistant_spec:
                drafter_dir = _resolve_model_dir(self.assistant_spec.get("model_dir_env"))
                if drafter_dir is not None:
                    try:
                        self._drafter_model = OVModelForCausalLM.from_pretrained(
                            str(drafter_dir), device=self.device
                        )
                        logger.info(
                            "Drafter loaded: %s",
                            self.assistant_spec.get("hf_repo"),
                        )
                    except Exception as e:
                        logger.warning(
                            "Drafter load failed (%s); falling back to target-only",
                            e,
                        )
                        self._drafter_model = None
                else:
                    logger.info(
                        "Drafter directory not configured; MTP disabled at runtime"
                    )

            self._loaded = True

    # ───────────────────────────────────────────────────────
    # Generation (sync core, async wrapper)
    # ───────────────────────────────────────────────────────

    def _build_inputs(self, messages: list[dict], system_prompt: Optional[str] = None):
        msgs: list[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend(messages)

        # tokenizer の apply_chat_template が使えれば優先
        if self._tokenizer and hasattr(self._tokenizer, "apply_chat_template"):
            try:
                inputs = self._tokenizer.apply_chat_template(
                    msgs,
                    add_generation_prompt=True,
                    return_tensors="pt",
                    tokenize=True,
                )
                # apply_chat_template は Tensor を返す（input_ids 相当）
                return {"input_ids": inputs}
            except Exception as e:
                logger.debug("apply_chat_template failed (%s), using fallback", e)

        prompt = _format_messages(msgs)
        return self._tokenizer(prompt, return_tensors="pt")

    def _generate_sync(
        self,
        messages: list[dict],
        *,
        system_prompt: Optional[str] = None,
        max_new_tokens: int = 1024,
        temperature: float = 0.7,
        json_schema: Optional[dict] = None,
        use_mtp: Optional[bool] = None,
    ) -> str:
        self._ensure_loaded(with_drafter=bool(use_mtp if use_mtp is not None else self.mtp_enabled))
        inputs = self._build_inputs(messages, system_prompt)

        gen_kwargs: dict[str, Any] = {
            "max_new_tokens": max_new_tokens,
            "do_sample": temperature > 0,
            "temperature": max(temperature, 0.01),
        }
        if json_schema:
            # 一部 transformers バージョンは constrained generation 対応
            gen_kwargs["forced_decoder_ids"] = None  # placeholder

        # MTP（Speculative Decoding）有効時は assistant_model を渡す
        effective_mtp = use_mtp if use_mtp is not None else self.mtp_enabled
        if effective_mtp and self._drafter_model is not None:
            gen_kwargs["assistant_model"] = self._drafter_model

        outputs = self._target_model.generate(**inputs, **gen_kwargs)
        # 入力部分を除いた応答のみデコード
        input_len = inputs["input_ids"].shape[-1]
        response_ids = outputs[0][input_len:]
        text = self._tokenizer.decode(response_ids, skip_special_tokens=True)
        return _strip_thinking(text)

    def _stream_sync(
        self,
        messages: list[dict],
        *,
        system_prompt: Optional[str] = None,
        max_new_tokens: int = 1024,
        temperature: float = 0.7,
        use_mtp: Optional[bool] = None,
    ) -> Iterator[str]:
        self._ensure_loaded(with_drafter=bool(use_mtp if use_mtp is not None else self.mtp_enabled))
        _, _, TextIteratorStreamer, _ = _try_import_transformers()
        if TextIteratorStreamer is None:
            raise NotImplementedError("TextIteratorStreamer unavailable")

        inputs = self._build_inputs(messages, system_prompt)
        streamer = TextIteratorStreamer(
            self._tokenizer, skip_prompt=True, skip_special_tokens=True
        )

        gen_kwargs: dict[str, Any] = {
            **inputs,
            "max_new_tokens": max_new_tokens,
            "do_sample": temperature > 0,
            "temperature": max(temperature, 0.01),
            "streamer": streamer,
        }
        effective_mtp = use_mtp if use_mtp is not None else self.mtp_enabled
        if effective_mtp and self._drafter_model is not None:
            gen_kwargs["assistant_model"] = self._drafter_model

        # 別スレッドで生成、メインスレッドは streamer から chunk を取り出す
        thread = threading.Thread(target=self._target_model.generate, kwargs=gen_kwargs)
        thread.start()
        in_thinking = False
        for chunk in streamer:
            # ストリーミング中の Thinking 除去（簡易）
            if "<|think|>" in chunk:
                in_thinking = True
            if in_thinking:
                if "</think>" in chunk:
                    in_thinking = False
                    chunk = chunk.split("</think>", 1)[1]
                else:
                    continue
            if chunk:
                yield chunk
        thread.join(timeout=60)

    # ───────────────────────────────────────────────────────
    # LLMAdapter API
    # ───────────────────────────────────────────────────────

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        return await asyncio.to_thread(
            self._generate_sync,
            messages,
            max_new_tokens=int(kwargs.get("max_new_tokens", 1024)),
            temperature=float(kwargs.get("temperature", 0.7)),
            use_mtp=kwargs.get("use_mtp"),
        )

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue(maxsize=64)

        def producer() -> None:
            try:
                for chunk in self._stream_sync(
                    messages,
                    system_prompt=system_prompt,
                    max_new_tokens=int(kwargs.get("max_new_tokens", 1024)),
                    temperature=float(kwargs.get("temperature", 0.7)),
                    use_mtp=kwargs.get("use_mtp"),
                ):
                    asyncio.run_coroutine_threadsafe(queue.put(chunk), loop).result()
            except NotImplementedError as e:
                asyncio.run_coroutine_threadsafe(
                    queue.put(f"[エラー: {e}]"), loop
                ).result()
            except Exception as e:
                logger.exception("Stream producer failed")
                asyncio.run_coroutine_threadsafe(queue.put(f"[エラー: {e}]"), loop).result()
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(None), loop).result()

        thread = threading.Thread(target=producer, daemon=True)
        thread.start()
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        # Classifier は temperature 低 + Thinking off 推奨
        try:
            raw = await asyncio.to_thread(
                self._generate_sync,
                messages,
                system_prompt=system_prompt,
                max_new_tokens=256,
                temperature=0.1,
                use_mtp=False,  # Classifier は短いので MTP オーバーヘッド回避
            )
        except NotImplementedError as e:
            logger.warning("classify_intent unavailable: %s", e)
            return {"intent": "converse", "parameters": {}, "confidence": 0.0}

        try:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            pass
        return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        messages = [{"role": "user", "content": user_prompt}]
        return await asyncio.to_thread(
            self._generate_sync,
            messages,
            system_prompt=system_prompt,
            max_new_tokens=int(kwargs.get("max_new_tokens", 1024)),
            temperature=0.3,
            json_schema=json_schema,
            use_mtp=kwargs.get("use_mtp"),
        )

    async def ping(self) -> dict:
        try:
            self._ensure_loaded(with_drafter=False)
            return {
                "ok": True,
                "device": self.device,
                "target": self.spec.get("hf_repo"),
                "drafter": (self.assistant_spec or {}).get("hf_repo")
                if self.mtp_enabled
                else None,
                "mtp_enabled": self.mtp_enabled,
            }
        except NotImplementedError as e:
            return {"ok": False, "message": str(e)}
        except Exception as e:
            return {"ok": False, "message": str(e)}
