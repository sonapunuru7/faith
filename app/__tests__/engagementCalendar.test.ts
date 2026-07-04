jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { collection, where, documentId, getDocs } from 'firebase/firestore';
import { fetchEngagedDatesInMonth } from '../src/firebase/engagementCalendar';

describe('fetchEngagedDatesInMonth', () => {
  test('returns the set of dates in that month where the verse was viewed', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      forEach: (callback: (doc: { id: string; data: () => { viewedVerse: boolean } }) => void) => {
        callback({ id: '2026-07-01', data: () => ({ viewedVerse: true }) });
        callback({ id: '2026-07-02', data: () => ({ viewedVerse: false }) });
        callback({ id: '2026-07-03', data: () => ({ viewedVerse: true }) });
      },
    });

    const result = await fetchEngagedDatesInMonth('alice', 2026, 7);

    expect(collection).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement');
    expect(where).toHaveBeenCalledWith(documentId(), '>=', '2026-07-01');
    expect(where).toHaveBeenCalledWith(documentId(), '<=', '2026-07-31');
    expect(result).toEqual(new Set(['2026-07-01', '2026-07-03']));
  });

  test('zero-pads single-digit months', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ forEach: () => {} });

    await fetchEngagedDatesInMonth('alice', 2026, 1);

    expect(where).toHaveBeenCalledWith(documentId(), '>=', '2026-01-01');
    expect(where).toHaveBeenCalledWith(documentId(), '<=', '2026-01-31');
  });
});
