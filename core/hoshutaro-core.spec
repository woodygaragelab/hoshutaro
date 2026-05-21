# -*- mode: python ; coding: utf-8 -*-
#
# HOSHUTARO core サイドカーの PyInstaller ビルド定義。
#
#   ビルド:  cd core && pyinstaller --noconfirm hoshutaro-core.spec
#   出力:    core/dist/hoshutaro-core/  （onedir。中の hoshutaro-core が実行ファイル）
#
# Python インタプリタと全依存をこのバンドルに同梱するため、配布先 PC に
# Python のインストールは不要。設定 / スキル / プラグインはバンドルに含めず、
# Tauri が初回起動時に書き込み可能ディレクトリへ展開する（HOSHUTARO_HOME）。
#
# ML 依存（requirements-ml.txt: openvino-genai 等）はビルド環境に pip 済みなら
# 自動的に取り込む。Gemma 4 推論を含めるにはビルド前に
#   pip install -r requirements-ml.txt
# を実行すること（CI: .github/workflows/release.yml で実施）。

import importlib.util

from PyInstaller.utils.hooks import collect_all, collect_submodules

hiddenimports = collect_submodules("app") + collect_submodules("uvicorn")
datas = []
binaries = []

# ML 依存（OpenVINO GenAI 系）はネイティブライブラリを伴うため collect_all で取り込む。
for pkg in ("openvino", "openvino_genai", "openvino_tokenizers"):
    if importlib.util.find_spec(pkg) is not None:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden

a = Analysis(
    ["run_core.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="hoshutaro-core",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="hoshutaro-core",
)
