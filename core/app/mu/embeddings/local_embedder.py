"""
ローカル埋め込みモデル（multilingual-e5-small、384次元、~120MB）。

依存:
  - sentence-transformers（オプショナル）
  - sentence-transformers が未インストールの環境では NullEmbedder にフォールバックし、
    ベクトル検索機能はスキップされる（is_available() が False）

配布:
  - Tauri リソースに同梱予定（Track E）
  - 開発時は HuggingFace から自動ダウンロード

設計:
  - シングルトンとして遅延初期化（プロセス内で1回だけロード）
  - encode() はバッチ対応、長文は max_length で truncate
  - EmbedderProtocol で抽象化し、将来 OpenVINO 埋め込みやリモート埋め込みに切替可能
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Optional, Protocol, Sequence

logger = logging.getLogger(__name__)


VECTOR_DIM = 384
DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-small"


# ───────────────────────────────────────────────────────────
# Protocol
# ───────────────────────────────────────────────────────────


class EmbedderProtocol(Protocol):
    """埋め込みモデルが実装すべきインターフェース。"""

    @property
    def dim(self) -> int: ...
    @property
    def is_available(self) -> bool: ...

    def encode(self, texts: Sequence[str]) -> list[list[float]]: ...

    def encode_one(self, text: str) -> list[float]: ...


# ───────────────────────────────────────────────────────────
# Implementation: SentenceTransformerEmbedder
# ───────────────────────────────────────────────────────────


class SentenceTransformerEmbedder:
    """
    sentence-transformers ベースの埋め込み実装。

    multilingual-e5-small は「query: 」「passage: 」のプレフィックスを推奨するが、
    Project Mu の用途（短い機器名・ルール説明文）では差が小さいため省略してシンプル運用。
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL_NAME,
        cache_folder: Optional[str] = None,
        device: Optional[str] = None,
    ) -> None:
        self.model_name = model_name
        self.cache_folder = cache_folder or os.environ.get("KASE_EMBEDDING_MODEL_PATH")
        self.device = device or "cpu"
        self._model = None
        self._lock = threading.Lock()
        self._load_error: Optional[str] = None

    def _ensure_loaded(self) -> None:
        if self._model is not None or self._load_error:
            return
        with self._lock:
            if self._model is not None or self._load_error:
                return
            try:
                # 遅延 import（sentence-transformers 未インストール環境でも import 時にエラーにしない）
                from sentence_transformers import SentenceTransformer  # type: ignore

                kwargs: dict = {"device": self.device}
                if self.cache_folder:
                    kwargs["cache_folder"] = self.cache_folder
                self._model = SentenceTransformer(self.model_name, **kwargs)
                logger.info(
                    "Loaded embedder %s on %s (cache=%s)",
                    self.model_name,
                    self.device,
                    self.cache_folder,
                )
            except ImportError as e:
                self._load_error = (
                    f"sentence-transformers not installed: {e}. "
                    "Install with `pip install sentence-transformers` or use NullEmbedder."
                )
                logger.warning(self._load_error)
            except Exception as e:
                self._load_error = f"Failed to load embedder model: {e}"
                logger.warning(self._load_error)

    @property
    def dim(self) -> int:
        return VECTOR_DIM

    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._model is not None

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        self._ensure_loaded()
        if self._model is None:
            raise RuntimeError(
                f"Embedder unavailable: {self._load_error or 'unknown reason'}"
            )
        # numpy を返すが list[list[float]] に変換
        result = self._model.encode(
            list(texts),
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,  # コサイン類似度 = ドット積で計算可能に
        )
        return [v.tolist() for v in result]

    def encode_one(self, text: str) -> list[float]:
        return self.encode([text])[0]


# ───────────────────────────────────────────────────────────
# Implementation: NullEmbedder (フォールバック)
# ───────────────────────────────────────────────────────────


class NullEmbedder:
    """
    埋め込みモデルが利用できない環境用のフォールバック。

    encode() は明示的に例外を投げる。is_available が False なので、
    呼び出し側はベクトル検索をスキップする想定。
    """

    @property
    def dim(self) -> int:
        return VECTOR_DIM

    @property
    def is_available(self) -> bool:
        return False

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        raise RuntimeError("NullEmbedder cannot encode; install sentence-transformers")

    def encode_one(self, text: str) -> list[float]:
        raise RuntimeError("NullEmbedder cannot encode; install sentence-transformers")


# ───────────────────────────────────────────────────────────
# シングルトン取得
# ───────────────────────────────────────────────────────────

_default_embedder: Optional[EmbedderProtocol] = None
_default_lock = threading.Lock()


def get_embedder() -> EmbedderProtocol:
    """
    プロセス内のデフォルト Embedder を取得。

    sentence-transformers が利用可能なら SentenceTransformerEmbedder、
    それ以外は NullEmbedder を返す。
    """
    global _default_embedder
    if _default_embedder is not None:
        return _default_embedder
    with _default_lock:
        if _default_embedder is not None:
            return _default_embedder
        try:
            import sentence_transformers  # noqa: F401
            _default_embedder = SentenceTransformerEmbedder()
        except ImportError:
            logger.info(
                "sentence-transformers not available; using NullEmbedder. "
                "Vector search features will be disabled."
            )
            _default_embedder = NullEmbedder()
        return _default_embedder


def reset_for_tests(embedder: Optional[EmbedderProtocol] = None) -> None:
    """テスト用: デフォルト Embedder を差し替えるかリセットする。"""
    global _default_embedder
    _default_embedder = embedder
