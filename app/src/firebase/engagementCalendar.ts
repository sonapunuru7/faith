import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from './config';

// Document IDs in this subcollection are YYYY-MM-DD date strings (see Phase
// 2's engagement.ts), so a range filter on documentId() finds every doc in
// the given month — no separate date field needed, and Firestore doesn't
// require a composite index for a single inequality on one field.
export async function fetchEngagedDatesInMonth(
  uid: string,
  year: number,
  month: number
): Promise<Set<string>> {
  const monthStr = String(month).padStart(2, '0');
  const start = `${year}-${monthStr}-01`;
  const end = `${year}-${monthStr}-31`;

  const engagementRef = collection(db, 'users', uid, 'engagement');
  const monthQuery = query(
    engagementRef,
    where(documentId(), '>=', start),
    where(documentId(), '<=', end)
  );
  const snapshot = await getDocs(monthQuery);

  const engagedDates = new Set<string>();
  snapshot.forEach((docSnap: { id: string; data: () => { viewedVerse?: boolean } }) => {
    if (docSnap.data().viewedVerse) {
      engagedDates.add(docSnap.id);
    }
  });
  return engagedDates;
}
