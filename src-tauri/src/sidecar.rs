//! core（Python エンジン）を sidecar として起動・ヘルス監視・停止する。
//!
//! - **dev ビルド**: リポジトリの `core/` を `python -m uvicorn` で起動する
//!   （開発者の Python 環境を使う）。
//! - **release ビルド**: PyInstaller で梱包した `hoshutaro-core` 実行ファイルを
//!   起動する。Python インタプリタごとアプリに同梱されるため、配布先 PC に
//!   Python のインストールは不要。設定 / スキル / プラグインは初回起動時に
//!   書き込み可能なユーザーディレクトリへ展開し、`HOSHUTARO_HOME` で core に渡す。

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::AppHandle;
#[cfg(not(debug_assertions))]
use tauri::Manager;

/// 既定ポート。dev では Vite プロキシ（/api → :8000）と揃える。
/// 衝突時は OS 割り当ての空きポートにフォールバックする。
const PREFERRED_PORT: u16 = 8000;

/// 起動した core プロセスと割り当てポートを保持する Tauri 管理状態。
pub struct CoreSidecar {
    child: Mutex<Option<Child>>,
    port: Mutex<u16>,
}

impl CoreSidecar {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(PREFERRED_PORT),
        }
    }

    /// core のベース URL（webview から参照する）。
    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", *self.port.lock().unwrap())
    }
}

impl Default for CoreSidecar {
    fn default() -> Self {
        Self::new()
    }
}

/// PREFERRED_PORT が空いていればそれを、ダメなら OS 割り当ての空きポートを返す。
fn pick_port() -> u16 {
    if TcpListener::bind(("127.0.0.1", PREFERRED_PORT)).is_ok() {
        return PREFERRED_PORT;
    }
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(PREFERRED_PORT)
}

/// Windows で余計なコンソールウィンドウを出さない（CREATE_NO_WINDOW）。
fn suppress_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

/// ディレクトリを再帰コピーする（home テンプレート展開用）。
#[cfg_attr(debug_assertions, allow(dead_code))]
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_all(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

// ── dev ビルド: リポジトリの core/ を Python で起動 ───────────────────

/// dev の HOSHUTARO_HOME。リポジトリの `core/` をそのまま使う（書き込み可能）。
#[cfg(debug_assertions)]
fn resolve_home(_app: &AppHandle) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|repo| repo.join("core"))
        .unwrap_or_else(|| PathBuf::from("core"))
}

/// dev: `python -m uvicorn` で core を起動する。
#[cfg(debug_assertions)]
fn spawn_core(_app: &AppHandle, port: u16, home: &Path) -> std::io::Result<Child> {
    let python = if cfg!(windows) { "python" } else { "python3" };
    let mut cmd = Command::new(python);
    cmd.args([
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        &port.to_string(),
    ])
    .current_dir(home)
    .env("HOSHUTARO_HOME", home);
    suppress_console(&mut cmd);
    cmd.spawn()
}

// ── release ビルド: 梱包バイナリ hoshutaro-core を起動 ────────────────

/// 梱包された core 実行ファイルのパス。
/// tauri.conf.json の bundle.resources で `core/` 配下に同梱される。
#[cfg(not(debug_assertions))]
fn core_binary(app: &AppHandle) -> PathBuf {
    let exe_name = if cfg!(windows) {
        "hoshutaro-core.exe"
    } else {
        "hoshutaro-core"
    };
    app.path()
        .resource_dir()
        .map(|res| {
            res.join("core")
                .join("bin")
                .join("hoshutaro-core")
                .join(exe_name)
        })
        .unwrap_or_else(|_| PathBuf::from(exe_name))
}

/// release の HOSHUTARO_HOME。アプリデータディレクトリ配下の書き込み可能な
/// `home/`。初回起動時に同梱テンプレート（config / skills / plugins / .env.example）
/// を展開する。
#[cfg(not(debug_assertions))]
fn resolve_home(app: &AppHandle) -> PathBuf {
    let home = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("home");

    let marker = home.join(".initialized");
    if !marker.exists() {
        let template = app
            .path()
            .resource_dir()
            .map(|res| res.join("core").join("home-template"))
            .unwrap_or_default();
        if template.is_dir() {
            match copy_dir_all(&template, &home) {
                Ok(()) => {
                    let _ = fs::write(&marker, b"1");
                    eprintln!("[hoshutaro] home テンプレートを展開しました: {home:?}");
                }
                Err(err) => {
                    eprintln!("[hoshutaro] WARN: home テンプレート展開に失敗: {err}");
                }
            }
        } else {
            eprintln!("[hoshutaro] WARN: home テンプレートが見つかりません: {template:?}");
        }
    }
    home
}

/// release: 梱包バイナリ `hoshutaro-core` で core を起動する。
#[cfg(not(debug_assertions))]
fn spawn_core(app: &AppHandle, port: u16, home: &Path) -> std::io::Result<Child> {
    let bin = core_binary(app);
    let mut cmd = Command::new(&bin);
    cmd.args(["--host", "127.0.0.1", "--port", &port.to_string()])
        .env("HOSHUTARO_HOME", home);
    if let Some(dir) = bin.parent() {
        cmd.current_dir(dir);
    }
    suppress_console(&mut cmd);
    cmd.spawn()
}

// ── ヘルス監視 ───────────────────────────────────────────────────────

/// `/api/health` に HTTP/1.0 GET を投げ、ステータス 200 が返れば true。
/// localhost 通信のみのため依存クレートを足さず最小実装にしている。
fn health_ok(port: u16) -> bool {
    let mut stream = match TcpStream::connect(("127.0.0.1", port)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

    let request = "GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    response.starts_with("HTTP/1.0 200") || response.starts_with("HTTP/1.1 200")
}

/// `/api/health` が応答するまでポーリングする（最大 timeout）。
fn wait_for_health(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if health_ok(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    false
}

/// core を起動し、ヘルス確認まで行う。準備完了したかを返す。
pub fn start(app: &AppHandle, state: &CoreSidecar) -> bool {
    let port = pick_port();
    *state.port.lock().unwrap() = port;
    let home = resolve_home(app);

    match spawn_core(app, port, &home) {
        Ok(child) => {
            *state.child.lock().unwrap() = Some(child);
        }
        Err(err) => {
            eprintln!("[hoshutaro] core sidecar の起動に失敗しました: {err}");
            return false;
        }
    }

    // 梱包バイナリの初回起動は展開に時間がかかるため余裕を持たせる。
    let ready = wait_for_health(port, Duration::from_secs(90));
    if ready {
        eprintln!("[hoshutaro] core sidecar ready (port {port})");
    } else {
        eprintln!("[hoshutaro] WARN: core sidecar の health check がタイムアウトしました");
    }
    ready
}

/// core プロセスを停止する（アプリ終了時に呼ぶ）。
pub fn stop(state: &CoreSidecar) {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
        eprintln!("[hoshutaro] core sidecar を停止しました");
    }
}
