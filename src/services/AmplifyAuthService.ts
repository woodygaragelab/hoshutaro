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
} from 'aws-amplify/auth';

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
};
