import os
import sys
import logging
import time
import json
import threading
import tempfile
import subprocess
from typing import Optional, List, Dict

from mcp.server.fastmcp import FastMCP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openvino-adapter")

mcp = FastMCP("openvino-adapter")

# Global variables for model state
_pipe = None
_infer_lock = threading.Lock()
_available = False
_device = "none"
_error_msg = ""
_performance_mode = "LATENCY"

NPU_PIPELINE_CONFIG = {
    "MAX_PROMPT_LEN": 4096,
    "MIN_RESPONSE_LEN": 512,
    "CACHE_DIR": ".npucache",
}

def _get_device_order(performance_mode: str) -> list[str]:
    # We remove the hardcoded single-device failover tests when MULTI occurs.
    # By default we just return what is asked.
    return []

def _build_device_config(dev: str, performance_mode: str) -> dict:
    import openvino.properties.hint as hints
    
    config = {}
    
    # NPUを利用する際は、以前のシステムでコンパイルに成功していたキャッシュ（.npucacheの既存blob）を強制的にロードさせる
    # 現在のIntelドライバではQwen3の新規コンパイルが確定でクラッシュする（IE.Convolutionのバグ）ため、過去のキャッシュの再利用が不可欠
    if "NPU" in dev:
        # backend直下の .npucache を絶対パスで指定
        legacy_cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".npucache"))
        config["CACHE_DIR"] = legacy_cache_dir
        # 注: ここで MAX_PROMPT_LEN や GENERATE_HINT を追加すると、
        # OpenVINO側でキャッシュハッシュが変わりキャッシュミスを起こして即フリーズ・タイムアウトするため、絶対に追加しないこと。
        if dev == "NPU":
            return config

    if performance_mode == "THROUGHPUT":
        perf = hints.PerformanceMode.THROUGHPUT
    elif performance_mode == "CUMULATIVE_THROUGHPUT":
        perf = hints.PerformanceMode.CUMULATIVE_THROUGHPUT
    else:
        perf = hints.PerformanceMode.LATENCY
        
    config[hints.performance_mode()] = perf
    return config

def _test_model_load_in_subprocess(model_path: str, device: str, performance_mode: str) -> bool:
    legacy_cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".npucache"))
    # We write a short script that tries to load the model on the target device
    # This prevents fatal C++ compiler aborts (like LLVM ERROR on NPU) from killing the MCP server
    
    test_code = f"""
import sys
import openvino.properties.hint as hints
import openvino_genai as ov_genai

config = {{}}
if "NPU" in "{device}":
    config["CACHE_DIR"] = r"{legacy_cache_dir}"
    if "{device}" == "NPU":
        pass # Only NPU
elif "{performance_mode}" == "THROUGHPUT":
    config[hints.performance_mode()] = hints.PerformanceMode.THROUGHPUT
elif "{performance_mode}" == "CUMULATIVE_THROUGHPUT":
    config[hints.performance_mode()] = hints.PerformanceMode.CUMULATIVE_THROUGHPUT
else:
    config[hints.performance_mode()] = hints.PerformanceMode.LATENCY

try:
    pipe = ov_genai.LLMPipeline(r'{model_path}', '{device}', **config)
    del pipe
    sys.exit(0)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
"""
    try:
        import tempfile, subprocess
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(test_code)
            tmp_path = f.name
        
        result = subprocess.run([sys.executable, tmp_path], capture_output=True, text=True, timeout=180)
        os.remove(tmp_path)
        if result.returncode == 0:
            return True
        else:
            logger.warning(f"Device test failed for {device}: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Failed to run subprocess test: {e}")
        return False

def load_model_if_needed():
    global _pipe, _available, _device, _error_msg, _performance_mode
    
    with _infer_lock:
        if _pipe is not None and _available:
            return  # Already loaded
            
        model_dir = os.environ.get("LLM_BASE_URL", "C:\\Users\\kazuh\\OpenVINO_Models")
        model_name = os.environ.get("LLM_MODEL", "")
        if not model_name:
            _error_msg = "Model path not configured"
            _available = False
            return
            
        model_path = os.path.join(model_dir, model_name)
        device = os.environ.get("OPENVINO_DEVICE", "AUTO")
        _performance_mode = os.environ.get("OPENVINO_PERFORMANCE_MODE", "LATENCY")
        
        try:
            # 安全のためNPUが絡む場合は事前にサブプロセスでコンパイルテストを行い、クラッシュを回避する
            if "NPU" in device:
                if not _test_model_load_in_subprocess(model_path, device, _performance_mode):
                    logger.warning(f"NPU test failed for {device}, falling back to GPU")
                    device = "GPU"  # 自動フォールバック
            
            import openvino_genai as ov_genai
            config = _build_device_config(device, _performance_mode)
            _pipe = ov_genai.LLMPipeline(model_path, device, **config)
            _device = device
            _available = True
            _error_msg = ""
            logger.info(f"Loaded {model_path} on {device} with config {config}")

        except Exception as e:
            _error_msg = f"{device}のロード失敗: {str(e)}"
            _available = False
        except ImportError:
            _error_msg = "openvino-genai がインストールされていません"
            _available = False

