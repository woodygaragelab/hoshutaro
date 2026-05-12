import { Amplify } from 'aws-amplify';

let configured = false;

/**
 * Amplify.configure(...) を冪等に呼ぶラッパ。
 *
 * `amplify_outputs.json` は `npx ampx sandbox` (または pipeline-deploy) で
 * 自動生成される .gitignore 対象ファイル。バックエンドが未デプロイの環境では
 * 存在しないため、Vite の `import.meta.glob` (eager) を使って **ファイルが
 * 無くてもビルドが落ちない** 形で取り込む。
 *
 * - 存在する: Amplify.configure に渡し、true を返す
 * - 存在しない: 警告ログを出し、false を返す (呼び出し側で fallback 可能)
 */
export function ensureAmplifyConfigured(): boolean {
  if (configured) return true;

  const modules = import.meta.glob('../../amplify_outputs.json', {
    eager: true,
  }) as Record<string, { default?: unknown }>;
  const outputs = Object.values(modules)[0]?.default;

  if (!outputs) {
    console.warn(
      '[amplify] amplify_outputs.json not found — auth features are disabled until `npx ampx sandbox` deploys the backend.',
    );
    return false;
  }

  Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);
  configured = true;
  return true;
}
