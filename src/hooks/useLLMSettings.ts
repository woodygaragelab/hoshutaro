import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getCloudClient } from '../services/cloudSync';

/**
 * HOSHUTARO Track D Sprint 2 - DynamoDB LLMSettings の React hook (Slice 2-B)。
 *
 * 役割:
 *   - 認証済みユーザのクラウド LLM 設定 (preferredModel / fallbackModels[] /
 *     mtpEnabled / customApiKeys) を AppSync 経由で取得・更新
 *   - 既存の AIAssistant/LLMSettingsDialog はローカル FastAPI backend 経由で
 *     adapter (gemini/openvino/ollama)・temperature・HF ダウンロード等を扱うが、
 *     これらはデバイス固有設定なのでクラウド同期しない
 *   - 本 hook が扱うのは「どこからログインしても同じであるべき preference」のみ
 *
 * Sprint 1 の post-confirmation Lambda は UserSettings のみ作成するので、
 * LLMSettings は **本 hook の初回 update() で作成 (upsert 相当)** することを想定。
 * 実装上は AppSync の `create` を別途呼ぶか、`update` が無いレコードは create
 * できる Amplify Gen2 の挙動に頼る。本 Slice では update のみ提供し、create との
 * 統合は Slice 2-C で LLMSettingsDialog 配線時に判断する。
 */
export type LLMSettingsData = {
  preferredModel: string | null;
  fallbackModels: string[];
  mtpEnabled: boolean;
  customApiKeys: string | null;
};

const LLM_SETTINGS_QUERY_KEY = 'llmSettings';

const DEFAULT_LLM_SETTINGS: LLMSettingsData = {
  preferredModel: null,
  fallbackModels: [],
  mtpEnabled: false,
  customApiKeys: null,
};

function normalize(raw: {
  preferredModel?: string | null;
  fallbackModels?: (string | null)[] | null;
  mtpEnabled?: boolean | null;
  customApiKeys?: string | null;
}): LLMSettingsData {
  return {
    preferredModel: raw.preferredModel ?? null,
    fallbackModels: (raw.fallbackModels ?? []).filter(
      (m): m is string => typeof m === 'string' && m.length > 0,
    ),
    mtpEnabled: raw.mtpEnabled ?? false,
    customApiKeys: raw.customApiKeys ?? null,
  };
}

export function useLLMSettings() {
  const { user } = useAuth();
  const userId = user?.userId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [LLM_SETTINGS_QUERY_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LLMSettingsData | null> => {
      const client = getCloudClient();
      if (!client || !userId) return null;
      const result = await client.models.LLMSettings.get({ userId });
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }
      if (!result.data) return null;
      return normalize(result.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (
      patch: Partial<LLMSettingsData>,
    ): Promise<LLMSettingsData | null> => {
      const client = getCloudClient();
      if (!client || !userId) {
        throw new Error(
          'Cloud client unavailable — Amplify not configured or user not signed in',
        );
      }
      const result = await client.models.LLMSettings.update(
        // Amplify Gen2 の `.identifier(['userId'])` shape に合わせて `as never` で
        // エスケープ。詳細は src/hooks/useUserSettings.ts と同じ事情。
        {
          userId,
          ...patch,
        } as never,
      );
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }
      if (!result.data) return null;
      return normalize(result.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LLM_SETTINGS_QUERY_KEY, userId] });
    },
  });

  return {
    // `null` = レコード不在 (初回 update でレコード生成、もしくは create が必要)
    // `undefined` = まだフェッチしていない
    settings: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error as Error | null,
    DEFAULTS: DEFAULT_LLM_SETTINGS,
  };
}
