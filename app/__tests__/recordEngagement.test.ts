jest.mock('../src/firebase/userProfile', () => ({
  fetchWellnessState: jest.fn(),
  saveWellnessState: jest.fn(),
}));

import { fetchWellnessState, saveWellnessState } from '../src/firebase/userProfile';
import { recordEngagement } from '../src/wellness/recordEngagement';

describe('recordEngagement', () => {
  test('computes the next wellness state from the stored one, saves it, and returns it', async () => {
    (fetchWellnessState as jest.Mock).mockResolvedValue({
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-03',
    });
    (saveWellnessState as jest.Mock).mockResolvedValue(undefined);

    const result = await recordEngagement('alice', '2026-07-04');

    const expectedNext = {
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 80,
      lastEngagedDate: '2026-07-04',
    };

    expect(fetchWellnessState).toHaveBeenCalledWith('alice');
    expect(saveWellnessState).toHaveBeenCalledWith('alice', expectedNext);
    expect(result).toEqual(expectedNext);
  });
});
