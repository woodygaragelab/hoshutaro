"""
OpenVINO + Gemma 4 E2B-it Adapter（openvino-genai LLMPipeline + MTP / Speculative Decoding）。

設計（プラン WS1-2）:
  - 推論は `openvino_genai.LLMPipeline(model_dir, device)` をベースとする。
  - **MTP**: `ov_genai.draft_model(drafter_dir, device)` を作成し、
    `LLMPipeline(model_dir, device, draft_model=drafter)` で渡す。
    GenerationConfig の `num_assistant_tokens` / `assistant_confidence_threshold` で制御。
  - drafter 未配置・未設定なら `draft_model` を渡さず target 単体で動作（graceful degrade）。
  - chat template は `pipe.get_tokenizer().apply_chat_template(...)` を使う。
  - ストリーミングは `pipe.generate(prompt, streamer=callback)` の Python ストリーマで実装。

依存:
  - 実行時: `openvino-genai >= 2024.4`（プラン WS1-1 / requirements-ml.txt）。
  - 依存未導入でもバックエンドが起動するよう optional import パターンを維持。

NPU/GPU/CPU 検出:
  - 環境変数 `OPENVINO_DEVICE` 優先。未設定なら NPU > GPU > CPU の順に自動選択。
  - NPU 利用時は `core/.npucache` を `CACHE_DIR` に指定（既存 plugin の挙動を移植）。

Thinking モード（Gemma 4 の `<|think|>...</think>`）は除去して最終応答のみ返す。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Any, AsyncGenerator, Callable, Iterator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# Optional imports（インストールされていなくても import 失敗しない）
# ───────────────────────────────────────────────────────────


def _try_import_genai() -> tuple[Any, Optional[str]]:
    """openvino-genai を import。失敗時は (None, error_message)。"""
    try:
        import openvino_genai as ov_genai  # type: ignore
        return ov_genai, None
    except ImportError as e:
        return None, f"openvino-genai not installed: {e}"


def _try_import_openvino() -> tuple[Any, Optional[str]]:
    """openvino 本体を import（デバイス検出用）。失敗時は (None, error_message)。"""
    try:
        import openvino as ov  # type: ignore
        return ov, None
    except ImportError as e:
        return None, f"openvino not installed: {e}"


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
    """OpenVINO デバイス自動検出（NPU > GPU > CPU）。"""
    auto = os.environ.get("OPENVINO_DEVICE", "").strip().upper()
    if auto:
        return auto
    ov, _ = _try_import_openvino()
    if ov is None:
        return "CPU"
    try:
        core = ov.Core()
        devices = core.available_devices
        for pref in ("NPU", "GPU.0", "GPU"):
            if pref in devices:
                return pref
        return "CPU"
    except Exception:
        return "CPU"


def _format_messages(messages: list[dict]) -> str:
    """
    {role, content} の配列を Gemma 4 のチャットテンプレートに整形（tokenizer 未ロード時の最小フォーマット）。

    `apply_chat_template` が利用可能なら adapter 側ではそちらを優先する。本関数は
    tokenizer なしでもテストで挙動を確認できるよう module-level に置く。
    """
    lines: list[str] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        lines.append(f"<start_of_turn>{role}\n{content}<end_of_turn>")
    lines.append("<start_of_turn>model\n")
    return "\n".join(lines)


def _build_device_config(device: str) -> dict:
    """既存 plugins/openvino-adapter/server.py の device-config / NPU .npucache 回避を流用。"""
    config: dict[str, Any] = {}
    if "NPU" in device:
        # backend 直下の .npucache を絶対パスで指定（既存の挙動を維持）
        legacy_cache_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", ".npucache")
        )
        config["CACHE_DIR"] = legacy_cache_dir
        # NPU 単独時はパフォーマンス hint を付けない（キャッシュハッシュが変わると即フリーズ）
        if device == "NPU":
            return config
    # GPU/CPU/HETERO 系は LATENCY hint
    try:
        import openvino.properties.hint as hints  # type: ignore
        config[hints.performance_mode()] = hints.PerformanceMode.LATENCY
    except Exception:
        pass
    return config


# ───────────────────────────────────────────────────────────
# OpenVinoGemmaAdapter
# ───────────────────────────────────────────────────────────


class OpenVinoGemmaAdapter(LLMAdapter):
    """
    OpenVINO + Gemma 4 E2B-it 推論アダプタ（openvino-genai LLMPipeline ベース）。

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
        self._pipe = None
        self._tokenizer = None  # ov_genai Tokenizer（chat_template 適用用）
        self._drafter_active = False
        self._infer_lock = threading.Lock()
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

    def _ensure_loaded(self) -> None:
        """LLMPipeline を遅延ロード。drafter があれば draft_model 付きで構築。"""
        if self._loaded:
            return
        with self._load_lock:
            if self._loaded:
                return

            if self._load_error and self._load_error.startswith("HARD_FAIL"):
                raise NotImplementedError(self._load_error)

            ov_genai, genai_err = _try_import_genai()
            if genai_err:
                self._load_error = f"HARD_FAIL: {genai_err}"
                raise NotImplementedError(self._load_error)

            target_dir = _resolve_model_dir(self.spec.get("model_dir_env"))
            if target_dir is None:
                self._load_error = (
                    f"Target model directory not found. "
                    f"Set {self.spec.get('model_dir_env')} and download "
                    f"{self.spec.get('hf_repo')} via initial setup."
                )
                raise NotImplementedError(self._load_error)

            device_config = _build_device_config(self.device)

            # drafter（MTP）構築は target ロード前に行い、draft_model を kwargs に乗せる
            draft_kwargs: dict[str, Any] = {}
            if self.mtp_enabled and self.assistant_spec is not None:
                drafter_dir = _resolve_model_dir(self.assistant_spec.get("model_dir_env"))
                if drafter_dir is not None:
                    try:
                        drafter = ov_genai.draft_model(str(drafter_dir), self.device)
                        draft_kwargs["draft_model"] = drafter
                        self._drafter_active = True
                        logger.info(
                            "Drafter loaded for MTP: %s",
                            self.assistant_spec.get("hf_repo"),
                        )
                    except Exception as e:
                        logger.warning(
                            "Drafter load failed (%s); falling back to target-only",
                            e,
                        )
                        self._drafter_active = False
                else:
                    logger.info(
                        "Drafter directory not configured (%s); MTP disabled at runtime",
                        self.assistant_spec.get("model_dir_env"),
                    )

            try:
                self._pipe = ov_genai.LLMPipeline(
                    str(target_dir), self.device, **device_config, **draft_kwargs
                )
                self._tokenizer = self._pipe.get_tokenizer()
                logger.info(
                    "LLMPipeline loaded: target=%s device=%s mtp_active=%s",
                    self.spec.get("hf_repo"),
                    self.device,
                    self._drafter_active,
                )
            except Exception as e:
                self._load_error = f"Failed to load LLMPipeline: {e}"
                logger.exception("LLMPipeline load failed")
                raise NotImplementedError(self._load_error)

            self._loaded = True

    # ───────────────────────────────────────────────────────
    # Prompt build & generation config
    # ───────────────────────────────────────────────────────

    def _apply_chat_template(
        self, messages: list[dict], system_prompt: Optional[str] = None
    ) -> str:
        msgs: list[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend(messages)
        try:
            return self._tokenizer.apply_chat_template(msgs, add_generation_prompt=True)
        except Exception as e:
            logger.debug("apply_chat_template failed (%s), using raw fallback", e)
            return _format_messages(msgs)

    def _build_generation_config(
        self,
        *,
        max_new_tokens: int,
        temperature: float,
        use_mtp: Optional[bool],
    ) -> Any:
        ov_genai, _ = _try_import_genai()
        gen_cfg = ov_genai.GenerationConfig()
        gen_cfg.max_new_tokens = int(max_new_tokens)
        if temperature > 0:
            gen_cfg.do_sample = True
            gen_cfg.temperature = float(max(temperature, 0.01))
        else:
            gen_cfg.do_sample = False

        # MTP（Speculative Decoding）— drafter がロード済みの場合のみ有効化
        effective_mtp = (
            self._drafter_active
            if use_mtp is None
            else (use_mtp and self._drafter_active)
        )
        if effective_mtp:
            # num_assistant_tokens: drafter が一度に提案するトークン数の目安。
            # assistant_confidence_threshold: drafter 採択の信頼度閾値。
            for attr, value in (
                ("num_assistant_tokens", 5),
                ("assistant_confidence_threshold", 0.4),
            ):
                if hasattr(gen_cfg, attr):
                    setattr(gen_cfg, attr, value)
        return gen_cfg

    # ───────────────────────────────────────────────────────
    # Generation (sync core, async wrapper)
    # ───────────────────────────────────────────────────────

    def _generate_sync(
        self,
        messages: list[dict],
        *,
        system_prompt: Optional[str] = None,
        max_new_tokens: int = 1024,
        temperature: float = 0.7,
        use_mtp: Optional[bool] = None,
    ) -> str:
        self._ensure_loaded()
        prompt = self._apply_chat_template(messages, system_prompt)
        gen_cfg = self._build_generation_config(
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            use_mtp=use_mtp,
        )
        with self._infer_lock:
            result = self._pipe.generate(prompt, gen_cfg)
        text = str(result).strip()
        return _strip_thinking(text)

    def _stream_sync(
        self,
        messages: list[dict],
        *,
        system_prompt: Optional[str] = None,
        max_new_tokens: int = 1024,
        temperature: float = 0.7,
        use_mtp: Optional[bool] = None,
        emit: Callable[[str], None],
    ) -> None:
        """同期ストリーミング。`emit(chunk)` をストリーマから呼び出す。"""
        self._ensure_loaded()
        prompt = self._apply_chat_template(messages, system_prompt)
        gen_cfg = self._build_generation_config(
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            use_mtp=use_mtp,
        )

        # openvino-genai のストリーマは callable(str) -> bool|StreamingStatus
        # True/RUNNING を返している間は継続、False/STOP で中断。
        _thinking_state = {"in": False}

        def _streamer(chunk: str) -> bool:
            if not chunk:
                return False
            # ストリーミング中の Thinking 除去
            text = chunk
            if "<|think|>" in text:
                _thinking_state["in"] = True
            if _thinking_state["in"]:
                if "</think>" in text:
                    _thinking_state["in"] = False
                    text = text.split("</think>", 1)[1]
                else:
                    return False
            if text:
                emit(text)
            return False  # False = 継続（一部 binding は bool を継続/中断の意で扱う）

        with self._infer_lock:
            try:
                self._pipe.generate(prompt, gen_cfg, _streamer)
            except TypeError:
                # 一部バージョンは generate(prompt, generation_config=..., streamer=...) シグネチャ
                self._pipe.generate(prompt, generation_config=gen_cfg, streamer=_streamer)

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
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue(maxsize=128)

        def producer() -> None:
            try:
                self._stream_sync(
                    messages,
                    system_prompt=system_prompt,
                    max_new_tokens=int(kwargs.get("max_new_tokens", 1024)),
                    temperature=float(kwargs.get("temperature", 0.7)),
                    use_mtp=kwargs.get("use_mtp"),
                    emit=lambda chunk: asyncio.run_coroutine_threadsafe(
                        queue.put(chunk), loop
                    ).result(),
                )
            except NotImplementedError as e:
                asyncio.run_coroutine_threadsafe(
                    queue.put(f"[エラー: {e}]"), loop
                ).result()
            except Exception as e:
                logger.exception("Stream producer failed")
                asyncio.run_coroutine_threadsafe(
                    queue.put(f"[エラー: {e}]"), loop
                ).result()
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
        # Classifier は temperature 低 + MTP off（短く確定的に）
        try:
            raw = await asyncio.to_thread(
                self._generate_sync,
                messages,
                system_prompt=system_prompt,
                max_new_tokens=256,
                temperature=0.1,
                use_mtp=False,
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
        # JSON Schema が指定されていればプロンプトに埋め込む（Gemma 4 は強制構文非対応）
        prompt = user_prompt
        if json_schema:
            prompt = (
                f"{user_prompt}\n\n"
                f"次の JSON Schema に厳密に従い、JSON オブジェクトのみで応答してください。"
                f"前置きや説明、コードブロックは出力しないこと。\n"
                f"Schema: {json.dumps(json_schema, ensure_ascii=False)}"
            )
        messages = [{"role": "user", "content": prompt}]
        return await asyncio.to_thread(
            self._generate_sync,
            messages,
            system_prompt=system_prompt,
            max_new_tokens=int(kwargs.get("max_new_tokens", 2048)),
            temperature=0.3,
            use_mtp=kwargs.get("use_mtp"),
        )

    async def ping(self) -> dict:
        try:
            self._ensure_loaded()
            return {
                "ok": True,
                "device": self.device,
                "target": self.spec.get("hf_repo"),
                "drafter": (self.assistant_spec or {}).get("hf_repo")
                if self._drafter_active
                else None,
                "mtp_enabled": self._drafter_active,
            }
        except NotImplementedError as e:
            return {"ok": False, "message": str(e)}
        except Exception as e:
            return {"ok": False, "message": str(e)}
