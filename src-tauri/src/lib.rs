//! HOSHUTARO デスクトップシェル（Tauri 2.x）。
//!
//! 起動時に core（Python エンジン）を sidecar として spawn し、
//! `/api/health` が応答したらメインウィンドウを表示する。
//! アプリ終了時に core プロセスを停止する。

mod sidecar;

use sidecar::CoreSidecar;
use tauri::{Manager, RunEvent};

/// webview（フロントエンド）から core のベース URL を取得するコマンド。
#[tauri::command]
fn core_base_url(state: tauri::State<'_, CoreSidecar>) -> String {
    state.base_url()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CoreSidecar::new())
        .invoke_handler(tauri::generate_handler![core_base_url])
        .setup(|app| {
            // core の起動とヘルス監視は別スレッドで行い、UI スレッドを塞がない。
            // 準備完了（またはタイムアウト）後にメインウィンドウを表示する。
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<CoreSidecar>();
                if !sidecar::start(state.inner()) {
                    eprintln!("[hoshutaro] core 未準備のままウィンドウを表示します");
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building HOSHUTARO")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state = app.state::<CoreSidecar>();
                sidecar::stop(state.inner());
            }
        });
}
