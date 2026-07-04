import { computeEngagementUpdate } from '../src/wellness/computeEngagementUpdate';
import { DEFAULT_WELLNESS_STATE, WellnessState } from '../src/wellness/wellnessState';

describe('computeEngagementUpdate', () => {
  test('a brand new user engaging for the first time starts a streak of 1', () => {
    const result = computeEngagementUpdate(DEFAULT_WELLNESS_STATE, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      missedDaysInARow: 0,
      wellnessScore: 60,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('engaging again on a day already counted is a no-op', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-04',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual(previous);
  });

  test('engaging on the very next day continues the streak and raises the score', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-03',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 80,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('missing exactly one day dips the score but does not reset the streak', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 1,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-02', // one day (07-03) was missed before today
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 75, // 70 - 5 (one missed day) + 10 (today)
      lastEngagedDate: '2026-07-04',
    });
  });

  test('missing two or more days resets the streak to 1 but keeps the longest streak', () => {
    const previous: WellnessState = {
      currentStreak: 9,
      longestStreak: 9,
      missedDaysInARow: 3,
      wellnessScore: 70,
      lastEngagedDate: '2026-06-30', // three days missed: 07-01, 07-02, 07-03
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 65, // 70 - 15 (3 missed days x 5) + 10
      lastEngagedDate: '2026-07-04',
    });
  });

  test('a very long gap never drops the score to zero in one step, because the penalty is capped', () => {
    const previous: WellnessState = {
      currentStreak: 20,
      longestStreak: 20,
      missedDaysInARow: 10,
      wellnessScore: 25,
      lastEngagedDate: '2026-06-01', // over a month missed
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result.wellnessScore).toBe(10); // penalty capped at 30, floors at 0, then +10
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(20);
  });

  test('wellness score never exceeds 100', () => {
    const previous: WellnessState = {
      currentStreak: 5,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 95,
      lastEngagedDate: '2026-07-03',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result.wellnessScore).toBe(100);
  });
});
