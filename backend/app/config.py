import shutil
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ ディレクトリの .env を基準にする
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
_ENV_EXAMPLE = _ENV_FILE.with_name(".env.example")

# .env が存在しなければ .env.example からコピーして初期設定を適用
if not _ENV_FILE.exists() and _ENV_EXAMPLE.exists():
    shutil.copy2(_ENV_EXAMPLE, _ENV_FILE)


class Settings(BaseSettings):
    # ── Gemini (Built-in LLM) ──
    gemini_api_key: str = ""
    
    # ── GitHub (Plugin Downloads) ──
    github_pat: str = ""
    
    # ── Development Mode ──
    dev_mode: bool = False
    
    # ── Home Directory (set by Launcher, fallback to backend/) ──
    hoshutaro_home: str = str(Path(__file__).resolve().parents[1])
    
    # ── LLM Adapter (Global generic settings) ──
    llm_adapter: str = "gemini"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 1024
    skills_path: str = "./skills/SKILLS.md"
    debug_mode: bool = False

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
