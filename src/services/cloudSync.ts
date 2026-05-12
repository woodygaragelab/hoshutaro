import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

/**
 * HOSHUTARO Track D Sprint 2 - AppSync (`generateClient<Schema>()`) の lazy wrapper。
 *
 * `Amplify.configure(...)` (= `ensureAmplifyConfigured()`, src/services/amplifyConfig.ts)
 * が呼ばれていないと `generateClient` は内部で例外を吐くので、ここで try/catch で
 * 包み null を返す。null fallback により:
 *   - `amplify_outputs.json` が無い (sandbox 未起動) 開発環境
 *   - Amplify configure に失敗した状態
 *   - Jest テスト環境
 * のいずれでも import-time crash を起こさず、UI 側 hook が「offline / unavailable」
 * モードで graceful degrade できる。
 *
 * 実 sandbox / production 環境では一度生成したクライアントを singleton で再利用する
 * (毎回 `generateClient()` を呼ぶと内部状態がリセットされる懸念があるため)。
 */
type CloudClient = ReturnType<typeof generateClient<Schema>>;

let cachedClient: CloudClient | null = null;
let attempted = false;

export function getCloudClient(): CloudClient | null {
  if (cachedClient) return cachedClient;
  if (attempted) return null;
  attempted = true;
  try {
    cachedClient = generateClient<Schema>();
    return cachedClient;
  } catch (err) {
    console.warn(
      '[cloudSync] generateClient<Schema>() failed — Amplify likely not configured yet.',
      err,
    );
    return null;
  }
}

/**
 * Reset the cached client. Test-only — production code never needs this.
 */
export function __resetCloudClientForTest(): void {
  cachedClient = null;
  attempted = false;
}
