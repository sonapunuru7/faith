import { WellnessState } from './wellnessState';

const ENGAGE_BONUS = 10;
const MISS_PENALTY_PER_DAY = 5;
const MAX_MISS_PENALTY = 30;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function daysBetween(fromDateString: string, toDateString: string): number {
  const from = new Date(`${fromDateString}T00:00:00`);
  const to = new Date(`${toDateString}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeEngagementUpdate(previous: WellnessState, today: string): WellnessState {
  if (previous.lastEngagedDate === today) {
    return previous;
  }

  const missedDays = previous.lastEngagedDate
    ? Math.max(0, daysBetween(previous.lastEngagedDate, today) - 1)
    : 0;

  const penalty = Math.min(MAX_MISS_PENALTY, MISS_PENALTY_PER_DAY * missedDays);
  const scoreAfterMiss = Math.max(MIN_SCORE, previous.wellnessScore - penalty);
  const wellnessScore = Math.min(MAX_SCORE, scoreAfterMiss + ENGAGE_BONUS);

  const currentStreak = missedDays >= 2 ? 1 : previous.currentStreak + 1;
  const longestStreak = Math.max(previous.longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    missedDaysInARow: 0,
    wellnessScore,
    lastEngagedDate: today,
  };
}
