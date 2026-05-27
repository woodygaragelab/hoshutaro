"""
Project Mu SQLite 接続層。

設計方針:
  - 標準ライブラリ sqlite3 を直接使用（依存追加を避ける、起動高速化）
  - SQLAlchemy は使わない（ORM オーバーヘッドを排除、生 SQL で十分）
  - 接続は thread-local（FastAPI のスレッドプール対応）
  - sqlite-vec 拡張のロードを試行し、失敗時は graceful degradation

DB 配置:
  - 環境変数 SQLITE_PATH（既定: ~/.hoshutaro/data.db）
  - 親ディレクトリ自動作成

スキーマ:
  - 同一パッケージの schema.sql を初回接続時に IDEMPOTENT 適用
  - schema_versions テーブルで適用済みバージョン管理
"""

from __future__ import annotations

import logging
import os
import sqlite3
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ───────────────────────────────────────────────────────────
# DB パス解決
# ───────────────────────────────────────────────────────────


def get_db_path() -> Path:
    """SQLite ファイルのパスを返す。環境変数で上書き可能。"""
    raw = os.environ.get("SQLITE_PATH")
    if raw:
        path = Path(os.path.expanduser(raw))
    else:
        path = Path.home() / ".hoshutaro" / "data.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


# ───────────────────────────────────────────────────────────
# 接続管理（thread-local）
# ───────────────────────────────────────────────────────────

_local = threading.local()
_init_lock = threading.Lock()
_initialized = False
_sqlite_vec_loaded: Optional[bool] = None


def _try_load_sqlite_vec(conn: sqlite3.Connection) -> bool:
    """
    sqlite-vec 拡張のロードを試行。

    Returns:
        True: 拡張ロード成功（VIRTUAL TABLE vec0 が使える）
        False: ロード失敗（ベクトル検索は無効、CRUD は通常通り動作）
    """
    global _sqlite_vec_loaded
    if _sqlite_vec_loaded is not None:
        return _sqlite_vec_loaded

    try:
        conn.enable_load_extension(True)
    except (sqlite3.NotSupportedError, AttributeError):
        # sqlite3 ビルドが拡張ロード非対応（一部の OS デフォルト Python）
        logger.info("sqlite3 was built without enable_load_extension; vector search disabled")
        _sqlite_vec_loaded = False
        return False

    # sqlite_vec パッケージがインストールされていれば使う
    try:
        import sqlite_vec  # type: ignore

        sqlite_vec.load(conn)
        _sqlite_vec_loaded = True
        logger.info("sqlite-vec extension loaded successfully")
        return True
    except ImportError:
        logger.info("sqlite-vec Python package not installed; vector search disabled")
    except Exception as e:
        logger.warning("Failed to load sqlite-vec extension: %s", e)
    finally:
        try:
            conn.enable_load_extension(False)
        except Exception:
            pass

    _sqlite_vec_loaded = False
    return False


def is_vector_search_available() -> bool:
    """ベクトル検索（sqlite-vec）が利用可能か。"""
    return bool(_sqlite_vec_loaded)


def _ensure_vec_tables(conn: sqlite3.Connection) -> None:
    """
    sqlite-vec ロード成功時のみ VIRTUAL TABLE を作成。
    schema.sql 本体には書かず、ここで条件付き実行。
    """
    if not _sqlite_vec_loaded:
        return
    try:
        conn.executescript(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS master_map_vec USING vec0(
                map_id INTEGER PRIMARY KEY,
                embedding float[384]
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS rules_vec USING vec0(
                rule_id INTEGER PRIMARY KEY,
                embedding float[384]
            );
            """
        )
        conn.commit()
    except sqlite3.OperationalError as e:
        # 既に作成済み or 互換性問題
        logger.debug("vec0 table creation skipped: %s", e)


def _initialize_db(conn: sqlite3.Connection) -> None:
    """schema.sql を idempotent に適用。"""
    sql = _SCHEMA_PATH.read_text(encoding="utf-8")
    conn.executescript(sql)
    conn.commit()
    _ensure_vec_tables(conn)


def _open_connection() -> sqlite3.Connection:
    """新規 SQLite 接続を作成し、初回ならスキーマを適用する。"""
    global _initialized

    db_path = get_db_path()
    conn = sqlite3.connect(
        str(db_path),
        detect_types=sqlite3.PARSE_DECLTYPES,
        check_same_thread=False,  # FastAPI スレッドプール対応
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")  # 並行読み取り高速化

    # 拡張ロード試行
    _try_load_sqlite_vec(conn)

    # 初期化（プロセス内で1回だけ）
    with _init_lock:
        if not _initialized:
            _initialize_db(conn)
            _initialized = True
            logger.info("Project Mu SQLite initialized at %s", db_path)
        else:
            # 後続接続: vec テーブルだけ確認（CREATE IF NOT EXISTS で冪等）
            _ensure_vec_tables(conn)

    return conn


def get_connection() -> sqlite3.Connection:
    """thread-local の接続を取得（なければ作成）。"""
    conn: Optional[sqlite3.Connection] = getattr(_local, "conn", None)
    if conn is None:
        conn = _open_connection()
        _local.conn = conn
    return conn


def close_connection() -> None:
    """thread-local 接続をクローズ（テスト・シャットダウン用）。"""
    conn: Optional[sqlite3.Connection] = getattr(_local, "conn", None)
    if conn is not None:
        try:
            conn.close()
        finally:
            _local.conn = None


def reset_for_tests(db_path: Optional[Path] = None) -> None:
    """
    テスト用ヘルパ: 既存接続を閉じ、初期化フラグをリセット。
    引数 db_path 指定時は環境変数 SQLITE_PATH を上書き。
    """
    global _initialized, _sqlite_vec_loaded
    close_connection()
    if db_path is not None:
        os.environ["SQLITE_PATH"] = str(db_path)
    _initialized = False
    _sqlite_vec_loaded = None
