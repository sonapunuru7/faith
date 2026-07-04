import { getTodayDateString } from '../src/utils/date';

describe('getTodayDateString', () => {
  test('formats a given date as YYYY-MM-DD using local date parts', () => {
    const date = new Date(2026, 6, 4); // July 4, 2026 (month is 0-indexed)
    expect(getTodayDateString(date)).toBe('2026-07-04');
  });

  test('zero-pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(getTodayDateString(date)).toBe('2026-01-05');
  });

  test('defaults to the current date when no argument is given', () => {
    const now = new Date();
    const expected = getTodayDateString(now);
    expect(getTodayDateString()).toBe(expected);
  });
});
