import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { DEFAULT_WELLNESS_STATE, WellnessState } from '../wellness/wellnessState';

export async function fetchWellnessState(uid: string): Promise<WellnessState> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    return DEFAULT_WELLNESS_STATE;
  }
  const data = snapshot.data();
  return {
    currentStreak: data.currentStreak ?? DEFAULT_WELLNESS_STATE.currentStreak,
    longestStreak: data.longestStreak ?? DEFAULT_WELLNESS_STATE.longestStreak,
    missedDaysInARow: data.missedDaysInARow ?? DEFAULT_WELLNESS_STATE.missedDaysInARow,
    wellnessScore: data.wellnessScore ?? DEFAULT_WELLNESS_STATE.wellnessScore,
    lastEngagedDate: data.lastEngagedDate ?? DEFAULT_WELLNESS_STATE.lastEngagedDate,
  };
}

export async function saveWellnessState(uid: string, state: WellnessState): Promise<void> {
  await setDoc(doc(db, 'users', uid), state, { merge: true });
}
