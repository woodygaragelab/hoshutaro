import shutil
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ ディレクトリの .env を基準にする
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
_ENV_EXAMPLE = _ENV_FILE.with_name(".env.example")

# .env が存在しなければ .env.example からコピーして初期設定を適用
if not _ENV_FILE.exists() and _ENV_EXAMPLE.exists():
    shutil.copy2(_ENV_EXAMPLE, _ENV_FILE)


class Settings(BaseSettings):
    llm_adapter: str = "openai_compat"
    llm_base_url: str = "http://127.0.0.1:11434/v1"
    llm_model: str = ""
    llm_api_key: str = "none"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 2048
    skills_path: str = "./skills/SKILLS.md"
    debug_mode: bool = False

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
