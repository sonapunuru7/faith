export interface WellnessState {
  currentStreak: number;
  longestStreak: number;
  missedDaysInARow: number;
  wellnessScore: number;
  lastEngagedDate: string;
}

export const DEFAULT_WELLNESS_STATE: WellnessState = {
  currentStreak: 0,
  longestStreak: 0,
  missedDaysInARow: 0,
  wellnessScore: 50,
  lastEngagedDate: '',
};
