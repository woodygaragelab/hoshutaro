import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  setUpTOTP,
  verifyTOTPSetup,
  updatePassword,
  updateUserAttributes,
} from 'aws-amplify/auth';
import { getUserManagementUrl } from './amplifyConfig';

export type AuthenticatedUser = {
  userId: string;
  username: string;
  email: string;
  givenName?: string;
  familyName?: string;
};

/**
 * HOSHUTARO Track D Sprint 1 - aws-amplify v6 auth API の thin wrapper。
 *
 * 目的:
 *   - UI 層から Amplify の named export を直接 import しない (テスト時の mock 容易化)
 *   - レスポンス shape を AuthenticatedUser に正規化
 *   - エラーは throw のまま伝搬 (呼び出し側で Cognito Exception → 表示メッセージに変換)
 *
 * 認証フロー全体の仕様は docs/7_AUTH_AND_USERS.md を参照。
 */
export const AmplifyAuthService = {
  async signIn(email: string, password: string) {
    return signIn({ username: email, password });
  },

  async signUp(
    email: string,
    password: string,
    attrs?: { givenName?: string; familyName?: string },
  ) {
    return signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          ...(attrs?.givenName ? { given_name: attrs.givenName } : {}),
          ...(attrs?.familyName ? { family_name: attrs.familyName } : {}),
        },
      },
    });
  },

  async confirmSignUp(email: string, code: string) {
    return confirmSignUp({ username: email, confirmationCode: code });
  },

  async resendConfirmationCode(email: string) {
    return resendSignUpCode({ username: email });
  },

  async requestPasswordReset(email: string) {
    return resetPassword({ username: email });
  },

  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    return confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  },

  async signOut() {
    return signOut();
  },

  async getCurrentUserDetails(): Promise<AuthenticatedUser | null> {
    try {
      const user = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      return {
        userId: user.userId,
        username: user.username,
        email: attrs.email ?? '',
        givenName: attrs.given_name,
        familyName: attrs.family_name,
      };
    } catch {
      return null;
    }
  },

  async getCurrentSession() {
    return fetchAuthSession();
  },

  async setupMfa() {
    return setUpTOTP();
  },

  async verifyMfaSetup(code: string) {
    return verifyTOTPSetup({ code });
  },

  async updateUserPassword(oldPassword: string, newPassword: string) {
    return updatePassword({ oldPassword, newPassword });
  },

  async updateProfile(attrs: { givenName?: string; familyName?: string }) {
    return updateUserAttributes({
      userAttributes: {
        ...(attrs.givenName !== undefined ? { given_name: attrs.givenName } : {}),
        ...(attrs.familyName !== undefined ? { family_name: attrs.familyName } : {}),
      },
    });
  },

  /**
   * user-management Lambda (Function URL) を呼ぶ薄いラッパ。
   * - exportData: { ok: true, action, exportedAt, data: { ... } }
   * - deleteAccount: { ok: true, action }
   *
   * 失敗時 (HTTP !=2xx / fetch エラー / endpoint 未設定) は Error を throw。
   * 呼び出し側で `mapAuthError` などで日本語化して表示する。
   */
  async callUserManagement(
    action: 'deleteAccount' | 'exportData',
  ): Promise<{
    ok: true;
    action: 'deleteAccount' | 'exportData';
    exportedAt?: string;
    data?: unknown;
  }> {
    const url = getUserManagementUrl();
    if (!url) {
      throw new Error(
        'user-management エンドポイントが未設定です (amplify_outputs.json 不在)。',
      );
    }

    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) {
      throw new Error('アクセストークンを取得できません。再ログインしてください。');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      let detail: { code?: string; message?: string } = {};
      try {
        detail = (await response.json()) as { code?: string; message?: string };
      } catch {
        // ignore JSON parse error
      }
      const suffix = detail.message ? ` — ${detail.message}` : '';
      throw new Error(
        `user-management ${action} HTTP ${response.status}${suffix}`,
      );
    }

    return (await response.json()) as {
      ok: true;
      action: 'deleteAccount' | 'exportData';
      exportedAt?: string;
      data?: unknown;
    };
  },
};
