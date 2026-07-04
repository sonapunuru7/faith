jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  setDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, setDoc } from 'firebase/firestore';
import { markVerseViewed, saveJournalAnswers } from '../src/firebase/engagement';

describe('markVerseViewed', () => {
  test('merges viewedVerse and a numeric completedAt into the engagement doc', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await markVerseViewed('alice', '2026-07-04');

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement', '2026-07-04');
    const [, payload, options] = (setDoc as jest.Mock).mock.calls[0];
    expect(payload.viewedVerse).toBe(true);
    expect(typeof payload.completedAt).toBe('number');
    expect(options).toEqual({ merge: true });
  });
});

describe('saveJournalAnswers', () => {
  test('merges journalAnswers into the engagement doc', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await saveJournalAnswers('alice', '2026-07-04', { '0': 'Grateful for rest.' });

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement', '2026-07-04');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'users/alice/engagement/2026-07-04' },
      { journalAnswers: { '0': 'Grateful for rest.' } },
      { merge: true }
    );
  });
});
