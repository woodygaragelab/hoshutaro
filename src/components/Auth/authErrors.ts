/**
 * HOSHUTARO Track D Sprint 1 - Cognito Exception → 日本語表示メッセージのマッピング。
 *
 * docs/7_AUTH_AND_USERS.md §5 の一覧表に対応する。各認証画面では catch した
 * エラーを mapAuthError() に通してから Alert で表示する。
 *
 * UserNotConfirmedException だけは「メッセージ表示」ではなく ConfirmEmailScreen
 * への遷移トリガーとして扱うため、isUserNotConfirmedError() を別途用意。
 */
export function mapAuthError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return '予期せぬエラーが発生しました。再度お試しください。';
  }
  const name = (err as { name?: string }).name;
  const message = (err as { message?: string }).message;

  switch (name) {
    case 'UserNotConfirmedException':
      return 'メール確認が必要です。確認画面に移動します。';
    case 'NotAuthorizedException':
      return 'メールまたはパスワードが正しくありません。';
    case 'UsernameExistsException':
      return 'このメールアドレスは既に登録されています。';
    case 'InvalidPasswordException':
      return 'パスワードが要件を満たしていません (12 文字以上、英大小・数字・記号を含む)。';
    case 'CodeMismatchException':
      return '確認コードが正しくありません。';
    case 'ExpiredCodeException':
      return 'コードの有効期限が切れています。再送信してください。';
    case 'LimitExceededException':
      return '短時間に試行が多すぎます。しばらく待ってからお試しください。';
    case 'InvalidParameterException':
      return '入力内容に誤りがあります。';
    case 'NetworkError':
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    default:
      return message ?? '予期せぬエラーが発生しました。';
  }
}

export function isUserNotConfirmedError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'UserNotConfirmedException'
  );
}

export function isUserNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'UserNotFoundException'
  );
}
