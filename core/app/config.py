import shutil
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# core/ ディレクトリの .env を基準にする
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
_ENV_EXAMPLE = _ENV_FILE.with_name(".env.example")

# .env が存在しなければ .env.example からコピーして初期設定を適用
if not _ENV_FILE.exists() and _ENV_EXAMPLE.exists():
    shutil.copy2(_ENV_EXAMPLE, _ENV_FILE)


class Settings(BaseSettings):
    # ── GitHub (Plugin Downloads) ──
    github_pat: str = ""

    # ── Development Mode ──
    dev_mode: bool = False

    # ── Home Directory (set by Launcher, fallback to core/) ──
    hoshutaro_home: str = str(Path(__file__).resolve().parents[1])

    # ── LLM Adapter (registry resolve のデフォルト) ──
    # 既定はローカル Gemma 4 E2B-it（OpenVINO）。
    # registry.LLM_MODELS のキーまたは MCP plugin id を指定可能。
    llm_adapter: str = "local_gemma_4_e2b_it"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 1024
    skills_path: str = "./skills/SKILLS.md"
    debug_mode: bool = False

    # ── Excel パイプライン スケール制御（WS1-7） ──
    # LLM 並列度（Phase 2 のシート別エージェント等）と Phase 3 チャンクサイズ。
    excel_pipeline_max_concurrency: int = 4
    excel_pipeline_chunk_size: int = 500
    excel_pipeline_phase_timeout_sec: float = 180.0
    excel_pipeline_fuzzy_match_threshold: float = 0.8

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
