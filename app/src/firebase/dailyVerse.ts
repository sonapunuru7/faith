import { doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import { DailyVerse } from '../types/models';

export async function fetchDailyVerseDoc(date: string): Promise<DailyVerse | null> {
  const snapshot = await getDoc(doc(db, 'dailyVerses', date));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as DailyVerse;
}
