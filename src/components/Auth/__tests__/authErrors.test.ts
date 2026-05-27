import {
  isUserNotConfirmedError,
  isUserNotFoundError,
  mapAuthError,
} from '../authErrors';

describe('mapAuthError', () => {
  it.each([
    ['UserNotConfirmedException', /メール確認が必要/],
    ['NotAuthorizedException', /メールまたはパスワード/],
    ['UsernameExistsException', /既に登録/],
    ['InvalidPasswordException', /パスワードが要件/],
    ['CodeMismatchException', /確認コードが正しく/],
    ['ExpiredCodeException', /有効期限が切れ/],
    ['LimitExceededException', /試行が多すぎ/],
    ['InvalidParameterException', /入力内容に誤り/],
    ['NetworkError', /ネットワークエラー/],
  ])('maps %s to Japanese message', (name, pattern) => {
    expect(mapAuthError({ name })).toMatch(pattern);
  });

  it('falls back to err.message for unknown error names', () => {
    expect(mapAuthError({ name: 'WeirdError', message: 'custom msg' })).toBe('custom msg');
  });

  it('returns a generic message for non-object errors', () => {
    expect(mapAuthError(null)).toMatch(/予期せぬエラー/);
    expect(mapAuthError(undefined)).toMatch(/予期せぬエラー/);
    expect(mapAuthError('plain string')).toMatch(/予期せぬエラー/);
  });
});

describe('isUserNotConfirmedError', () => {
  it('detects UserNotConfirmedException', () => {
    expect(isUserNotConfirmedError({ name: 'UserNotConfirmedException' })).toBe(true);
  });
  it('rejects other error names', () => {
    expect(isUserNotConfirmedError({ name: 'NotAuthorizedException' })).toBe(false);
    expect(isUserNotConfirmedError(null)).toBe(false);
    expect(isUserNotConfirmedError('string')).toBe(false);
  });
});

describe('isUserNotFoundError', () => {
  it('detects UserNotFoundException', () => {
    expect(isUserNotFoundError({ name: 'UserNotFoundException' })).toBe(true);
  });
  it('rejects other error names', () => {
    expect(isUserNotFoundError({ name: 'NotAuthorizedException' })).toBe(false);
    expect(isUserNotFoundError(null)).toBe(false);
  });
});
