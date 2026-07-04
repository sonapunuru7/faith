jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ auth: { currentUser: { uid: 'alice' } } }));

jest.mock('../src/firebase/dailyVerse', () => ({
  fetchDailyVerseDoc: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/firebase/engagement', () => ({
  markVerseViewed: jest.fn().mockResolvedValue(undefined),
  saveJournalAnswers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/notifications/dailyReminder', () => ({
  scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/userProfile', () => ({
  fetchWellnessState: jest.fn().mockResolvedValue({
    currentStreak: 0,
    longestStreak: 0,
    missedDaysInARow: 0,
    wellnessScore: 50,
    lastEngagedDate: '',
  }),
  saveWellnessState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/engagementCalendar', () => ({
  fetchEngagedDatesInMonth: jest.fn().mockResolvedValue(new Set()),
}));

import { render, screen } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { RootNavigator } from '../src/navigation/RootNavigator';

describe('RootNavigator', () => {
  test('shows the sign-in screen when no user is authenticated', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(null);
      return () => {};
    });

    render(<RootNavigator />);

    expect(await screen.findByText('Sign in to Faith')).toBeTruthy();
  });

  test('shows the home screen when a user is authenticated', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback({ uid: 'alice' });
      return () => {};
    });

    render(<RootNavigator />);

    expect(await screen.findByText('Welcome to Faith')).toBeTruthy();
  });
});
