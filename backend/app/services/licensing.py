"""
License Manager — サブスクリプション + 開発モード管理

Geminiクォータチェック、プラグインアクセス制御を行う。
DEV_MODE=true の場合は全制限を解除する。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class LicenseInfo:
    """ライセンス情報"""
    def __init__(
        self,
        plan: str = "free",
        is_dev_mode: bool = False,
        gemini_quota: int = 100,
        gemini_used: int = 0,
        enabled_plugins: list[str] | None = None,
        expires_at: str = "",
    ):
        self.plan = plan
        self.is_dev_mode = is_dev_mode
        self.gemini_quota = gemini_quota
        self.gemini_used = gemini_used
        self.enabled_plugins = enabled_plugins or []
        self.expires_at = expires_at

    def to_dict(self) -> dict:
        return {
            "plan": self.plan,
            "isDevMode": self.is_dev_mode,
            "geminiQuota": self.gemini_quota,
            "geminiUsed": self.gemini_used,
            "enabledPlugins": self.enabled_plugins,
            "expiresAt": self.expires_at,
        }


# プラン別クォータ定義
PLAN_QUOTAS = {
    "free": 100,
    "standard": 5000,
    "enterprise": 999999,
    "dev": 999999,
}


class LicenseManager:
    """サブスクリプション + 開発モード管理"""

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
        """ライセンス情報を読み込み"""
        # 開発モード: 全制限解除
        if settings.dev_mode:
            return LicenseInfo(
                plan="dev",
                is_dev_mode=True,
                gemini_quota=999999,
                gemini_used=0,
                enabled_plugins=["*"],
                expires_at="",
            )

        # ライセンスファイルから読み込み
        if self._license_path.exists():
            try:
                data = json.loads(self._license_path.read_text(encoding="utf-8"))
                return LicenseInfo(
                    plan=data.get("plan", "free"),
                    is_dev_mode=False,
                    gemini_quota=PLAN_QUOTAS.get(data.get("plan", "free"), 100),
                    gemini_used=data.get("geminiUsed", 0),
                    enabled_plugins=data.get("enabledPlugins", []),
                    expires_at=data.get("expiresAt", ""),
                )
            except Exception as e:
                logger.warning("[LicenseManager] ライセンスファイル読み込み失敗: %s", e)

        # デフォルト: Free プラン
        return LicenseInfo()

    def get_info(self) -> LicenseInfo:
        """現在のライセンス情報を取得"""
        if self._info is None:
            self._info = self._load()
        return self._info

    def _save(self) -> None:
        """ライセンス情報を保存"""
        if self._info is None:
            return
        self._license_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "plan": self._info.plan,
            "geminiUsed": self._info.gemini_used,
            "enabledPlugins": self._info.enabled_plugins,
            "expiresAt": self._info.expires_at,
            "lastUpdated": datetime.now().isoformat(),
        }
        self._license_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    async def validate_gemini_request(self) -> bool:
        """Gemini API呼び出し前にクォータチェック"""
        info = self.get_info()
        
        # 開発モードは無制限
        if info.is_dev_mode:
            return True
        
        if info.gemini_used >= info.gemini_quota:
            logger.warning(
                "[LicenseManager] Geminiクォータ超過: %d/%d",
                info.gemini_used, info.gemini_quota,
            )
            return False
        
        # カウントアップ
        info.gemini_used += 1
        self._save()
        return True

    async def check_plugin_access(self, plugin_id: str) -> bool:
        """プラグインのライセンスチェック"""
        info = self.get_info()
        
        # 開発モードは全許可
        if info.is_dev_mode:
            return True
        
        # ワイルドカードまたは明示的に含まれているか
        if "*" in info.enabled_plugins or plugin_id in info.enabled_plugins:
            return True
        
        return False

    def reset_monthly_usage(self) -> None:
        """月次使用量リセット (スケジューラーから呼ばれる)"""
        info = self.get_info()
        info.gemini_used = 0
        self._save()
        logger.info("[LicenseManager] 月次使用量をリセットしました")


# シングルトンインスタンス
license_manager = LicenseManager()
