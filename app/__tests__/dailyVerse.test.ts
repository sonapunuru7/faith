jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  getDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, getDoc } from 'firebase/firestore';
import { fetchDailyVerseDoc } from '../src/firebase/dailyVerse';

describe('fetchDailyVerseDoc', () => {
  test('returns the daily verse when the document exists', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        reference: 'Philippians 4:6-7',
        journalPrompts: ['Where did you see this today?'],
      }),
    });

    const result = await fetchDailyVerseDoc('2026-07-04');

    expect(doc).toHaveBeenCalledWith({}, 'dailyVerses', '2026-07-04');
    expect(result).toEqual({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
  });

  test('returns null when no document exists for that date', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await fetchDailyVerseDoc('2099-01-01');

    expect(result).toBeNull();
  });
});
