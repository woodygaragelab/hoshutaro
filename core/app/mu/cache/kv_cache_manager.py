"""
KV キャッシュマネージャ — prompt_cache_meta テーブルと実ファイル（~/.hoshutaro/llm_cache/）の整合管理。

設計:
  - 実際の KV キャッシュ（バイナリ）の生成・読み込みは OpenVinoGemmaAdapter（Track B）が担当
  - 本マネージャはメタ管理 + ファイル存在検証 + invalidate + ディスク使用量集計
  - 実体ファイル: ~/.hoshutaro/llm_cache/{cache_key}.bin（OpenVINO の場合）
                  または別パス（モデルプロバイダ依存）

呼び出しフロー:
  1. Skill 実行時、cache_key を解決
  2. KvCacheManager.lookup(cache_key, model_id, rules_hash, lora_version) で「再利用可能か」判定
  3. 再利用可能なら cache_path を返却、Adapter がそれをロード
  4. 不可なら新規 cache 作成、KvCacheManager.register(...) で記録
  5. ルール更新等で invalidate
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from app.mu.memory import prompt_cache

logger = logging.getLogger(__name__)


def _default_cache_dir() -> Path:
    raw = os.environ.get("KASE_KV_CACHE_DIR")
    if raw:
        path = Path(os.path.expanduser(raw))
    else:
        path = Path.home() / ".hoshutaro" / "llm_cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


class KvCacheManager:
    """
    KV キャッシュ管理。スレッドセーフではないので、利用側で必要に応じてロック。
    """

    def __init__(self, cache_dir: Optional[Path] = None) -> None:
        self.cache_dir = cache_dir or _default_cache_dir()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    # ───────────────────────────────────────────────────────
    # パス解決
    # ───────────────────────────────────────────────────────

    def cache_path(self, cache_key: str) -> Path:
        """cache_key からファイルパスを返す（存在保証なし）。"""
        # 安全のためファイル名を sanitize（パストラバーサル防止）
        safe = "".join(c for c in cache_key if c.isalnum() or c in ("_", "-", "."))
        if not safe:
            raise ValueError(f"Invalid cache_key: {cache_key!r}")
        return self.cache_dir / f"{safe}.bin"

    # ───────────────────────────────────────────────────────
    # ルックアップ・登録
    # ───────────────────────────────────────────────────────

    def lookup(
        self,
        cache_key: str,
        *,
        rules_hash: str,
        model_id: str,
        lora_version: Optional[str] = None,
    ) -> Optional[Path]:
        """
        既存キャッシュが現在のルール/モデル/LoRA と一致し、ファイルも存在するか検証。

        Returns:
            一致時はファイルパス、一致しない or ファイル欠損時は None
        """
        if not prompt_cache.is_valid(
            cache_key,
            expected_rules_hash=rules_hash,
            expected_model_id=model_id,
            expected_lora_version=lora_version,
        ):
            return None
        path = self.cache_path(cache_key)
        if not path.exists():
            # メタはあるがファイルが消えている → メタも削除
            logger.warning(
                "Cache file missing for %s; invalidating meta", cache_key
            )
            prompt_cache.invalidate(cache_key)
            return None
        prompt_cache.record_hit(cache_key)
        return path

    def register(
        self,
        cache_key: str,
        *,
        rules_hash: str,
        model_id: str,
        lora_version: Optional[str] = None,
    ) -> Path:
        """
        新規キャッシュ（または再構築後）の登録。返り値はファイルを書き込むべきパス。
        """
        path = self.cache_path(cache_key)
        prompt_cache.upsert(
            cache_key=cache_key,
            file_path=str(path),
            model_id=model_id,
            rules_hash=rules_hash,
            lora_version=lora_version,
        )
        return path

    def invalidate(self, cache_key: str) -> bool:
        """メタとファイル両方を削除。"""
        path = self.cache_path(cache_key)
        if path.exists():
            try:
                path.unlink()
            except OSError as e:
                logger.warning("Failed to remove cache file %s: %s", path, e)
        return prompt_cache.invalidate(cache_key)

    def invalidate_by_lora_version(self, lora_version: str) -> int:
        """LoRA 更新時の一括 invalidate。"""
        # まずメタから対象を取得してファイル削除
        for meta in prompt_cache.list_all(limit=10_000):
            if meta.lora_version == lora_version:
                self.invalidate(meta.cache_key)
        return prompt_cache.invalidate_by_lora_version(lora_version)

    # ───────────────────────────────────────────────────────
    # 診断
    # ───────────────────────────────────────────────────────

    def disk_usage(self) -> dict[str, int]:
        """ディスク使用量サマリ。"""
        if not self.cache_dir.exists():
            return {"file_count": 0, "total_bytes": 0}
        total = 0
        count = 0
        for entry in self.cache_dir.iterdir():
            if entry.is_file():
                try:
                    total += entry.stat().st_size
                    count += 1
                except OSError:
                    pass
        return {"file_count": count, "total_bytes": total}

    def cleanup_orphans(self) -> int:
        """メタが存在しない孤立キャッシュファイルを削除。返り値は削除件数。"""
        if not self.cache_dir.exists():
            return 0
        valid_keys = {m.cache_key for m in prompt_cache.list_all(limit=100_000)}
        removed = 0
        for entry in self.cache_dir.iterdir():
            if entry.is_file() and entry.suffix == ".bin":
                key = entry.stem
                if key not in valid_keys:
                    try:
                        entry.unlink()
                        removed += 1
                    except OSError:
                        pass
        return removed


# ───────────────────────────────────────────────────────────
# シングルトン
# ───────────────────────────────────────────────────────────

_default_manager: Optional[KvCacheManager] = None


def get_manager() -> KvCacheManager:
    global _default_manager
    if _default_manager is None:
        _default_manager = KvCacheManager()
    return _default_manager


def reset_for_tests(manager: Optional[KvCacheManager] = None) -> None:
    global _default_manager
    _default_manager = manager
