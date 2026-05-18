//! HOSHUTARO デスクトップシェル（Tauri 2.x）。
//!
//! Sprint 1 ではフロントエンド（src/）を webview に表示するだけの最小シェル。
//! Sprint 2 で core（Python エンジン）を sidecar として spawn/監視し、
//! 空きポートを webview へ注入する処理をここに追加する。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running HOSHUTARO");
}
