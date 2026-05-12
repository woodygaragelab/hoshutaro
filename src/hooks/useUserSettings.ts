import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getCloudClient } from '../services/cloudSync';

/**
 * HOSHUTARO Track D Sprint 2 - DynamoDB UserSettings の React hook (Slice 2-A)。
 *
 * 役割:
 *   - 認証済みユーザの UserSettings レコード (theme / language / mfaEnabled) を
 *     AppSync 経由で取得・更新
 *   - 初回レコードは Sprint 1 の post-confirmation Lambda が conditional put で
 *     作成しているので、本 hook は **存在前提で get + update のみ**を提供する
 *   - cloud client / userId が未準備の状態 (configure 失敗 / 未認証 / sandbox 未起動)
 *     では query を disabled にし、`settings = undefined` を返す
 */
export type UserSettingsData = {
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  mfaEnabled: boolean;
};

const USER_SETTINGS_QUERY_KEY = 'userSettings';

function normalize(raw: {
  theme?: string | null;
  language?: string | null;
  mfaEnabled?: boolean | null;
}): UserSettingsData {
  const theme = raw.theme === 'dark' ? 'dark' : 'light';
  const language = raw.language === 'en' ? 'en' : 'ja';
  return {
    theme,
    language,
    mfaEnabled: raw.mfaEnabled ?? false,
  };
}

export function useUserSettings() {
  const { user } = useAuth();
  const userId = user?.userId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [USER_SETTINGS_QUERY_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserSettingsData | null> => {
      const client = getCloudClient();
      if (!client || !userId) return null;
      const result = await client.models.UserSettings.get({ userId });
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }
      if (!result.data) return null;
      return normalize(result.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<UserSettingsData>): Promise<UserSettingsData | null> => {
      const client = getCloudClient();
      if (!client || !userId) {
        throw new Error('Cloud client unavailable — Amplify not configured or user not signed in');
      }
      const result = await client.models.UserSettings.update(
        // Amplify Gen2 の `.identifier(['userId'])` 経由 update input は内部的に
        // 複合識別子向けの shape (`identifier: string[]` 含む) を持つため、ここでは
        // `as never` でエスケープして簡素化する。本格的な型付けは Sprint 2-D 以降で
        // generated type を直接使う形に整理する。
        {
          userId,
          ...patch,
          updatedAt: new Date().toISOString(),
        } as never,
      );
      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }
      if (!result.data) return null;
      return normalize(result.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_SETTINGS_QUERY_KEY, userId] });
    },
  });

  return {
    // `null` = レコード不在 (post-confirmation Lambda が走っていない / cloud client 不在)
    // `undefined` = まだフェッチしていない (loading 中、または userId 未確定)
    settings: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error as Error | null,
  };
}
