from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    llm_adapter: str = "openai_compat"
    llm_base_url: str = "http://127.0.0.1:11434/v1"
    llm_model: str = ""
    llm_api_key: str = "none"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 2048
    skills_path: str = "./skills/SKILLS.md"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
