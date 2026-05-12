import { createContext } from 'react';
import type { AuthenticatedUser } from '../services/AmplifyAuthService';

export type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
