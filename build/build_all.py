"""
Build All — ビルドパイプラインスクリプト (スタブ)

Phase 6: タグビルド時の全ステップ自動化。

Usage:
    python build/build_all.py --platform windows --version v1.0.0

Steps:
    1. Frontend ビルド (npm run build → dist/)
    2. Backend バイナリ化 (PyInstaller → core/)
    3. Launcher バイナリ化 (PyInstaller → hoshutaro.exe)
    4. パッケージング (zip)
"""

import argparse
import subprocess
import sys
from pathlib import Path


def build_frontend(project_root: Path) -> None:
    """Frontend をビルド"""
    print("=== Step 1: Frontend Build ===")
    subprocess.run(["npm", "run", "build"], cwd=project_root, check=True, shell=True)
    print("Frontend build complete: dist/")


def build_backend(project_root: Path) -> None:
    """Backend を PyInstaller でバイナリ化"""
    print("=== Step 2: Backend Build ===")
    backend_dir = project_root / "backend"
    subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            "--name", "hoshutaro-server",
            "--add-data", ".env:.",
            "--add-data", str(project_root / "dist") + ":frontend",
            "app/main.py",
        ],
        cwd=backend_dir,
        check=True,
    )
    print("Backend build complete: core/hoshutaro-server.exe")


def build_launcher(project_root: Path) -> None:
    """Launcher を PyInstaller でバイナリ化"""
    print("=== Step 3: Launcher Build ===")
    launcher_dir = project_root / "launcher"
    subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            "--onefile", "--windowed",
            "--name", "hoshutaro",
            "main.py",
        ],
        cwd=launcher_dir,
        check=True,
    )
    print("Launcher build complete: hoshutaro.exe")


def package(project_root: Path, platform: str, version: str) -> None:
    """最終パッケージ（インストーラー等）を作成"""
    print(f"=== Step 4: Package ({platform}, {version}) ===")
    
    if platform == "windows":
        iss_path = project_root / "build" / "hoshutaro_setup.iss"
        if iss_path.exists():
            # ISCC (Inno Setup Compiler) の標準パスを検索
            iscc_paths = [
                r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
                r"C:\Program Files\Inno Setup 6\ISCC.exe",
            ]
            iscc_exe = next((p for p in iscc_paths if Path(p).exists()), None)
            
            if iscc_exe:
                print(f"Running Inno Setup Compiler: {iscc_exe}")
                # /DAppVersion={version} などでバージョン指定可能だが、今回は単純呼び出し
                subprocess.run([iscc_exe, str(iss_path)], check=True)
                print(f"Windows installer created at: build/hoshutaro-setup-windows.exe")
                return
            else:
                print("Warning: Inno Setup 6 (ISCC.exe) not found. Skipping installer creation.")
                print("Falling back to ZIP packaging.")
                
    # Fallback / Linux / Mac: zip packaging
    output_name = f"hoshutaro-{platform}-{version}.zip"
    print(f"Creating fallback zip package: {output_name}")
    import zipfile
    zip_path = project_root / "build" / output_name
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Launcher
        launcher_exe = project_root / "launcher" / "dist" / "hoshutaro.exe"
        if launcher_exe.exists():
            zf.write(launcher_exe, arcname="hoshutaro.exe")
        
        # Backend
        backend_exe = project_root / "backend" / "dist" / "hoshutaro-server.exe"
        if backend_exe.exists():
            zf.write(backend_exe, arcname="core/hoshutaro-server.exe")
            
        # Frontend
        frontend_dir = project_root / "dist"
        if frontend_dir.exists():
            for f in frontend_dir.rglob("*"):
                if f.is_file():
                    zf.write(f, arcname=f"frontend/{f.relative_to(frontend_dir)}")
    
    print(f"Package created: {zip_path}")


def main():
    parser = argparse.ArgumentParser(description="HOSHUTARO Build Pipeline")
    parser.add_argument("--platform", choices=["windows", "linux", "darwin"], required=True)
    parser.add_argument("--version", required=True, help="Version tag (e.g., v1.0.0)")
    parser.add_argument("--skip-frontend", action="store_true")
    parser.add_argument("--skip-backend", action="store_true")
    parser.add_argument("--skip-launcher", action="store_true")
    args = parser.parse_args()

    project_root = Path(__file__).parent.parent.resolve()
    print(f"Project root: {project_root}")

    if not args.skip_frontend:
        build_frontend(project_root)
    if not args.skip_backend:
        build_backend(project_root)
    if not args.skip_launcher:
        build_launcher(project_root)

    package(project_root, args.platform, args.version)
    print("\n=== Build Complete ===")


if __name__ == "__main__":
    main()
