import {
  formatPasswordRequirements,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
} from '../passwordValidation';

describe('validatePasswordStrength', () => {
  it('returns no issues for a fully compliant password', () => {
    expect(validatePasswordStrength('GoodPass1!ABC')).toEqual([]);
  });

  it('flags too-short passwords', () => {
    expect(validatePasswordStrength('Aa1!')).toContain('too-short');
  });

  it('flags missing uppercase', () => {
    expect(validatePasswordStrength('lowercase1!aaa')).toContain('no-uppercase');
  });

  it('flags missing lowercase', () => {
    expect(validatePasswordStrength('UPPERCASE1!AAA')).toContain('no-lowercase');
  });

  it('flags missing number', () => {
    expect(validatePasswordStrength('NoNumberHere!ABC')).toContain('no-number');
  });

  it('flags missing symbol', () => {
    expect(validatePasswordStrength('NoSymbol123ABCD')).toContain('no-symbol');
  });

  it('exposes the minimum length constant', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });
});

describe('formatPasswordRequirements', () => {
  it('returns empty string when no issues', () => {
    expect(formatPasswordRequirements([])).toBe('');
  });
  it('joins multiple issue messages', () => {
    const msg = formatPasswordRequirements(['too-short', 'no-symbol']);
    expect(msg).toMatch(/12 文字以上/);
    expect(msg).toMatch(/記号/);
  });
});

describe('isValidEmail', () => {
  it.each(['alice@example.com', 'a.b+c@example.co.jp'])('accepts %s', (e) => {
    expect(isValidEmail(e)).toBe(true);
  });
  it.each(['', 'no-at-sign', 'space @example.com', 'noat.com'])('rejects %s', (e) => {
    expect(isValidEmail(e)).toBe(false);
  });
});
