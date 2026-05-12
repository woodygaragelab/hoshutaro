import { defineAuth } from '@aws-amplify/backend';
import { postConfirmationTrigger } from '../functions/post-confirmation-trigger/resource';

/**
 * HOSHUTARO Track D - Cognito auth resource (Sprint 1)
 *
 * - Email + password login with verification.
 * - Optional TOTP MFA (configured via CDK overrides in backend.ts).
 * - Password policy (12+ chars, all character classes) via CDK overrides.
 * - postConfirmation trigger seeds the UserSettings table on signup.
 *
 * See: docs/7_AUTH_AND_USERS.md
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'HOSHUTARO への登録 — メール確認',
      verificationEmailBody: (createCode: () => string) =>
        `HOSHUTARO へようこそ。\n\n確認コード: ${createCode()}\n\nこのコードを画面に入力してメールアドレスを確認してください。`,
    },
  },
  userAttributes: {
    email: { mutable: true, required: true },
    givenName: { mutable: true, required: false },
    familyName: { mutable: true, required: false },
  },
  triggers: {
    postConfirmation: postConfirmationTrigger,
  },
});
