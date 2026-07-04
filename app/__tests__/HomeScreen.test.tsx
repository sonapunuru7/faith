jest.mock('../src/firebase/config', () => ({ auth: { currentUser: { uid: 'alice' } } }));

jest.mock('../src/firebase/dailyVerse', () => ({
  fetchDailyVerseDoc: jest.fn(),
}));

jest.mock('../src/firebase/engagement', () => ({
  markVerseViewed: jest.fn().mockResolvedValue(undefined),
  saveJournalAnswers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/api/bibleApi', () => ({
  fetchVerseText: jest.fn(),
  BibleApiError: class BibleApiError extends Error {},
}));

jest.mock('../src/notifications/dailyReminder', () => ({
  scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { fetchDailyVerseDoc } from '../src/firebase/dailyVerse';
import { markVerseViewed, saveJournalAnswers } from '../src/firebase/engagement';
import { fetchVerseText } from '../src/api/bibleApi';
import { HomeScreen } from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  beforeEach(() => {
    (fetchDailyVerseDoc as jest.Mock).mockReset();
    (fetchVerseText as jest.Mock).mockReset();
    (markVerseViewed as jest.Mock).mockClear();
    (saveJournalAnswers as jest.Mock).mockClear();
  });

  test('shows the verse, reference, and prompts once loaded, and marks it viewed', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');

    render(<HomeScreen />);

    expect(await screen.findByText('Philippians 4:6-7')).toBeTruthy();
    expect(await screen.findByText('Do not be anxious about anything...')).toBeTruthy();
    expect(await screen.findByText('Where did you see this today?')).toBeTruthy();
    await waitFor(() => expect(markVerseViewed).toHaveBeenCalledWith('alice', expect.any(String)));
  });

  test('still shows the loaded verse when marking it viewed fails', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');
    (markVerseViewed as jest.Mock).mockRejectedValue(new Error('network blip'));

    render(<HomeScreen />);

    expect(await screen.findByText('Philippians 4:6-7')).toBeTruthy();
    expect(await screen.findByText('Do not be anxious about anything...')).toBeTruthy();
    expect(await screen.findByText('Where did you see this today?')).toBeTruthy();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('shows a fallback message when no verse is set for today', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);

    expect(await screen.findByText(/isn.t available yet/i)).toBeTruthy();
  });

  test('shows an error message if the verse text fails to load', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<HomeScreen />);

    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
  });

  test('saves reflections when the save button is pressed', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');

    render(<HomeScreen />);

    const input = await screen.findByTestId('journal-answer-0');
    fireEvent.changeText(input, 'Grateful for rest.');
    fireEvent.press(screen.getByText('Save reflections'));

    await waitFor(() =>
      expect(saveJournalAnswers).toHaveBeenCalledWith('alice', expect.any(String), {
        '0': 'Grateful for rest.',
      })
    );
  });
});
