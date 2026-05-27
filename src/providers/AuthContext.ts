import { createContext } from 'react';
import type { AuthenticatedUser } from '../services/AmplifyAuthService';

export type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  /**
   * クラウド認証が利用可能か。`amplify_outputs.json` が未配置（バックエンド未デプロイ）
   * のときは false になり、デスクトップアプリはオフラインモードとして認証ガードを
   * 素通りする（HOSHUTARO はオフライン・エッジエンジンで、クラウドは任意機能）。
   */
  authAvailable: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
