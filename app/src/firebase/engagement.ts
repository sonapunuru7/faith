import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';

export async function markVerseViewed(uid: string, date: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'engagement', date),
    { viewedVerse: true, completedAt: Date.now() },
    { merge: true }
  );
}

export async function saveJournalAnswers(
  uid: string,
  date: string,
  journalAnswers: Record<string, string>
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'engagement', date), { journalAnswers }, { merge: true });
}
