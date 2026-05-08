import {
  getISOWeek,
  getTimeKey,
  generateTimeRange,
  getISOWeeksInYear,
  parseTimeKey,
  shiftDateByTimeScale,
} from '../dateUtils';

describe('getISOWeek', () => {
  test('Jan 1 2024 (Mon) is week 1 of 2024', () => {
    expect(getISOWeek(new Date(Date.UTC(2024, 0, 1)))).toEqual({ year: 2024, week: 1 });
  });

  test('Jan 1 2023 (Sun) is week 52 of 2022', () => {
    expect(getISOWeek(new Date(Date.UTC(2023, 0, 1)))).toEqual({ year: 2022, week: 52 });
  });

  test('Dec 31 2026 (Thu) is week 53 of 2026', () => {
    // 2026 is a long ISO year (53 weeks)
    expect(getISOWeek(new Date(Date.UTC(2026, 11, 31)))).toEqual({ year: 2026, week: 53 });
  });
});

describe('getTimeKey', () => {
  const d = new Date(Date.UTC(2026, 4, 8)); // 2026-05-08 (Fri)

  test('year scale yields YYYY', () => {
    expect(getTimeKey(d, 'year')).toBe('2026');
  });

  test('month scale yields YYYY-MM (zero padded)', () => {
    expect(getTimeKey(d, 'month')).toBe('2026-05');
  });

  test('day scale yields YYYY-MM-DD', () => {
    expect(getTimeKey(d, 'day')).toBe('2026-05-08');
  });

  test('week scale yields YYYY-Www (zero padded)', () => {
    expect(getTimeKey(d, 'week')).toBe('2026-W19');
  });
});

describe('parseTimeKey', () => {
  test('year roundtrips through getTimeKey', () => {
    const date = parseTimeKey('2026', 'year');
    expect(date).not.toBeNull();
    expect(getTimeKey(date!, 'year')).toBe('2026');
  });

  test('invalid year returns null', () => {
    expect(parseTimeKey('not-a-year', 'year')).toBeNull();
  });

  test('day roundtrips through getTimeKey', () => {
    const date = parseTimeKey('2026-05-08', 'day');
    expect(date).not.toBeNull();
    expect(getTimeKey(date!, 'day')).toBe('2026-05-08');
  });

  test('malformed month returns null', () => {
    expect(parseTimeKey('2026-', 'month')).toBeNull();
  });

  test('malformed week returns null', () => {
    expect(parseTimeKey('2026', 'week')).toBeNull();
  });
});

describe('getISOWeeksInYear', () => {
  test('2024 has 52 ISO weeks', () => {
    expect(getISOWeeksInYear(2024)).toBe(52);
  });

  test('2026 has 53 ISO weeks (long year)', () => {
    expect(getISOWeeksInYear(2026)).toBe(53);
  });
});

describe('generateTimeRange', () => {
  test('emits 3 yearly keys for a 3-year span', () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2026, 0, 1));
    expect(generateTimeRange(start, end, 'year')).toEqual(['2024', '2025', '2026']);
  });

  test('emits unique sorted month keys across a year boundary', () => {
    const start = new Date(Date.UTC(2025, 10, 15));
    const end = new Date(Date.UTC(2026, 1, 10));
    const keys = generateTimeRange(start, end, 'month');
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  test('emits 7 daily keys for a one-week span', () => {
    const start = new Date(Date.UTC(2026, 4, 1));
    const end = new Date(Date.UTC(2026, 4, 7));
    expect(generateTimeRange(start, end, 'day')).toHaveLength(7);
  });
});

describe('shiftDateByTimeScale', () => {
  test('year shift moves date forward by 2 years preserving month/day', () => {
    const original = new Date(Date.UTC(2024, 5, 15));
    const shifted = shiftDateByTimeScale(original, '2024', '2026', 'year');
    expect(shifted.getUTCFullYear()).toBe(2026);
    expect(shifted.getUTCMonth()).toBe(5);
    expect(shifted.getUTCDate()).toBe(15);
  });

  test('returns clone of original when keys are invalid', () => {
    const original = new Date(Date.UTC(2024, 5, 15));
    const shifted = shiftDateByTimeScale(original, 'bogus', '2026', 'year');
    expect(shifted.getTime()).toBe(original.getTime());
    expect(shifted).not.toBe(original);
  });
});
