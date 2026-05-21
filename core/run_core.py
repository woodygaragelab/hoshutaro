"""HOSHUTARO core サイドカー起動エントリ。

- 開発時:   `python run_core.py --port 8000`
- 梱包時:   PyInstaller がこのファイルを単一実行ファイル `hoshutaro-core` 化する
            （ユーザー PC に Python は不要。インタプリタごとアプリに同梱される）。

設定 / スキル / プラグイン / .env の場所は環境変数 `HOSHUTARO_HOME` で指定する。
Tauri シェルが書き込み可能なユーザーディレクトリを渡す（src-tauri/src/sidecar.rs）。
"""

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(prog="hoshutaro-core")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    import uvicorn
    from app.main import app

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
