import { formatBytes, formatPercentage, muKeys } from '../hooks';

describe('formatBytes', () => {
  test('values under 1KB report bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  test('values under 1MB report KB with 1 decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  test('values under 1GB report MB with 1 decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  test('values >= 1GB report GB with 2 decimals', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
  });
});

describe('formatPercentage', () => {
  test('zero total returns "0%" without dividing', () => {
    expect(formatPercentage(5, 0)).toBe('0%');
  });

  test('returns ratio with 1 decimal place', () => {
    expect(formatPercentage(50, 200)).toBe('25.0%');
    expect(formatPercentage(1, 3)).toBe('33.3%');
  });
});

describe('muKeys', () => {
  test('all queries share the "mu" namespace prefix', () => {
    expect(muKeys.dashboard()[0]).toBe('mu');
    expect(muKeys.health()[0]).toBe('mu');
    expect(muKeys.rules()[0]).toBe('mu');
  });

  test('dashboard differentiates by organization', () => {
    expect(muKeys.dashboard('acme')).not.toEqual(muKeys.dashboard('beta'));
    expect(muKeys.dashboard()).toEqual(muKeys.dashboard(undefined));
  });

  test('rules and mappings include their params object as a stable key segment', () => {
    const rk = muKeys.rules({ task_type: 'header' });
    expect(rk).toContain('rules');
    expect(rk[rk.length - 1]).toEqual({ task_type: 'header' });
  });

  test('setupStatus is namespaced under "setup"', () => {
    expect(muKeys.setupStatus()[0]).toBe('setup');
  });
});
