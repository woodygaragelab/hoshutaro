/**
 * API ベース URL リゾルバ（プラン Track E Gap 1）。
 *
 * 梱包後の Tauri アプリでは Vite dev proxy が無く、FastAPI sidecar は 8000 以外の
 * OS 割当ポートで起動しうる。Tauri シェルが公開する `core_base_url` コマンドで
 * 実ベース URL を解決し、全 API 呼び出しの前置に使う。
 *
 * ブラウザ / 開発モードでは `_apiBase` を空のままにし、相対パス `/api/...` を
 * Vite proxy（dev）または同一オリジン（テスト）で解決させる — 後方互換。
 */

/** Tauri 2 の webview 内で動作しているか判定する。 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let _apiBase = ''
let _initialized = false

/**
 * API ベース URL を解決してキャッシュする。アプリ起動時に 1 度だけ呼ぶ。
 *
 * Tauri 環境でのみ `@tauri-apps/api` を動的 import する。これにより jest（jsdom、
 * 非 Tauri）では ESM パッケージを一切ロードせず、テスト構成を変更せずに済む。
 */
export async function initApiBase(): Promise<void> {
  if (_initialized) return
  _initialized = true
  if (!isTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    _apiBase = await invoke<string>('core_base_url')
  } catch (e) {
    // 解決失敗時は相対パスにフォールバック（dev では proxy、prod では同一オリジン）
    console.error('[apiBase] core_base_url の解決に失敗。相対パスにフォールバックします', e)
    _apiBase = ''
  }
}

/**
 * `/api/...` のパスにベース URL を前置する。
 * ベースが空（ブラウザ / dev）なら相対パスのまま返す。
 */
export function apiUrl(path: string): string {
  return _apiBase ? _apiBase + path : path
}

/** 解決済みのベース URL（空文字なら相対パス運用）。テスト・診断用。 */
export function getApiBase(): string {
  return _apiBase
}
