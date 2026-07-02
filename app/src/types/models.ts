export interface UserProfile {
  displayName: string;
  email: string;
  preferredTranslation: string;
  notificationTime: string;
  currentStreak: number;
  longestStreak: number;
  missedDaysInARow: number;
  wellnessScore: number;
  lastEngagedDate: string;
  createdAt: number;
}

export interface DailyVerse {
  reference: string;
  journalPrompts: string[];
}

export interface Engagement {
  viewedVerse: boolean;
  journalAnswers: Record<string, string>;
  completedAt: number | null;
}

export type AnnotationType = 'highlight' | 'underline' | 'circle';

export interface Annotation {
  type: AnnotationType;
  color: string;
  range: { start: number; end: number };
}

export interface JournalEntry {
  title: string;
  verseReferences: string[];
  verseText: string;
  translation: string;
  annotations: Annotation[];
  freeformNotes: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}
