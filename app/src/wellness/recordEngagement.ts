import { fetchWellnessState, saveWellnessState } from '../firebase/userProfile';
import { computeEngagementUpdate } from './computeEngagementUpdate';
import { WellnessState } from './wellnessState';

export async function recordEngagement(uid: string, today: string): Promise<WellnessState> {
  const previous = await fetchWellnessState(uid);
  const next = computeEngagementUpdate(previous, today);
  await saveWellnessState(uid, next);
  return next;
}
