//! core（Python エンジン）を sidecar として起動・ヘルス監視・停止する。
//!
//! Sprint 2: デスクトップアプリ起動時に core を子プロセスとして spawn し、
//! `/api/health` が応答するまで待ってからメインウィンドウを表示、
//! アプリ終了時に kill する。

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

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

/// core ディレクトリ（uvicorn を起動する cwd）。
/// dev ビルドではリポジトリ内の `core/` を指す。
#[cfg(debug_assertions)]
fn core_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|repo| repo.join("core"))
        .unwrap_or_else(|| PathBuf::from("core"))
}

/// release ビルドでは実行ファイルと同梱された `core/` を指す。
/// （単一バイナリ同梱の最終形は後続スプリントで確定する。）
#[cfg(not(debug_assertions))]
fn core_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("core")))
        .unwrap_or_else(|| PathBuf::from("core"))
}

/// Python インタプリタ名（OS 差）。
fn python_exe() -> &'static str {
    if cfg!(windows) {
        "python"
    } else {
        "python3"
    }
}

/// uvicorn 経由で core を起動する。
fn spawn_core(port: u16) -> std::io::Result<Child> {
    let mut cmd = Command::new(python_exe());
    cmd.args([
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        &port.to_string(),
    ])
    .current_dir(core_dir());

    // Windows: 余計なコンソールウィンドウを出さない（CREATE_NO_WINDOW）。
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    cmd.spawn()
}

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
pub fn start(state: &CoreSidecar) -> bool {
    let port = pick_port();
    *state.port.lock().unwrap() = port;

    match spawn_core(port) {
        Ok(child) => {
            *state.child.lock().unwrap() = Some(child);
        }
        Err(err) => {
            eprintln!("[hoshutaro] core sidecar の起動に失敗しました: {err}");
            return false;
        }
    }

    let ready = wait_for_health(port, Duration::from_secs(60));
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
