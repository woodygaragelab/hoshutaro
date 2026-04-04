import asyncio
import logging
import threading
import time
import subprocess
import sys
import tempfile
import os
from typing import AsyncGenerator, TYPE_CHECKING

from app.llm.base import LLMAdapter

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

class OpenVINOGenAIAdapter(LLMAdapter):
    """
    openvino-genai Python SDKを使った直接推論アダプター。
    """
    NPU_PIPELINE_CONFIG = {
        "MAX_PROMPT_LEN": 4096,
        "MIN_RESPONSE_LEN": 512,
        "CACHE_DIR": ".npucache",
    }

    @staticmethod
    def _get_device_order(performance_mode: str) -> list[str]:
        try:
            from openvino.runtime import Core
            core = Core()
            available = core.available_devices
            has_npu = any('NPU' in d for d in available)
            has_gpu = any('GPU' in d for d in available)
        except Exception:
            has_npu, has_gpu = False, False

        if performance_mode == "LATENCY":
            priority = ["NPU", "GPU", "CPU"]
        elif performance_mode == "POWER_SAVING":
            priority = ["NPU", "CPU"]
        elif performance_mode == "AUTO":
            priority = ["NPU", "GPU", "CPU"]
        else:
            priority = ["GPU", "CPU"]

        ordered = []
        for p in priority:
            if p == "NPU" and has_npu:
                ordered.append(p)
            elif p == "GPU" and has_gpu:
                ordered.append(p)
            elif p == "CPU":
                ordered.append(p)
                
        if "CPU" not in ordered:
            ordered.append("CPU")
        return ordered

    def _build_device_config(self, dev: str, performance_mode: str) -> dict:
        import openvino.properties.hint as hints
        config = {}
        if "NPU" in dev:
            config.update(self.NPU_PIPELINE_CONFIG)
            if performance_mode in ("LATENCY", "AUTO"):
                config["GENERATE_HINT"] = "BEST_PERF"
            else:
                config["GENERATE_HINT"] = "FAST_COMPILE"

            if dev == "NPU":
                return config

        perf = hints.PerformanceMode.THROUGHPUT if performance_mode == "THROUGHPUT" else hints.PerformanceMode.LATENCY
        config[hints.performance_mode()] = perf
        return config

    def __init__(self, model_path: str, device: str = "AUTO", performance_mode: str = "LATENCY"):
        devices_to_try = (
            [device] if device not in ("AUTO", "", None)
            else self._get_device_order(performance_mode)
        )

        self._pipe = None
        self._available = False
        self._device = "none"
        self._model_path = model_path
        self._performance_mode = performance_mode
        self._error_msg = ""
        self._infer_lock = threading.Lock()

        try:
            import openvino_genai as ov_genai

            if performance_mode == "AUTO" and device in ("AUTO", "", None):
                best = self._benchmark_devices(model_path, devices_to_try)
                if best:
                    devices_to_try = [best]

            for dev in devices_to_try:
                if dev == "NPU" and not self._test_model_load_in_subprocess(model_path, dev):
                    continue

                try:
                    config = self._build_device_config(dev, performance_mode)
                    self._pipe = ov_genai.LLMPipeline(model_path, dev, **config)
                    self._device = dev
                    self._available = True
                    self._error_msg = ""
                    break
                except Exception as e:
                    self._error_msg = f"{dev}のロード失敗: {str(e)}"

            if not self._available:
                if not self._error_msg:
                    self._error_msg = f"全デバイスでのモデルロードに失敗: {devices_to_try}"
        except ImportError:
            self._error_msg = "openvino-genai がインストールされていません"
            self._available = False

    @staticmethod
    def _test_model_load_in_subprocess(model_path: str, device: str) -> bool:
        if device == "NPU":
            test_code = (
                "import sys\n"
                "try:\n"
                "    import openvino_genai as ov_genai\n"
                f"    p = ov_genai.LLMPipeline(r'{model_path}', '{device}', CACHE_DIR='.npucache')\n"
                "    del p\n"
                "    sys.exit(0)\n"
                "except Exception as e:\n"
                "    print(str(e), file=sys.stderr)\n"
                "    sys.exit(1)\n"
            )
        else:
            test_code = (
                "import sys\n"
                "try:\n"
                "    import openvino_genai as ov_genai\n"
                f"    p = ov_genai.LLMPipeline(r'{model_path}', '{device}')\n"
                "    del p\n"
                "    sys.exit(0)\n"
                "except Exception as e:\n"
                "    print(str(e), file=sys.stderr)\n"
                "    sys.exit(1)\n"
            )

        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
                f.write(test_code)
                tmp_path = f.name

            result = subprocess.run(
                [sys.executable, tmp_path],
                timeout=180,
                capture_output=True,
            )
            try:
                os.remove(tmp_path)
            except OSError:
                pass

            if result.returncode == 0:
                return True
            else:
                return False
        except Exception:
            return False

    def _benchmark_devices(self, model_path: str, devices: list[str]) -> str | None:
        import openvino_genai as ov_genai
        results: list[tuple[str, float]] = []
        for dev in devices:
            if not self._test_model_load_in_subprocess(model_path, dev):
                continue
            try:
                config = self._build_device_config(dev, "AUTO")
                pipe = ov_genai.LLMPipeline(model_path, dev, **config)
                start = time.monotonic()
                pipe.generate("hello", max_new_tokens=1, do_sample=False)
                elapsed = time.monotonic() - start
                del pipe
                results.append((dev, elapsed))
            except Exception:
                pass

        if not results:
            return None
        best_dev, best_ms = min(results, key=lambda x: x[1])
        return best_dev

    async def _generate_text_raw(self, messages: list[dict], temperature: float, max_tokens: int) -> str:
        if not self._available or self._pipe is None:
            raise RuntimeError("OpenVINO GenAI パイプラインが利用できません")

        prompt = self._pipe.get_tokenizer().apply_chat_template(
            messages, add_generation_prompt=True
        )

        content_str = " ".join(str(m.get("content", "")) for m in messages)
        prefill = ""
        # JSONを要求するプロンプトの場合、全ての推論モデル(DeepSeek等)に対して「すでに思考プロセスは終了した」と錯覚させ、
        # 配列・オブジェクト問わず即座にJSONの中身だけを生成させるプレフィル
        if "JSON" in content_str:
            prefill = "<think>\n</think>\n```json\n"
            prompt += prefill

        def _run_generate():
            with self._infer_lock:
                return self._pipe.generate(
                    prompt, max_new_tokens=max_tokens, do_sample=False
                )

        result = await asyncio.to_thread(_run_generate)
        raw = str(result).strip()

        if prefill:
            raw = prefill + raw

        logger.info("[OpenVINO GenAI] Raw generation length: %d chars. First 100 chars: %s", len(raw), repr(raw[:100]))
        return raw

    async def _generate_stream_raw(self, messages: list[dict], temperature: float, max_tokens: int) -> AsyncGenerator[str, None]:
        if not self._available or self._pipe is None:
            yield "OpenVINO GenAIが利用できません。"
            return

        import openvino_genai as ov_genai

        prompt = self._pipe.get_tokenizer().apply_chat_template(
            messages, add_generation_prompt=True
        )

        q: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        class AsyncQueueStreamer(ov_genai.StreamerBase):
            def __init__(self, tokenizer):
                ov_genai.StreamerBase.__init__(self)
                self.tokenizer = tokenizer
                self.tokens = []
                self.text_len = 0

            def write(self, token) -> ov_genai.StreamingStatus:
                try:
                    t_val = int(token)
                except TypeError:
                    t_val = int(token[0])
                self.tokens.append(t_val)
                text = self.tokenizer.decode(self.tokens)
                if isinstance(text, list):
                    text = text[0]
                new_text = text[self.text_len :]
                if "\ufffd" not in new_text:
                    self.text_len = len(text)
                    if new_text:
                        loop.call_soon_threadsafe(q.put_nowait, new_text)
                return ov_genai.StreamingStatus.RUNNING

            def end(self):
                text = self.tokenizer.decode(self.tokens)
                if isinstance(text, list):
                    text = text[0]
                new_text = text[self.text_len :]
                if new_text:
                    loop.call_soon_threadsafe(q.put_nowait, new_text)
                loop.call_soon_threadsafe(q.put_nowait, None)

        streamer = AsyncQueueStreamer(self._pipe.get_tokenizer())

        def _run_stream_generate():
            with self._infer_lock:
                self._pipe.generate(
                    prompt,
                    streamer=streamer,
                    max_new_tokens=max_tokens,
                    do_sample=False,
                )

        task = asyncio.create_task(
            asyncio.to_thread(_run_stream_generate)
        )

        while True:
            token = await q.get()
            if token is None:
                break
            yield token

        await task

    async def ping(self) -> dict:
        start = time.monotonic()
        if not self._available:
            return {
                "ok": False,
                "latency_ms": 0.0,
                "device": self._device,
                "mode": self._performance_mode,
                "error": self._error_msg
            }
        try:
            await asyncio.to_thread(
                self._pipe.generate, "hello", max_new_tokens=1, do_sample=False
            )
            ok = True
            error_msg = ""
        except Exception as e:
            ok = False
            error_msg = str(e)
            
        return {
            "ok": ok,
            "latency_ms": round((time.monotonic() - start) * 1000, 2),
            "device": self._device,
            "mode": self._performance_mode,
            "error": error_msg if not ok else None
        }
