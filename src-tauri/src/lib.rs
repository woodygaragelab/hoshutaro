//! HOSHUTARO デスクトップシェル（Tauri 2.x）。
//!
//! 起動時に core（Python エンジン）を sidecar として spawn し、
//! `/api/health` が応答したらメインウィンドウを表示する。
//! システムトレイ・単一インスタンス・ウィンドウ状態復元・自動更新を備える。

mod sidecar;

use sidecar::CoreSidecar;
use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent};

/// webview（フロントエンド）から core のベース URL を取得するコマンド。
#[tauri::command]
fn core_base_url(state: tauri::State<'_, CoreSidecar>) -> String {
    state.base_url()
}

/// メインウィンドウを表示し前面に出す（トレイ / 二重起動からの復帰用）。
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// システムトレイ（表示 / 終了メニュー）を構築する。
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "ウィンドウを表示", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("HOSHUTARO")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance は最初に登録する（二重起動時は既存ウィンドウへフォーカス）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // process プラグイン: 更新適用後の再起動（relaunch）に使用
        .plugin(tauri_plugin_process::init())
        .manage(CoreSidecar::new())
        .invoke_handler(tauri::generate_handler![core_base_url])
        .setup(|app| {
            setup_tray(app)?;

            // core の起動とヘルス監視は別スレッドで行い、UI スレッドを塞がない。
            // 準備完了（またはタイムアウト）後にメインウィンドウを表示する。
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<CoreSidecar>();
                if !sidecar::start(&handle, state.inner()) {
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
