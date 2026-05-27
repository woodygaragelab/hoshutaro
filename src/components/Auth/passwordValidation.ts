/**
 * HOSHUTARO Track D Sprint 1 - パスワード強度 / メール形式の純粋関数。
 *
 * Cognito 側のパスワードポリシー (amplify/backend.ts CDK overrides) と一致させる:
 *   - 最小 12 文字
 *   - 大文字 / 小文字 / 数字 / 記号 必須
 *
 * UI 側でも事前検証してフィードバックを早く返すことで、ネットワーク往復前に
 * 不正入力を弾く。サーバ側のポリシーは Cognito が最終ゲートとして動く。
 */
export type PasswordStrengthIssue =
  | 'too-short'
  | 'no-uppercase'
  | 'no-lowercase'
  | 'no-number'
  | 'no-symbol';

export const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string): PasswordStrengthIssue[] {
  const issues: PasswordStrengthIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push('too-short');
  if (!/[A-Z]/.test(password)) issues.push('no-uppercase');
  if (!/[a-z]/.test(password)) issues.push('no-lowercase');
  if (!/[0-9]/.test(password)) issues.push('no-number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('no-symbol');
  return issues;
}

export function passwordIssueMessage(issue: PasswordStrengthIssue): string {
  switch (issue) {
    case 'too-short':
      return `${PASSWORD_MIN_LENGTH} 文字以上`;
    case 'no-uppercase':
      return '大文字 (A-Z)';
    case 'no-lowercase':
      return '小文字 (a-z)';
    case 'no-number':
      return '数字 (0-9)';
    case 'no-symbol':
      return '記号 (例: !@#$%)';
  }
}

export function formatPasswordRequirements(issues: PasswordStrengthIssue[]): string {
  if (issues.length === 0) return '';
  return `不足: ${issues.map(passwordIssueMessage).join(' / ')}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
