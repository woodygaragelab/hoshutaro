import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Hub } from 'aws-amplify/utils';
import {
  AmplifyAuthService,
  type AuthenticatedUser,
} from '../services/AmplifyAuthService';
import { ensureAmplifyConfigured } from '../services/amplifyConfig';
import { AuthContext, type AuthContextValue } from './AuthContext';

type AuthProviderProps = { children: ReactNode };

/**
 * Track D Sprint 1 - 認証 Context Provider。
 *
 * - 初回マウントで `ensureAmplifyConfigured()` を呼び、amplify_outputs.json が
 *   見つからなければ auth を無効化したまま loading=false に落とす。
 * - `Hub.listen('auth', ...)` で signedIn / signedOut / tokenRefresh を購読し、
 *   その都度 `getCurrentUserDetails()` を再取得して state を最新化する。
 * - `signOut()` は Amplify の signOut → local state クリアを行う。
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await AmplifyAuthService.getCurrentUserDetails();
    setUser(current);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await AmplifyAuthService.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    const configured = ensureAmplifyConfigured();
    if (!configured) {
      setLoading(false);
      return;
    }

    void refresh();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'signedOut':
        case 'tokenRefresh':
        case 'tokenRefresh_failure':
          void refresh();
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [refresh]);

  const value: AuthContextValue = { user, loading, refresh, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
