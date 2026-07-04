jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchWellnessState, saveWellnessState } from '../src/firebase/userProfile';
import { DEFAULT_WELLNESS_STATE } from '../src/wellness/wellnessState';

describe('fetchWellnessState', () => {
  test('returns the stored wellness fields when the profile document exists', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        currentStreak: 4,
        longestStreak: 9,
        missedDaysInARow: 0,
        wellnessScore: 75,
        lastEngagedDate: '2026-07-04',
        displayName: 'Alice',
      }),
    });

    const result = await fetchWellnessState('alice');

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice');
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 75,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('returns the default wellness state when no profile document exists yet', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await fetchWellnessState('brand-new-uid');

    expect(result).toEqual(DEFAULT_WELLNESS_STATE);
  });
});

describe('saveWellnessState', () => {
  test('merges the wellness fields into the user profile document', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const state = {
      currentStreak: 4,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 75,
      lastEngagedDate: '2026-07-04',
    };

    await saveWellnessState('alice', state);

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice');
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/alice' }, state, { merge: true });
  });
});