@mcp.tool()
def test_connection() -> dict:
    """Test connection and load model if possible"""
    global _available, _device, _performance_mode, _error_msg
    load_model_if_needed()
    
    start = time.monotonic()
    if not _available:
        return {
            "ok": False,
            "latency_ms": 0.0,
            "device": _device,
            "mode": _performance_mode,
            "error": _error_msg
        }
    try:
        with _infer_lock:
            # ウォームアップ時はちゃんとTokenizerのテンプレートを通して正しいテンサー配列にする（直接のRaw文字列はNPUの形状エラーを誘発するため）
            warmup_messages = [{"role": "user", "content": "hello"}]
            prompt_str = _pipe.get_tokenizer().apply_chat_template(warmup_messages, add_generation_prompt=True)
            _pipe.generate(prompt_str, max_new_tokens=1, do_sample=False)
        ok = True
        error_msg = ""
    except Exception as e:
        ok = False
        error_msg = str(e)
        
    return {
        "ok": ok,
        "latency_ms": round((time.monotonic() - start) * 1000, 2),
        "device": _device,
        "mode": _performance_mode,
        "error": error_msg if not ok else None
    }

@mcp.tool()
def list_models() -> List[str]:
    """List available local models from LLM_BASE_URL (OpenVINO_Models dir)"""
    model_dir = os.environ.get("LLM_BASE_URL", "C:\\Users\\kazuh\\OpenVINO_Models")
    if not os.path.exists(model_dir):
        return []
        
    models = []
    for item in os.listdir(model_dir):
        item_path = os.path.join(model_dir, item)
        if os.path.isdir(item_path):
            if os.path.exists(os.path.join(item_path, "openvino_model.xml")):
                models.append(item)
    return models

_download_state = {
    "active": False,
    "repo_id": "",
    "status": "", # "idle", "downloading", "completed", "error"
    "error": ""
}

def _run_hf_download(repo_id: str, target_dir: str):
    global _download_state
    try:
        import os
        os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
        from huggingface_hub import snapshot_download
        
        # Python APIで直接ダウンロードを実行する
        snapshot_download(repo_id=repo_id, local_dir=target_dir)
        
        _download_state["status"] = "completed"
            
    except Exception as e:
        _download_state["status"] = "error"
        _download_state["error"] = str(e)
    finally:
        _download_state["active"] = False


@mcp.tool()
def download_hf_model(repo_id: str) -> dict:
    """Download an OpenVINO model from Hugging Face asynchronously"""
    global _download_state
    if _download_state["active"]:
        return {"ok": False, "error": "A download is already in progress"}
        
    # Example repo_id: OpenVINO/gpt-oss-20b-int4-ov
    model_name = repo_id.split("/")[-1]
    
    base_dir = os.environ.get("LLM_BASE_URL", "C:\\Users\\kazuh\\OpenVINO_Models")
    target_dir = os.path.join(base_dir, model_name)
    
    os.makedirs(target_dir, exist_ok=True)
    
    _download_state["active"] = True
    _download_state["repo_id"] = repo_id
    _download_state["status"] = "downloading"
    _download_state["error"] = ""
    _download_state["target_dir"] = target_dir
    
    thread = threading.Thread(target=_run_hf_download, args=(repo_id, target_dir), daemon=True)
    thread.start()
    
    return {"ok": True, "job_id": repo_id, "target_dir": target_dir}

def _get_dir_size_mb(start_path='.'):
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(start_path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
    except Exception:
        pass
    return round(total_size / (1024 * 1024), 2)

@mcp.tool()
def get_download_status() -> dict:
    """Get the current Hugging Face model download status"""
    global _download_state
    
    state_copy = dict(_download_state)
    if state_copy.get("active") and state_copy.get("target_dir"):
        if os.path.exists(state_copy["target_dir"]):
            state_copy["downloaded_mb"] = _get_dir_size_mb(state_copy["target_dir"])
        else:
            state_copy["downloaded_mb"] = 0.0
            
    return state_copy

@mcp.tool()
def generate_text(
    prompt: Optional[str] = None,
    messages: Optional[List[Dict[str, str]]] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> dict:
    """Generate text completion from prompt or messages"""
    global _available, _pipe
    
    load_model_if_needed()
    if not _available or _pipe is None:
        raise RuntimeError(f"OpenVINO GenAI is not available: {_error_msg}")

    if messages is None:
        if prompt is None:
            raise ValueError("Either prompt or messages must be provided")
        messages = [{"role": "user", "content": prompt}]

    prompt_str = _pipe.get_tokenizer().apply_chat_template(
        messages, add_generation_prompt=True
    )

    with _infer_lock:
        kwargs = {"max_new_tokens": max_tokens, "do_sample": False}
        result = _pipe.generate(prompt_str, **kwargs)
        
    raw = str(result).strip()
    return {"text": raw, "model": "openvino"}

if __name__ == "__main__":
    import asyncio
    import sys
    
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    mcp.run()
