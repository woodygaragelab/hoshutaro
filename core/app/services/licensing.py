"""
License Manager — サブスクリプション + 開発モード管理。

LLM 呼出クォータチェックとプラグインアクセス制御を行う。`DEV_MODE=true` は全制限解除。

プラン WS3-3 で旧 `gemini_quota` / `gemini_used` / `validate_gemini_request` を汎用名
`llm_quota` / `llm_used` / `validate_llm_request` に変更（LLM プロバイダ非依存化）。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class LicenseInfo:
    """ライセンス情報。"""

    def __init__(
        self,
        plan: str = "free",
        is_dev_mode: bool = False,
        llm_quota: int = 100,
        llm_used: int = 0,
        enabled_plugins: list[str] | None = None,
        expires_at: str = "",
    ):
        self.plan = plan
        self.is_dev_mode = is_dev_mode
        self.llm_quota = llm_quota
        self.llm_used = llm_used
        self.enabled_plugins = enabled_plugins or []
        self.expires_at = expires_at

    def to_dict(self) -> dict:
        return {
            "plan": self.plan,
            "isDevMode": self.is_dev_mode,
            "llmQuota": self.llm_quota,
            "llmUsed": self.llm_used,
            "enabledPlugins": self.enabled_plugins,
            "expiresAt": self.expires_at,
        }


# プラン別クォータ定義（LLM 呼出回数の上限）。
PLAN_QUOTAS = {
    "free": 100,
    "standard": 5000,
    "enterprise": 999999,
    "dev": 999999,
}


class LicenseManager:
    """サブスクリプション + 開発モード管理。"""

    _instance: "LicenseManager | None" = None

    def __new__(cls) -> "LicenseManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, "_initialized"):
            self._home = Path(settings.hoshutaro_home)
            self._license_path = self._home / "config" / "license.json"
            self._info: LicenseInfo | None = None
            self._initialized = True

    def _load(self) -> LicenseInfo:
        """ライセンス情報を読み込み。"""
        if settings.dev_mode:
            return LicenseInfo(
                plan="dev",
                is_dev_mode=True,
                llm_quota=999999,
                llm_used=0,
                enabled_plugins=["*"],
                expires_at="",
            )

        if self._license_path.exists():
            try:
                data = json.loads(self._license_path.read_text(encoding="utf-8"))
                # 旧フィールド名 (geminiUsed) もフォールバックで読む（マイグレーション猶予）
                used = data.get("llmUsed", data.get("geminiUsed", 0))
                return LicenseInfo(
                    plan=data.get("plan", "free"),
                    is_dev_mode=False,
                    llm_quota=PLAN_QUOTAS.get(data.get("plan", "free"), 100),
                    llm_used=used,
                    enabled_plugins=data.get("enabledPlugins", []),
                    expires_at=data.get("expiresAt", ""),
                )
            except Exception as e:
                logger.warning("[LicenseManager] ライセンスファイル読み込み失敗: %s", e)

        return LicenseInfo()

    def get_info(self) -> LicenseInfo:
        if self._info is None:
            self._info = self._load()
        return self._info

    def _save(self) -> None:
        if self._info is None:
            return
        self._license_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "plan": self._info.plan,
            "llmUsed": self._info.llm_used,
            "enabledPlugins": self._info.enabled_plugins,
            "expiresAt": self._info.expires_at,
            "lastUpdated": datetime.now().isoformat(),
        }
        self._license_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    async def validate_llm_request(self) -> bool:
        """LLM 呼出前にクォータチェック。プラン WS3-3 で gemini → llm にリネーム。"""
        info = self.get_info()
        if info.is_dev_mode:
            return True
        if info.llm_used >= info.llm_quota:
            logger.warning(
                "[LicenseManager] LLM クォータ超過: %d/%d",
                info.llm_used, info.llm_quota,
            )
            return False
        info.llm_used += 1
        self._save()
        return True

    async def check_plugin_access(self, plugin_id: str) -> bool:
        info = self.get_info()
        if info.is_dev_mode:
            return True
        if "*" in info.enabled_plugins or plugin_id in info.enabled_plugins:
            return True
        return False

    def reset_monthly_usage(self) -> None:
        """月次使用量リセット（スケジューラから）。"""
        info = self.get_info()
        info.llm_used = 0
        self._save()
        logger.info("[LicenseManager] 月次使用量をリセットしました")


license_manager = LicenseManager()
